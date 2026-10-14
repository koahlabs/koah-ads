-- Seed the ledger from the existing Loops waitlist before enabling the counter.
-- The ledger stores email hashes, not email addresses. Only the server can use it.
begin;

create table public.sidequest_waitlist_counter (
  id integer primary key check (id = 1),
  value bigint not null default 0 check (value >= 0),
  initialized boolean not null default false
);
insert into public.sidequest_waitlist_counter (id) values (1);

create table public.sidequest_waitlist_leads (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  lead_number bigint not null unique check (lead_number > 0)
);

alter table public.sidequest_waitlist_counter enable row level security;
alter table public.sidequest_waitlist_leads enable row level security;
revoke all on public.sidequest_waitlist_counter, public.sidequest_waitlist_leads from public, anon, authenticated, service_role;

-- The singleton lock serializes different leads and duplicate requests across
-- server instances. Retrying the same email returns its existing number.
create function public.sidequest_register_waitlist_lead(p_email_hash text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare ready boolean; assigned bigint;
begin
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid lead hash'; end if;
  select initialized into ready from public.sidequest_waitlist_counter where id = 1 for update;
  if ready is distinct from true then raise exception 'The waitlist ledger has not been seeded'; end if;
  select lead_number into assigned from public.sidequest_waitlist_leads where email_hash = p_email_hash;
  if assigned is not null then return assigned; end if;
  update public.sidequest_waitlist_counter set value = value + 1 where id = 1 returning value into assigned;
  insert into public.sidequest_waitlist_leads (email_hash, lead_number) values (p_email_hash, assigned);
  return assigned;
end;
$$;

-- The setup script orders the existing waitlist by first join date and email.
-- Re-running the import appends missing leads without renumbering known leads.
create function public.sidequest_seed_waitlist_leads(p_email_hashes text[]) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare email_hash_to_seed text; assigned bigint;
begin
  if p_email_hashes is null or cardinality(p_email_hashes) > 100000 then raise exception 'Invalid waitlist seed'; end if;
  perform 1 from public.sidequest_waitlist_counter where id = 1 for update;
  foreach email_hash_to_seed in array p_email_hashes loop
    if email_hash_to_seed is null or email_hash_to_seed !~ '^[a-f0-9]{64}$' then raise exception 'Invalid lead hash'; end if;
    if not exists (select 1 from public.sidequest_waitlist_leads where email_hash = email_hash_to_seed) then
      update public.sidequest_waitlist_counter set value = value + 1 where id = 1 returning value into assigned;
      insert into public.sidequest_waitlist_leads (email_hash, lead_number) values (email_hash_to_seed, assigned);
    end if;
  end loop;
  update public.sidequest_waitlist_counter set initialized = true where id = 1 returning value into assigned;
  return assigned;
end;
$$;

revoke all on function public.sidequest_register_waitlist_lead(text) from public, anon, authenticated;
revoke all on function public.sidequest_seed_waitlist_leads(text[]) from public, anon, authenticated;
grant execute on function public.sidequest_register_waitlist_lead(text) to service_role;
grant execute on function public.sidequest_seed_waitlist_leads(text[]) to service_role;

commit;
