-- Arquivamento soft-delete para CRUD do CRM
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
