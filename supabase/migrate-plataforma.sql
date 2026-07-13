-- Plataforma: cargos pré-setados (ENUM) + gestão / custos IA
-- Opções de profiles.role: owner | consultor  (não usa mais "agente")
-- Promova o dono da plataforma:
--   update public.profiles set role = 'owner' where email = 'seu@email.com';

alter table public.profiles
  add column if not exists active boolean not null default true;

-- Valores legados → consultor
update public.profiles
set role = 'consultor'
where role is null
   or role not in ('owner', 'consultor');

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'profile_role'
  ) then
    create type public.profile_role as enum ('owner', 'consultor');
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;

-- Converte text → enum (dropdown no Table Editor do Supabase)
do $$
declare
  col_type text;
begin
  select t.typname into col_type
  from pg_attribute a
  join pg_class r on r.oid = a.attrelid
  join pg_namespace n on n.oid = r.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and r.relname = 'profiles'
    and a.attname = 'role'
    and not a.attisdropped;

  if col_type is distinct from 'profile_role' then
    execute 'alter table public.profiles alter column role drop default';
    execute $sql$
      alter table public.profiles
        alter column role type public.profile_role
        using role::text::public.profile_role
    $sql$;
  end if;

  execute $sql$
    alter table public.profiles
      alter column role set default 'consultor'::public.profile_role
  $sql$;
  execute 'alter table public.profiles alter column role set not null';
end $$;

-- Helper: requester é owner?
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and coalesce(p.active, true) = true
  );
$$;

grant execute on function public.is_platform_owner() to authenticated;

-- Owners podem atualizar qualquer profile (cargos / active)
drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for update to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- Uso / custo estimado das IAs
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'mistral')),
  operation text not null,
  model_name text,
  units numeric not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_ai_usage_created
  on public.ai_usage_events(created_at desc);
create index if not exists idx_ai_usage_provider
  on public.ai_usage_events(provider);

alter table public.embedding_jobs
  add column if not exists estimated_cost_usd numeric(12, 6) default 0;

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_select_auth on public.ai_usage_events;
create policy ai_usage_select_auth on public.ai_usage_events
  for select to authenticated using (true);

drop policy if exists ai_usage_insert_auth on public.ai_usage_events;
create policy ai_usage_insert_auth on public.ai_usage_events
  for insert to authenticated with check (true);

drop policy if exists ai_usage_owner_all on public.ai_usage_events;
create policy ai_usage_owner_all on public.ai_usage_events
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

comment on table public.ai_usage_events is 'Eventos de uso Gemini/Mistral com custo estimado (métricas Plataforma)';
