-- =============================================================================
-- SOLUÇÃO FINAL: Desabilita RLS e garante perfis
-- Execute ESTE SQL AGORA no Supabase SQL Editor
-- =============================================================================

-- PASSO 1: Desabilita RLS completamente para a tabela profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- PASSO 2: Remove TODAS as policies (para garantir que não há bloqueio)
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

-- PASSO 3: Verifica que não há mais policies
SELECT policyname, roles, cmd, perm 
FROM pg_policies 
WHERE tablename = 'profiles';

-- PASSO 4: Garante que os perfis existam com os IDs corretos
-- (Usando os IDs que você forneceu da tabela auth.users)

-- Perfil para lucasoffgod@hotmail.com (ID: 1266ab6a-dd5b-4809-ba3a-8f675ee5a69e)
INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
VALUES (
  '1266ab6a-dd5b-4809-ba3a-8f675ee5a69e',
  'lucasoffgod@hotmail.com',
  'Lucas Off God',
  'owner',
  true,
  '{"dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  role = 'owner',
  active = true,
  menu_access = '{"dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true}'::jsonb;

-- Perfil para neuroboost.ai2025@gmail.com (ID: 55665324-2842-42f2-9920-9bed27afe62e)
INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
VALUES (
  '55665324-2842-42f2-9920-9bed27afe62e',
  'neuroboost.ai2025@gmail.com',
  'NeuroBoost AI',
  'owner',
  true,
  '{"dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  role = 'owner',
  active = true,
  menu_access = '{"dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true}'::jsonb;

-- PASSO 5: Verifica os perfis
SELECT 
  p.id,
  p.email,
  p.role,
  p.active,
  p.menu_access,
  u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email IN ('lucasoffgod@hotmail.com', 'neuroboost.ai2025@gmail.com');

-- PASSO 6: Verifica que RLS está desabilitado
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'profiles';

-- PASSO 7: Testa se o frontend consegue ler (simule o que o frontend faz)
SELECT id, email, role, active, menu_access 
FROM public.profiles 
WHERE id = '1266ab6a-dd5b-4809-ba3a-8f675ee5a69e';

SELECT id, email, role, active, menu_access 
FROM public.profiles 
WHERE id = '55665324-2842-42f2-9920-9bed27afe62e';
