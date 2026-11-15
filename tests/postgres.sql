\set ON_ERROR_STOP on
-- Run against a fresh disposable PostgreSQL database, never a hosted project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
\ir ../supabase/migrations/202611070001_clearweek.sql
\ir ../supabase/migrations/202611150001_clearweek_release.sql
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');

set role service_role;
insert into public.clearweek_actions values (
  '00000000-0000-0000-0000-000000000001', 'bus:shift', 'approve',
  '10000000-0000-0000-0000-000000000001', '{}', now()
);
insert into public.clearweek_actions values (
  '00000000-0000-0000-0000-000000000001', 'bus:shift', 'approve',
  '10000000-0000-0000-0000-000000000002', '{}', now()
) on conflict (owner, conflict_id, kind) do nothing;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  request_id uuid := '20000000-0000-0000-0000-000000000001';
  blocked_id uuid := '20000000-0000-0000-0000-000000000002';
begin
  if (select count(*) from public.clearweek_actions) <> 1 then raise exception 'Duplicate approval'; end if;
  if public.clearweek_reserve(request_id, owner_id, 'scenario', 5000, 20, 4999) <> '{"allowed":false}' then raise exception 'Cap failed'; end if;
  if public.clearweek_reserve(request_id, owner_id, 'scenario', 5000, 20, 4000000) <> '{"allowed":true}' then raise exception 'Reservation failed'; end if;
  if public.clearweek_reserve(blocked_id, owner_id, 'scenario', 5000, 20, 4000000) <> '{"allowed":false}' then raise exception 'Rate limit failed'; end if;
  if public.clearweek_reserve(blocked_id, owner_id, 'scenario', 5000, 1, 4000000) <> '{"allowed":false}' then raise exception 'Allowance failed'; end if;
  update public.clearweek_ai_requests set suggestion = '{"framing":"coverage","details":["swap"]}' where id = request_id;
  if not (public.clearweek_reserve(blocked_id, owner_id, 'scenario', 5000, 1, 4000000) ? 'cached') then raise exception 'Cache failed'; end if;
end
$$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  if exists (select 1 from public.clearweek_actions) then raise exception 'Cross-owner read'; end if;
  if has_table_privilege(current_user, 'public.clearweek_actions', 'INSERT') then raise exception 'Browser can insert'; end if;
  if has_function_privilege(current_user, 'public.clearweek_reserve(uuid,uuid,text,integer,integer,integer)', 'EXECUTE') then raise exception 'Browser can reserve'; end if;
  if has_function_privilege(current_user, 'public.clearweek_release(uuid,uuid)', 'EXECUTE') then raise exception 'Browser can release'; end if;
end
$$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.clearweek_actions) <> 1 then raise exception 'Owner cannot read'; end if;
end $$;

-- A plain insert of a second approval must fail with unique_violation (SQLSTATE 23505); the API maps this to HTTP 409.
set role service_role;
do $$
begin
  insert into public.clearweek_actions values (
    '00000000-0000-0000-0000-000000000001', 'bus:shift', 'approve',
    '10000000-0000-0000-0000-000000000003', '{}', now()
  );
  raise exception 'Second approval was accepted';
exception when unique_violation then null;
end
$$;

-- Releasing a failed reservation: it stops counting toward the lifetime, spend and daily limits,
-- still counts toward the per-minute limit, and cannot be done twice, by another owner, or to a successful call.
do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  other_id uuid := '00000000-0000-0000-0000-000000000002';
  done_id uuid := '20000000-0000-0000-0000-000000000001';
  failed_id uuid := '20000000-0000-0000-0000-000000000003';
  next_id uuid := '20000000-0000-0000-0000-000000000004';
begin
  update public.clearweek_ai_requests set created_at = now() - interval '2 minutes';
  if public.clearweek_reserve(failed_id, owner_id, 'other-key', 5000, 20, 4000000) <> '{"allowed":true}' then raise exception 'Second reservation failed'; end if;
  if public.clearweek_release(failed_id, other_id) then raise exception 'Another owner released a reservation'; end if;
  if public.clearweek_release(done_id, owner_id) then raise exception 'A successful call was released'; end if;
  if not public.clearweek_release(failed_id, owner_id) then raise exception 'Release failed'; end if;
  if public.clearweek_release(failed_id, owner_id) then raise exception 'Released twice'; end if;
  if (select count(*) from public.clearweek_ai_requests) <> 2 then raise exception 'Released row was not kept'; end if;
  -- Within the same minute the provider may still not be called again.
  if public.clearweek_reserve(next_id, owner_id, 'other-key', 5000, 20, 4000000) <> '{"allowed":false}' then raise exception 'Per-minute limit ignored a released row'; end if;
  update public.clearweek_ai_requests set created_at = now() - interval '2 minutes';
  -- One live row exists. An allowance of 2 and a cap of 10000 micros each leave room for exactly one more
  -- only if the released row is not counted.
  if public.clearweek_reserve(next_id, owner_id, 'other-key', 5000, 2, 10000) <> '{"allowed":true}' then raise exception 'Released row still counts toward the allowance or cap'; end if;
end
$$;

-- The daily limit ignores released rows too: five released attempts today do not block a sixth.
do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  attempt uuid;
begin
  for n in 1..5 loop
    update public.clearweek_ai_requests set created_at = now() - interval '2 minutes' where created_at > now() - interval '1 minute';
    attempt := ('30000000-0000-0000-0000-00000000000' || n)::uuid;
    -- Rows 1 to 3 fit under the daily limit of 5 alongside the two live rows; release each so the next can follow.
    if public.clearweek_reserve(attempt, owner_id, 'daily-key', 5000, 20, 4000000) <> '{"allowed":true}' then raise exception 'Daily limit counted released rows at attempt %', n; end if;
    if not public.clearweek_release(attempt, owner_id) then raise exception 'Release % failed', n; end if;
  end loop;
end
$$;
