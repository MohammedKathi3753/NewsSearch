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
