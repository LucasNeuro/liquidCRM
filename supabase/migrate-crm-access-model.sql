-- =============================================================================
-- LIQUI · atualiza profiles + leads para o modelo de acesso (owner aprova + menu)
-- Cole no SQL Editor do Supabase e rode 1x.
-- Seguro para reexecução (IF NOT EXISTS / DROP IF EXISTS onde cabe).
-- =============================================================================

-- 1) Colunas base
alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists idx_leads_assigned_to on public.leads (assigned_to);

-- 2) menu_access (o que o consultor vê no sidebar após login)
alter table public.profiles
  add column if not exists menu_access jsonb;

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
  'Flags de menu por rota. Owner ignora e vê tudo. Consultor: owner define no sideover.';

-- 3) Roles: legado "agente" → consultor; constraint alinhada ao app
update public.profiles
set role = 'consultor'
where role::text = 'agente';

-- remove CHECK antigo (nome gerado pelo Postgres varia)
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
end $$;

alter table public.profiles
  alter column role set default 'consultor';

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['owner'::text, 'consultor'::text]));

-- 4) Cadastro público: pendente + menu padrão (senha é do próprio user no Auth)
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

-- 5) Helper owner (RLS / distribuição)
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

-- 6) View da tela Operação → Distribuição
create or replace view public.v_leads_distribuicao as
select
  p.id as consultor_id,
  p.full_name,
  p.email,
  p.role::text as role,
  coalesce(p.active, true) as active,
  p.menu_access,
  count(l.id_lead)::int as total_leads,
  count(l.id_lead) filter (
    where lower(coalesce(l.status, '')) = 'ganho'
  )::int as ganhos,
  count(l.id_lead) filter (
    where lower(coalesce(l.status, '')) not in ('ganho', 'perdido')
  )::int as abertos,
  count(l.id_lead) filter (
    where lower(coalesce(l.status, '')) = 'perdido'
  )::int as perdidos
from public.profiles p
left join public.leads l
  on l.assigned_to = p.id
 and l.archived_at is null
where p.role::text = 'consultor'
group by p.id, p.full_name, p.email, p.role, p.active, p.menu_access;

grant select on public.v_leads_distribuicao to authenticated;

-- 7) Cadastro: ativo por padrão, menu só Leads + Negócios
--    (owner pode restringir depois no sideover de acessos)
update public.profiles
set
  active = true,
  menu_access = '{
    "dashboard": false,
    "leads": true,
    "tentativas": false,
    "pesquisas": false,
    "negocios": true,
    "distribuicao": false,
    "plataforma": false
  }'::jsonb
where role = 'consultor';

-- Após rodar: redeploy Edge Function manage-users.