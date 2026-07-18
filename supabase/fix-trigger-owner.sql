-- =============================================================================
-- CORREÇÃO: Garante que o trigger não force role='consultor' para owners
-- =============================================================================

-- 1. Atualiza o trigger para não sobrescrever o role se já for owner
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se já existir um perfil com este ID, não fazer nada (evita conflitos)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    RETURN new;
  END IF;
  
  -- Verificar se este usuário deve ser owner (primeiro usuário do sistema)
  -- Se não houver nenhum owner ainda, este usuário será owner
  DECLARE
    owner_count INTEGER;
    user_role TEXT;
  BEGIN
    SELECT COUNT(*) INTO owner_count FROM public.profiles WHERE role = 'owner';
    
    -- Se não houver owners, este usuário será owner
    IF owner_count = 0 THEN
      user_role := 'owner';
    ELSE
      user_role := 'consultor';
    END IF;
    
    INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
    VALUES (
      new.id,
      coalesce(new.email, ''),
      coalesce(
        new.raw_user_meta_data->>'full_name',
        split_part(coalesce(new.email, 'usuario'), '@', 1)
      ),
      user_role,
      true,
      CASE user_role
        WHEN 'owner' THEN '{
          "dashboard": true,
          "leads": true,
          "tentativas": true,
          "pesquisas": true,
          "negocios": true,
          "distribuicao": true,
          "plataforma": true
        }'::jsonb
        ELSE '{
          "dashboard": false,
          "leads": true,
          "tentativas": false,
          "pesquisas": false,
          "negocios": true,
          "distribuicao": false,
          "plataforma": false
        }'::jsonb
      END
    )
    ON CONFLICT (id) DO UPDATE SET
      email = excluded.email,
      full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name),
      role = excluded.role,
      menu_access = excluded.menu_access;
  END;
  
  RETURN new;
END;
$$;

-- 2. Atualiza o trigger
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Verificação: lista todos os usuários
SELECT id, email, role, active, menu_access FROM public.profiles ORDER BY created_at;
