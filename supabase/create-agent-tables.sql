-- =============================================================================
-- SQL para criar tabelas do Super Agente
-- Execute este SQL no Supabase SQL Editor
-- =============================================================================

-- 1. Tabela para armazenar relatórios gerados pelo agente
CREATE TABLE IF NOT EXISTS public.agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,  -- leads_daily, leads_weekly, negocios_status, users_activity, custom
  data JSONB NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID NOT NULL,  -- REFERENCES auth.users(id)
  
  -- Índices para busca
  CONSTRAINT fk_agent_reports_generated_by FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.agent_reports IS 'Relatórios gerados pelo Super Agente';
COMMENT ON COLUMN public.agent_reports.type IS 'Tipo do relatório: leads_daily, leads_weekly, negocios_status, users_activity, custom';
COMMENT ON COLUMN public.agent_reports.data IS 'Dados do relatório em formato JSON';
COMMENT ON COLUMN public.agent_reports.summary IS 'Resumo do relatório';

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_agent_reports_type ON public.agent_reports(type);
CREATE INDEX IF NOT EXISTS idx_agent_reports_generated_at ON public.agent_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_agent_reports_generated_by ON public.agent_reports(generated_by);

-- 2. Tabela para armazenar configurações de webhooks
CREATE TABLE IF NOT EXISTS public.agent_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',  -- Quais eventos disparar este webhook
  secret TEXT,  -- Token de segurança
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.agent_webhooks IS 'Configurações de webhooks para o Super Agente';
COMMENT ON COLUMN public.agent_webhooks.events IS 'Eventos que disparam este webhook (ex: ["report_generated", "lead_created"])';
COMMENT ON COLUMN public.agent_webhooks.secret IS 'Token de segurança para autenticação do webhook';

-- Índice para busca por eventos
CREATE INDEX IF NOT EXISTS idx_agent_webhooks_events ON public.agent_webhooks USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_agent_webhooks_active ON public.agent_webhooks(active) WHERE active = true;

-- 3. Tabela para agendamento de relatórios
CREATE TABLE IF NOT EXISTS public.agent_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,  -- Tipo do relatório a ser gerado
  cron_expression TEXT NOT NULL,  -- Expressão cron para agendamento
  webhook_url TEXT,  -- URL do webhook para enviar o relatório
  filters JSONB DEFAULT '{}',  -- Filtros adicionais
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ
);

COMMENT ON TABLE public.agent_report_schedules IS 'Agendamento de relatórios para o Super Agente';
COMMENT ON COLUMN public.agent_report_schedules.cron_expression IS 'Expressão cron para agendamento (ex: "0 9 * * *" para 9h todos os dias)';

-- Índice para busca por tipo e ativo
CREATE INDEX IF NOT EXISTS idx_agent_report_schedules_type ON public.agent_report_schedules(report_type);
CREATE INDEX IF NOT EXISTS idx_agent_report_schedules_active ON public.agent_report_schedules(active) WHERE active = true;

-- 4. Função para criar as tabelas se não existirem (para usar no trigger)
CREATE OR REPLACE FUNCTION public.create_reports_table_if_not_exists()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
  -- agent_reports
  CREATE TABLE IF NOT EXISTS public.agent_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    summary TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  );
  
  -- agent_webhooks
  CREATE TABLE IF NOT EXISTS public.agent_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  );
  
  -- agent_report_schedules
  CREATE TABLE IF NOT EXISTS public.agent_report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    webhook_url TEXT,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ
  );
END;
$$;

-- 5. Função para criar a tabela de webhooks se não existir
CREATE OR REPLACE FUNCTION public.create_webhooks_table_if_not_exists()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.agent_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  );
END;
$$;

-- 6. Função para criar a tabela de agendamentos se não existir
CREATE OR REPLACE FUNCTION public.create_schedules_table_if_not_exists()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.agent_report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    webhook_url TEXT,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ
  );
END;
$$;

-- 7. RLS Policies para as tabelas do agente
ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;

-- Owners podem ver todos os relatórios, usuários só os seus
CREATE POLICY agent_reports_select_policy ON public.agent_reports
  FOR SELECT TO authenticated
  USING (
    -- Owners veem todos
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários veem só seus relatórios
    (generated_by = auth.uid())
  );

CREATE POLICY agent_reports_insert_policy ON public.agent_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Qualquer usuário autenticado pode inserir
    (true)
  );

-- Webhooks: apenas owners podem gerenciar
ALTER TABLE public.agent_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_webhooks_select_policy ON public.agent_webhooks
  FOR SELECT TO authenticated
  USING (
    -- Owners veem todos
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários veem só seus webhooks
    (created_by = auth.uid())
  );

CREATE POLICY agent_webhooks_insert_policy ON public.agent_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Qualquer usuário autenticado pode inserir
    (true)
  );

CREATE POLICY agent_webhooks_update_policy ON public.agent_webhooks
  FOR UPDATE TO authenticated
  USING (
    -- Owners podem atualizar qualquer webhook
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários podem atualizar só seus webhooks
    (created_by = auth.uid())
  );

CREATE POLICY agent_webhooks_delete_policy ON public.agent_webhooks
  FOR DELETE TO authenticated
  USING (
    -- Owners podem deletar qualquer webhook
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários podem deletar só seus webhooks
    (created_by = auth.uid())
  );

-- Agendamentos: apenas owners podem gerenciar
ALTER TABLE public.agent_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_schedules_select_policy ON public.agent_report_schedules
  FOR SELECT TO authenticated
  USING (
    -- Owners veem todos
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários veem só seus agendamentos
    (created_by = auth.uid())
  );

CREATE POLICY agent_schedules_insert_policy ON public.agent_report_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Qualquer usuário autenticado pode inserir
    (true)
  );

CREATE POLICY agent_schedules_update_policy ON public.agent_report_schedules
  FOR UPDATE TO authenticated
  USING (
    -- Owners podem atualizar qualquer agendamento
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários podem atualizar só seus agendamentos
    (created_by = auth.uid())
  );

CREATE POLICY agent_schedules_delete_policy ON public.agent_report_schedules
  FOR DELETE TO authenticated
  USING (
    -- Owners podem deletar qualquer agendamento
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')) OR
    -- Usuários podem deletar só seus agendamentos
    (created_by = auth.uid())
  );

-- 8. Verificação: lista as tabelas criadas
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('agent_reports', 'agent_webhooks', 'agent_report_schedules')
ORDER BY table_name, ordinal_position;
