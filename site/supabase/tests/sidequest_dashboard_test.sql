begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.com');

insert into sidequest_payouts (user_id, amount_cents, status) values
  ('00000000-0000-0000-0000-00000000000a', 200, 'paid'),
  ('00000000-0000-0000-0000-00000000000a', 100, 'pending'),
  ('00000000-0000-0000-0000-00000000000a', 500, 'failed'),
  ('00000000-0000-0000-0000-00000000000b', 900, 'paid');

insert into sidequest_payouts (user_id, day, amount_cents, status)
select '00000000-0000-0000-0000-00000000000d', date '2026-10-01' + n, 100, 'paid'
from generate_series(0, 10) n;

insert into sidequest_stripe_accounts (user_id, environment, country, account_id) values
  ('00000000-0000-0000-0000-00000000000a', 'test', 'US', 'acct_one'),
  ('00000000-0000-0000-0000-00000000000b', 'test', 'US', 'acct_two');

-- own payouts

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (sidequest_dashboard() - 'payouts'),
  '{"paid_out_cents": 200, "pending_payout_cents": 100}'::jsonb,
  'the dashboard totals count only paid and pending payouts of the signed-in user'
);

select is(jsonb_array_length(sidequest_dashboard() -> 'payouts'), 3, 'the dashboard lists every payout status of the signed-in user');

-- isolation

select is(
  (select count(*)::int from sidequest_stripe_accounts),
  1,
  'a user reads only their own Stripe connection'
);

select is_empty(
  $$ select * from sidequest_payouts where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'a user cannot read the payouts of another user'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  (sidequest_dashboard() ->> 'paid_out_cents')::int,
  900,
  'a second user sees only their own totals'
);

-- writes

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ update sidequest_stripe_accounts set account_id = 'acct_attacker' $$,
  '42501',
  null,
  'a user cannot replace their Stripe connection'
);

select throws_ok(
  $$ delete from sidequest_payouts $$,
  '42501',
  null,
  'a user cannot erase payouts'
);

select throws_ok(
  $$ insert into sidequest_payouts (user_id, amount_cents, status) values ('00000000-0000-0000-0000-00000000000a', 100, 'paid') $$,
  '42501',
  null,
  'a user cannot create payouts'
);

select throws_ok(
  $$ insert into sidequest_stripe_accounts (user_id, environment, country) values ('00000000-0000-0000-0000-00000000000a', 'live', 'US') $$,
  '42501',
  null,
  'a user cannot create a Stripe connection'
);

-- anonymous access

reset role;
set local role anon;

select throws_ok(
  $$ select sidequest_dashboard() $$,
  '42501',
  null,
  'anon cannot call the dashboard function'
);

select throws_ok(
  $$ select * from sidequest_payouts $$,
  '42501',
  null,
  'anon cannot read payouts'
);

-- no payouts

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is(
  sidequest_dashboard(),
  '{"paid_out_cents": 0, "pending_payout_cents": 0, "payouts": []}'::jsonb,
  'a user without payouts sees zero totals and an empty list'
);

-- payout list limit

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';

select is(jsonb_array_length(sidequest_dashboard() -> 'payouts'), 10, 'the dashboard lists at most 10 payouts');

select is(
  sidequest_dashboard() -> 'payouts' -> 0 ->> 'date',
  '2026-10-11',
  'the dashboard lists the newest payout first'
);

reset role;

select * from finish();

rollback;
