-- =============================================================================
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
drop table if exists public.lead_insights cascade;
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

-- Insights Gemini (histórico por lead)
create table public.lead_insights (
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

create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_produto on public.leads(produto_interesse);
create index if not exists idx_tentativas_compra_email on public.tentativas_compra(email);
create index if not exists idx_tentativas_compra_status on public.tentativas_compra(status_pagamento);
create index if not exists idx_respostas_pesquisa_email on public.respostas_pesquisa(email);
create index if not exists idx_respostas_pesquisa_momento on public.respostas_pesquisa(momento_compra);
create index if not exists idx_classifications_lead on public.classifications(id_lead);
create index if not exists idx_tentativas_id_lead on public.tentativas_compra(id_lead);
create index if not exists idx_respostas_id_lead on public.respostas_pesquisa(id_lead);
create index if not exists idx_lead_insights_lead on public.lead_insights(id_lead, created_at desc);

alter table public.leads enable row level security;
alter table public.tentativas_compra enable row level security;
alter table public.respostas_pesquisa enable row level security;
alter table public.classifications enable row level security;
alter table public.lead_insights enable row level security;
alter table public.profiles enable row level security;

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

-- ===================== SEED LEADS (original + sintético 2x) =====================
insert into public.leads (id_lead, nome, email, telefone, origem, produto_interesse, status, data_entrada) values
(32, 'Vanessa Cunha', 'vanessa.cunha@gmail.com', '11912517517', 'youtube', 'Aprovação Contábil', 'Em contato', '08/05/2026'),
(22, 'Leticia Moreira', 'leticia.moreira@yahoo.com.br', '+55 11 90928-9546', 'youtube', 'Aprovação Contábil', 'Qualificado', '19/06/2025'),
(47, 'Maria Oliveira Costa', 'maria.costa@gmail.com', '11979254563', 'email', 'Escola Contábil', 'Ganho', '20/08/2025'),
(24, 'Gabriela Pires', 'GABRIELA.PIRES@YAHOO.COM.BR', '5511916240908', 'youtube', 'Aprovação Contábil', 'Novo', '2025-01-22'),
(5, 'Carlos Eduardo Alves', 'carlos.alves@outlook.com', '(11) 91371-8431', 'instagram', 'MBA em Contabilidade', 'Novo', '19/12/2025'),
(10, 'C. Barbosa', 'camila.barbosa@gmail.com', '11981756179', 'youtube', 'Aprovação Contábil', 'Novo', '01-24-2026'),
(31, 'Eduardo Nogueira', NULL, '11962092888', 'youtube', 'Escola Contábil', 'Em contato', '11 de abril de 2025'),
(23, 'Daniel Castro', 'daniel.castro@yahoo.com.br', '+55 11 92842-7073', 'youtube', 'Pós RT', 'Em contato', '18/01/2026'),
(46, 'Marcio Antunes', 'marcio.antunes@yahoo.com.br', '11937135391', 'instagram', 'Escola Contábil', 'Ganho', '2025-05-28'),
(34, 'Débora Sales', 'debora.sales@yahoo.com.br', '5511938285503', 'email', 'MBA em Contabilidade', 'Novo', '31 de outubro de 2025'),
(20, 'Mariana Dias', 'Mariana.dias@gmail.com', '+55 11 98038-8981', 'whatsapp', 'MBA em Contabilidade', 'Novo', '07/01/2026'),
(42, 'Sabrina Reis', 'sabrina.reis@gmail.com', '11989639081', 'whatsapp', 'Escola Contábil', 'Perdido', '18/05/2025'),
(44, 'Carolina Lopes', NULL, '11992274302', 'whatsapp', 'MBA em Contabilidade', 'Novo', '2025-02-22'),
(19, 'Rodrigo Fernandes', 'rodrigo.fernandes@outlook.com', '11985758349', 'youtube', 'Aprovação Contábil', 'Em contato', '15/06/25'),
(39, 'Diego Camargo', NULL, '5511917566185', 'whatsapp', 'MBA em Contabilidade', 'Em contato', '2025-03-16'),
(8, 'Fernanda Gomes Pinto', 'fernanda.pinto@outlook.com', '(11) 91070-9497', 'youtube', 'Escola Contábil', 'Em contato', '10/04/2026'),
(36, 'Priscila Fonseca', 'priscila.fonseca@hotmail.com', '11907634247', 'instagram', 'Aprovação Contábil', 'Novo', '11 de março de 2025'),
(41, 'Henrique Duarte', 'HENRIQUE.DUARTE@HOTMAIL.COM', '11949597086', 'whatsapp', 'Aprovação Contábil', 'Em contato', '6 de novembro de 2025'),
(18, 'Amanda Correia', 'AMANDA.CORREIA@GMAIL.COM', '+55 11 99691-7555', 'whatsapp', 'Aprovação Contábil', 'Em contato', '19/04/25'),
(1, 'Joao Silva Souza', NULL, '+55 11 90335-6886', 'whatsapp', 'Aprovação Contábil', 'Novo', '2025-04-15'),
(16, 'Beatriz Araujo', 'beatriz.araujo@yahoo.com.br', '11951220073', 'email', 'Pós RT', 'Perdido', '12/01/2025'),
(3, 'Pedro Henrique Lima', NULL, '+55 11 97532-9037', 'youtube', 'MBA em Contabilidade', 'Novo', '12 de outubro de 2025'),
(27, 'André Vieira', 'Andre.vieira@hotmail.com', '+55 11 99708-6737', 'email', 'Aprovação Contábil', 'Ganho', '21/02/2026'),
(14, 'L. Carvalho', NULL, '(11) 97846-1803', 'email', 'MBA em Contabilidade', 'Em contato', '22 de maio de 2025'),
(43, 'Otavio Brandao', 'otavio.brandao@gmail.com', '(11) 99964-5480', 'youtube', 'Pós RT', 'Em contato', '04/08/2025'),
(13, 'Thiago Ribeiro', 'THIAGO.RIBEIRO@YAHOO.COM.BR', '5511953100814', 'email', 'Aprovação Contábil', 'Novo', '2025-09-10'),
(33, 'R. Azevedo', 'ricardo.azevedo@yahoo.com.br', '5511907869910', 'youtube', 'MBA em Contabilidade', 'Novo', '04/02/26'),
(29, 'Leonardo Mendes', 'leonardo.mendes@gmail.com', '5511990377459', 'instagram', 'Escola Contábil', 'Em contato', '14/12/2025'),
(11, 'Bruno Cardoso', 'Bruno.cardoso@hotmail.com', '+55 11 99188-7369', 'whatsapp', 'Escola Contábil', 'Novo', '2025-02-02'),
(15, 'Gustavo Teixeira', 'Gustavo.teixeira@gmail.com', '+55 11 90632-3852', 'instagram', 'Aprovação Contábil', 'Qualificado', '2026-03-09'),
(7, 'Rafael Almeida', 'rafael.almeida@outlook.com', '5511984374605', 'whatsapp', 'Aprovação Contábil', 'Qualificado', '2025-02-16'),
(21, 'V. Rocha', NULL, '11932138745', 'instagram', 'Aprovação Contábil', 'Perdido', '22 de março de 2025'),
(25, 'Marcelo Freitas', 'marcelo.freitas@hotmail.com', '+55 11 97897-9095', 'youtube', 'Escola Contábil', 'Novo', '2025-03-02'),
(17, 'Felipe Monteiro', 'Felipe.monteiro@gmail.com', '(11) 99149-7616', 'whatsapp', 'Pós RT', 'Novo', '2026-03-22'),
(4, 'Ana Beatriz Ferreira', 'ana.ferreira@gmail.com', '5511921429110', 'email', 'Pós RT', 'Em contato', '09/08/25'),
(12, 'Patrícia Nunes', 'patricia.nunes@yahoo.com.br', '5511935935572', 'instagram', 'Aprovação Contábil', 'Perdido', '2025-11-19'),
(30, 'Natália Barros', NULL, '+55 11 93337-4088', 'youtube', 'Aprovação Contábil', 'Em contato', '05-24-2025'),
(48, 'Guilherme Peixoto', 'guilherme.peixoto@hotmail.com', '+55 11 95419-3837', 'instagram', 'Aprovação Contábil', 'Ganho', '02-16-2025'),
(28, 'Isabela Ramos', 'isabela.ramos@gmail.com', '(11) 98844-7167', 'email', 'Pós RT', 'Em contato', '24/04/26'),
(6, 'Juliana Rodrigues', NULL, '(11) 99794-2942', 'email', 'Escola Contábil', 'Perdido', '2026-01-23'),
(45, 'M. Antunes', NULL, '11937135391', 'instagram', 'Escola Contábil', 'Em contato', '05-14-2025'),
(37, 'Guilherme Peixoto', 'guilherme.peixoto@hotmail.com', '11954193837', 'instagram', 'Aprovação Contábil', 'Qualificado', '02-10-2025'),
(38, 'Aline Tavares', 'Aline.tavares@yahoo.com.br', '11988231132', 'whatsapp', 'Pós RT', 'Novo', '2025-11-18'),
(26, 'Renata Cavalcanti', 'renata.cavalcanti@gmail.com', '11944349361', 'instagram', 'Aprovação Contábil', 'Em contato', '05-13-2026'),
(2, 'Maria Oliveira Costa', NULL, '11979254563', 'email', 'Escola Contábil', 'Novo', '12/08/25'),
(35, 'Fabio Macedo', 'FABIO.MACEDO@GMAIL.COM', '11977736262', 'instagram', 'Pós RT', 'Novo', '04/05/2026'),
(40, 'B. Farias', 'bianca.farias@gmail.com', '(11) 90983-2887', 'youtube', 'Pós RT', 'Novo', '12-24-2025'),
(9, 'Lucas Martins', 'lucas.martins@outlook.com', '(11) 92183-1063', 'whatsapp', 'Pós RT', 'Novo', '2025-10-01'),
(101, 'Alice Souza', NULL, '11991000000', 'youtube', 'Aprovação Contábil', 'Novo', '12/01/2025'),
(102, 'Brenda Campos', 'brenda.campos102@exemplo.crm.br', '11991000137', 'instagram', 'Escola Contábil', 'Em contato', '03/03/2025'),
(103, 'Caio Farias', 'caio.farias103@exemplo.crm.br', '11991000274', 'whatsapp', 'MBA em Contabilidade', 'Qualificado', '15/06/2025'),
(104, 'Diana Ibanez', 'diana.ibanez104@exemplo.crm.br', '11991000411', 'email', 'Pós RT', 'Ganho', '22/09/2025'),
(105, 'Elias Leal', 'elias.leal105@exemplo.crm.br', '11991000548', 'youtube', 'Aprovação Contábil', 'Perdido', '01/11/2025'),
(106, 'Flavia Ortega', 'flavia.ortega106@exemplo.crm.br', '11991000685', 'instagram', 'Escola Contábil', 'Novo', '18/01/2026'),
(107, 'Gabriel Rezende', 'gabriel.rezende107@exemplo.crm.br', '11991000822', 'whatsapp', 'MBA em Contabilidade', 'Em contato', '07/02/2026'),
(108, 'Helena Uchoa', NULL, '11991000959', 'email', 'Pós RT', 'Qualificado', '2025-04-11'),
(109, 'Igor Xavier', 'igor.xavier109@exemplo.crm.br', '11991001096', 'youtube', 'Aprovação Contábil', 'Ganho', '05-20-2025'),
(110, 'Jana Andrade', 'jana.andrade110@exemplo.crm.br', '11991001233', 'instagram', 'Escola Contábil', 'Perdido', '11 de julho de 2025'),
(111, 'Kaique Souza', 'kaique.souza111@exemplo.crm.br', '11991001370', 'whatsapp', 'MBA em Contabilidade', 'Novo', '03 de janeiro de 2026'),
(112, 'Lara Campos', 'lara.campos112@exemplo.crm.br', '11991001507', 'email', 'Pós RT', 'Em contato', '2026-05-09'),
(113, 'Murilo Farias', 'murilo.farias113@exemplo.crm.br', '11991001644', 'youtube', 'Aprovação Contábil', 'Qualificado', '12/01/2025'),
(114, 'Nina Ibanez', 'nina.ibanez114@exemplo.crm.br', '11991001781', 'instagram', 'Escola Contábil', 'Ganho', '03/03/2025'),
(115, 'Otto Leal', NULL, '11991001918', 'whatsapp', 'MBA em Contabilidade', 'Perdido', '15/06/2025'),
(116, 'Paula Ortega', 'paula.ortega116@exemplo.crm.br', '11991002055', 'email', 'Pós RT', 'Novo', '22/09/2025'),
(117, 'Quirino Rezende', 'quirino.rezende117@exemplo.crm.br', '11991002192', 'youtube', 'Aprovação Contábil', 'Em contato', '01/11/2025'),
(118, 'Rafaela Uchoa', 'rafaela.uchoa118@exemplo.crm.br', '11991002329', 'instagram', 'Escola Contábil', 'Qualificado', '18/01/2026'),
(119, 'Sergio Xavier', 'sergio.xavier119@exemplo.crm.br', '11991002466', 'whatsapp', 'MBA em Contabilidade', 'Ganho', '07/02/2026'),
(120, 'Taina Andrade', 'taina.andrade120@exemplo.crm.br', '11991002603', 'email', 'Pós RT', 'Perdido', '2025-04-11'),
(121, 'Ursula Souza', 'ursula.souza121@exemplo.crm.br', '11991002740', 'youtube', 'Aprovação Contábil', 'Novo', '05-20-2025'),
(122, 'Vitor Campos', NULL, '11991002877', 'instagram', 'Escola Contábil', 'Em contato', '11 de julho de 2025'),
(123, 'Wagner Farias', 'wagner.farias123@exemplo.crm.br', '11991003014', 'whatsapp', 'MBA em Contabilidade', 'Qualificado', '03 de janeiro de 2026'),
(124, 'Yasmin Ibanez', 'yasmin.ibanez124@exemplo.crm.br', '11991003151', 'email', 'Pós RT', 'Ganho', '2026-05-09'),
(125, 'Zelia Leal', 'zelia.leal125@exemplo.crm.br', '11991003288', 'youtube', 'Aprovação Contábil', 'Perdido', '12/01/2025'),
(126, 'Arthur Ortega', 'arthur.ortega126@exemplo.crm.br', '11991003425', 'instagram', 'Escola Contábil', 'Novo', '03/03/2025'),
(127, 'Bia Rezende', 'bia.rezende127@exemplo.crm.br', '11991003562', 'whatsapp', 'MBA em Contabilidade', 'Em contato', '15/06/2025'),
(128, 'Cesar Uchoa', 'cesar.uchoa128@exemplo.crm.br', '11991003699', 'email', 'Pós RT', 'Qualificado', '22/09/2025'),
(129, 'Duda Xavier', NULL, '11991003836', 'youtube', 'Aprovação Contábil', 'Ganho', '01/11/2025'),
(130, 'Enzo Andrade', 'enzo.andrade130@exemplo.crm.br', '11991003973', 'instagram', 'Escola Contábil', 'Perdido', '18/01/2026'),
(131, 'Fatima Souza', 'fatima.souza131@exemplo.crm.br', '11991004110', 'whatsapp', 'MBA em Contabilidade', 'Novo', '07/02/2026'),
(132, 'Giovana Campos', 'giovana.campos132@exemplo.crm.br', '11991004247', 'email', 'Pós RT', 'Em contato', '2025-04-11'),
(133, 'Heitor Farias', 'heitor.farias133@exemplo.crm.br', '11991004384', 'youtube', 'Aprovação Contábil', 'Qualificado', '05-20-2025'),
(134, 'Ingrid Ibanez', 'ingrid.ibanez134@exemplo.crm.br', '11991004521', 'instagram', 'Escola Contábil', 'Ganho', '11 de julho de 2025'),
(135, 'Jonas Leal', 'jonas.leal135@exemplo.crm.br', '11991004658', 'whatsapp', 'MBA em Contabilidade', 'Perdido', '03 de janeiro de 2026'),
(136, 'Katia Ortega', NULL, '11991004795', 'email', 'Pós RT', 'Novo', '2026-05-09'),
(137, 'Luan Rezende', 'luan.rezende137@exemplo.crm.br', '11991004932', 'youtube', 'Aprovação Contábil', 'Em contato', '12/01/2025'),
(138, 'Monica Uchoa', 'monica.uchoa138@exemplo.crm.br', '11991005069', 'instagram', 'Escola Contábil', 'Qualificado', '03/03/2025'),
(139, 'Noel Xavier', 'noel.xavier139@exemplo.crm.br', '11991005206', 'whatsapp', 'MBA em Contabilidade', 'Ganho', '15/06/2025'),
(140, 'Olivia Andrade', 'olivia.andrade140@exemplo.crm.br', '11991005343', 'email', 'Pós RT', 'Perdido', '22/09/2025'),
(141, 'Pietro Souza', 'pietro.souza141@exemplo.crm.br', '11991005480', 'youtube', 'Aprovação Contábil', 'Novo', '01/11/2025'),
(142, 'Queila Campos', 'queila.campos142@exemplo.crm.br', '11991005617', 'instagram', 'Escola Contábil', 'Em contato', '18/01/2026'),
(143, 'Ruan Farias', NULL, '11991005754', 'whatsapp', 'MBA em Contabilidade', 'Qualificado', '07/02/2026'),
(144, 'Sofia Ibanez', 'sofia.ibanez144@exemplo.crm.br', '11991005891', 'email', 'Pós RT', 'Ganho', '2025-04-11'),
(145, 'Tiago Leal', 'tiago.leal145@exemplo.crm.br', '11991006028', 'youtube', 'Aprovação Contábil', 'Perdido', '05-20-2025'),
(146, 'Ubirajara Ortega', 'ubirajara.ortega146@exemplo.crm.br', '11991006165', 'instagram', 'Escola Contábil', 'Novo', '11 de julho de 2025'),
(147, 'Vera Rezende', 'vera.rezende147@exemplo.crm.br', '11991006302', 'whatsapp', 'MBA em Contabilidade', 'Em contato', '03 de janeiro de 2026'),
(148, 'William Uchoa', 'william.uchoa148@exemplo.crm.br', '11991006439', 'email', 'Pós RT', 'Qualificado', '2026-05-09');

-- ===================== SEED TENTATIVAS (original + sintético 2x) =====================
insert into public.tentativas_compra (nome, email, telefone, produto, valor, forma_pagamento, status_pagamento, data_tentativa) values
('Fábio Macedo', 'fabio.macedo@gmail.com', '11977736262', 'MBA em Contabilidade', 5990.00, 'cartão', 'abandonado', '08/10/25'),
('Juliana Rodrigues', 'juliana.rodrigues@gmail.com', NULL, 'Pós RT', 3497.00, 'pix', 'recusado', '15 de setembro de 2025'),
('Daniel Castro', 'DANIEL.CASTRO@YAHOO.COM.BR', '11928427073', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2025-07-06'),
('Mariana Dias', 'mariana.dias@gmail.com', '11980388981', 'MBA em Contabilidade', 5990.00, 'pix', 'aprovado', '04-19-2026'),
('Vanessa Cunha', NULL, '(11) 91251-7517', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '14/03/26'),
('A. Tavares', 'ALINE.TAVARES@YAHOO.COM.BR', '(11) 98823-1132', 'Escola Contábil', 1997.00, 'pix', 'recusado', '2026-05-01'),
('André Vieira', 'ANDRE.VIEIRA@HOTMAIL.COM', '(11) 99708-6737', 'Aprovação Contábil', 997.00, 'boleto', 'abandonado', '17/06/26'),
('Leonardo Mendes', 'leonardo.mendes@gmail.com', '(11) 99037-7459', 'MBA em Contabilidade', 5990.00, 'boleto', 'abandonado', '2025-03-20'),
('Gabriela Pires', NULL, '+55 11 91624-0908', 'Escola Contábil', 1997.00, 'pix', 'aprovado', '2026-02-25'),
('Claudia Marques', 'CLAUDIA.MARQUES@YAHOO.COM.BR', '(31) 99123-4567', 'Pós RT', 3497.00, 'cartão', 'recusado', '05-20-2025'),
('Marcio Antunes', 'marcio.antunes@yahoo.com.br', '(11) 93713-5391', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '21 de junho de 2025'),
('Larissa Carvalho', NULL, '5511978461803', 'MBA em Contabilidade', 5990.00, 'cartão', 'aprovado', '11/06/2026'),
('Felipe Monteiro', 'FELIPE.MONTEIRO2@GMAIL.COM', '11991497616', 'Pós RT', 3497.00, 'cartão', 'pendente', '27/03/2025'),
('Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '+55 11 95419-3837', 'Aprovação Contábil', 997.00, 'boleto', 'recusado', '11/05/2026'),
('Diego Camargo', 'Diego.camargo@yahoo.com.br', '5511917566185', 'Aprovação Contábil', 997.00, 'boleto', 'recusado', '2025-05-09'),
('Thiago Ribeiro', 'thiago.ribeiro@yahoo.com.br', '+55 11 95310-0814', 'Aprovação Contábil', 997.00, 'pix', 'abandonado', '13/04/2025'),
('Fábio Macedo', 'fabio.macedo@gmail.com', '(11) 97773-6262', 'Aprovação Contábil', 997.00, 'cartão', 'recusado', '07-02-2025'),
('Ana Beatriz Ferreira', 'ANA.FERREIRA@GMAIL.COM', '+55 11 92142-9110', 'Pós RT', 3497.00, 'pix', 'aprovado', '30/11/2025'),
('Juliana Rodrigues', NULL, '11997942942', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '27 de outubro de 2025'),
('Otavio Brandao', 'otavio.brandao@gmail.com', '5511999645480', 'MBA em Contabilidade', 5990.00, 'cartão', 'aprovado', '08/05/2026'),
('Leonardo Mendes', 'Leonardo.mendes@gmail.com', '11990377459', 'MBA em Contabilidade', 5990.00, 'pix', 'aprovado', '22/11/25'),
('Roberto Tanaka', 'roberto.tanaka@gmail.com', '+55 41 98888-4444', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '29/09/2025'),
('Patricia Nunes', NULL, '11935935572', 'MBA em Contabilidade', 5990.00, 'cartão', 'recusado', '02/07/2025'),
('Rodrigo Fernandes', 'Rodrigo.fernandes@outlook.com', '(11) 98575-8349', 'Aprovação Contábil', 997.00, 'cartão', 'recusado', '15 de fevereiro de 2025'),
('Pedro Henrique Lima', 'PEDRO.LIMA@GMAIL.COM', '11975329037', 'MBA em Contabilidade', 5990.00, 'pix', 'recusado', '04-24-2025'),
('Aline Tavares', 'Aline.tavares@yahoo.com.br', '11988231132', 'Pós RT', 3497.00, 'pix', 'recusado', '15/03/2026'),
('Marcio Antunes', 'Marcio.antunes@yahoo.com.br', '11937135391', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '11-21-2025'),
('Sandra Regina Melo', 'Sandra.melo@gmail.com', '+55 11 96123-4567', 'Pós RT', 3497.00, 'boleto', 'aprovado', '05-12-2025'),
('Rafael Almeida', 'rafael.almeida@outlook.com', '(11) 98437-4605', 'Aprovação Contábil', 997.00, 'pix', 'recusado', '19/06/26'),
('Bruno Cardoso', 'bruno.cardoso@hotmail.com', NULL, 'Escola Contábil', 1997.00, 'cartão', 'recusado', '28/05/2026'),
('Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '(11) 95419-3837', 'Aprovação Contábil', 997.00, 'cartão', 'recusado', '2025-10-08'),
('G. Pires', 'Gabriela.pires@yahoo.com.br', '+55 11 91624-0908', 'Aprovação Contábil', 997.00, 'pix', 'abandonado', '13/05/25'),
('Renata Cavalcanti', 'renata.cavalcanti@gmail.com', '(11) 94434-9361', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '14/12/25'),
('Joao Silva Souza', 'joao.souza@gmail.com', '11903356886', 'Aprovação Contábil', 997.00, 'boleto', 'pendente', '17/04/2026'),
('Diego Camargo', 'Diego.camargo@yahoo.com.br', '11917566185', 'MBA em Contabilidade', 5990.00, 'cartão', 'abandonado', '2025-05-07'),
('Renata Cavalcanti', 'Renata.cavalcanti@gmail.com', '5511944349361', 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '04-16-2026'),
('Camila Barbosa', 'camila.barbosa@gmail.com', '+55 11 98175-6179', 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '15/06/25'),
('D. Sales', 'debora.sales@yahoo.com.br', '+55 11 93828-5503', 'MBA em Contabilidade', 5990.00, 'boleto', 'aprovado', '05/07/2026'),
('Rafael Almeida', 'rafael.almeida@outlook.com', '+55 11 98437-4605', 'Aprovação Contábil', 997.00, 'cartão', 'abandonado', '3 de novembro de 2025'),
('Felipe Monteiro', 'Felipe.monteiro@gmail.com', '5511991497616', 'Pós RT', 3497.00, 'pix', 'aprovado', '2026-06-06'),
('Henrique Duarte', 'henrique.duarte@hotmail.com', '+55 11 94959-7086', 'Aprovação Contábil', 997.00, 'pix', 'pendente', '16 de maio de 2026'),
('Beatriz Araujo', 'beatriz.araujo@yahoo.com.br', '11951220073', 'Pós RT', 3497.00, 'cartão', 'abandonado', '2026-06-03'),
('Carolina Lopes', 'carolina.lopes@hotmail.com', '5511992274302', 'MBA em Contabilidade', 5990.00, 'pix', 'pendente', '2025-08-22'),
('E. Nogueira', 'EDUARDO.NOGUEIRA@OUTLOOK.COM', '(11) 96209-2888', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '4 de novembro de 2025'),
('Fernanda Gomes Pinto', 'Fernanda.pinto@outlook.com', '11910709497', 'Escola Contábil', 1997.00, 'cartão', 'aprovado', '2026-03-24'),
('Isabela Ramos', 'ISABELA.RAMOS@GMAIL.COM', '5511988447167', 'Pós RT', 3497.00, 'boleto', 'abandonado', '09/06/26'),
('Andre Vieira', 'andre.vieira@hotmail.com', '11997086737', 'Aprovação Contábil', 997.00, 'boleto', 'abandonado', '3 de outubro de 2025'),
('S. Reis', NULL, '11989639081', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2025-11-23'),
('otávio brandão', 'otavio.brandao@gmail.com', NULL, 'Pós RT', 3497.00, 'boleto', 'aprovado', '2025-09-06'),
('Bianca Farias', 'bianca.farias@gmail.com', '11909832887', 'Pós RT', 3497.00, 'pix', 'abandonado', '2 de fevereiro de 2025'),
('LUCAS MARTINS', 'LUCAS.MARTINS@OUTLOOK.COM', '(11) 92183-1063', 'Pós RT', 3497.00, 'cartão', 'recusado', '20/06/2026'),
('Ana Beatriz Ferreira', 'ana.ferreira@gmail.com', '+55 11 92142-9110', 'Pós RT', 3497.00, 'boleto', 'pendente', '05-14-2026'),
('Vinicius Rocha', 'vinicius.rocha@outlook.com', '+55 11 93213-8745', 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '22 de abril de 2025'),
('Isabela Ramos', 'ISABELA.RAMOS20@GMAIL.COM', '(11) 98844-7167', 'Pós RT', 3497.00, 'boleto', 'recusado', '02/04/2026'),
('Débora Sales', NULL, '+55 11 93828-5503', 'MBA em Contabilidade', 5990.00, 'pix', 'aprovado', '29/01/26'),
('Lucas Martins', 'lucas.martins@outlook.com', '11921831063', 'Pós RT', 3497.00, 'pix', 'abandonado', '6 de abril de 2026'),
('Maria Oliveira Costa', NULL, '11979254563', 'Escola Contábil', 1997.00, 'boleto', 'aprovado', '03-18-2026'),
('Paulo César Xavier', 'PAULO.XAVIER@OUTLOOK.COM', '21987651234', 'Escola Contábil', 1997.00, 'boleto', 'pendente', '2025-05-20'),
('ricardo azevedo', 'Ricardo.azevedo@yahoo.com.br', '11907869910', 'MBA em Contabilidade', 5990.00, 'pix', 'abandonado', '02-16-2025'),
('Leticia Moreira', NULL, '11909289546', 'Escola Contábil', 1997.00, 'pix', 'aprovado', '2025-11-07'),
('Natália Barros', 'Natalia.barros@gmail.com', '11933374088', 'Pós RT', 3497.00, 'boleto', 'aprovado', '10/06/2025'),
('priscila fonseca', 'priscila.fonseca89@hotmail.com', '11907634247', 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '23/05/26'),
('Gustavo Teixeira', 'Gustavo.teixeira@gmail.com', '5511906323852', 'Aprovação Contábil', 997.00, 'cartão', 'pendente', '27/02/2025'),
('Flavia Ibanez Sint', NULL, NULL, 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Gabriel Junqueira Sint', 'gabriel.junqueira.sint1@exemplo.crm.br', '11982000091', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Helena Klein Sint', 'helena.klein.sint2@exemplo.crm.br', '11982000182', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025'),
('Igor Leal Sint', 'igor.leal.sint3@exemplo.crm.br', '11982000273', 'Pós RT', 5990.00, 'pix', 'pendente', '18/01/2026'),
('Jana Moraes Sint', 'jana.moraes.sint4@exemplo.crm.br', '11982000364', 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '07/02/2026'),
('Kaique Neves Sint', NULL, '11982000455', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '2025-04-11'),
('Lara Ortega Sint', 'lara.ortega.sint6@exemplo.crm.br', '11982000546', 'MBA em Contabilidade', 3497.00, 'pix', 'recusado', '05-20-2025'),
('Murilo Pacheco Sint', 'murilo.pacheco.sint7@exemplo.crm.br', '11982000637', 'Pós RT', 5990.00, 'cartão', 'pendente', '11 de julho de 2025'),
('Nina Queiroz Sint', 'nina.queiroz.sint8@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'boleto', 'aprovado', '03 de janeiro de 2026'),
('Otto Rezende Sint', 'otto.rezende.sint9@exemplo.crm.br', '11982000819', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2026-05-09'),
('Paula Siqueira Sint', NULL, '11982000910', 'MBA em Contabilidade', 3497.00, 'cartão', 'recusado', '12/01/2025'),
('Quirino Torres Sint', 'quirino.torres.sint11@exemplo.crm.br', '11982001001', 'Pós RT', 5990.00, 'boleto', 'pendente', '03/03/2025'),
('Rafaela Uchoa Sint', 'rafaela.uchoa.sint12@exemplo.crm.br', '11982001092', 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Sergio Valente Sint', 'sergio.valente.sint13@exemplo.crm.br', '11982001183', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Taina Werneck Sint', 'taina.werneck.sint14@exemplo.crm.br', '11982001274', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025'),
('Ursula Xavier Sint', NULL, '11982001365', 'Pós RT', 5990.00, 'pix', 'pendente', '18/01/2026'),
('Vitor Yamamoto Sint', 'vitor.yamamoto.sint16@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '07/02/2026'),
('Wagner Zanetti Sint', 'wagner.zanetti.sint17@exemplo.crm.br', '11982001547', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '2025-04-11'),
('Yasmin Andrade Sint', 'yasmin.andrade.sint18@exemplo.crm.br', '11982001638', 'MBA em Contabilidade', 3497.00, 'pix', 'recusado', '05-20-2025'),
('Zelia Brito Sint', 'zelia.brito.sint19@exemplo.crm.br', '11982001729', 'Pós RT', 5990.00, 'cartão', 'pendente', '11 de julho de 2025'),
('Arthur Correia Sint', NULL, '11982001820', 'Aprovação Contábil', 997.00, 'boleto', 'aprovado', '03 de janeiro de 2026'),
('Bia Souza Sint', 'bia.souza.sint21@exemplo.crm.br', '11982001911', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2026-05-09'),
('Cesar Almeida Sint', 'cesar.almeida.sint22@exemplo.crm.br', '11982002002', 'MBA em Contabilidade', 3497.00, 'cartão', 'recusado', '12/01/2025'),
('Duda Barbosa Sint', 'duda.barbosa.sint23@exemplo.crm.br', '11982002093', 'Pós RT', 5990.00, 'boleto', 'pendente', '03/03/2025'),
('Enzo Campos Sint', 'enzo.campos.sint24@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Fatima Dantas Sint', NULL, '11982002275', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Giovana Esteves Sint', 'giovana.esteves.sint26@exemplo.crm.br', '11982002366', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025'),
('Heitor Farias Sint', 'heitor.farias.sint27@exemplo.crm.br', '11982002457', 'Pós RT', 5990.00, 'pix', 'pendente', '18/01/2026'),
('Ingrid Guedes Sint', 'ingrid.guedes.sint28@exemplo.crm.br', '11982002548', 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '07/02/2026'),
('Jonas Holanda Sint', 'jonas.holanda.sint29@exemplo.crm.br', '11982002639', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '2025-04-11'),
('Katia Ibanez Sint', NULL, '11982002730', 'MBA em Contabilidade', 3497.00, 'pix', 'recusado', '05-20-2025'),
('Luan Junqueira Sint', 'luan.junqueira.sint31@exemplo.crm.br', '11982002821', 'Pós RT', 5990.00, 'cartão', 'pendente', '11 de julho de 2025'),
('Monica Klein Sint', 'monica.klein.sint32@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'boleto', 'aprovado', '03 de janeiro de 2026'),
('Noel Leal Sint', 'noel.leal.sint33@exemplo.crm.br', '11982003003', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2026-05-09'),
('Olivia Moraes Sint', 'olivia.moraes.sint34@exemplo.crm.br', '11982003094', 'MBA em Contabilidade', 3497.00, 'cartão', 'recusado', '12/01/2025'),
('Pietro Neves Sint', NULL, '11982003185', 'Pós RT', 5990.00, 'boleto', 'pendente', '03/03/2025'),
('Queila Ortega Sint', 'queila.ortega.sint36@exemplo.crm.br', '11982003276', 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Ruan Pacheco Sint', 'ruan.pacheco.sint37@exemplo.crm.br', '11982003367', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Sofia Queiroz Sint', 'sofia.queiroz.sint38@exemplo.crm.br', '11982003458', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025'),
('Tiago Rezende Sint', 'tiago.rezende.sint39@exemplo.crm.br', '11982003549', 'Pós RT', 5990.00, 'pix', 'pendente', '18/01/2026'),
('Ubirajara Siqueira Sint', NULL, NULL, 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '07/02/2026'),
('Vera Torres Sint', 'vera.torres.sint41@exemplo.crm.br', '11982003731', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '2025-04-11'),
('William Uchoa Sint', 'william.uchoa.sint42@exemplo.crm.br', '11982003822', 'MBA em Contabilidade', 3497.00, 'pix', 'recusado', '05-20-2025'),
('Alice Valente Sint', 'alice.valente.sint43@exemplo.crm.br', '11982003913', 'Pós RT', 5990.00, 'cartão', 'pendente', '11 de julho de 2025'),
('Brenda Werneck Sint', 'brenda.werneck.sint44@exemplo.crm.br', '11982004004', 'Aprovação Contábil', 997.00, 'boleto', 'aprovado', '03 de janeiro de 2026'),
('Caio Xavier Sint', NULL, '11982004095', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2026-05-09'),
('Diana Yamamoto Sint', 'diana.yamamoto.sint46@exemplo.crm.br', '11982004186', 'MBA em Contabilidade', 3497.00, 'cartão', 'recusado', '12/01/2025'),
('Elias Zanetti Sint', 'elias.zanetti.sint47@exemplo.crm.br', '11982004277', 'Pós RT', 5990.00, 'boleto', 'pendente', '03/03/2025'),
('Flavia Andrade Sint', 'flavia.andrade.sint48@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Gabriel Brito Sint', 'gabriel.brito.sint49@exemplo.crm.br', '11982004459', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Helena Correia Sint', NULL, '11982004550', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025'),
('Igor Souza Sint', 'igor.souza.sint51@exemplo.crm.br', '11982004641', 'Pós RT', 5990.00, 'pix', 'pendente', '18/01/2026'),
('Jana Almeida Sint', 'jana.almeida.sint52@exemplo.crm.br', '11982004732', 'Aprovação Contábil', 997.00, 'cartão', 'aprovado', '07/02/2026'),
('Kaique Barbosa Sint', 'kaique.barbosa.sint53@exemplo.crm.br', '11982004823', 'Escola Contábil', 1997.00, 'boleto', 'abandonado', '2025-04-11'),
('Lara Campos Sint', 'lara.campos.sint54@exemplo.crm.br', '11982004914', 'MBA em Contabilidade', 3497.00, 'pix', 'recusado', '05-20-2025'),
('Murilo Dantas Sint', NULL, '11982005005', 'Pós RT', 5990.00, 'cartão', 'pendente', '11 de julho de 2025'),
('Nina Esteves Sint', 'nina.esteves.sint56@exemplo.crm.br', NULL, 'Aprovação Contábil', 997.00, 'boleto', 'aprovado', '03 de janeiro de 2026'),
('Otto Farias Sint', 'otto.farias.sint57@exemplo.crm.br', '11982005187', 'Escola Contábil', 1997.00, 'pix', 'abandonado', '2026-05-09'),
('Paula Guedes Sint', 'paula.guedes.sint58@exemplo.crm.br', '11982005278', 'MBA em Contabilidade', 3497.00, 'cartão', 'recusado', '12/01/2025'),
('Quirino Holanda Sint', 'quirino.holanda.sint59@exemplo.crm.br', '11982005369', 'Pós RT', 5990.00, 'boleto', 'pendente', '03/03/2025'),
('Rafaela Ibanez Sint', NULL, '11982005460', 'Aprovação Contábil', 997.00, 'pix', 'aprovado', '15/06/2025'),
('Sergio Junqueira Sint', 'sergio.junqueira.sint61@exemplo.crm.br', '11982005551', 'Escola Contábil', 1997.00, 'cartão', 'abandonado', '22/09/2025'),
('Taina Klein Sint', 'taina.klein.sint62@exemplo.crm.br', '11982005642', 'MBA em Contabilidade', 3497.00, 'boleto', 'recusado', '01/11/2025');

-- ===================== SEED RESPOSTAS (original + sintético 2x) =====================
insert into public.respostas_pesquisa (nome, email, telefone, momento_compra, principal_objecao, area_interesse, nota_intencao, data_resposta) values
('GABRIELA PIRES', 'gabriela.pires@yahoo.com.br', '11916240908', 'só pesquisando', 'indecisão', 'primeiro emprego', 10, '21/12/2025'),
('D. Castro', NULL, '(11) 92842-7073', 'em alguns meses', 'confiança', 'primeiro emprego', NULL, '02-01-2026'),
('renata cavalcanti', 'renata.cavalcanti@gmail.com', '(11) 94434-9361', 'só pesquisando', 'preço', 'primeiro emprego', 8, '21 de fevereiro de 2026'),
('henrique duarte', 'henrique.duarte@hotmail.com', '5511949597086', 'só pesquisando', 'confiança', 'abrir escritório', NULL, '2026-01-27'),
('PATRÍCIA NUNES', 'patricia.nunes@yahoo.com.br', '11935935572', 'só pesquisando', 'indecisão', 'abrir escritório', 2, '6 de abril de 2025'),
('Mariana Dias', NULL, '+55 11 98038-8981', 'só pesquisando', 'tempo', 'atualização profissional', NULL, '2026-03-28'),
('Marcelo Freitas', 'marcelo.freitas@hotmail.com', '(11) 97897-9095', 'em alguns meses', 'tempo', 'atualização profissional', 1, '09-16-2025'),
('PEDRO HENRIQUE LIMA', NULL, '11975329037', 'quero comprar já', 'tempo', 'carreira pública', 4, '30 de maio de 2026'),
('Rafael Almeida', 'rafael.almeida@outlook.com', '11984374605', 'quero comprar já', 'preço', 'atualização profissional', 1, '18/01/26'),
('SABRINA REIS', 'sabrina.reis@gmail.com', '+55 11 98963-9081', 'quero comprar já', 'confiança', 'carreira pública', 5, '8 de maio de 2025'),
('Vinicius Rocha', 'vinicius.rocha@outlook.com', '(11) 93213-8745', 'em alguns meses', 'tempo', 'primeiro emprego', 1, '21/03/2025'),
('Marcos Vinícius Prado', 'marcos.prado@hotmail.com', '51993334444', 'em alguns meses', 'indecisão', 'atualização profissional', 5, '2025-06-04'),
('BRUNO CARDOSO', 'Bruno.cardoso@hotmail.com', '(11) 99188-7369', 'em alguns meses', 'preço', 'atualização profissional', 5, '17 de maio de 2025'),
('MÁRCIO ANTUNES', 'Marcio.antunes@yahoo.com.br', '(11) 93713-5391', 'quero comprar já', 'confiança', 'abrir escritório', 2, '07-07-2025'),
('A. Tavares', 'aline.tavares@yahoo.com.br', '11988231132', 'só pesquisando', 'tempo', 'primeiro emprego', 1, '25/06/25'),
('Guilherme Peixoto', 'GUILHERME.PEIXOTO@HOTMAIL.COM', '+55 11 95419-3837', 'só pesquisando', 'preço', 'primeiro emprego', 9, '15 de junho de 2025'),
('FELIPE MONTEIRO', NULL, '11991497616', 'quero comprar já', 'preço', 'carreira pública', 4, '09-09-2025'),
('Tatiane Ferreira', 'Tatiane.ferreira@gmail.com', '61995556666', 'quero comprar já', 'indecisão', 'carreira pública', 6, '03/01/26'),
('letícia moreira', 'Leticia.moreira@yahoo.com.br', '5511909289546', 'em alguns meses', 'tempo', 'abrir escritório', 4, '27/05/26'),
('fernanda gomes pinto', NULL, '+55 11 91070-9497', 'em alguns meses', 'indecisão', 'primeiro emprego', 6, '2026-06-30'),
('Priscila Fonseca', 'priscila.fonseca@hotmail.com', '+55 11 90763-4247', 'quero comprar já', 'confiança', 'carreira pública', 8, '07-05-2026'),
('Elaine dos Santos', 'elaine.santos@gmail.com', '5511970001111', 'quero comprar já', 'confiança', 'primeiro emprego', NULL, '18 de maio de 2026'),
('Ana Beatriz Ferreira', 'ANA.FERREIRA@GMAIL.COM', '5511921429110', 'em alguns meses', 'preço', 'abrir escritório', 2, '2025-11-26'),
('Ricardo Azevedo', NULL, '5511907869910', 'quero comprar já', 'confiança', 'primeiro emprego', 8, '15/03/26'),
('Juliana Rodrigues', NULL, '11997942942', 'em alguns meses', 'preço', 'primeiro emprego', 8, '2025-04-17'),
('I. Ramos', NULL, '(11) 98844-7167', 'quero comprar já', 'indecisão', 'atualização profissional', 9, '2025-03-15'),
('Otávio Brandão', 'Otavio.brandao@gmail.com', '5511999645480', 'quero comprar já', 'tempo', 'abrir escritório', 2, '21/04/2025'),
('DÉBORA SALES', 'debora.sales@yahoo.com.br', '11938285503', 'só pesquisando', 'preço', 'atualização profissional', 8, '06/02/2026'),
('Fabio Macedo', 'Fabio.macedo@gmail.com', '11977736262', 'em alguns meses', 'tempo', 'atualização profissional', 1, '19/02/2026'),
('beatriz araújo', NULL, '(11) 95122-0073', 'só pesquisando', 'indecisão', 'atualização profissional', 8, '2025-07-13'),
('Lara Dantas', NULL, '11973000000', 'só pesquisando', 'preço', 'primeiro emprego', NULL, '01/11/2025'),
('Murilo Esteves', 'murilo.esteves.p1@exemplo.crm.br', '11973000053', 'em alguns meses', 'tempo', 'abrir escritório', 2, '18/01/2026'),
('Nina Farias', 'nina.farias.p2@exemplo.crm.br', '11973000106', 'quero comprar já', 'confiança', 'atualização profissional', 3, '07/02/2026'),
('Otto Guedes', 'otto.guedes.p3@exemplo.crm.br', '11973000159', 'só pesquisando', 'indecisão', 'carreira pública', 4, '2025-04-11'),
('Paula Holanda', NULL, '11973000212', 'em alguns meses', 'preço', 'primeiro emprego', 5, '05-20-2025'),
('Quirino Ibanez', 'quirino.ibanez.p5@exemplo.crm.br', '11973000265', 'quero comprar já', 'tempo', 'abrir escritório', 6, '11 de julho de 2025'),
('Rafaela Junqueira', 'rafaela.junqueira.p6@exemplo.crm.br', '11973000318', 'só pesquisando', 'confiança', 'atualização profissional', NULL, '03 de janeiro de 2026'),
('Sergio Klein', 'sergio.klein.p7@exemplo.crm.br', '11973000371', 'em alguns meses', 'indecisão', 'carreira pública', 8, '2026-05-09'),
('Taina Leal', NULL, '11973000424', 'quero comprar já', 'preço', 'primeiro emprego', 9, '12/01/2025'),
('Ursula Moraes', 'ursula.moraes.p9@exemplo.crm.br', '11973000477', 'só pesquisando', 'tempo', 'abrir escritório', 10, '03/03/2025'),
('Vitor Neves', 'vitor.neves.p10@exemplo.crm.br', '11973000530', 'em alguns meses', 'confiança', 'atualização profissional', 1, '15/06/2025'),
('Wagner Ortega', 'wagner.ortega.p11@exemplo.crm.br', '11973000583', 'quero comprar já', 'indecisão', 'carreira pública', 2, '22/09/2025'),
('Yasmin Pacheco', NULL, '11973000636', 'só pesquisando', 'preço', 'primeiro emprego', NULL, '01/11/2025'),
('Zelia Queiroz', 'zelia.queiroz.p13@exemplo.crm.br', '11973000689', 'em alguns meses', 'tempo', 'abrir escritório', 4, '18/01/2026'),
('Arthur Rezende', 'arthur.rezende.p14@exemplo.crm.br', '11973000742', 'quero comprar já', 'confiança', 'atualização profissional', 5, '07/02/2026'),
('Bia Siqueira', 'bia.siqueira.p15@exemplo.crm.br', '11973000795', 'só pesquisando', 'indecisão', 'carreira pública', 6, '2025-04-11'),
('Cesar Torres', NULL, '11973000848', 'em alguns meses', 'preço', 'primeiro emprego', 7, '05-20-2025'),
('Duda Uchoa', 'duda.uchoa.p17@exemplo.crm.br', '11973000901', 'quero comprar já', 'tempo', 'abrir escritório', 8, '11 de julho de 2025'),
('Enzo Valente', 'enzo.valente.p18@exemplo.crm.br', '11973000954', 'só pesquisando', 'confiança', 'atualização profissional', NULL, '03 de janeiro de 2026'),
('Fatima Werneck', 'fatima.werneck.p19@exemplo.crm.br', '11973001007', 'em alguns meses', 'indecisão', 'carreira pública', 10, '2026-05-09'),
('Giovana Xavier', NULL, '11973001060', 'quero comprar já', 'preço', 'primeiro emprego', 1, '12/01/2025'),
('Heitor Yamamoto', 'heitor.yamamoto.p21@exemplo.crm.br', '11973001113', 'só pesquisando', 'tempo', 'abrir escritório', 2, '03/03/2025'),
('Ingrid Zanetti', 'ingrid.zanetti.p22@exemplo.crm.br', '11973001166', 'em alguns meses', 'confiança', 'atualização profissional', 3, '15/06/2025'),
('Jonas Andrade', 'jonas.andrade.p23@exemplo.crm.br', '11973001219', 'quero comprar já', 'indecisão', 'carreira pública', 4, '22/09/2025'),
('Katia Brito', NULL, '11973001272', 'só pesquisando', 'preço', 'primeiro emprego', NULL, '01/11/2025'),
('Luan Correia', 'luan.correia.p25@exemplo.crm.br', '11973001325', 'em alguns meses', 'tempo', 'abrir escritório', 6, '18/01/2026'),
('Monica Souza', 'monica.souza.p26@exemplo.crm.br', '11973001378', 'quero comprar já', 'confiança', 'atualização profissional', 7, '07/02/2026'),
('Noel Almeida', 'noel.almeida.p27@exemplo.crm.br', '11973001431', 'só pesquisando', 'indecisão', 'carreira pública', 8, '2025-04-11'),
('Olivia Barbosa', NULL, '11973001484', 'em alguns meses', 'preço', 'primeiro emprego', 9, '05-20-2025'),
('Pietro Campos', 'pietro.campos.p29@exemplo.crm.br', '11973001537', 'quero comprar já', 'tempo', 'abrir escritório', 10, '11 de julho de 2025');

-- Vincular auxiliares → leads (e-mail / telefone / nome)
create or replace function public.norm_email(v text)
returns text language sql immutable as $$
  select nullif(lower(trim(coalesce(v, ''))), '');
$$;

create or replace function public.norm_phone_tail(v text)
returns text language sql immutable as $$
  select case
    when length(digits) >= 8 then right(digits, 8)
    else nullif(digits, '')
  end
  from (select regexp_replace(coalesce(v, ''), '\D', '', 'g') as digits) s;
$$;

update public.tentativas_compra t
set id_lead = l.id_lead
from public.leads l
where t.id_lead is null
  and public.norm_email(t.email) is not null
  and public.norm_email(t.email) = public.norm_email(l.email);

update public.respostas_pesquisa r
set id_lead = l.id_lead
from public.leads l
where r.id_lead is null
  and public.norm_email(r.email) is not null
  and public.norm_email(r.email) = public.norm_email(l.email);

update public.tentativas_compra t
set id_lead = l.id_lead
from public.leads l
where t.id_lead is null
  and public.norm_phone_tail(t.telefone) is not null
  and public.norm_phone_tail(t.telefone) = public.norm_phone_tail(l.telefone);

update public.respostas_pesquisa r
set id_lead = l.id_lead
from public.leads l
where r.id_lead is null
  and public.norm_phone_tail(r.telefone) is not null
  and public.norm_phone_tail(r.telefone) = public.norm_phone_tail(l.telefone);

update public.tentativas_compra t
set id_lead = l.id_lead
from public.leads l
where t.id_lead is null
  and lower(trim(t.nome)) = lower(trim(l.nome));

update public.respostas_pesquisa r
set id_lead = l.id_lead
from public.leads l
where r.id_lead is null
  and lower(trim(r.nome)) = lower(trim(l.nome));

-- Checagem rápida
-- select * from public.v_crm_resumo;
-- Esperado: leads=96, tentativas=126, respostas=60;
