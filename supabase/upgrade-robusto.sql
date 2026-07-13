-- =============================================================================
-- LIQUI — UPGRADE ROBUSTO (um arquivo só)
-- =============================================================================
-- Parte do schema do enunciado que você JÁ TEM (não dropa dados):
--   leads · tentativas_compra · respostas_pesquisa · classifications · profiles
--
-- E completa para TODA a aplicação:
--   pipelines · pipeline_stages · lead_insights · negocios
--   FKs id_lead · backfill · RLS · views · seeds de funil
--
-- Como usar: cole TUDO no SQL Editor do Supabase → Run
-- Seguro rodar mais de uma vez (idempotente).
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- A) NÚCLEO DO ENUNCIADO — garantir tabelas/colunas (sem DROP)
-- =============================================================================

create table if not exists public.leads (
  id_lead integer primary key,
  nome varchar not null,
  email varchar,
  telefone varchar,
  origem varchar,
  produto_interesse varchar,
  status varchar,
  data_entrada varchar,
  score_gemini integer,
  intent_gemini text,
  labels_gemini text[] default '{}',
  created_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists score_gemini integer,
  add column if not exists intent_gemini text,
  add column if not exists labels_gemini text[] default '{}',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tentativas_compra (
  id serial primary key,
  nome varchar not null,
  email varchar,
  telefone varchar,
  produto varchar,
  valor numeric,
  forma_pagamento varchar,
  status_pagamento varchar,
  data_tentativa varchar,
  id_lead integer references public.leads(id_lead) on delete set null
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tentativas_compra'
      and column_name = 'id_lead'
  ) then
    alter table public.tentativas_compra
      add column id_lead integer references public.leads(id_lead) on delete set null;
  end if;
end $$;

create table if not exists public.respostas_pesquisa (
  id serial primary key,
  nome varchar not null,
  email varchar,
  telefone varchar,
  momento_compra varchar,
  principal_objecao varchar,
  area_interesse varchar,
  nota_intencao integer,
  data_resposta varchar,
  id_lead integer references public.leads(id_lead) on delete set null
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'respostas_pesquisa'
      and column_name = 'id_lead'
  ) then
    alter table public.respostas_pesquisa
      add column id_lead integer references public.leads(id_lead) on delete set null;
  end if;
end $$;

create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  id_lead integer references public.leads(id_lead) on delete cascade,
  source_text text not null,
  intent text,
  sentiment text,
  labels text[] default '{}',
  confidence numeric,
  score integer,
  model_name text not null default 'gemini',
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'consultor',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- B) FUNIS (Kanban leads + Kanban negócios)
-- =============================================================================

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  kind text not null default 'leads',
  created_at timestamptz not null default now()
);

alter table public.pipelines
  add column if not exists kind text not null default 'leads';

alter table public.pipelines drop constraint if exists pipelines_kind_check;
alter table public.pipelines
  add constraint pipelines_kind_check check (kind in ('leads', 'negocios'));

update public.pipelines set kind = 'leads' where coalesce(kind, '') = '';

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

-- =============================================================================
-- C) INSIGHTS GEMINI (histórico por lead)
-- =============================================================================

create table if not exists public.lead_insights (
  id uuid primary key default gen_random_uuid(),
  id_lead integer not null references public.leads(id_lead) on delete cascade,
  resumo text not null,
  proximo_passo text not null,
  riscos text[] default '{}',
  evidencias text[] default '{}',
  model_name text not null default 'gemini',
  raw_response jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- D) NEGÓCIOS (N por lead)
-- =============================================================================

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
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'negocios_status_check'
  ) then
    alter table public.negocios
      add constraint negocios_status_check
      check (status_negocio in ('aberto', 'ganho', 'perdido'));
  end if;
end $$;

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

create or replace function public.touch_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated
  before update on public.leads
  for each row execute function public.touch_lead_updated_at();

-- =============================================================================
-- E) ÍNDICES
-- =============================================================================

create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_origem on public.leads(origem);
create index if not exists idx_leads_pipeline on public.leads(pipeline_id);
create index if not exists idx_leads_stage on public.leads(stage_id);

create index if not exists idx_tentativas_id_lead on public.tentativas_compra(id_lead);
create index if not exists idx_tentativas_email on public.tentativas_compra(email);
create index if not exists idx_tentativas_status on public.tentativas_compra(status_pagamento);

create index if not exists idx_respostas_id_lead on public.respostas_pesquisa(id_lead);
create index if not exists idx_respostas_email on public.respostas_pesquisa(email);

create index if not exists idx_classifications_lead on public.classifications(id_lead);
create index if not exists idx_lead_insights_lead on public.lead_insights(id_lead, created_at desc);

create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages(pipeline_id, position);
create index if not exists idx_pipelines_kind on public.pipelines(kind);

create index if not exists idx_negocios_lead on public.negocios(id_lead);
create index if not exists idx_negocios_pipeline on public.negocios(pipeline_id);
create index if not exists idx_negocios_stage on public.negocios(stage_id);
create index if not exists idx_negocios_status on public.negocios(status_negocio);

-- =============================================================================
-- F) HELPERS + BACKFILL id_lead (inconsistências do Sheets)
-- =============================================================================

create or replace function public.norm_email(v text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(v, ''))), '');
$$;

create or replace function public.norm_phone_tail(v text)
returns text
language sql
immutable
as $$
  select case
    when length(digits) >= 8 then right(digits, 8)
    else nullif(digits, '')
  end
  from (select regexp_replace(coalesce(v, ''), '\D', '', 'g') as digits) s;
$$;

create or replace function public.link_auxiliares_to_leads()
returns table (tentativas_linked int, respostas_linked int)
language plpgsql
as $$
declare
  t_count int := 0;
  r_count int := 0;
  n int := 0;
begin
  update public.tentativas_compra t
  set id_lead = l.id_lead
  from public.leads l
  where t.id_lead is null
    and public.norm_email(t.email) is not null
    and public.norm_email(t.email) = public.norm_email(l.email);
  get diagnostics n = row_count;
  t_count := t_count + n;

  update public.respostas_pesquisa r
  set id_lead = l.id_lead
  from public.leads l
  where r.id_lead is null
    and public.norm_email(r.email) is not null
    and public.norm_email(r.email) = public.norm_email(l.email);
  get diagnostics n = row_count;
  r_count := r_count + n;

  update public.tentativas_compra t
  set id_lead = l.id_lead
  from public.leads l
  where t.id_lead is null
    and public.norm_phone_tail(t.telefone) is not null
    and public.norm_phone_tail(t.telefone) = public.norm_phone_tail(l.telefone);
  get diagnostics n = row_count;
  t_count := t_count + n;

  update public.respostas_pesquisa r
  set id_lead = l.id_lead
  from public.leads l
  where r.id_lead is null
    and public.norm_phone_tail(r.telefone) is not null
    and public.norm_phone_tail(r.telefone) = public.norm_phone_tail(l.telefone);
  get diagnostics n = row_count;
  r_count := r_count + n;

  update public.tentativas_compra t
  set id_lead = l.id_lead
  from public.leads l
  where t.id_lead is null
    and lower(trim(t.nome)) = lower(trim(l.nome));
  get diagnostics n = row_count;
  t_count := t_count + n;

  update public.respostas_pesquisa r
  set id_lead = l.id_lead
  from public.leads l
  where r.id_lead is null
    and lower(trim(r.nome)) = lower(trim(l.nome));
  get diagnostics n = row_count;
  r_count := r_count + n;

  return query select t_count, r_count;
end;
$$;

select * from public.link_auxiliares_to_leads();

-- =============================================================================
-- G) SEED FUNIS (só se vazios)
-- =============================================================================

do $$
declare
  pid uuid;
begin
  if not exists (select 1 from public.pipelines where kind = 'leads') then
    insert into public.pipelines (name, is_default, kind)
    values ('Leads', true, 'leads')
    returning id into pid;

    insert into public.pipeline_stages (pipeline_id, name, position, color) values
      (pid, 'Novo', 0, '#94a3b8'),
      (pid, 'Em contato', 1, '#3b82f6'),
      (pid, 'Qualificado', 2, '#f7941d'),
      (pid, 'Ganho', 3, '#22c55e'),
      (pid, 'Perdido', 4, '#ef4444');

    update public.leads l
    set pipeline_id = pid, stage_id = s.id
    from public.pipeline_stages s
    where s.pipeline_id = pid
      and s.name = coalesce(l.status, 'Novo')
      and l.pipeline_id is null;
  else
    -- vincular leads ainda sem stage ao funil default de leads
    select id into pid
    from public.pipelines
    where kind = 'leads' and is_default
    limit 1;

    if pid is null then
      select id into pid from public.pipelines where kind = 'leads' limit 1;
    end if;

    if pid is not null then
      update public.leads l
      set
        pipeline_id = coalesce(l.pipeline_id, pid),
        stage_id = coalesce(
          l.stage_id,
          (select s.id from public.pipeline_stages s
           where s.pipeline_id = pid and s.name = coalesce(l.status, 'Novo')
           limit 1)
        )
      where l.pipeline_id is null or l.stage_id is null;
    end if;
  end if;
end $$;

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

-- Seed demo de negócios (só se tabela vazia)
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

  select id into pid from public.pipelines
  where kind = 'negocios' and is_default limit 1;
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
    insert into public.negocios (
      codigo, titulo, id_lead, valor, pipeline_id, stage_id, status_negocio
    ) values (
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

-- =============================================================================
-- H) RLS
-- =============================================================================

alter table public.leads enable row level security;
alter table public.tentativas_compra enable row level security;
alter table public.respostas_pesquisa enable row level security;
alter table public.classifications enable row level security;
alter table public.profiles enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_insights enable row level security;
alter table public.negocios enable row level security;

drop policy if exists leads_all_auth on public.leads;
create policy leads_all_auth on public.leads for all to authenticated using (true) with check (true);
drop policy if exists tentativas_all_auth on public.tentativas_compra;
create policy tentativas_all_auth on public.tentativas_compra for all to authenticated using (true) with check (true);
drop policy if exists respostas_all_auth on public.respostas_pesquisa;
create policy respostas_all_auth on public.respostas_pesquisa for all to authenticated using (true) with check (true);
drop policy if exists classifications_all_auth on public.classifications;
create policy classifications_all_auth on public.classifications for all to authenticated using (true) with check (true);
drop policy if exists lead_insights_all_auth on public.lead_insights;
create policy lead_insights_all_auth on public.lead_insights for all to authenticated using (true) with check (true);
drop policy if exists pipelines_all_auth on public.pipelines;
create policy pipelines_all_auth on public.pipelines for all to authenticated using (true) with check (true);
drop policy if exists stages_all_auth on public.pipeline_stages;
create policy stages_all_auth on public.pipeline_stages for all to authenticated using (true) with check (true);
drop policy if exists negocios_all_auth on public.negocios;
create policy negocios_all_auth on public.negocios for all to authenticated using (true) with check (true);
drop policy if exists profiles_select_auth on public.profiles;
create policy profiles_select_auth on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists leads_select_anon on public.leads;
create policy leads_select_anon on public.leads for select to anon using (true);
drop policy if exists tentativas_select_anon on public.tentativas_compra;
create policy tentativas_select_anon on public.tentativas_compra for select to anon using (true);
drop policy if exists respostas_select_anon on public.respostas_pesquisa;
create policy respostas_select_anon on public.respostas_pesquisa for select to anon using (true);
drop policy if exists pipelines_select_anon on public.pipelines;
create policy pipelines_select_anon on public.pipelines for select to anon using (true);
drop policy if exists stages_select_anon on public.pipeline_stages;
create policy stages_select_anon on public.pipeline_stages for select to anon using (true);
drop policy if exists negocios_select_anon on public.negocios;
create policy negocios_select_anon on public.negocios for select to anon using (true);

-- =============================================================================
-- I) VIEWS DE CHECAGEM
-- =============================================================================

create or replace view public.v_crm_resumo as
select
  (select count(*) from public.leads) as total_leads,
  (select count(*) from public.tentativas_compra) as total_tentativas,
  (select count(*) from public.respostas_pesquisa) as total_respostas,
  (select count(*) from public.leads where status = 'Novo') as leads_novos,
  (select count(*) from public.leads where status = 'Ganho') as leads_ganhos,
  (select count(*) from public.tentativas_compra where status_pagamento = 'aprovado') as pagamentos_aprovados,
  (select count(*) from public.tentativas_compra where status_pagamento = 'abandonado') as pagamentos_abandonados,
  (select count(*) from public.tentativas_compra where id_lead is not null) as tentativas_com_lead,
  (select count(*) from public.respostas_pesquisa where id_lead is not null) as respostas_com_lead,
  (select count(*) from public.classifications) as total_classifications,
  (select count(*) from public.lead_insights) as total_insights,
  (select count(*) from public.negocios) as total_negocios,
  (select count(*) from public.negocios where status_negocio = 'aberto') as negocios_abertos,
  (select coalesce(sum(valor), 0) from public.negocios where status_negocio = 'aberto') as pipeline_valor_aberto,
  (select count(*) from public.pipelines where kind = 'leads') as funis_leads,
  (select count(*) from public.pipelines where kind = 'negocios') as funis_negocios;

create or replace view public.v_lead_ficha as
select
  l.id_lead,
  l.nome,
  l.email,
  l.telefone,
  l.origem,
  l.produto_interesse,
  l.status,
  l.data_entrada,
  l.score_gemini,
  l.intent_gemini,
  l.labels_gemini,
  l.pipeline_id,
  l.stage_id,
  (select count(*) from public.tentativas_compra t where t.id_lead = l.id_lead) as qtd_tentativas,
  (select count(*) from public.respostas_pesquisa r where r.id_lead = l.id_lead) as qtd_respostas,
  (select count(*) from public.classifications c where c.id_lead = l.id_lead) as qtd_classifications,
  (select count(*) from public.lead_insights i where i.id_lead = l.id_lead) as qtd_insights,
  (select count(*) from public.negocios n where n.id_lead = l.id_lead) as qtd_negocios,
  (select coalesce(sum(n.valor), 0) from public.negocios n where n.id_lead = l.id_lead) as valor_negocios
from public.leads l;

create or replace view public.v_schema_health as
select
  'leads' as tabela, count(*) as linhas from public.leads
union all select 'tentativas_compra', count(*) from public.tentativas_compra
union all select 'respostas_pesquisa', count(*) from public.respostas_pesquisa
union all select 'classifications', count(*) from public.classifications
union all select 'profiles', count(*) from public.profiles
union all select 'pipelines', count(*) from public.pipelines
union all select 'pipeline_stages', count(*) from public.pipeline_stages
union all select 'lead_insights', count(*) from public.lead_insights
union all select 'negocios', count(*) from public.negocios
order by 1;

-- Arquivamento soft-delete (CRUD CRM)
alter table public.leads
  add column if not exists archived_at timestamptz;
alter table public.tentativas_compra
  add column if not exists archived_at timestamptz;
alter table public.respostas_pesquisa
  add column if not exists archived_at timestamptz;
alter table public.negocios
  add column if not exists archived_at timestamptz;

create index if not exists idx_leads_archived on public.leads(archived_at);
create index if not exists idx_tentativas_archived on public.tentativas_compra(archived_at);
create index if not exists idx_respostas_archived on public.respostas_pesquisa(archived_at);
create index if not exists idx_negocios_archived on public.negocios(archived_at);

-- Insights: markdown completo + título (timeline)
alter table public.lead_insights
  add column if not exists titulo text;
alter table public.lead_insights
  add column if not exists markdown text;

create index if not exists idx_lead_insights_lead_created
  on public.lead_insights(id_lead, created_at desc);

-- =============================================================================
-- Conferir depois de rodar:
--   select * from public.v_crm_resumo;
--   select * from public.v_schema_health;
--   select * from public.v_lead_ficha order by id_lead limit 10;
-- =============================================================================
