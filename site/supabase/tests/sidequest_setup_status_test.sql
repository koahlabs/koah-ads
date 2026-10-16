begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

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
  '{"connected": false, "hasQueries": false}'::jsonb,
  'a user with no device and no usage has neither'
);

-- connected device

reset role;

insert into sidequest_devices (key_hash, user_id) values (repeat('a', 64), '00000000-0000-0000-0000-00000000000a');

set local role authenticated;

select is(
  sidequest_setup_status(),
  '{"connected": true, "hasQueries": false}'::jsonb,
  'a confirmed device makes the user connected'
);

-- usage

reset role;

insert into sidequest_daily_usage (user_id, day, ad_requests) values ('00000000-0000-0000-0000-00000000000a', current_date, 1);

set local role authenticated;

select is(
  sidequest_setup_status(),
  '{"connected": true, "hasQueries": true}'::jsonb,
  'a usage row makes hasQueries true'
);

-- isolation

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  sidequest_setup_status(),
  '{"connected": false, "hasQueries": false}'::jsonb,
  'rows of another user do not count'
);

reset role;

select * from finish();

rollback;
