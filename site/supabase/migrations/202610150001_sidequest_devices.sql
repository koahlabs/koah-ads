create table public.sidequest_devices (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users (id) on delete cascade,
  user_code text unique check (user_code ~ '^[BCDFGHJKLMNPQRSTVWXZ]{8}$'),
  requested_ip inet,
  requested_location text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  check (
    (user_id is null and user_code is not null and requested_ip is not null)
    or (user_id is not null and user_code is null)
  )
);

create table public.sidequest_connect_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  failed_at timestamptz not null default now()
);

create table public.sidequest_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  ad_requests integer not null default 0,
  primary key (user_id, day)
);

create index on public.sidequest_devices (expires_at) where user_id is null;
create index on public.sidequest_connect_failures (user_id, failed_at);

alter table public.sidequest_devices enable row level security;
alter table public.sidequest_connect_failures enable row level security;
alter table public.sidequest_daily_usage enable row level security;

create function public.sidequest_network(p_ip inet)
returns cidr
language sql
immutable
set search_path = ''
as $$
  select network(set_masklen(p_ip, case when family(p_ip) = 6 then 64 else 32 end));
$$;

create function public.sidequest_suspended(p_user auth.users)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_user.banned_until > now(), false) or p_user.deleted_at is not null;
$$;

create function public.sidequest_check_caller(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if (select count(*) from public.sidequest_connect_failures f
      where f.user_id = p_user_id and f.failed_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts' using errcode = 'P0429';
  end if;
  if exists (select 1 from auth.users u where u.id = p_user_id and public.sidequest_suspended(u)) then
    raise exception 'account suspended' using errcode = 'P0403';
  end if;
end;
$$;

create function public.sidequest_start_device(p_key_hash text, p_user_code text, p_ip inet, p_location text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix cidr := public.sidequest_network(p_ip);
  v_expires_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_prefix::text, 0));

  delete from public.sidequest_devices d
    where d.user_id is null and d.expires_at <= now();
  delete from public.sidequest_connect_failures f
    where f.failed_at <= now() - interval '1 hour';

  if (
    select count(*) from public.sidequest_devices d
    where d.user_id is null
      and public.sidequest_network(d.requested_ip) = v_prefix
  ) >= 10 then
    raise exception 'too many pending connections' using errcode = 'P0429';
  end if;

  insert into public.sidequest_devices (key_hash, user_code, requested_ip, requested_location)
    values (p_key_hash, p_user_code, p_ip, p_location)
    returning expires_at into v_expires_at;
  return v_expires_at;
end;
$$;

create function public.sidequest_device(p_key_hash text)
returns table (status text, user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when d.user_id is null then 'pending'
      when public.sidequest_suspended(u) then 'banned'
      else 'connected'
    end::text,
    d.user_id,
    u.email::text
  from public.sidequest_devices d
  left join auth.users u on u.id = d.user_id
  where d.key_hash = p_key_hash
    and (d.user_id is not null or d.expires_at > now());
$$;

create function public.sidequest_pending_device(p_user_code text, p_visitor_ip inet)
returns table (requested_ip inet, requested_location text, created_at timestamptz, same_network boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform public.sidequest_check_caller(v_user_id);

  return query
    select
      d.requested_ip,
      d.requested_location,
      d.created_at,
      coalesce(public.sidequest_network(d.requested_ip) = public.sidequest_network(p_visitor_ip), false)
    from public.sidequest_devices d
    where d.user_code = p_user_code
      and d.user_id is null
      and d.expires_at > now();

  if not found then
    insert into public.sidequest_connect_failures (user_id) values (v_user_id);
  end if;
end;
$$;

create function public.sidequest_confirm_device(p_user_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_connected boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform public.sidequest_check_caller(v_user_id);

  update public.sidequest_devices d
    set user_id = v_user_id, user_code = null, requested_ip = null, requested_location = null
    where d.user_code = p_user_code
      and d.user_id is null
      and d.expires_at > now();

  v_connected := found;
  if not v_connected then
    insert into public.sidequest_connect_failures (user_id) values (v_user_id);
  end if;
  return v_connected;
end;
$$;

create function public.sidequest_take_ad_request(p_key_hash text)
returns table (status text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_suspended boolean;
  v_taken boolean;
begin
  select d.user_id, public.sidequest_suspended(u) into v_user_id, v_suspended
    from public.sidequest_devices d
    join auth.users u on u.id = d.user_id
    where d.key_hash = p_key_hash;
  if not found then
    return;
  end if;
  if v_suspended then
    return query select 'banned', v_user_id;
    return;
  end if;

  -- Well above a heavy human day of Claude Code answers.
  insert into public.sidequest_daily_usage as u (user_id, day, ad_requests)
    values (v_user_id, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set ad_requests = u.ad_requests + 1
      where u.ad_requests < 500;
  v_taken := found;
  return query select case when v_taken then 'connected' else 'over_limit' end, v_user_id;
end;
$$;

revoke execute on function public.sidequest_network(inet) from public, anon, authenticated, service_role;
revoke execute on function public.sidequest_suspended(auth.users) from public, anon, authenticated, service_role;
revoke execute on function public.sidequest_check_caller(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.sidequest_start_device(text, text, inet, text) from public, anon, authenticated;
revoke execute on function public.sidequest_device(text) from public, anon, authenticated;
revoke execute on function public.sidequest_take_ad_request(text) from public, anon, authenticated;
revoke execute on function public.sidequest_pending_device(text, inet) from public, anon;
revoke execute on function public.sidequest_confirm_device(text) from public, anon;

grant execute on function public.sidequest_start_device(text, text, inet, text) to service_role;
grant execute on function public.sidequest_device(text) to service_role;
grant execute on function public.sidequest_take_ad_request(text) to service_role;
