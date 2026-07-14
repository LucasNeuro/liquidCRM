-- Cadastro self-service: ativo + menu só Leads e Negócios
-- Rode no SQL Editor do Supabase (após migrate-plataforma.sql)

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.profiles
  add column if not exists menu_access jsonb not null default '{
    "dashboard": false,
    "leads": true,
    "tentativas": false,
    "pesquisas": false,
    "negocios": true,
    "distribuicao": false,
    "plataforma": false
  }'::jsonb;

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

comment on function public.handle_new_user_profile() is
  'Cria profiles ativos com menu só Leads + Negócios; owner ajusta acessos em Plataforma.';
