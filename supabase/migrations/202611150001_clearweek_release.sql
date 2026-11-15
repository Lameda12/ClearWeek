-- DRAFT FOR REVIEW. Not applied to any database.
--
-- Problem: every Gemini attempt reserves a ledger row before the call, and a failed attempt keeps it.
-- Twenty failures (for example during a provider outage) use up the lifetime allowance for good,
-- and five in a day switch Gemini off until tomorrow, even though nothing was spent.
--
-- Change: a reservation can be released when the provider answered with an error (those are not billed).
-- A released row
--   * stays in the table as a record of the attempt,
--   * no longer counts toward the lifetime allowance, the spend cap or the 5-per-24-hours limit,
--   * still counts toward the 1-per-minute limit, so a failing provider is not called in a tight loop.
-- Attempts that timed out, or whose answer was unusable, are never released: they may have been billed.
--
-- Safe to apply before or after the application change: the column is nullable, the reserve function
-- keeps its signature, and the application treats a missing release function as "keep the reservation".

alter table public.clearweek_ai_requests add column released_at timestamptz;

create or replace function public.clearweek_reserve(p_id uuid, p_owner uuid, p_key text, p_micros integer,
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
    from public.clearweek_ai_requests where released_at is null;
  if used_count >= p_max_requests or used_micros + p_micros > p_cap_micros
    -- Released rows still count here: one provider call a minute at most, whatever happened to the last one.
    or exists (select 1 from public.clearweek_ai_requests where created_at > now() - interval '1 minute')
    or (select count(*) from public.clearweek_ai_requests
        where released_at is null and created_at > now() - interval '24 hours') >= 5
  then return jsonb_build_object('allowed', false); end if;

  insert into public.clearweek_ai_requests(id, owner, cache_key, reserved_micros)
    values (p_id, p_owner, p_key, p_micros);
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.clearweek_reserve(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.clearweek_reserve(uuid, uuid, text, integer, integer, integer) to service_role;

-- Releases one reservation of this owner. Only a row with no saved suggestion can be released, and only once.
-- Returns whether a row was released.
create function public.clearweek_release(p_id uuid, p_owner uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.clearweek_ai_requests set released_at = pg_catalog.now()
    where id = p_id and owner = p_owner and suggestion is null and released_at is null;
  return found;
end;
$$;
revoke all on function public.clearweek_release(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clearweek_release(uuid, uuid) to service_role;
