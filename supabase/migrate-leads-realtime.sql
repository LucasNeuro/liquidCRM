-- Realtime em leads (atribuição / Kanban / Distribuição atualizam ao vivo)
-- Idempotente.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;

-- Replica identity full melhora payloads de UPDATE no Realtime
alter table public.leads replica identity full;
