-- Seed the ledger from the existing Loops waitlist before registering new leads.
-- The ledger stores email hashes, not email addresses. Only the server can use it.

create table public.sidequest_waitlist_leads (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  lead_number bigint not null unique check (lead_number > 0)
);

alter table public.sidequest_waitlist_leads enable row level security;
revoke all on public.sidequest_waitlist_leads from public, anon, authenticated, service_role;

-- The advisory lock serializes different leads across server instances.
-- Retrying the same email returns its existing number without taking the lock.
create function public.sidequest_register_waitlist_lead(p_email_hash text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare assigned bigint;
begin
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid lead hash'; end if;
  select lead_number into assigned from public.sidequest_waitlist_leads where email_hash = p_email_hash;
  if assigned is not null then return assigned; end if;
  perform pg_advisory_xact_lock(hashtext('sidequest_waitlist_leads'));
  select max(lead_number) into assigned from public.sidequest_waitlist_leads;
  if assigned is null then raise exception 'The waitlist ledger has not been seeded'; end if;
  -- A concurrent request for the same email may have inserted it while this one waited.
  insert into public.sidequest_waitlist_leads (email_hash, lead_number) values (p_email_hash, assigned + 1)
  on conflict (email_hash) do update set email_hash = excluded.email_hash
  returning lead_number into assigned;
  return assigned;
end;
$$;

-- The setup script orders the existing waitlist by first join date and email.
-- Re-running the import appends missing leads without renumbering known leads.
create function public.sidequest_seed_waitlist_leads(p_email_hashes text[]) returns bigint
language plpgsql security definer set search_path = ''
as $$
begin
  if p_email_hashes is null or cardinality(p_email_hashes) > 100000 then raise exception 'Invalid waitlist seed'; end if;
  if exists (select 1 from unnest(p_email_hashes) as hash where hash is null or hash !~ '^[a-f0-9]{64}$') then raise exception 'Invalid lead hash'; end if;
  perform pg_advisory_xact_lock(hashtext('sidequest_waitlist_leads'));
  insert into public.sidequest_waitlist_leads (email_hash, lead_number)
  select hash, (select coalesce(max(lead_number), 0) from public.sidequest_waitlist_leads) + row_number() over (order by first_position)
  from (select hash, min(position) as first_position from unnest(p_email_hashes) with ordinality as seed(hash, position) group by hash) as firsts
  where not exists (select 1 from public.sidequest_waitlist_leads as known where known.email_hash = firsts.hash);
  return (select coalesce(max(lead_number), 0) from public.sidequest_waitlist_leads);
end;
$$;

revoke all on function public.sidequest_register_waitlist_lead(text) from public, anon, authenticated;
revoke all on function public.sidequest_seed_waitlist_leads(text[]) from public, anon, authenticated;
grant execute on function public.sidequest_register_waitlist_lead(text) to service_role;
grant execute on function public.sidequest_seed_waitlist_leads(text[]) to service_role;
