-- Atribuição de leads a consultores + RLS por papel
-- Rode no SQL Editor após migrate-plataforma.sql / migrate-signup-pending.sql

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists idx_leads_assigned_to on public.leads (assigned_to);

comment on column public.leads.assigned_to is
  'Consultor responsável (profiles.id). NULL = fila sem dono.';

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

alter table public.leads enable row level security;

drop policy if exists leads_all_auth on public.leads;
drop policy if exists leads_select_auth on public.leads;
drop policy if exists leads_write_auth on public.leads;
drop policy if exists leads_owner_all on public.leads;
drop policy if exists leads_consultor_select on public.leads;
drop policy if exists leads_consultor_update on public.leads;

-- Owner: tudo
create policy leads_owner_all on public.leads
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- Consultor: só os seus (mesma regra no select/update)
create policy leads_consultor_select on public.leads
  for select to authenticated
  using (
    not public.is_platform_owner()
    and assigned_to = auth.uid()
  );

create policy leads_consultor_update on public.leads
  for update to authenticated
  using (
    not public.is_platform_owner()
    and assigned_to = auth.uid()
  )
  with check (
    not public.is_platform_owner()
    and assigned_to = auth.uid()
  );

-- Negócios: consultor só dos leads atribuídos
alter table public.negocios enable row level security;

drop policy if exists negocios_all_auth on public.negocios;
drop policy if exists negocios_owner_all on public.negocios;
drop policy if exists negocios_consultor_select on public.negocios;
drop policy if exists negocios_consultor_write on public.negocios;

create policy negocios_owner_all on public.negocios
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create policy negocios_consultor_select on public.negocios
  for select to authenticated
  using (
    not public.is_platform_owner()
    and exists (
      select 1 from public.leads l
      where l.id_lead = negocios.id_lead
        and l.assigned_to = auth.uid()
    )
  );

create policy negocios_consultor_write on public.negocios
  for all to authenticated
  using (
    not public.is_platform_owner()
    and exists (
      select 1 from public.leads l
      where l.id_lead = negocios.id_lead
        and l.assigned_to = auth.uid()
    )
  )
  with check (
    not public.is_platform_owner()
    and exists (
      select 1 from public.leads l
      where l.id_lead = negocios.id_lead
        and l.assigned_to = auth.uid()
    )
  );

-- View agregada para Operação → Distribuição
create or replace view public.v_leads_distribuicao as
select
  p.id as consultor_id,
  p.full_name,
  p.email,
  p.role::text as role,
  coalesce(p.active, true) as active,
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
group by p.id, p.full_name, p.email, p.role, p.active;

grant select on public.v_leads_distribuicao to authenticated;
