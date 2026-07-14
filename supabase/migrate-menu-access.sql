-- Preferir migrate-crm-access-model.sql (pacote completo).
-- Este arquivo só adiciona menu_access se você quiser o mínimo.

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
  'Flags de menu do CRM por rota. Owner ignora e vê tudo.';
