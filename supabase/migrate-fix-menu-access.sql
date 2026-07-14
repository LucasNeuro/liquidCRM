-- =============================================================================
-- COLE ESTE ARQUIVO INTEIRO NO SQL EDITOR DO SUPABASE E CLIQUE EM RUN
-- Corrige: ERROR 42703 column "menu_access" does not exist
-- Idempotente (pode rodar mais de uma vez).
-- =============================================================================

-- 1) Colunas que o app precisa
alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.profiles
  add column if not exists menu_access jsonb;

-- 2) Preenche só quem ainda está NULL
update public.profiles
set menu_access = '{
  "dashboard": false,
  "leads": true,
  "tentativas": false,
  "pesquisas": false,
  "negocios": true,
  "distribuicao": false,
  "plataforma": false
}'::jsonb
where menu_access is null
  and coalesce(role::text, '') <> 'owner';

update public.profiles
set menu_access = '{
  "dashboard": true,
  "leads": true,
  "tentativas": true,
  "pesquisas": true,
  "negocios": true,
  "distribuicao": true,
  "plataforma": true
}'::jsonb
where menu_access is null
  and role::text = 'owner';

alter table public.profiles
  alter column menu_access set default '{
    "dashboard": false,
    "leads": true,
    "tentativas": false,
    "pesquisas": false,
    "negocios": true,
    "distribuicao": false,
    "plataforma": false
  }'::jsonb;

alter table public.profiles
  alter column menu_access set not null;

comment on column public.profiles.menu_access is
  'Flags de menu por rota. Owner vê tudo. Consultor: owner define no sideover.';

-- 3) Legado "agente" → consultor (seu CHECK ainda permite agente)
update public.profiles
set role = 'consultor'
where role::text = 'agente';

-- Remove CHECK antigo de role (nome varia)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
exception
  when others then null;
end $$;

alter table public.profiles
  alter column role set default 'consultor';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role = any (array['owner'::text, 'consultor'::text]));
exception
  when duplicate_object then null;
end $$;

-- 4) Helper + RLS (owner grava menus; consultor lê o próprio perfil)
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'owner'
      and coalesce(p.active, true) = true
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_platform_owner());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- 5) Trigger de cadastro já cria menu padrão (Leads + Negócios)
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, active, menu_access)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    'consultor',
    true,
    '{
      "dashboard": false,
      "leads": true,
      "tentativas": false,
      "pesquisas": false,
      "negocios": true,
      "distribuicao": false,
      "plataforma": false
    }'::jsonb
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name),
    menu_access = coalesce(profiles.menu_access, excluded.menu_access);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

-- 6) Conferência — deve retornar JSON em menu_access (não erro 42703)
select email, role, active, menu_access
from public.profiles
where email = 'marcondeslucas979@gmail.com';
