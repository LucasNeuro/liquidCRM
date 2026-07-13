-- =============================================================================
-- LIQUI — custos IA (views) + Realtime + cron 18h BRT (indexação RAG)
-- Rode após migrate-plataforma.sql e migrate-pgvector-rag.sql
-- =============================================================================

-- Garante tabela de eventos (se migrate-plataforma ainda não rodou)
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'mistral')),
  operation text not null,
  model_name text,
  units numeric not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_ai_usage_created
  on public.ai_usage_events(created_at desc);
create index if not exists idx_ai_usage_provider
  on public.ai_usage_events(provider);

alter table public.embedding_jobs
  add column if not exists estimated_cost_usd numeric(12, 6) default 0;

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_select_auth on public.ai_usage_events;
create policy ai_usage_select_auth on public.ai_usage_events
  for select to authenticated using (true);

drop policy if exists ai_usage_insert_auth on public.ai_usage_events;
create policy ai_usage_insert_auth on public.ai_usage_events
  for insert to authenticated with check (true);

-- Resumo em tempo real (KPI Plataforma)
create or replace view public.v_ai_cost_resumo as
select
  coalesce(sum(estimated_cost_usd) filter (where provider = 'gemini'), 0)::numeric(12, 6)
    as gemini_cost_usd,
  coalesce(sum(estimated_cost_usd) filter (where provider = 'mistral'), 0)::numeric(12, 6)
    as mistral_cost_usd,
  coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6) as total_cost_usd,
  count(*)::int as total_events,
  count(*) filter (where provider = 'gemini')::int as gemini_events,
  count(*) filter (where provider = 'mistral')::int as mistral_events,
  (select count(*)::int from public.crm_embeddings) as chunks_indexed,
  (select coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6)
     from public.embedding_jobs where status = 'success') as embed_jobs_cost_usd,
  (select max(finished_at) from public.embedding_jobs where status = 'success')
    as last_embed_at;

-- Breakdown diário (gráficos / tabela)
create or replace view public.v_ai_cost_daily as
select
  (created_at at time zone 'America/Sao_Paulo')::date as day_brt,
  provider,
  operation,
  count(*)::int as events,
  coalesce(sum(units), 0)::numeric as units,
  coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6) as cost_usd
from public.ai_usage_events
group by 1, 2, 3
order by 1 desc, 2, 3;

grant select on public.v_ai_cost_resumo to authenticated, anon;
grant select on public.v_ai_cost_daily to authenticated, anon;

-- Realtime para KPIs vivos na tela Plataforma
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if to_regclass('public.ai_usage_events') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'ai_usage_events'
     )
  then
    execute 'alter publication supabase_realtime add table public.ai_usage_events';
  end if;

  if to_regclass('public.embedding_jobs') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'embedding_jobs'
     )
  then
    execute 'alter publication supabase_realtime add table public.embedding_jobs';
  end if;

  if to_regclass('public.crm_embeddings') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'crm_embeddings'
     )
  then
    execute 'alter publication supabase_realtime add table public.crm_embeddings';
  end if;
end $$;

-- =============================================================================
-- Cron 18:00 America/Sao_Paulo (= 21:00 UTC) via pg_cron + pg_net
-- Pré-requisitos no Dashboard Supabase:
--   Database → Extensions → habilite pg_cron e pg_net
-- Preencha PROJECT_REF e SERVICE_ROLE_KEY abaixo (ou use Vault).
-- Alternativa no Render: Cron Job (ver render.yaml) — recomendado se não quiser
-- guardar service role no SQL.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Desagenda job antigo se existir
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'liqui-embed-18h-brt';
exception when others then
  null;
end $$;

-- !! SUBSTITUA os placeholders antes de agendar !!
-- PROJECT_URL = https://<ref>.supabase.co
-- SERVICE_ROLE_KEY = secret do projeto
--
-- select cron.schedule(
--   'liqui-embed-18h-brt',
--   '0 21 * * *',
--   $$
--   select net.http_post(
--     url := 'https://PROJECT_REF.supabase.co/functions/v1/embed-crm-batch',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer SERVICE_ROLE_KEY',
--       'apikey', 'SERVICE_ROLE_KEY'
--     ),
--     body := '{"trigger_source":"cron"}'::jsonb
--   );
--   $$
-- );

comment on view public.v_ai_cost_resumo is 'KPIs de custo Gemini/Mistral + chunks (tela Plataforma)';
comment on view public.v_ai_cost_daily is 'Custo IA agregado por dia BRT';
