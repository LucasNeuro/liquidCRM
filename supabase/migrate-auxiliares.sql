-- Preferencial: use supabase/upgrade-robusto.sql (absorve este arquivo).
-- Este script permanece como referência parcial.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Garantir colunas / FKs do enunciado (leads já existentes)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists score_gemini integer,
  add column if not exists intent_gemini text,
  add column if not exists labels_gemini text[] default '{}',
  add column if not exists created_at timestamptz not null default now();

-- tentativas / respostas: coluna id_lead se faltar
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tentativas_compra' and column_name = 'id_lead'
  ) then
    alter table public.tentativas_compra
      add column id_lead integer references public.leads(id_lead) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'respostas_pesquisa' and column_name = 'id_lead'
  ) then
    alter table public.respostas_pesquisa
      add column id_lead integer references public.leads(id_lead) on delete set null;
  end if;
end $$;

-- classifications
create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  id_lead integer references public.leads(id_lead) on delete cascade,
  source_text text not null,
  intent text,
  sentiment text,
  labels text[] default '{}',
  confidence numeric(5,4),
  score integer,
  model_name text not null default 'gemini',
  raw_response jsonb,
  created_at timestamptz not null default now()
);

-- profiles (auth)
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

-- ---------------------------------------------------------------------------
-- 2) Funis / estágios (auxiliares de CRM)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) Histórico de insights Gemini (auxiliar)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4) Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_tentativas_id_lead on public.tentativas_compra(id_lead);
create index if not exists idx_tentativas_email on public.tentativas_compra(email);
create index if not exists idx_respostas_id_lead on public.respostas_pesquisa(id_lead);
create index if not exists idx_respostas_email on public.respostas_pesquisa(email);
create index if not exists idx_classifications_lead on public.classifications(id_lead);
create index if not exists idx_lead_insights_lead on public.lead_insights(id_lead, created_at desc);
create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages(pipeline_id, position);
create index if not exists idx_leads_pipeline on public.leads(pipeline_id);
create index if not exists idx_leads_stage on public.leads(stage_id);

-- ---------------------------------------------------------------------------
-- 5) Helpers de normalização (inconsistências do desafio)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6) Backfill id_lead em tentativas e pesquisas
--     Prioridade: e-mail → telefone (últimos 8) → nome aproximado
-- ---------------------------------------------------------------------------
create or replace function public.link_auxiliares_to_leads()
returns table (tentativas_linked int, respostas_linked int)
language plpgsql
as $$
declare
  t_count int := 0;
  r_count int := 0;
  n int := 0;
begin
  -- por e-mail
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

  -- por telefone (últimos 8 dígitos)
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

  -- por nome (igualdade case-insensitive / sem espaços extras)
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

-- ---------------------------------------------------------------------------
-- 7) Seed funil padrão (se vazio) + vincular leads
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8) RLS
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.tentativas_compra enable row level security;
alter table public.respostas_pesquisa enable row level security;
alter table public.classifications enable row level security;
alter table public.profiles enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_insights enable row level security;

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

-- ---------------------------------------------------------------------------
-- 9) Views de checagem
-- ---------------------------------------------------------------------------
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
  (select count(*) from public.lead_insights) as total_insights;

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
  (select count(*) from public.lead_insights i where i.id_lead = l.id_lead) as qtd_insights
from public.leads l;

-- Checagem rápida:
-- select * from public.v_crm_resumo;
-- select * from public.v_lead_ficha order by id_lead limit 20;
