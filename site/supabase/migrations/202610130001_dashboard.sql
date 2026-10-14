-- Run against the same Supabase project used for sign-in.
-- Only the trusted ad/revenue pipeline may write earnings and payout records.
-- Browser sessions can read their own records, but cannot create credits.
begin;

create table public.sidequest_daily_earnings (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  impressions bigint not null default 0 check (impressions >= 0),
  earned_cents bigint not null default 0 check (earned_cents >= 0),
  primary key (user_id, date)
);

create table public.sidequest_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('pending', 'paid', 'failed')),
  provider_reference text unique
);
create index sidequest_payouts_user_date on public.sidequest_payouts (user_id, date desc);

create table public.sidequest_stripe_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Use a separate namespace for each Stripe sandbox and for live mode.
  environment text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  provisioning_key uuid not null default gen_random_uuid(),
  account_id text check (account_id ~ '^acct_[a-zA-Z0-9]+$'),
  created_at timestamptz not null default now(),
  primary key (user_id, environment),
  unique (environment, account_id)
);

alter table public.sidequest_daily_earnings enable row level security;
alter table public.sidequest_payouts enable row level security;
alter table public.sidequest_stripe_accounts enable row level security;

revoke all on public.sidequest_daily_earnings, public.sidequest_payouts, public.sidequest_stripe_accounts from anon, authenticated;
grant select on public.sidequest_daily_earnings, public.sidequest_payouts, public.sidequest_stripe_accounts to authenticated;
grant all on public.sidequest_daily_earnings, public.sidequest_payouts, public.sidequest_stripe_accounts to service_role;

create policy "Read own earnings" on public.sidequest_daily_earnings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own payouts" on public.sidequest_payouts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own Stripe connection" on public.sidequest_stripe_accounts for select to authenticated using ((select auth.uid()) = user_id);

-- SECURITY INVOKER preserves RLS; callers cannot select another user's totals.
create function public.sidequest_dashboard() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'as_of', (now() at time zone 'UTC')::date,
    'total_impressions', coalesce((select sum(impressions) from public.sidequest_daily_earnings where user_id = (select auth.uid())), 0),
    'total_earned_cents', coalesce((select sum(earned_cents) from public.sidequest_daily_earnings where user_id = (select auth.uid())), 0),
    'paid_out_cents', coalesce((select sum(amount_cents) from public.sidequest_payouts where user_id = (select auth.uid()) and status = 'paid'), 0),
    'pending_payout_cents', coalesce((select sum(amount_cents) from public.sidequest_payouts where user_id = (select auth.uid()) and status = 'pending'), 0),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', date, 'impressions', impressions, 'earned_cents', earned_cents) order by date)
      from public.sidequest_daily_earnings
      where user_id = (select auth.uid()) and date between (now() at time zone 'UTC')::date - 89 and (now() at time zone 'UTC')::date
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'amount_cents', amount_cents, 'status', status) order by date desc, id)
      from (select id, date, amount_cents, status from public.sidequest_payouts where user_id = (select auth.uid()) order by date desc, id limit 10) recent
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.sidequest_dashboard() from public, anon;
grant execute on function public.sidequest_dashboard() to authenticated;

commit;
