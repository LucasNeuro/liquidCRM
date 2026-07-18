-- =============================================================================
-- SOLUÇÃO IMEDIATA: Força atualização de todas as proteções
-- Execute ESTE SQL AGORA no Supabase SQL Editor
-- =============================================================================

-- 1. DESABILITA RLS temporariamente (para testar se é o problema)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Verifica se o usuário neuroboost.ai2025@gmail.com existe e está correto
SELECT id, email, role, active, menu_access FROM public.profiles 
WHERE email = 'neuroboost.ai2025@gmail.com';

-- 3. Se o usuário não existir, cria ele como owner
INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'neuroboost.ai2025@gmail.com'),
  'neuroboost.ai2025@gmail.com',
  'NeuroBoost AI',
  'owner',
  true,
  '{
    "dashboard": true,
    "leads": true,
    "tentativas": true,
    "pesquisas": true,
    "negocios": true,
    "distribuicao": true,
    "plataforma": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  role = 'owner',
  active = true,
  menu_access = '{
    "dashboard": true,
    "leads": true,
    "tentativas": true,
    "pesquisas": true,
    "negocios": true,
    "distribuicao": true,
    "plataforma": true
  }'::jsonb;

-- 4. Verifica novamente
SELECT id, email, role, active, menu_access FROM public.profiles 
WHERE email = 'neuroboost.ai2025@gmail.com';

-- 5. Verifica o usuário lucasoffgod@hotmail.com também
SELECT id, email, role, active, menu_access FROM public.profiles 
WHERE email = 'lucasoffgod@hotmail.com';

-- 6. Se funcionar, agora reabilita RLS com as policies corretas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Cria a policy de SELECT permissiva
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 8. Verifica se o usuário pode ler seu perfil com RLS ativo
SELECT id, email, role, active FROM public.profiles WHERE email = 'neuroboost.ai2025@gmail.com';
