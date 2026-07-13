-- =============================================================================
-- LIQUI — Habilitar Realtime em todas as tabelas da aplicação
-- Cole no SQL Editor do Supabase → Run (idempotente)
-- =============================================================================

-- Garante que a publication existe (padrão Supabase)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Helper: adiciona tabela à publication se ainda não estiver
create or replace function public._liqui_realtime_add(p_schema text, p_table text)
returns void
language plpgsql
as $$
begin
  if to_regclass(format('%I.%I', p_schema, p_table)) is null then
    raise notice 'Tabela %.% não existe — pulando', p_schema, p_table;
    return;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = p_schema
      and tablename = p_table
  ) then
    raise notice 'Realtime já ativo: %.%', p_schema, p_table;
    return;
  end if;

  execute format(
    'alter publication supabase_realtime add table %I.%I',
    p_schema,
    p_table
  );
  raise notice 'Realtime habilitado: %.%', p_schema, p_table;
end;
$$;

-- Núcleo enunciado
select public._liqui_realtime_add('public', 'leads');
select public._liqui_realtime_add('public', 'tentativas_compra');
select public._liqui_realtime_add('public', 'respostas_pesquisa');
select public._liqui_realtime_add('public', 'classifications');
select public._liqui_realtime_add('public', 'profiles');

-- Auxiliares LIQUI
select public._liqui_realtime_add('public', 'pipelines');
select public._liqui_realtime_add('public', 'pipeline_stages');
select public._liqui_realtime_add('public', 'lead_insights');
select public._liqui_realtime_add('public', 'negocios');

-- Limpa helper (opcional; pode manter se quiser reusar)
drop function if exists public._liqui_realtime_add(text, text);

-- Conferir:
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime'
-- order by 1, 2;
