-- ============================================================================
-- NewsSearch — Supabase schema, RLS policies and retention.
-- Paste this whole file into: Supabase Dashboard -> SQL Editor -> New query,
-- then Run. Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One analysis request. Minimal retention: expires 30 days after creation and
-- only the newest 50 rows per user are kept (see triggers below).
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('text', 'url')),
  input_text text not null default '',
  input_url text,
  source_title text,
  ml_available boolean not null default false,
  ml_label text check (ml_label in ('REAL', 'FAKE')),
  ml_probability real,
  ml_features jsonb,
  ml_model_version text,
  keywords jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  ai_explanation text,
  ai_summary text,
  providers_used jsonb not null default '[]'::jsonb,
  providers_failed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);
create index if not exists analyses_expires_idx
  on public.analyses (expires_at) where expires_at is not null;

-- In-app notifications (created by the background ingestion job).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'evidence_match',
  title text not null,
  body text not null default '',
  analysis_id uuid references public.analyses(id) on delete set null,
  evidence_url text,
  evidence_provider text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Shared evidence ingested from fact-check feeds (service-role writes only).
create table if not exists public.evidence_pool (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  provider text not null,
  kind text not null check (kind in ('factcheck', 'news')),
  title text not null,
  url text not null,
  snippet text,
  published_at timestamptz,
  source jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now()
);

create index if not exists evidence_pool_ingested_idx
  on public.evidence_pool (ingested_at desc);

-- ---------------------------------------------------------------------------
-- Lock down privileges: no anon/authenticated access by default.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.analyses, public.notifications, public.evidence_pool from anon;
revoke all on table public.profiles, public.analyses, public.notifications, public.evidence_pool from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.analyses to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select on public.evidence_pool to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only ever touch their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.notifications enable row level security;
alter table public.evidence_pool enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists analyses_select_own on public.analyses;
create policy analyses_select_own on public.analyses
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists analyses_insert_own on public.analyses;
create policy analyses_insert_own on public.analyses
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists analyses_delete_own on public.analyses;
create policy analyses_delete_own on public.analyses
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Authenticated users may read the shared evidence pool; nobody else can.
drop policy if exists evidence_pool_read_authenticated on public.evidence_pool;
create policy evidence_pool_read_authenticated on public.evidence_pool
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Retention: minimal history.
--   1) every analysis/notification gets a 30-day expiry on insert;
--   2) inserting an analysis trims that user's history to the newest 50;
--   3) purge_expired_documents() removes expired rows (daily service job).
-- ---------------------------------------------------------------------------
create or replace function public.set_newssearch_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists analyses_set_expiry on public.analyses;
create trigger analyses_set_expiry
before insert on public.analyses
for each row execute function public.set_newssearch_expiry();

drop trigger if exists notifications_set_expiry on public.notifications;
create trigger notifications_set_expiry
before insert on public.notifications
for each row execute function public.set_newssearch_expiry();

create or replace function public.trim_user_analyses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.analyses
  where user_id = new.user_id
    and id not in (
      select id from public.analyses
      where user_id = new.user_id
      order by created_at desc
      limit 50
    );
  return new;
end;
$$;

drop trigger if exists analyses_trim_history on public.analyses;
create trigger analyses_trim_history
after insert on public.analyses
for each row execute function public.trim_user_analyses();

create or replace function public.purge_expired_documents(batch_size integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
  deleted_analyses integer;
  deleted_notifications integer;
  deleted_evidence integer;
begin
  with expired as (
    select id from public.analyses
    where expires_at is not null and expires_at < now()
    order by expires_at
    limit greatest(batch_size, 1)
  )
  delete from public.analyses a using expired e where a.id = e.id;
  get diagnostics deleted_analyses = row_count;

  with expired as (
    select id from public.notifications
    where expires_at is not null and expires_at < now()
    order by expires_at
    limit greatest(batch_size, 1)
  )
  delete from public.notifications n using expired e where n.id = e.id;
  get diagnostics deleted_notifications = row_count;

  delete from public.evidence_pool
  where ingested_at < now() - interval '120 days';
  get diagnostics deleted_evidence = row_count;

  deleted := deleted_analyses + deleted_notifications + deleted_evidence;
  return deleted;
end;
$$;

revoke all on function public.purge_expired_documents(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_documents(integer) to service_role;
-- ============================================================================
-- NewsSearch migration 002: search-based verdict, language, shareable links.
-- Run in Supabase SQL Editor after schema.sql. Safe to re-run.
-- ============================================================================

alter table public.analyses add column if not exists evidence_verdict jsonb;
alter table public.analyses add column if not exists lang text not null default 'en';

-- Share links: a frozen snapshot of one analysis. Only the owner can create,
-- see or delete their share rows. Signed-in viewers open a link through the
-- API, which looks the token up server-side (tokens are never listable).
create table if not exists public.shared_analyses (
  token text primary key,
  analysis_id uuid not null unique references public.analyses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

revoke all on table public.shared_analyses from anon, authenticated;
grant select, insert, delete on public.shared_analyses to authenticated;
alter table public.shared_analyses enable row level security;

drop policy if exists shared_select_own on public.shared_analyses;
create policy shared_select_own on public.shared_analyses for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);
drop policy if exists shared_insert_own on public.shared_analyses;
create policy shared_insert_own on public.shared_analyses for insert to authenticated
  with check (
    (select auth.uid()) is not null and (select auth.uid()) = owner_id
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid()))
  );
drop policy if exists shared_delete_own on public.shared_analyses;
create policy shared_delete_own on public.shared_analyses for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

notify pgrst, 'reload schema';
