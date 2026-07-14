-- Seed: 25 consultores INATIVOS + 50 leads sintéticos (todos os canais)
-- Pré-requisito: migrate-lead-assignment.sql
-- Senha de todos os consultores: LiquiTeste@123
-- Após o seed, o owner libera em Plataforma → Usuários (active=true).
--
-- Nota: format() do Postgres NÃO aceita %02d (só %s, %I, %L). Use lpad().

create extension if not exists pgcrypto;

do $$
declare
  i int;
  uid uuid;
  cons_ids uuid[] := '{}';
  lead_id int;
  max_id int;
  email_c text;
  nomes text[] := array[
    'Ana Paula Costa','Bruno Ferreira','Camila Souza','Diego Alves','Eduarda Lima',
    'Felipe Rocha','Gabriela Martins','Henrique Dias','Isabela Nunes','João Pedro Santos',
    'Karina Oliveira','Lucas Mendes','Mariana Castro','Nicolas Barbosa','Olivia Ribeiro',
    'Pedro Henrique','Queila Freitas','Rafael Gomes','Sofia Carvalho','Thiago Moreira',
    'Ursula Campos','Vitor Hugo','Wagner Pinto','Yasmin Duarte','Zoe Teixeira'
  ];
  origens text[] := array[
    'instagram','email','facebook','whatsapp','indicacao',
    'google','linkedin','site','organico','anuncio'
  ];
  produtos text[] := array[
    'Aprovação Contábil','MEI Essencial','Abertura de Empresa',
    'BPO Contábil','Imposto de Renda','Certificado Digital'
  ];
  status_list text[] := array['Novo','Em contato','Qualificado','Ganho','Perdido'];
  o text;
  p text;
  st text;
  nome_lead text;
  email_lead text;
  assigned uuid;
  telefone text;
begin
  -- 25 consultores inativos
  for i in 1..25 loop
    uid := gen_random_uuid();
    cons_ids := array_append(cons_ids, uid);
    email_c := 'consultor' || lpad(i::text, 2, '0') || '@liqui.test';

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      email_c,
      crypt('LiquiTeste@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', nomes[i]),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;

    -- identity (login e-mail)
    begin
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        uid,
        jsonb_build_object(
          'sub', uid::text,
          'email', email_c,
          'email_verified', true
        ),
        'email',
        uid::text,
        now(),
        now(),
        now()
      );
    exception
      when unique_violation then
        null;
    end;

    insert into public.profiles (id, email, full_name, role, active)
    values (
      uid,
      email_c,
      nomes[i],
      'consultor',
      false
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      role = 'consultor',
      active = false;
  end loop;

  select coalesce(max(id_lead), 0) into max_id from public.leads;

  -- 50 leads sintéticos · canais rotativos · round-robin nos 25 consultores
  for i in 1..50 loop
    lead_id := max_id + i;
    o := origens[((i - 1) % array_length(origens, 1)) + 1];
    p := produtos[((i - 1) % array_length(produtos, 1)) + 1];
    st := status_list[((i - 1) % array_length(status_list, 1)) + 1];
    nome_lead := 'Lead Sintetico ' || lpad(i::text, 2, '0');
    email_lead := 'lead.sintetico.' || lpad(i::text, 2, '0') || '@exemplo.com';
    assigned := cons_ids[((i - 1) % 25) + 1];
    telefone := '(11) 9' || lpad((1000 + i)::text, 4, '0') || '-' || lpad((2000 + i)::text, 4, '0');

    insert into public.leads (
      id_lead, nome, email, telefone, origem, produto_interesse,
      status, data_entrada, assigned_to
    ) values (
      lead_id,
      nome_lead,
      email_lead,
      telefone,
      o,
      p,
      st,
      to_char(current_date - ((i % 40)), 'DD/MM/YYYY'),
      assigned
    )
    on conflict (id_lead) do update set
      origem = excluded.origem,
      produto_interesse = excluded.produto_interesse,
      status = excluded.status,
      assigned_to = excluded.assigned_to;
  end loop;

  raise notice 'Seed OK: 25 consultores inativos (consultor01..25@liqui.test / LiquiTeste@123) + 50 leads.';
end $$;
