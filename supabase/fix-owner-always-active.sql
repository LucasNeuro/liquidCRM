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
