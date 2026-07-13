# Agente: manage-users

Gestão de consultores / acessos (somente `profiles.role = owner`).

## Actions

- `create` — cria Auth user + profile (`consultor` | `agente` | `owner`)
- `update` — nome, role, active
- `delete` — soft (`active=false`) ou `hard: true` remove Auth user

## Deploy

```bash
supabase functions deploy manage-users --no-verify-jwt
```

Promova owner:

```sql
update public.profiles set role = 'owner' where email = 'seu@email.com';
```
