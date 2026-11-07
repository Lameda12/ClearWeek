create table public.clearweek_actions (
  owner uuid not null references auth.users(id) on delete cascade,
  conflict_id text not null check (conflict_id = 'bus:shift'),
  kind text not null check (kind in ('approve', 'resolve')),
  proposal_version uuid,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, conflict_id, kind),
  check ((kind = 'approve') = (proposal_version is not null))
);
alter table public.clearweek_actions enable row level security;
revoke all on public.clearweek_actions from anon, authenticated;
grant select on public.clearweek_actions to authenticated;
grant select, insert on public.clearweek_actions to service_role;
create policy "Read own actions" on public.clearweek_actions
  for select to authenticated using ((select auth.uid()) = owner);

create table public.clearweek_ai_requests (
  id uuid primary key,
  owner uuid not null references auth.users(id),
  cache_key text not null,
  reserved_micros integer not null check (reserved_micros > 0),
  created_at timestamptz not null default now(),
  suggestion jsonb,
  input_tokens integer,
  output_tokens integer,
  estimated_micros integer
);
alter table public.clearweek_ai_requests enable row level security;
revoke all on public.clearweek_ai_requests from anon, authenticated;
grant select, update on public.clearweek_ai_requests to service_role;

create function public.clearweek_reserve(p_id uuid, p_owner uuid, p_key text, p_micros integer,
  p_max_requests integer, p_cap_micros integer)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  cached jsonb;
  used_count bigint;
  used_micros bigint;
begin
  -- Serialize reservations across owners and instances for this project.
  perform pg_catalog.pg_advisory_xact_lock(37487193);
  select suggestion into cached from public.clearweek_ai_requests
    where owner = p_owner and cache_key = p_key and suggestion is not null limit 1;
  if cached is not null then return jsonb_build_object('cached', cached); end if;

  select count(*), coalesce(sum(reserved_micros), 0) into used_count, used_micros
    from public.clearweek_ai_requests;
  if used_count >= p_max_requests or used_micros + p_micros > p_cap_micros
    or exists (select 1 from public.clearweek_ai_requests where created_at > now() - interval '1 minute')
    or (select count(*) from public.clearweek_ai_requests where created_at > now() - interval '24 hours') >= 5
  then return jsonb_build_object('allowed', false); end if;

  insert into public.clearweek_ai_requests(id, owner, cache_key, reserved_micros)
    values (p_id, p_owner, p_key, p_micros);
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.clearweek_reserve(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.clearweek_reserve(uuid, uuid, text, integer, integer, integer) to service_role;
