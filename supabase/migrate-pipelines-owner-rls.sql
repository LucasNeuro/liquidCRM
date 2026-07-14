-- Funis/estágios: leitura para autenticados; escrita só owner
-- Rode no SQL Editor do Supabase após migrate-plataforma.sql

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'owner'
      and coalesce(p.active, true) = true
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;

-- Remove políticas permissivas antigas (escrevia qualquer authenticated)
drop policy if exists pipelines_all_auth on public.pipelines;
drop policy if exists stages_all_auth on public.pipeline_stages;
drop policy if exists pipelines_select_auth on public.pipelines;
drop policy if exists pipelines_write_owner on public.pipelines;
drop policy if exists stages_select_auth on public.pipeline_stages;
drop policy if exists stages_write_owner on public.pipeline_stages;

create policy pipelines_select_auth on public.pipelines
  for select to authenticated
  using (true);

create policy pipelines_write_owner on public.pipelines
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create policy stages_select_auth on public.pipeline_stages
  for select to authenticated
  using (true);

create policy stages_write_owner on public.pipeline_stages
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- Mantém select anon se já existia (seed/preview)
drop policy if exists pipelines_select_anon on public.pipelines;
create policy pipelines_select_anon on public.pipelines
  for select to anon using (true);

drop policy if exists stages_select_anon on public.pipeline_stages;
create policy stages_select_anon on public.pipeline_stages
  for select to anon using (true);
