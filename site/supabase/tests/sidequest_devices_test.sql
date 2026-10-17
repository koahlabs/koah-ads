begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (id, email, banned_until, deleted_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', null, null),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', null, null),
  ('00000000-0000-0000-0000-00000000000c', 'banned@example.com', now() + interval '1 day', null),
  ('00000000-0000-0000-0000-00000000000d', 'deleted@example.com', null, now()),
  ('00000000-0000-0000-0000-00000000000e', 'e@example.com', null, null),
  ('00000000-0000-0000-0000-00000000000f', 'f@example.com', null, null);

-- start and lookup

select sidequest_start_device(repeat('1', 64), 'BCDFGHJK', '203.0.113.1', 'Berlin', 'macos');

select is(
  (select status from sidequest_device(repeat('1', 64))),
  'pending',
  'a started device is pending'
);

select is_empty(
  $$ select * from sidequest_device(repeat('0', 64)) $$,
  'an unknown key has no row'
);

-- confirm

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(sidequest_confirm_device('BCDFGHJK'), true, 'confirm binds the pending device');

reset role;

select results_eq(
  $$ select status, email from sidequest_device(repeat('1', 64)) $$,
  $$ values ('connected', 'a@example.com') $$,
  'the confirmed device is connected to the confirming user'
);

set local role authenticated;

select is(sidequest_confirm_device('BCDFGHJK'), false, 'a code works only once');

reset role;

select ok(
  (select requested_ip is null from sidequest_devices where key_hash = repeat('1', 64)),
  'confirm clears the requested ip'
);

select results_eq(
  $$ select requested_location, os from sidequest_devices where key_hash = repeat('1', 64) $$,
  $$ values ('Berlin', 'macos') $$,
  'confirm keeps the location and os'
);

-- unknown os

select throws_ok(
  $$ select sidequest_start_device(repeat('a', 64), 'FGHJKLMN', '203.0.113.3', null, 'beos') $$,
  '23514',
  null,
  'an os outside the allowlist is rejected'
);

-- start without os

select sidequest_start_device(repeat('e', 64), 'HJKLMNPQ', '203.0.113.5', 'Oslo');

select is(
  (select os from sidequest_devices where key_hash = repeat('e', 64)),
  null,
  'a device started without an os stores none'
);

-- pending details

select sidequest_start_device(repeat('b', 64), 'GHJKLMNP', '203.0.113.4', 'Oslo', 'linux');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select os from sidequest_pending_device('GHJKLMNP', null) $$,
  $$ values ('linux') $$,
  'lookup returns the os'
);

reset role;

-- same network

select sidequest_start_device(repeat('8', 64), 'DFGHJKLM', '2001:db8:3:1::1', null, null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select same_network from sidequest_pending_device('DFGHJKLM', '2001:db8:3:1:ffff::2') $$,
  $$ values (true) $$,
  'addresses in the same IPv6 /64 are the same network'
);

select results_eq(
  $$ select same_network from sidequest_pending_device('DFGHJKLM', '2001:db8:3:2::1') $$,
  $$ values (false) $$,
  'addresses in different IPv6 /64 prefixes are different networks'
);

reset role;

-- expired codes

select sidequest_start_device(repeat('2', 64), 'CDFGHJKL', '203.0.113.2', null, null);
update sidequest_devices set expires_at = now() - interval '1 minute' where key_hash = repeat('2', 64);

set local role authenticated;

select is_empty(
  $$ select * from sidequest_pending_device('CDFGHJKL', null) $$,
  'an expired code is not found by lookup'
);

select is(sidequest_confirm_device('CDFGHJKL'), false, 'an expired code cannot be confirmed');

reset role;

select is_empty(
  $$ select * from sidequest_device(repeat('2', 64)) $$,
  'an expired pending device is not reported'
);

-- banned and deleted users

insert into sidequest_devices (key_hash, user_id) values
  (repeat('3', 64), '00000000-0000-0000-0000-00000000000c'),
  (repeat('4', 64), '00000000-0000-0000-0000-00000000000d');

select is(
  (select status from sidequest_device(repeat('3', 64))),
  'banned',
  'a device of a banned user is banned'
);

select is(
  (select status from sidequest_device(repeat('4', 64))),
  'banned',
  'a device of a soft-deleted user is banned'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select throws_ok(
  $$ select * from sidequest_pending_device('BCDFGHJK', null) $$,
  'P0403',
  null,
  'a banned user cannot look up a code'
);

select throws_ok(
  $$ select sidequest_confirm_device('BCDFGHJK') $$,
  'P0403',
  null,
  'a banned user cannot confirm a code'
);

-- failure limit

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';

do $$
begin
  for i in 1..10 loop
    perform * from public.sidequest_pending_device('BBBBBBBB', null);
  end loop;
end
$$;

select throws_ok(
  $$ select * from sidequest_pending_device('BBBBBBBB', null) $$,
  'P0429',
  null,
  'the 11th failed lookup in an hour is rejected'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';

select is_empty(
  $$ select * from sidequest_pending_device('BBBBBBBB', null) $$,
  'failures of one user do not limit another user'
);

reset role;

-- pending cap

select sidequest_start_device(
  md5(n::text) || md5(n::text || 'k'),
  translate(lpad(n::text, 8, '0'), '0123456789', 'BCDFGHJKLM'),
  '198.51.100.7',
  null,
  null
) from generate_series(1000, 1009) n;

select throws_ok(
  $$ select sidequest_start_device(repeat('5', 64), 'BBBBBBBB', '198.51.100.7', null, null) $$,
  'P0429',
  null,
  'an IPv4 address is limited to 10 pending devices'
);

select sidequest_start_device(
  md5(n::text) || md5(n::text || 'k'),
  translate(lpad(n::text, 8, '0'), '0123456789', 'BCDFGHJKLM'),
  ('2001:db8:1:1::' || (n - 1999))::inet,
  null,
  null
) from generate_series(2000, 2009) n;

select throws_ok(
  $$ select sidequest_start_device(repeat('6', 64), 'BBBBBBBC', '2001:db8:1:1:ffff::1', null, null) $$,
  'P0429',
  null,
  'addresses in the same IPv6 /64 share the pending cap'
);

select lives_ok(
  $$ select sidequest_start_device(repeat('7', 64), 'BBBBBBBD', '2001:db8:1:2::1', null, null) $$,
  'a different IPv6 /64 has its own pending cap'
);

-- daily cap

insert into sidequest_devices (key_hash, user_id) values
  (repeat('9', 64), '00000000-0000-0000-0000-00000000000b');

insert into sidequest_daily_usage (user_id, day, ad_requests) values
  ('00000000-0000-0000-0000-00000000000a', (now() at time zone 'utc')::date, 498);

select is(
  array[
    (select status from sidequest_take_ad_request(repeat('1', 64))),
    (select status from sidequest_take_ad_request(repeat('1', 64))),
    (select status from sidequest_take_ad_request(repeat('1', 64)))
  ],
  array['connected', 'connected', 'over_limit'],
  'the daily cap allows 500 requests and rejects the next'
);

select is(
  (select status from sidequest_take_ad_request(repeat('9', 64))),
  'connected',
  'the daily cap of one user does not limit another user'
);

select ok(
  (select last_request_at is not null from sidequest_devices where key_hash = repeat('9', 64)),
  'taking an ad request records the device last request time'
);

select is(
  (select status from sidequest_take_ad_request(repeat('3', 64))),
  'banned',
  'a banned user cannot take an ad request'
);

select ok(
  (select last_request_at is null from sidequest_devices where key_hash = repeat('3', 64)),
  'a banned request does not record a last request time'
);

select is_empty(
  $$ select * from sidequest_take_ad_request(repeat('0', 64)) $$,
  'an unknown key cannot take an ad request'
);

-- permissions

select is(
  (select bool_or(has_function_privilege(r, f, 'execute'))
   from unnest(array['anon', 'authenticated']) r,
        unnest(array[
          'public.sidequest_start_device(text, text, inet, text, text)',
          'public.sidequest_device(text)',
          'public.sidequest_take_ad_request(text)',
          'public.sidequest_check_caller(uuid)'
        ]) f),
  false,
  'anon and authenticated cannot call the service-only functions'
);

set local role authenticated;

select is_empty(
  $$ select * from public.sidequest_devices $$,
  'authenticated cannot read the devices table'
);

reset role;

select * from finish();

rollback;
