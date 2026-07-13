-- Preferencial: use supabase/upgrade-robusto.sql (absorve este arquivo).
-- =============================================================================
-- LIQUI — Negócios vinculados a leads (N:1) + funil kind
-- Cole no SQL Editor após migrate-auxiliares.sql / pipelines
-- =============================================================================

-- Kind no funil: leads | negocios
alter table public.pipelines
  add column if not exists kind text not null default 'leads';

alter table public.pipelines
  drop constraint if exists pipelines_kind_check;
alter table public.pipelines
  add constraint pipelines_kind_check check (kind in ('leads', 'negocios'));

update public.pipelines set kind = 'leads' where kind is null or kind = '';

-- Tabela negócios
create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  titulo text not null,
  id_lead integer not null references public.leads(id_lead) on delete cascade,
  valor numeric(12, 2) not null default 0,
  status_negocio text not null default 'aberto',
  pipeline_id uuid references public.pipelines(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint negocios_status_check check (
    status_negocio in ('aberto', 'ganho', 'perdido')
  )
);

create index if not exists idx_negocios_lead on public.negocios(id_lead);
create index if not exists idx_negocios_pipeline on public.negocios(pipeline_id);
create index if not exists idx_negocios_stage on public.negocios(stage_id);
create index if not exists idx_pipelines_kind on public.pipelines(kind);

create or replace function public.touch_negocio_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_negocios_updated on public.negocios;
create trigger trg_negocios_updated
  before update on public.negocios
  for each row execute function public.touch_negocio_updated_at();

create or replace function public.next_negocio_codigo()
returns text
language plpgsql
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n int;
begin
  select count(*) + 1 into n from public.negocios
  where codigo like 'NEG-' || yr || '-%';
  return 'NEG-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

alter table public.negocios enable row level security;

drop policy if exists negocios_all_auth on public.negocios;
create policy negocios_all_auth on public.negocios
  for all to authenticated using (true) with check (true);
drop policy if exists negocios_select_anon on public.negocios;
create policy negocios_select_anon on public.negocios for select to anon using (true);

-- Seed funil de negócios
do $$
declare
  pid uuid;
begin
  if not exists (select 1 from public.pipelines where kind = 'negocios') then
    insert into public.pipelines (name, is_default, kind)
    values ('Negócios', true, 'negocios')
    returning id into pid;

    insert into public.pipeline_stages (pipeline_id, name, position, color) values
      (pid, 'Novos', 0, '#94a3b8'),
      (pid, 'Qualificando', 1, '#3b82f6'),
      (pid, 'Qualificado', 2, '#f7941d'),
      (pid, 'Proposta', 3, '#a855f7'),
      (pid, 'Ganho', 4, '#22c55e'),
      (pid, 'Perdido', 5, '#ef4444');
  end if;
end $$;

-- Seed demo: 1 negócio por alguns leads (só se tabela vazia)
do $$
declare
  pid uuid;
  sid uuid;
  lid integer;
  i int := 0;
begin
  if exists (select 1 from public.negocios limit 1) then
    return;
  end if;

  select id into pid from public.pipelines where kind = 'negocios' and is_default limit 1;
  if pid is null then
    select id into pid from public.pipelines where kind = 'negocios' limit 1;
  end if;
  if pid is null then return; end if;

  select id into sid from public.pipeline_stages
  where pipeline_id = pid order by position limit 1;

  for lid in
    select id_lead from public.leads order by id_lead limit 8
  loop
    i := i + 1;
    insert into public.negocios (codigo, titulo, id_lead, valor, pipeline_id, stage_id, status_negocio)
    values (
      'NEG-' || to_char(now(), 'YYYY') || '-' || lpad(i::text, 4, '0'),
      'Oportunidade · lead #' || lid,
      lid,
      (1000 + i * 437)::numeric,
      pid,
      sid,
      'aberto'
    );
  end loop;
end $$;
