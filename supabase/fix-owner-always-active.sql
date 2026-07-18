-- =============================================================================
-- CORREÇÃO: Garante que todos os owners estejam sempre ATIVOS
-- Rode este SQL no Supabase SQL Editor
-- =============================================================================

-- 1. Ativa todos os owners que estiverem inativos
UPDATE public.profiles
SET active = true
WHERE role = 'owner' AND active = false;

-- 2. Adiciona um CHECK para prevenir que owner seja desativado
-- (Idempotente - só adiciona se não existir)
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_owner_always_active
    CHECK (role <> 'owner' OR active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Adiciona um TRIGGER para garantir que owner nunca seja desativado
CREATE OR REPLACE FUNCTION public.prevent_owner_inactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    NEW.active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_owner_inactivation_trigger ON public.profiles;
CREATE TRIGGER prevent_owner_inactivation_trigger
  BEFORE UPDATE OR INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_inactivation();

-- 4. Verificação: lista todos os owners e seu status
SELECT id, email, full_name, role, active, created_at
FROM public.profiles
WHERE role = 'owner'
ORDER BY created_at;

-- 5. Verificação: conta quantos owners ativos
SELECT 
  COUNT(*) as total_owners,
  COUNT(*) FILTER (WHERE active = true) as active_owners,
  COUNT(*) FILTER (WHERE active = false) as inactive_owners
FROM public.profiles
WHERE role = 'owner';

-- 6. Corrige o DEFAULT do menu_access para owners
-- (O schema atual tem plataforma: false no DEFAULT, mas owners devem ter plataforma: true)
ALTER TABLE public.profiles 
  ALTER COLUMN menu_access SET DEFAULT '{
    "dashboard": false,
    "leads": true,
    "tentativas": false,
    "pesquisas": false,
    "negocios": true,
    "distribuicao": false,
    "plataforma": false
  }'::jsonb;

-- 7. Atualiza todos os owners para terem plataforma: true no menu_access
UPDATE public.profiles 
SET menu_access = jsonb_set(
  COALESCE(menu_access, '{}'::jsonb),
  '{plataforma}',
  'true'::jsonb
)
WHERE role = 'owner';

-- 8. Verificação final
SELECT id, email, role, active, menu_access->>'plataforma' as plataforma_access
FROM public.profiles
WHERE role = 'owner';

-- 9. CORREÇÃO CRÍTICA: Atualiza o usuário neuroboost.ai2025@gmail.com para ser owner com menu_access correto
-- (Substitua o email se necessário)
UPDATE public.profiles 
SET 
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
  }'::jsonb
WHERE email = 'neuroboost.ai2025@gmail.com';

-- 10. Verificação final para este usuário específico
SELECT id, email, role, active, menu_access FROM public.profiles 
WHERE email = 'neuroboost.ai2025@gmail.com';
