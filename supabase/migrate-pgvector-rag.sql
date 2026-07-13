-- =============================================================================
-- LIQUI — pgvector + embeddings CRM (RAG)
-- 1) Ative a extensão no Dashboard OU rode este script (create extension).
-- 2) Cole no SQL Editor do Supabase.
-- =============================================================================

-- Como ativar pgvector:
-- Dashboard → Database → Extensions → busque "vector" → Enable
-- (ou o comando abaixo, se o projeto permitir)

create extension if not exists vector with schema extensions;

-- Em alguns projetos o schema é public:
-- create extension if not exists vector;

create table if not exists public.crm_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id text not null,
  id_lead integer references public.leads(id_lead) on delete set null,
  chunk_text text not null,
  content_hash text not null,
  embedding vector(1024) not null,
  model_name text not null default 'mistral-embed',
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists idx_crm_embeddings_lead
  on public.crm_embeddings(id_lead);

create index if not exists idx_crm_embeddings_hash
  on public.crm_embeddings(content_hash);

-- IVFFlat depois de ter dados; HNSW se disponível:
do $$
begin
  begin
    create index if not exists idx_crm_embeddings_hnsw
      on public.crm_embeddings
      using hnsw (embedding vector_cosine_ops);
  exception when others then
    begin
      create index if not exists idx_crm_embeddings_ivfflat
        on public.crm_embeddings
        using ivfflat (embedding vector_cosine_ops)
        with (lists = 100);
    exception when others then
      raise notice 'Índice vetorial será criado após popular dados';
    end;
  end;
end $$;

create table if not exists public.embedding_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'success', 'error')),
  trigger_source text not null default 'manual',
  total_sources int not null default 0,
  embedded_count int not null default 0,
  skipped_count int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  meta jsonb default '{}'::jsonb
);

create index if not exists idx_embedding_jobs_started
  on public.embedding_jobs(started_at desc);

alter table public.crm_embeddings enable row level security;
alter table public.embedding_jobs enable row level security;

drop policy if exists crm_embeddings_all_auth on public.crm_embeddings;
create policy crm_embeddings_all_auth on public.crm_embeddings
  for all to authenticated using (true) with check (true);

drop policy if exists embedding_jobs_all_auth on public.embedding_jobs;
create policy embedding_jobs_all_auth on public.embedding_jobs
  for all to authenticated using (true) with check (true);

drop policy if exists crm_embeddings_select_anon on public.crm_embeddings;
create policy crm_embeddings_select_anon on public.crm_embeddings
  for select to anon using (true);

drop policy if exists embedding_jobs_select_anon on public.embedding_jobs;
create policy embedding_jobs_select_anon on public.embedding_jobs
  for select to anon using (true);

-- Similaridade coseno (1 - distance)
create or replace function public.match_crm_embeddings(
  query_embedding vector(1024),
  match_count int default 8,
  filter_id_lead int default null
)
returns table (
  id uuid,
  source_table text,
  source_id text,
  id_lead int,
  chunk_text text,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.source_table,
    e.source_id,
    e.id_lead,
    e.chunk_text,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.crm_embeddings e
  where filter_id_lead is null or e.id_lead = filter_id_lead
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_crm_embeddings(vector, int, int) to authenticated, anon;

comment on table public.crm_embeddings is 'Chunks CRM + embeddings Mistral (RAG para insight Gemini)';
comment on table public.embedding_jobs is 'Histórico de jobs de indexação (manual / cron 18h)';
