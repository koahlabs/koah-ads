begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

set local role service_role;

select throws_ok(
  $$ select sidequest_register_waitlist_lead(repeat('a', 64)) $$,
  'P0001',
  'The waitlist ledger has not been seeded',
  'registration is refused before the import'
);

select is(
  sidequest_seed_waitlist_leads(array[repeat('a', 64), repeat('b', 64), repeat('a', 64)]),
  2::bigint,
  'the import numbers each unique email once'
);

select is(sidequest_register_waitlist_lead(repeat('a', 64)), 1::bigint, 'an imported lead keeps its number');

select is(sidequest_register_waitlist_lead(repeat('c', 64)), 3::bigint, 'a new lead follows the imported leads');

select is(sidequest_register_waitlist_lead(repeat('c', 64)), 3::bigint, 'registering the same email again returns the same number');

select is(sidequest_register_waitlist_lead(repeat('d', 64)), 4::bigint, 'numbers have no gaps');

select is(
  sidequest_seed_waitlist_leads(array[repeat('b', 64), repeat('a', 64)]),
  4::bigint,
  'importing known emails again changes nothing'
);

select is(
  sidequest_seed_waitlist_leads(array[repeat('e', 64), repeat('f', 64), repeat('e', 64)]),
  6::bigint,
  'a repeated import appends only the missing leads'
);

select throws_ok(
  $$ select sidequest_seed_waitlist_leads(array[repeat('9', 64), 'invalid']) $$,
  'P0001',
  'Invalid lead hash',
  'the import rejects an invalid hash'
);

select is(sidequest_register_waitlist_lead(repeat('8', 64)), 7::bigint, 'a rejected import adds no leads');

select throws_ok(
  $$ select sidequest_register_waitlist_lead('not-a-hash') $$,
  'P0001',
  'Invalid lead hash',
  'registration rejects an invalid hash'
);

-- permissions

reset role;
set local role anon;

select throws_ok(
  $$ select sidequest_register_waitlist_lead(repeat('7', 64)) $$,
  '42501',
  null,
  'anon cannot register a lead'
);

select throws_ok(
  $$ select sidequest_seed_waitlist_leads(array[repeat('7', 64)]) $$,
  '42501',
  null,
  'anon cannot import leads'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select sidequest_register_waitlist_lead(repeat('7', 64)) $$,
  '42501',
  null,
  'a signed-in user cannot register a lead'
);

select throws_ok(
  $$ select email_hash from sidequest_waitlist_leads $$,
  '42501',
  null,
  'a signed-in user cannot read the lead ledger'
);

reset role;
set local role service_role;

select throws_ok(
  $$ select email_hash from sidequest_waitlist_leads $$,
  '42501',
  null,
  'even the server reads leads only through the functions'
);

select * from finish();

rollback;
