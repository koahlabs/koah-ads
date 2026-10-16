-- The setup wizard reads two booleans; the device and usage tables stay closed to the browser.
create function public.sidequest_setup_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'connected', exists (select 1 from public.sidequest_devices where user_id = (select auth.uid())),
    'hasQueries', exists (select 1 from public.sidequest_daily_usage where user_id = (select auth.uid()))
  );
$$;
revoke all on function public.sidequest_setup_status() from public, anon;
grant execute on function public.sidequest_setup_status() to authenticated;
