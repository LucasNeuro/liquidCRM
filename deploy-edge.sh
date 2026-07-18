#!/bin/bash

# Script para deploy da Edge Function manage-users
# Deve ser executado localmente com as variáveis de ambiente do Supabase

set -e

echo "=== Deploy da Edge Function manage-users ==="

# Navegar para a pasta da function
cd supabase/functions/manage-users

# Instalar dependências
echo "1. Instalando dependências..."
npm install

# Fazer deploy
echo "2. Fazendo deploy..."
npx supabase functions deploy manage-users

echo "=== Deploy concluído ==="
