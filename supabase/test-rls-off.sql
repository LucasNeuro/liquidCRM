-- =============================================================================
-- TESTE: Desabilita RLS temporariamente para verificar se é o problema
-- =============================================================================

-- 1. Desabilita RLS na tabela profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Testa se o usuário pode ler seu perfil
SELECT id, email, role, active, menu_access FROM public.profiles WHERE email = 'neuroboost.ai2025@gmail.com';

-- 3. Se funcionar, o problema é o RLS. Se não funcionar, o problema é outro.
--    Se funcionar, execute o SQL completo de fix-owner-always-active.sql

-- 4. Para reabilitar RLS (depois de testar):
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
