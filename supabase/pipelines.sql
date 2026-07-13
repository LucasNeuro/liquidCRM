-- =============================================================================
-- Funis e estágios customizáveis (LIQUI)
-- Cole no SQL Editor do Supabase (depois do schema principal)
-- =============================================================================

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  color text default '#f7941d',
  created_at timestamptz not null default now(),
  unique (pipeline_id, name)
);

alter table public.leads
  add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null,
  add column if not exists stage_id uuid references public.pipeline_stages(id) on delete set null;

create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages(pipeline_id, position);
create index if not exists idx_leads_pipeline on public.leads(pipeline_id);
create index if not exists idx_leads_stage on public.leads(stage_id);

alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;

drop policy if exists pipelines_all_auth on public.pipelines;
create policy pipelines_all_auth on public.pipelines
  for all to authenticated using (true) with check (true);
drop policy if exists pipelines_select_anon on public.pipelines;
create policy pipelines_select_anon on public.pipelines for select to anon using (true);

drop policy if exists stages_all_auth on public.pipeline_stages;
create policy stages_all_auth on public.pipeline_stages
  for all to authenticated using (true) with check (true);
drop policy if exists stages_select_anon on public.pipeline_stages;
create policy stages_select_anon on public.pipeline_stages for select to anon using (true);

-- Seed funil padrão (só se vazio)
do $$
declare
  pid uuid;
begin
  if not exists (select 1 from public.pipelines) then
    insert into public.pipelines (name, is_default)
    values ('Leads', true)
    returning id into pid;

    insert into public.pipeline_stages (pipeline_id, name, position, color) values
      (pid, 'Novo', 0, '#94a3b8'),
      (pid, 'Em contato', 1, '#3b82f6'),
      (pid, 'Qualificado', 2, '#f7941d'),
      (pid, 'Ganho', 3, '#22c55e'),
      (pid, 'Perdido', 4, '#ef4444');

    update public.leads l
    set
      pipeline_id = pid,
      stage_id = s.id
    from public.pipeline_stages s
    where s.pipeline_id = pid
      and s.name = coalesce(l.status, 'Novo');
  end if;
end $$;
