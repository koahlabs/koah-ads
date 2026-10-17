alter table public.sidequest_devices
  add column last_request_at timestamptz,
  add column os text check (os in ('macos', 'linux', 'windows'));

create or replace function public.sidequest_take_ad_request(p_key_hash text)
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

  update public.sidequest_devices d set last_request_at = now() where d.key_hash = p_key_hash;

  -- Well above a heavy human day of Claude Code answers.
  insert into public.sidequest_daily_usage as u (user_id, day, ad_requests)
    values (v_user_id, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set ad_requests = u.ad_requests + 1
      where u.ad_requests < 500;
  v_taken := found;
  return query select case when v_taken then 'connected' else 'over_limit' end, v_user_id;
end;
$$;


drop function public.sidequest_start_device(text, text, inet, text);

create function public.sidequest_start_device(p_key_hash text, p_user_code text, p_ip inet, p_location text, p_os text default null)
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

  insert into public.sidequest_devices (key_hash, user_code, requested_ip, requested_location, os)
    values (p_key_hash, p_user_code, p_ip, p_location, p_os)
    returning expires_at into v_expires_at;
  return v_expires_at;
end;
$$;

drop function public.sidequest_pending_device(text, inet);

create function public.sidequest_pending_device(p_user_code text, p_visitor_ip inet)
returns table (requested_ip inet, requested_location text, os text, created_at timestamptz, same_network boolean)
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
      d.os,
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

create or replace function public.sidequest_confirm_device(p_user_code text)
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
    set user_id = v_user_id, user_code = null, requested_ip = null
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

-- The setup wizard and dashboard read the user's own devices; the tables stay closed to the browser.
create function public.sidequest_setup_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'hasQueries', exists (select 1 from public.sidequest_daily_usage where user_id = (select auth.uid())),
    'devices', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'connectedAt', d.created_at,
          'lastRequestAt', d.last_request_at,
          'location', d.requested_location,
          'os', d.os
        ) order by d.created_at
      ) from public.sidequest_devices d where d.user_id = (select auth.uid())),
      '[]'::jsonb
    )
  );
$$;

create index on public.sidequest_devices (user_id) where user_id is not null;

revoke execute on function public.sidequest_start_device(text, text, inet, text, text) from public, anon, authenticated;
revoke execute on function public.sidequest_pending_device(text, inet) from public, anon;
revoke all on function public.sidequest_setup_status() from public, anon;

grant execute on function public.sidequest_start_device(text, text, inet, text, text) to service_role;
grant execute on function public.sidequest_setup_status() to authenticated;
