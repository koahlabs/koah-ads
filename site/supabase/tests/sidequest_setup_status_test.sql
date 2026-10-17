begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- anonymous access

set local role anon;

select throws_ok(
  $$ select sidequest_setup_status() $$,
  '42501',
  null,
  'anon cannot call the setup status function'
);

-- nothing yet

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  sidequest_setup_status(),
  '{"hasQueries": false, "devices": []}'::jsonb,
  'a user with no device and no usage has neither'
);

-- connected device

reset role;

insert into sidequest_devices (key_hash, user_id, created_at, last_request_at) values
  (repeat('a', 64), '00000000-0000-0000-0000-00000000000a', '2026-10-16 10:00:00+00', '2026-10-16 11:00:00+00'),
  (repeat('d', 64), '00000000-0000-0000-0000-00000000000a', '2026-10-15 10:00:00+00', null);

set local role authenticated;

select is(
  sidequest_setup_status() -> 'hasQueries',
  'false'::jsonb,
  'confirmed devices alone do not set hasQueries'
);

select results_eq(
  $$ select
       (d ->> 'connectedAt')::timestamptz,
       (d ->> 'lastRequestAt')::timestamptz
     from jsonb_array_elements(sidequest_setup_status() -> 'devices') d $$,
  $$ values
       ('2026-10-15 10:00:00+00'::timestamptz, null::timestamptz),
       ('2026-10-16 10:00:00+00'::timestamptz, '2026-10-16 11:00:00+00'::timestamptz) $$,
  'confirmed devices are listed by connection time with their last request'
);

-- usage

reset role;

insert into sidequest_daily_usage (user_id, day, ad_requests) values ('00000000-0000-0000-0000-00000000000a', current_date, 1);

set local role authenticated;

select is(
  sidequest_setup_status() -> 'hasQueries',
  'true'::jsonb,
  'a usage row makes hasQueries true'
);

-- isolation

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  sidequest_setup_status(),
  '{"hasQueries": false, "devices": []}'::jsonb,
  'rows of another user do not count'
);

reset role;

select * from finish();

rollback;
