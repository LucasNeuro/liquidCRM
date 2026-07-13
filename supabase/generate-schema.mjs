import { writeFileSync } from 'node:fs'

const ddl = `-- =============================================================================
-- Contabilidade Facilitada CRM / waje — Schema + Seed (enunciado)
-- Dados originais + volume ~2x com sintéticos
-- Datas mantidas como VARCHAR (formato original do desafio)
-- Cole no SQL Editor do Supabase e execute
-- =============================================================================

create extension if not exists pgcrypto;

-- Remove versões anteriores conflitantes
drop view if exists public.v_dashboard_kpis cascade;
drop view if exists public.v_funil_leads cascade;
drop view if exists public.v_crm_resumo cascade;
drop table if exists public.classifications cascade;
drop table if exists public.messages cascade;
drop table if exists public.lead_notes cascade;
drop table if exists public.deals cascade;
drop table if exists public.atendimentos cascade;
drop table if exists public.ai_agents cascade;
drop table if exists public.respostas_pesquisa cascade;
drop table if exists public.tentativas_compra cascade;
drop table if exists public.leads cascade;

-- ---------------------------------------------------------------------------
-- 1) leads (enunciado) + campos extras para Gemini
-- ---------------------------------------------------------------------------
create table public.leads (
  id_lead integer primary key,
  nome varchar(255) not null,
  email varchar(255),
  telefone varchar(50),
  origem varchar(50),
  produto_interesse varchar(100),
  status varchar(50),
  data_entrada varchar(50),
  score_gemini integer default null,
  intent_gemini text default null,
  labels_gemini text[] default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) tentativas_compra
-- ---------------------------------------------------------------------------
create table public.tentativas_compra (
  id serial primary key,
  nome varchar(255) not null,
  email varchar(255),
  telefone varchar(50),
  produto varchar(100),
  valor decimal(10,2),
  forma_pagamento varchar(50),
  status_pagamento varchar(50),
  data_tentativa varchar(50),
  id_lead integer references public.leads(id_lead) on delete set null
);

-- ---------------------------------------------------------------------------
-- 3) respostas_pesquisa
-- ---------------------------------------------------------------------------
create table public.respostas_pesquisa (
  id serial primary key,
  nome varchar(255) not null,
  email varchar(255),
  telefone varchar(50),
  momento_compra varchar(50),
  principal_objecao varchar(100),
  area_interesse varchar(100),
  nota_intencao integer,
  data_resposta varchar(50),
  id_lead integer references public.leads(id_lead) on delete set null
);

-- ---------------------------------------------------------------------------
-- Classificações Gemini
-- ---------------------------------------------------------------------------
create table public.classifications (
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'agente',
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

create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_produto on public.leads(produto_interesse);
create index if not exists idx_tentativas_compra_email on public.tentativas_compra(email);
create index if not exists idx_tentativas_compra_status on public.tentativas_compra(status_pagamento);
create index if not exists idx_respostas_pesquisa_email on public.respostas_pesquisa(email);
create index if not exists idx_respostas_pesquisa_momento on public.respostas_pesquisa(momento_compra);
create index if not exists idx_classifications_lead on public.classifications(id_lead);

alter table public.leads enable row level security;
alter table public.tentativas_compra enable row level security;
alter table public.respostas_pesquisa enable row level security;
alter table public.classifications enable row level security;
alter table public.profiles enable row level security;

drop policy if exists leads_all_auth on public.leads;
create policy leads_all_auth on public.leads for all to authenticated using (true) with check (true);
drop policy if exists tentativas_all_auth on public.tentativas_compra;
create policy tentativas_all_auth on public.tentativas_compra for all to authenticated using (true) with check (true);
drop policy if exists respostas_all_auth on public.respostas_pesquisa;
create policy respostas_all_auth on public.respostas_pesquisa for all to authenticated using (true) with check (true);
drop policy if exists classifications_all_auth on public.classifications;
create policy classifications_all_auth on public.classifications for all to authenticated using (true) with check (true);
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

create or replace view public.v_crm_resumo as
select
  (select count(*) from public.leads) as total_leads,
  (select count(*) from public.tentativas_compra) as total_tentativas,
  (select count(*) from public.respostas_pesquisa) as total_respostas,
  (select count(*) from public.leads where status = 'Novo') as leads_novos,
  (select count(*) from public.leads where status = 'Ganho') as leads_ganhos,
  (select count(*) from public.tentativas_compra where status_pagamento = 'aprovado') as pagamentos_aprovados,
  (select count(*) from public.tentativas_compra where status_pagamento = 'abandonado') as pagamentos_abandonados;
`

const leadsOriginal = [
  [32, 'Vanessa Cunha', 'vanessa.cunha@gmail.com', '11912517517', 'youtube', 'Aprovação Contábil', 'Em contato', '08/05/2026'],
  [22, 'Leticia Moreira', 'leticia.moreira@yahoo.com.br', '+55 11 90928-9546', 'youtube', 'Aprovação Contábil', 'Qualificado', '19/06/2025'],
  [47, 'Maria Oliveira Costa', 'maria.costa@gmail.com', '11979254563', 'email', 'Escola Contábil', 'Ganho', '20/08/2025'],
  [24, 'Gabriela Pires', 'GABRIELA.PIRES@YAHOO.COM.BR', '5511916240908', 'youtube', 'Aprovação Contábil', 'Novo', '2025-01-22'],
  [5, 'Carlos Eduardo Alves', 'carlos.alves@outlook.com', '(11) 91371-8431', 'instagram', 'MBA em Contabilidade', 'Novo', '19/12/2025'],
  [10, 'C. Barbosa', 'camila.barbosa@gmail.com', '11981756179', 'youtube', 'Aprovação Contábil', 'Novo', '01-24-2026'],
  [31, 'Eduardo Nogueira', null, '11962092888', 'youtube', 'Escola Contábil', 'Em contato', '11 de abril de 2025'],
  [23, 'Daniel Castro', 'daniel.castro@yahoo.com.br', '+55 11 92842-7073', 'youtube', 'Pós RT', 'Em contato', '18/01/2026'],
  [46, 'Marcio Antunes', 'marcio.antunes@yahoo.com.br', '11937135391', 'instagram', 'Escola Contábil', 'Ganho', '2025-05-28'],
  [34, 'Débora Sales', 'debora.sales@yahoo.com.br', '5511938285503', 'email', 'MBA em Contabilidade', 'Novo', '31 de outubro de 2025'],
  [20, 'Mariana Dias', 'Mariana.dias@gmail.com', '+55 11 98038-8981', 'whatsapp', 'MBA em Contabilidade', 'Novo', '07/01/2026'],
  [42, 'Sabrina Reis', 'sabrina.reis@gmail.com', '11989639081', 'whatsapp', 'Escola Contábil', 'Perdido', '18/05/2025'],
  [44, 'Carolina Lopes', null, '11992274302', 'whatsapp', 'MBA em Contabilidade', 'Novo', '2025-02-22'],
  [19, 'Rodrigo Fernandes', 'rodrigo.fernandes@outlook.com', '11985758349', 'youtube', 'Aprovação Contábil', 'Em contato', '15/06/25'],
  [39, 'Diego Camargo', null, '5511917566185', 'whatsapp', 'MBA em Contabilidade', 'Em contato', '2025-03-16'],
  [8, 'Fernanda Gomes Pinto', 'fernanda.pinto@outlook.com', '(11) 91070-9497', 'youtube', 'Escola Contábil', 'Em contato', '10/04/2026'],
  [36, 'Priscila Fonseca', 'priscila.fonseca@hotmail.com', '11907634247', 'instagram', 'Aprovação Contábil', 'Novo', '11 de março de 2025'],
  [41, 'Henrique Duarte', 'HENRIQUE.DUARTE@HOTMAIL.COM', '11949597086', 'whatsapp', 'Aprovação Contábil', 'Em contato', '6 de novembro de 2025'],
  [18, 'Amanda Correia', 'AMANDA.CORREIA@GMAIL.COM', '+55 11 99691-7555', 'whatsapp', 'Aprovação Contábil', 'Em contato', '19/04/25'],
  [1, 'Joao Silva Souza', null, '+55 11 90335-6886', 'whatsapp', 'Aprovação Contábil', 'Novo', '2025-04-15'],
  [16, 'Beatriz Araujo', 'beatriz.araujo@yahoo.com.br', '11951220073', 'email', 'Pós RT', 'Perdido', '12/01/2025'],
  [3, 'Pedro Henrique Lima', null, '+55 11 97532-9037', 'youtube', 'MBA em Contabilidade', 'Novo', '12 de outubro de 2025'],
  [27, 'André Vieira', 'Andre.vieira@hotmail.com', '+55 11 99708-6737', 'email', 'Aprovação Contábil', 'Ganho', '21/02/2026'],
  [14, 'L. Carvalho', null, '(11) 97846-1803', 'email', 'MBA em Contabilidade', 'Em contato', '22 de maio de 2025'],
  [43, 'Otavio Brandao', 'otavio.brandao@gmail.com', '(11) 99964-5480', 'youtube', 'Pós RT', 'Em contato', '04/08/2025'],
  [13, 'Thiago Ribeiro', 'THIAGO.RIBEIRO@YAHOO.COM.BR', '5511953100814', 'email', 'Aprovação Contábil', 'Novo', '2025-09-10'],
  [33, 'R. Azevedo', 'ricardo.azevedo@yahoo.com.br', '5511907869910', 'youtube', 'MBA em Contabilidade', 'Novo', '04/02/26'],
  [29, 'Leonardo Mendes', 'leonardo.mendes@gmail.com', '5511990377459', 'instagram', 'Escola Contábil', 'Em contato', '14/12/2025'],
  [11, 'Bruno Cardoso', 'Bruno.cardoso@hotmail.com', '+55 11 99188-7369', 'whatsapp', 'Escola Contábil', 'Novo', '2025-02-02'],
  [15, 'Gustavo Teixeira', 'Gustavo.teixeira@gmail.com', '+55 11 90632-3852', 'instagram', 'Aprovação Contábil', 'Qualificado', '2026-03-09'],
  [7, 'Rafael Almeida', 'rafael.almeida@outlook.com', '5511984374605', 'whatsapp', 'Aprovação Contábil', 'Qualificado', '2025-02-16'],
  [21, 'V. Rocha', null, '11932138745', 'instagram', 'Aprovação Contábil', 'Perdido', '22 de março de 2025'],
  [25, 'Marcelo Freitas', 'marcelo.freitas@hotmail.com', '+55 11 97897-9095', 'youtube', 'Escola Contábil', 'Novo', '2025-03-02'],
  [17, 'Felipe Monteiro', 'Felipe.monteiro@gmail.com', '(11) 99149-7616', 'whatsapp', 'Pós RT', 'Novo', '2026-03-22'],
  [4, 'Ana Beatriz Ferreira', 'ana.ferreira@gmail.com', '5511921429110', 'email', 'Pós RT', 'Em contato', '09/08/25'],
  [12, 'Patrícia Nunes', 'patricia.nunes@yahoo.com.br', '5511935935572', 'instagram', 'Aprovação Contábil', 'Perdido', '2025-11-19'],
  [30, 'Natália Barros', null, '+55 11 93337-4088', 'youtube', 'Aprovação Contábil', 'Em contato', '05-24-2025'],
  [48, 'Guilherme Peixoto', 'guilherme.peixoto@hotmail.com', '+55 11 95419-3837', 'instagram', 'Aprovação Contábil', 'Ganho', '02-16-2025'],
  [28, 'Isabela Ramos', 'isabela.ramos@gmail.com', '(11) 98844-7167', 'email', 'Pós RT', 'Em contato', '24/04/26'],
  [6, 'Juliana Rodrigues', null, '(11) 99794-2942', 'email', 'Escola Contábil', 'Perdido', '2026-01-23'],
  [45, 'M. Antunes', null, '11937135391', 'instagram', 'Escola Contábil', 'Em contato', '05-14-2025'],
  [37, 'Guilherme Peixoto', 'guilherme.peixoto@hotmail.com', '11954193837', 'instagram', 'Aprovação Contábil', 'Qualificado', '02-10-2025'],
  [38, 'Aline Tavares', 'Aline.tavares@yahoo.com.br', '11988231132', 'whatsapp', 'Pós RT', 'Novo', '2025-11-18'],
  [26, 'Renata Cavalcanti', 'renata.cavalcanti@gmail.com', '11944349361', 'instagram', 'Aprovação Contábil', 'Em contato', '05-13-2026'],
  [2, 'Maria Oliveira Costa', null, '11979254563', 'email', 'Escola Contábil', 'Novo', '12/08/25'],
  [35, 'Fabio Macedo', 'FABIO.MACEDO@GMAIL.COM', '11977736262', 'instagram', 'Pós RT', 'Novo', '04/05/2026'],
  [40, 'B. Farias', 'bianca.farias@gmail.com', '(11) 90983-2887', 'youtube', 'Pós RT', 'Novo', '12-24-2025'],
  [9, 'Lucas Martins', 'lucas.martins@outlook.com', '(11) 92183-1063', 'whatsapp', 'Pós RT', 'Novo', '2025-10-01'],
]

const tentativasOriginal = [
  ['Fábio Macedo', 'fabio.macedo@gmail.com', '11977736262', 'MBA em Contabilidade', 5990.0, 'cartão', 'abandonado', '08/10/25'],
  ['Juliana Rodrigues', 'juliana.rodrigues@gmail.com', null, 'Pós RT', 3497.0, 'pix', 'recusado', '15 de setembro de 2025'],
  ['Daniel Castro', 'DANIEL.CASTRO@YAHOO.COM.BR', '11928427073', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '2025-07-06'],
  ['Mariana Dias', 'mariana.dias@gmail.com', '11980388981', 'MBA em Contabilidade', 5990.0, 'pix', 'aprovado', '04-19-2026'],
  ['Vanessa Cunha', null, '(11) 91251-7517', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '14/03/26'],
  ['A. Tavares', 'ALINE.TAVARES@YAHOO.COM.BR', '(11) 98823-1132', 'Escola Contábil', 1997.0, 'pix', 'recusado', '2026-05-01'],
  ['André Vieira', 'ANDRE.VIEIRA@HOTMAIL.COM', '(11) 99708-6737', 'Aprovação Contábil', 997.0, 'boleto', 'abandonado', '17/06/26'],
  ['Leonardo Mendes', 'leonardo.mendes@gmail.com', '(11) 99037-7459', 'MBA em Contabilidade', 5990.0, 'boleto', 'abandonado', '2025-03-20'],
  ['Gabriela Pires', null, '+55 11 91624-0908', 'Escola Contábil', 1997.0, 'pix', 'aprovado', '2026-02-25'],
  ['Claudia Marques', 'CLAUDIA.MARQUES@YAHOO.COM.BR', '(31) 99123-4567', 'Pós RT', 3497.0, 'cartão', 'recusado', '05-20-2025'],
  ['Marcio Antunes', 'marcio.antunes@yahoo.com.br', '(11) 93713-5391', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '21 de junho de 2025'],
  ['Larissa Carvalho', null, '5511978461803', 'MBA em Contabilidade', 5990.0, 'cartão', 'aprovado', '11/06/2026'],
  ['Felipe Monteiro', 'FELIPE.MONTEIRO2@GMAIL.COM', '11991497616', 'Pós RT', 3497.0, 'cartão', 'pendente', '27/03/2025'],
  ['Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '+55 11 95419-3837', 'Aprovação Contábil', 997.0, 'boleto', 'recusado', '11/05/2026'],
  ['Diego Camargo', 'Diego.camargo@yahoo.com.br', '5511917566185', 'Aprovação Contábil', 997.0, 'boleto', 'recusado', '2025-05-09'],
  ['Thiago Ribeiro', 'thiago.ribeiro@yahoo.com.br', '+55 11 95310-0814', 'Aprovação Contábil', 997.0, 'pix', 'abandonado', '13/04/2025'],
  ['Fábio Macedo', 'fabio.macedo@gmail.com', '(11) 97773-6262', 'Aprovação Contábil', 997.0, 'cartão', 'recusado', '07-02-2025'],
  ['Ana Beatriz Ferreira', 'ANA.FERREIRA@GMAIL.COM', '+55 11 92142-9110', 'Pós RT', 3497.0, 'pix', 'aprovado', '30/11/2025'],
  ['Juliana Rodrigues', null, '11997942942', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '27 de outubro de 2025'],
  ['Otavio Brandao', 'otavio.brandao@gmail.com', '5511999645480', 'MBA em Contabilidade', 5990.0, 'cartão', 'aprovado', '08/05/2026'],
  ['Leonardo Mendes', 'Leonardo.mendes@gmail.com', '11990377459', 'MBA em Contabilidade', 5990.0, 'pix', 'aprovado', '22/11/25'],
  ['Roberto Tanaka', 'roberto.tanaka@gmail.com', '+55 41 98888-4444', 'Escola Contábil', 1997.0, 'boleto', 'abandonado', '29/09/2025'],
  ['Patricia Nunes', null, '11935935572', 'MBA em Contabilidade', 5990.0, 'cartão', 'recusado', '02/07/2025'],
  ['Rodrigo Fernandes', 'Rodrigo.fernandes@outlook.com', '(11) 98575-8349', 'Aprovação Contábil', 997.0, 'cartão', 'recusado', '15 de fevereiro de 2025'],
  ['Pedro Henrique Lima', 'PEDRO.LIMA@GMAIL.COM', '11975329037', 'MBA em Contabilidade', 5990.0, 'pix', 'recusado', '04-24-2025'],
  ['Aline Tavares', 'Aline.tavares@yahoo.com.br', '11988231132', 'Pós RT', 3497.0, 'pix', 'recusado', '15/03/2026'],
  ['Marcio Antunes', 'Marcio.antunes@yahoo.com.br', '11937135391', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '11-21-2025'],
  ['Sandra Regina Melo', 'Sandra.melo@gmail.com', '+55 11 96123-4567', 'Pós RT', 3497.0, 'boleto', 'aprovado', '05-12-2025'],
  ['Rafael Almeida', 'rafael.almeida@outlook.com', '(11) 98437-4605', 'Aprovação Contábil', 997.0, 'pix', 'recusado', '19/06/26'],
  ['Bruno Cardoso', 'bruno.cardoso@hotmail.com', null, 'Escola Contábil', 1997.0, 'cartão', 'recusado', '28/05/2026'],
  ['Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '(11) 95419-3837', 'Aprovação Contábil', 997.0, 'cartão', 'recusado', '2025-10-08'],
  ['G. Pires', 'Gabriela.pires@yahoo.com.br', '+55 11 91624-0908', 'Aprovação Contábil', 997.0, 'pix', 'abandonado', '13/05/25'],
  ['Renata Cavalcanti', 'renata.cavalcanti@gmail.com', '(11) 94434-9361', 'Escola Contábil', 1997.0, 'boleto', 'abandonado', '14/12/25'],
  ['Joao Silva Souza', 'joao.souza@gmail.com', '11903356886', 'Aprovação Contábil', 997.0, 'boleto', 'pendente', '17/04/2026'],
  ['Diego Camargo', 'Diego.camargo@yahoo.com.br', '11917566185', 'MBA em Contabilidade', 5990.0, 'cartão', 'abandonado', '2025-05-07'],
  ['Renata Cavalcanti', 'Renata.cavalcanti@gmail.com', '5511944349361', 'Aprovação Contábil', 997.0, 'pix', 'aprovado', '04-16-2026'],
  ['Camila Barbosa', 'camila.barbosa@gmail.com', '+55 11 98175-6179', 'Aprovação Contábil', 997.0, 'cartão', 'aprovado', '15/06/25'],
  ['D. Sales', 'debora.sales@yahoo.com.br', '+55 11 93828-5503', 'MBA em Contabilidade', 5990.0, 'boleto', 'aprovado', '05/07/2026'],
  ['Rafael Almeida', 'rafael.almeida@outlook.com', '+55 11 98437-4605', 'Aprovação Contábil', 997.0, 'cartão', 'abandonado', '3 de novembro de 2025'],
  ['Felipe Monteiro', 'Felipe.monteiro@gmail.com', '5511991497616', 'Pós RT', 3497.0, 'pix', 'aprovado', '2026-06-06'],
  ['Henrique Duarte', 'henrique.duarte@hotmail.com', '+55 11 94959-7086', 'Aprovação Contábil', 997.0, 'pix', 'pendente', '16 de maio de 2026'],
  ['Beatriz Araujo', 'beatriz.araujo@yahoo.com.br', '11951220073', 'Pós RT', 3497.0, 'cartão', 'abandonado', '2026-06-03'],
  ['Carolina Lopes', 'carolina.lopes@hotmail.com', '5511992274302', 'MBA em Contabilidade', 5990.0, 'pix', 'pendente', '2025-08-22'],
  ['E. Nogueira', 'EDUARDO.NOGUEIRA@OUTLOOK.COM', '(11) 96209-2888', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '4 de novembro de 2025'],
  ['Fernanda Gomes Pinto', 'Fernanda.pinto@outlook.com', '11910709497', 'Escola Contábil', 1997.0, 'cartão', 'aprovado', '2026-03-24'],
  ['Isabela Ramos', 'ISABELA.RAMOS@GMAIL.COM', '5511988447167', 'Pós RT', 3497.0, 'boleto', 'abandonado', '09/06/26'],
  ['Andre Vieira', 'andre.vieira@hotmail.com', '11997086737', 'Aprovação Contábil', 997.0, 'boleto', 'abandonado', '3 de outubro de 2025'],
  ['S. Reis', null, '11989639081', 'Escola Contábil', 1997.0, 'pix', 'abandonado', '2025-11-23'],
  ['otávio brandão', 'otavio.brandao@gmail.com', null, 'Pós RT', 3497.0, 'boleto', 'aprovado', '2025-09-06'],
  ['Bianca Farias', 'bianca.farias@gmail.com', '11909832887', 'Pós RT', 3497.0, 'pix', 'abandonado', '2 de fevereiro de 2025'],
  ['LUCAS MARTINS', 'LUCAS.MARTINS@OUTLOOK.COM', '(11) 92183-1063', 'Pós RT', 3497.0, 'cartão', 'recusado', '20/06/2026'],
  ['Ana Beatriz Ferreira', 'ana.ferreira@gmail.com', '+55 11 92142-9110', 'Pós RT', 3497.0, 'boleto', 'pendente', '05-14-2026'],
  ['Vinicius Rocha', 'vinicius.rocha@outlook.com', '+55 11 93213-8745', 'Aprovação Contábil', 997.0, 'cartão', 'aprovado', '22 de abril de 2025'],
  ['Isabela Ramos', 'ISABELA.RAMOS20@GMAIL.COM', '(11) 98844-7167', 'Pós RT', 3497.0, 'boleto', 'recusado', '02/04/2026'],
  ['Débora Sales', null, '+55 11 93828-5503', 'MBA em Contabilidade', 5990.0, 'pix', 'aprovado', '29/01/26'],
  ['Lucas Martins', 'lucas.martins@outlook.com', '11921831063', 'Pós RT', 3497.0, 'pix', 'abandonado', '6 de abril de 2026'],
  ['Maria Oliveira Costa', null, '11979254563', 'Escola Contábil', 1997.0, 'boleto', 'aprovado', '03-18-2026'],
  ['Paulo César Xavier', 'PAULO.XAVIER@OUTLOOK.COM', '21987651234', 'Escola Contábil', 1997.0, 'boleto', 'pendente', '2025-05-20'],
  ['ricardo azevedo', 'Ricardo.azevedo@yahoo.com.br', '11907869910', 'MBA em Contabilidade', 5990.0, 'pix', 'abandonado', '02-16-2025'],
  ['Leticia Moreira', null, '11909289546', 'Escola Contábil', 1997.0, 'pix', 'aprovado', '2025-11-07'],
  ['Natália Barros', 'Natalia.barros@gmail.com', '11933374088', 'Pós RT', 3497.0, 'boleto', 'aprovado', '10/06/2025'],
  ['priscila fonseca', 'priscila.fonseca89@hotmail.com', '11907634247', 'Aprovação Contábil', 997.0, 'pix', 'aprovado', '23/05/26'],
  ['Gustavo Teixeira', 'Gustavo.teixeira@gmail.com', '5511906323852', 'Aprovação Contábil', 997.0, 'cartão', 'pendente', '27/02/2025'],
]

const respostasOriginal = [
  ['GABRIELA PIRES', 'gabriela.pires@yahoo.com.br', '11916240908', 'só pesquisando', 'indecisão', 'primeiro emprego', 10, '21/12/2025'],
  ['D. Castro', null, '(11) 92842-7073', 'em alguns meses', 'confiança', 'primeiro emprego', null, '02-01-2026'],
  ['renata cavalcanti', 'renata.cavalcanti@gmail.com', '(11) 94434-9361', 'só pesquisando', 'preço', 'primeiro emprego', 8, '21 de fevereiro de 2026'],
  ['henrique duarte', 'henrique.duarte@hotmail.com', '5511949597086', 'só pesquisando', 'confiança', 'abrir escritório', null, '2026-01-27'],
  ['PATRÍCIA NUNES', 'patricia.nunes@yahoo.com.br', '11935935572', 'só pesquisando', 'indecisão', 'abrir escritório', 2, '6 de abril de 2025'],
  ['Mariana Dias', null, '+55 11 98038-8981', 'só pesquisando', 'tempo', 'atualização profissional', null, '2026-03-28'],
  ['Marcelo Freitas', 'marcelo.freitas@hotmail.com', '(11) 97897-9095', 'em alguns meses', 'tempo', 'atualização profissional', 1, '09-16-2025'],
  ['PEDRO HENRIQUE LIMA', null, '11975329037', 'quero comprar já', 'tempo', 'carreira pública', 4, '30 de maio de 2026'],
  ['Rafael Almeida', 'rafael.almeida@outlook.com', '11984374605', 'quero comprar já', 'preço', 'atualização profissional', 1, '18/01/26'],
  ['SABRINA REIS', 'sabrina.reis@gmail.com', '+55 11 98963-9081', 'quero comprar já', 'confiança', 'carreira pública', 5, '8 de maio de 2025'],
  ['Vinicius Rocha', 'vinicius.rocha@outlook.com', '(11) 93213-8745', 'em alguns meses', 'tempo', 'primeiro emprego', 1, '21/03/2025'],
  ['Marcos Vinícius Prado', 'marcos.prado@hotmail.com', '51993334444', 'em alguns meses', 'indecisão', 'atualização profissional', 5, '2025-06-04'],
  ['BRUNO CARDOSO', 'Bruno.cardoso@hotmail.com', '(11) 99188-7369', 'em alguns meses', 'preço', 'atualização profissional', 5, '17 de maio de 2025'],
  ['MÁRCIO ANTUNES', 'Marcio.antunes@yahoo.com.br', '(11) 93713-5391', 'quero comprar já', 'confiança', 'abrir escritório', 2, '07-07-2025'],
  ['A. Tavares', 'aline.tavares@yahoo.com.br', '11988231132', 'só pesquisando', 'tempo', 'primeiro emprego', 1, '25/06/25'],
  ['Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '+55 11 95419-3837', 'só pesquisando', 'preço', 'primeiro emprego', 9, '15 de junho de 2025'],
  ['FELIPE MONTEIRO', null, '11991497616', 'quero comprar já', 'preço', 'carreira pública', 4, '09-09-2025'],
  ['Tatiane Ferreira', 'Tatiane.ferreira@gmail.com', '61995556666', 'quero comprar já', 'indecisão', 'carreira pública', 6, '03/01/26'],
  ['letícia moreira', 'Leticia.moreira@yahoo.com.br', '5511909289546', 'em alguns meses', 'tempo', 'abrir escritório', 4, '27/05/26'],
  ['fernanda gomes pinto', null, '+55 11 91070-9497', 'em alguns meses', 'indecisão', 'primeiro emprego', 6, '2026-06-30'],
  ['Priscila Fonseca', 'priscila.fonseca@hotmail.com', '+55 11 90763-4247', 'quero comprar já', 'confiança', 'carreira pública', 8, '07-05-2026'],
  ['Elaine dos Santos', 'elaine.santos@gmail.com', '5511970001111', 'quero comprar já', 'confiança', 'primeiro emprego', null, '18 de maio de 2026'],
  ['Ana Beatriz Ferreira', 'ANA.FERREIRA@GMAIL.COM', '5511921429110', 'em alguns meses', 'preço', 'abrir escritório', 2, '2025-11-26'],
  ['Ricardo Azevedo', null, '5511907869910', 'quero comprar já', 'confiança', 'primeiro emprego', 8, '15/03/26'],
  ['Juliana Rodrigues', null, '11997942942', 'em alguns meses', 'preço', 'primeiro emprego', 8, '2025-04-17'],
  ['I. Ramos', null, '(11) 98844-7167', 'quero comprar já', 'indecisão', 'atualização profissional', 9, '2025-03-15'],
  ['Otávio Brandão', 'Otavio.brandao@gmail.com', '5511999645480', 'quero comprar já', 'tempo', 'abrir escritório', 2, '21/04/2025'],
  ['DÉBORA SALES', 'debora.sales@yahoo.com.br', '11938285503', 'só pesquisando', 'preço', 'atualização profissional', 8, '06/02/2026'],
  ['Fabio Macedo', 'Fabio.macedo@gmail.com', '11977736262', 'em alguns meses', 'tempo', 'atualização profissional', 1, '19/02/2026'],
  ['beatriz araújo', null, '(11) 95122-0073', 'só pesquisando', 'indecisão', 'atualização profissional', 8, '2025-07-13'],
]

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function leadRow(r) {
  return `(${[r[0], sqlStr(r[1]), sqlStr(r[2]), sqlStr(r[3]), sqlStr(r[4]), sqlStr(r[5]), sqlStr(r[6]), sqlStr(r[7])].join(', ')})`
}

function tentRow(r) {
  return `(${[sqlStr(r[0]), sqlStr(r[1]), sqlStr(r[2]), sqlStr(r[3]), Number(r[4]).toFixed(2), sqlStr(r[5]), sqlStr(r[6]), sqlStr(r[7])].join(', ')})`
}

function respRow(r) {
  const nota = r[6] === null || r[6] === undefined ? 'NULL' : r[6]
  return `(${[sqlStr(r[0]), sqlStr(r[1]), sqlStr(r[2]), sqlStr(r[3]), sqlStr(r[4]), sqlStr(r[5]), nota, sqlStr(r[7])].join(', ')})`
}

const firstNames = [
  'Alice', 'Brenda', 'Caio', 'Diana', 'Elias', 'Flavia', 'Gabriel', 'Helena', 'Igor', 'Jana',
  'Kaique', 'Lara', 'Murilo', 'Nina', 'Otto', 'Paula', 'Quirino', 'Rafaela', 'Sergio', 'Taina',
  'Ursula', 'Vitor', 'Wagner', 'Yasmin', 'Zelia', 'Arthur', 'Bia', 'Cesar', 'Duda', 'Enzo',
  'Fatima', 'Giovana', 'Heitor', 'Ingrid', 'Jonas', 'Katia', 'Luan', 'Monica', 'Noel', 'Olivia',
  'Pietro', 'Queila', 'Ruan', 'Sofia', 'Tiago', 'Ubirajara', 'Vera', 'William',
]
const lastNames = [
  'Souza', 'Almeida', 'Barbosa', 'Campos', 'Dantas', 'Esteves', 'Farias', 'Guedes', 'Holanda', 'Ibanez',
  'Junqueira', 'Klein', 'Leal', 'Moraes', 'Neves', 'Ortega', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira',
  'Torres', 'Uchoa', 'Valente', 'Werneck', 'Xavier', 'Yamamoto', 'Zanetti', 'Andrade', 'Brito', 'Correia',
]
const origens = ['youtube', 'instagram', 'whatsapp', 'email']
const produtos = ['Aprovação Contábil', 'Escola Contábil', 'MBA em Contabilidade', 'Pós RT']
const statuses = ['Novo', 'Em contato', 'Qualificado', 'Ganho', 'Perdido']
const datas = [
  '12/01/2025', '03/03/2025', '15/06/2025', '22/09/2025', '01/11/2025', '18/01/2026', '07/02/2026',
  '2025-04-11', '05-20-2025', '11 de julho de 2025', '03 de janeiro de 2026', '2026-05-09',
]
const formas = ['pix', 'cartão', 'boleto']
const pagStatuses = ['aprovado', 'abandonado', 'recusado', 'pendente']
const momentos = ['só pesquisando', 'em alguns meses', 'quero comprar já']
const objecoes = ['preço', 'tempo', 'confiança', 'indecisão']
const areas = ['primeiro emprego', 'abrir escritório', 'atualização profissional', 'carreira pública']

function cleanEmail(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.@_-]/g, '')
}

const synthLeads = []
for (let i = 0; i < leadsOriginal.length; i++) {
  const id = 101 + i
  const fn = firstNames[i % firstNames.length]
  const ln = lastNames[(i * 3) % lastNames.length]
  const nome = `${fn} ${ln}`
  const email = cleanEmail(`${fn}.${ln}${id}@exemplo.crm.br`)
  const tel = `1199${String(1000000 + i * 137).slice(-7)}`
  synthLeads.push([
    id,
    nome,
    i % 7 === 0 ? null : email,
    tel,
    origens[i % origens.length],
    produtos[i % produtos.length],
    statuses[i % statuses.length],
    datas[i % datas.length],
  ])
}

const synthTent = []
for (let i = 0; i < tentativasOriginal.length; i++) {
  const fn = firstNames[(i + 5) % firstNames.length]
  const ln = lastNames[(i + 9) % lastNames.length]
  const nome = `${fn} ${ln} Sint`
  const email = cleanEmail(`${fn}.${ln}.sint${i}@exemplo.crm.br`)
  synthTent.push([
    nome,
    i % 5 === 0 ? null : email,
    i % 8 === 0 ? null : `1198${String(2000000 + i * 91).slice(-7)}`,
    produtos[i % produtos.length],
    [997, 1997, 3497, 5990][i % 4],
    formas[i % formas.length],
    pagStatuses[i % pagStatuses.length],
    datas[(i + 2) % datas.length],
  ])
}

const synthResp = []
for (let i = 0; i < respostasOriginal.length; i++) {
  const fn = firstNames[(i + 11) % firstNames.length]
  const ln = lastNames[(i + 4) % lastNames.length]
  const nome = `${fn} ${ln}`
  const email = cleanEmail(`${fn}.${ln}.p${i}@exemplo.crm.br`)
  synthResp.push([
    nome,
    i % 4 === 0 ? null : email,
    `1197${String(3000000 + i * 53).slice(-7)}`,
    momentos[i % momentos.length],
    objecoes[i % objecoes.length],
    areas[i % areas.length],
    i % 6 === 0 ? null : 1 + (i % 10),
    datas[(i + 4) % datas.length],
  ])
}

let sql = ddl
sql += '\n-- ===================== SEED LEADS (original + sintético 2x) =====================\n'
sql += 'insert into public.leads (id_lead, nome, email, telefone, origem, produto_interesse, status, data_entrada) values\n'
sql += [...leadsOriginal, ...synthLeads].map(leadRow).join(',\n') + ';\n\n'

sql += '-- ===================== SEED TENTATIVAS (original + sintético 2x) =====================\n'
sql += 'insert into public.tentativas_compra (nome, email, telefone, produto, valor, forma_pagamento, status_pagamento, data_tentativa) values\n'
sql += [...tentativasOriginal, ...synthTent].map(tentRow).join(',\n') + ';\n\n'

sql += '-- ===================== SEED RESPOSTAS (original + sintético 2x) =====================\n'
sql += 'insert into public.respostas_pesquisa (nome, email, telefone, momento_compra, principal_objecao, area_interesse, nota_intencao, data_resposta) values\n'
sql += [...respostasOriginal, ...synthResp].map(respRow).join(',\n') + ';\n\n'

sql += `-- Checagem rápida
-- select * from public.v_crm_resumo;
-- Esperado: leads=${leadsOriginal.length * 2}, tentativas=${tentativasOriginal.length * 2}, respostas=${respostasOriginal.length * 2};
`

writeFileSync(new URL('./schema.sql', import.meta.url), sql, 'utf8')
console.log({
  leads: leadsOriginal.length * 2,
  tentativas: tentativasOriginal.length * 2,
  respostas: respostasOriginal.length * 2,
  bytes: sql.length,
})
