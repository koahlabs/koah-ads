alter table public.sidequest_devices add column last_request_at timestamptz;

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

-- The setup wizard and dashboard read the user's own devices; the tables stay closed to the browser.
create or replace function public.sidequest_setup_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'hasQueries', exists (select 1 from public.sidequest_daily_usage where user_id = (select auth.uid())),
    'devices', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'connectedAt', d.created_at,
          'lastRequestAt', d.last_request_at
        ) order by d.created_at
      ) from public.sidequest_devices d where d.user_id = (select auth.uid())),
      '[]'::jsonb
    )
  );
$$;
