-- =============================================================================
-- LIQUI — Índices e checagens para Kanbans de tentativas / pesquisas
-- (colunas do enunciado já bastam; este script só reforça)
-- =============================================================================

create index if not exists idx_tentativas_status on public.tentativas_compra(status_pagamento);
create index if not exists idx_tentativas_produto on public.tentativas_compra(produto);
create index if not exists idx_respostas_momento on public.respostas_pesquisa(momento_compra);
create index if not exists idx_respostas_objecao on public.respostas_pesquisa(principal_objecao);
create index if not exists idx_respostas_area on public.respostas_pesquisa(area_interesse);

-- View de cruzamento lead ↔ auxiliares (enriquece análise)
create or replace view public.v_lead_enriquecido as
select
  l.id_lead,
  l.nome,
  l.email,
  l.telefone,
  l.origem,
  l.produto_interesse,
  l.status,
  l.score_gemini,
  l.intent_gemini,
  (select count(*) from public.tentativas_compra t where t.id_lead = l.id_lead) as qtd_tentativas,
  (select count(*) from public.respostas_pesquisa r where r.id_lead = l.id_lead) as qtd_respostas,
  (select count(*) from public.negocios n where n.id_lead = l.id_lead) as qtd_negocios,
  (select coalesce(sum(t.valor),0) from public.tentativas_compra t where t.id_lead = l.id_lead) as valor_tentativas,
  (select max(r.nota_intencao) from public.respostas_pesquisa r where r.id_lead = l.id_lead) as max_nota_intencao,
  (select string_agg(distinct r.principal_objecao, ', ')
     from public.respostas_pesquisa r where r.id_lead = l.id_lead) as objecoes,
  (select string_agg(distinct t.status_pagamento, ', ')
     from public.tentativas_compra t where t.id_lead = l.id_lead) as status_pagamentos
from public.leads l;

-- Conferir: select * from public.v_lead_enriquecido limit 20;
