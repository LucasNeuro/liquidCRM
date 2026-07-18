#!/bin/bash

# Script de deploy para o Super Agente
# Execute este script para deploy da Edge Function

set -e

echo "=== Deploy do Super Agente ==="

# Navega para a pasta da function
cd "$(dirname "$0")"

# Instala dependências (se houver)
echo "1. Instalando dependências..."
npm install 2>/dev/null || echo "Nenhum package.json encontrado, pulando npm install"

# Faz deploy
echo "2. Fazendo deploy..."
npx supabase functions deploy super-agent

echo "=== Deploy concluído ==="
echo "Função disponível em: https://<seu-projeto>.supabase.co/functions/v1/super-agent"
