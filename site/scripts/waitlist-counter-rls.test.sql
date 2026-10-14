-- Run only in an empty disposable local PostgreSQL database.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
\ir ../supabase/migrations/202610130002_waitlist_lead_numbers.sql

set role service_role;
do $$
declare assigned bigint;
begin
  begin
    perform public.sidequest_register_waitlist_lead(repeat('a', 64));
    raise exception 'An unseeded counter assigned a lead number';
  exception when raise_exception then
    if sqlerrm <> 'The waitlist ledger has not been seeded' then raise; end if;
  end;
  assigned := public.sidequest_seed_waitlist_leads(array[repeat('a',64), repeat('b',64), repeat('a',64)]);
  if assigned <> 2 then raise exception 'Existing leads were not deduplicated'; end if;
  if public.sidequest_register_waitlist_lead(repeat('a',64)) <> 1 then raise exception 'An existing lead was renumbered'; end if;
  if public.sidequest_register_waitlist_lead(repeat('c',64)) <> 3 then raise exception 'A new lead did not follow the existing total'; end if;
  if public.sidequest_register_waitlist_lead(repeat('c',64)) <> 3 then raise exception 'A retry incremented the counter'; end if;
  if public.sidequest_seed_waitlist_leads(array[repeat('b',64),repeat('a',64)]) <> 3 then raise exception 'A repeated import changed the total'; end if;
  begin
    perform public.sidequest_seed_waitlist_leads(array[repeat('d',64),'invalid']);
    raise exception 'An invalid seed was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid lead hash' then raise; end if;
  end;
  if public.sidequest_register_waitlist_lead(repeat('d',64)) <> 4 then raise exception 'The invalid seed was not rolled back'; end if;
end $$;
reset role;

set role anon;
do $$ begin
  begin perform public.sidequest_register_waitlist_lead(repeat('e',64)); raise exception 'Anonymous counter access succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.sidequest_seed_waitlist_leads(array[repeat('e',64)]); raise exception 'Anonymous import access succeeded'; exception when insufficient_privilege then null; end;
  begin perform value from public.sidequest_waitlist_counter; raise exception 'Anonymous counter read succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform public.sidequest_register_waitlist_lead(repeat('e',64)); raise exception 'User counter access succeeded'; exception when insufficient_privilege then null; end;
  begin perform email_hash from public.sidequest_waitlist_leads; raise exception 'User lead read succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Waitlist lead numbers, retries, import, and access checks passed' as result;
