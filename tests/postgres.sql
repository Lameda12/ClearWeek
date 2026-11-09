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
