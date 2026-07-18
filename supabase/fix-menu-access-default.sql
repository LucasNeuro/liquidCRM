-- =============================================================================
-- CORREÇÃO DO DEFAULT DO menu_access
-- O schema atual tem DEFAULT com plataforma: false
-- Isso afeta novos perfis criados
-- =============================================================================

-- 1. Remove o DEFAULT atual (se existir)
ALTER TABLE public.profiles 
  ALTER COLUMN menu_access DROP DEFAULT;

-- 2. Adiciona novo DEFAULT que não inclua plataforma (para consultores)
-- Mas o trigger handle_new_user_profile já define o menu_access corretamente
-- Então podemos deixar sem DEFAULT ou com um DEFAULT genérico

-- 3. Verifica o DEFAULT atual
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'menu_access';

-- 4. Se precisar, adicione um DEFAULT vazio
-- ALTER TABLE public.profiles 
--   ALTER COLUMN menu_access SET DEFAULT '{}'::jsonb;

-- 5. O importante é que o trigger handle_new_user_profile esteja correto
-- Vamos verificar e corrigir o trigger

-- Verifica o trigger atual
SELECT event_manipulation, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_profile';
