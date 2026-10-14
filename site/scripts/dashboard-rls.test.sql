-- Run only in a new disposable local PostgreSQL database. This file simulates
-- Supabase auth roles, applies the migration, and proves the access boundary.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
\ir ../supabase/migrations/202610130001_dashboard.sql

insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
set role service_role;
insert into public.sidequest_daily_earnings values ('00000000-0000-0000-0000-000000000001', (now() at time zone 'UTC')::date, 100, 1500), ('00000000-0000-0000-0000-000000000002', (now() at time zone 'UTC')::date, 999, 9999);
insert into public.sidequest_payouts (user_id, amount_cents, status) values ('00000000-0000-0000-0000-000000000001', 200, 'paid'), ('00000000-0000-0000-0000-000000000001', 100, 'pending'), ('00000000-0000-0000-0000-000000000001', 500, 'failed');
insert into public.sidequest_stripe_accounts (user_id, environment, country, account_id) values ('00000000-0000-0000-0000-000000000001', 'test', 'US', 'acct_one'), ('00000000-0000-0000-0000-000000000002', 'test', 'US', 'acct_two');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
declare dashboard jsonb;
begin
  dashboard := public.sidequest_dashboard();
  if (dashboard->>'total_impressions')::bigint <> 100 or (dashboard->>'total_earned_cents')::bigint <> 1500 then raise exception 'RPC exposed another user'; end if;
  if (dashboard->>'paid_out_cents')::bigint <> 200 or (dashboard->>'pending_payout_cents')::bigint <> 100 then raise exception 'Payout aggregation failed'; end if;
  if jsonb_array_length(dashboard->'daily') <> 1 or jsonb_array_length(dashboard->'payouts') <> 3 then raise exception 'Activity aggregation failed'; end if;
  if (select count(*) from public.sidequest_stripe_accounts) <> 1 then raise exception 'Stripe mapping RLS failed'; end if;
  if (select count(*) from public.sidequest_daily_earnings where user_id = '00000000-0000-0000-0000-000000000002') <> 0 then raise exception 'Direct read bypassed RLS'; end if;
  begin
    insert into public.sidequest_daily_earnings values ('00000000-0000-0000-0000-000000000001', current_date + 1, 100, 100000);
    raise exception 'User could fabricate earnings';
  exception when insufficient_privilege then null; end;
  begin
    update public.sidequest_stripe_accounts set account_id = 'acct_attacker';
    raise exception 'User could replace their Stripe mapping';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.sidequest_payouts;
    raise exception 'User could erase payouts';
  exception when insufficient_privilege then null; end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (public.sidequest_dashboard()->>'total_earned_cents')::bigint <> 9999 then raise exception 'Second user isolation failed'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.sidequest_dashboard(); raise exception 'Anonymous RPC access succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Dashboard aggregation and RLS checks passed' as result;
