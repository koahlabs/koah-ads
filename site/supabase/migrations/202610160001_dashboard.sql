-- Only the trusted payout pipeline may write payout records.
-- Browser sessions can read their own records, but cannot create payouts.
-- Koah owns earnings; the site reads them from the Koah API.

create table public.sidequest_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('pending', 'paid', 'failed')),
  provider_reference text unique
);
create index sidequest_payouts_user_day on public.sidequest_payouts (user_id, day desc);

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

alter table public.sidequest_payouts enable row level security;
alter table public.sidequest_stripe_accounts enable row level security;

revoke all on public.sidequest_payouts, public.sidequest_stripe_accounts from anon, authenticated;
grant select on public.sidequest_payouts, public.sidequest_stripe_accounts to authenticated;
grant all on public.sidequest_payouts, public.sidequest_stripe_accounts to service_role;

create policy "Read own payouts" on public.sidequest_payouts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own Stripe connection" on public.sidequest_stripe_accounts for select to authenticated using ((select auth.uid()) = user_id);

-- SECURITY INVOKER preserves RLS; callers cannot select another user's payouts.
create function public.sidequest_dashboard() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'paid_out_cents', coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
    'pending_payout_cents', coalesce(sum(amount_cents) filter (where status = 'pending'), 0),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'date', day, 'amount_cents', amount_cents, 'status', status) order by day desc, id)
      from (select id, day, amount_cents, status from public.sidequest_payouts where user_id = (select auth.uid()) order by day desc, id limit 10) recent
    ), '[]'::jsonb)
  )
  from public.sidequest_payouts
  where user_id = (select auth.uid());
$$;
revoke all on function public.sidequest_dashboard() from public, anon;
grant execute on function public.sidequest_dashboard() to authenticated;
