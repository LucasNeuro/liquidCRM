-- =============================================================================
-- SOLUÇÃO URGENTE: Garante que os usuários tenham perfis
-- Execute ESTE SQL AGORA no Supabase SQL Editor
-- =============================================================================

-- 1. DESABILITA RLS para não bloquear nada
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Verifica se os usuários existem na auth.users
SELECT id, email FROM auth.users 
WHERE email IN ('neuroboost.ai2025@gmail.com', 'lucasoffgod@hotmail.com');

-- 3. Para cada usuário, garante que ele tenha um perfil na tabela profiles
-- Usário 1: neuroboost.ai2025@gmail.com
DO $$
DECLARE
  user_id UUID;
  user_email TEXT;
BEGIN
  SELECT id, email INTO user_id, user_email 
  FROM auth.users 
  WHERE email = 'neuroboost.ai2025@gmail.com' 
  LIMIT 1;
  
  IF user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
    VALUES (
      user_id,
      user_email,
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
      email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(full_name, ''), EXCLUDED.full_name),
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
    
    RAISE NOTICE 'Perfil de neuroboost.ai2025@gmail.com criado/atualizado como owner';
  ELSE
    RAISE NOTICE 'Usuário neuroboost.ai2025@gmail.com não encontrado em auth.users';
  END IF;
END $$;

-- 4. Usário 2: lucasoffgod@hotmail.com
DO $$
DECLARE
  user_id UUID;
  user_email TEXT;
BEGIN
  SELECT id, email INTO user_id, user_email 
  FROM auth.users 
  WHERE email = 'lucasoffgod@hotmail.com' 
  LIMIT 1;
  
  IF user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
    VALUES (
      user_id,
      user_email,
      'Lucas Off God',
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
      email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(full_name, ''), EXCLUDED.full_name),
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
    
    RAISE NOTICE 'Perfil de lucasoffgod@hotmail.com criado/atualizado como owner';
  ELSE
    RAISE NOTICE 'Usuário lucasoffgod@hotmail.com não encontrado em auth.users';
  END IF;
END $$;

-- 5. Verifica os perfis criados/atualizados
SELECT id, email, role, active, menu_access FROM public.profiles 
WHERE email IN ('neuroboost.ai2025@gmail.com', 'lucasoffgod@hotmail.com');

-- 6. Reabilita RLS com policy permissiva
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 7. Verificação final com RLS ativo
SELECT id, email, role, active FROM public.profiles 
WHERE email IN ('neuroboost.ai2025@gmail.com', 'lucasoffgod@hotmail.com');
