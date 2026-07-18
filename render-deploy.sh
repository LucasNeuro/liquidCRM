#!/bin/bash

# Script de deploy para Render
# Este script deve ser executado no ambiente do Render

set -e

echo "=== Iniciando deploy no Render ==="

# 1. Instalar dependências
echo "1. Instalando dependências..."
npm install

# 2. Build do frontend
echo "2. Fazendo build do frontend..."
npm run build

# 3. O Render automaticamente serve a pasta dist
# Não é necessário fazer nada mais aqui

echo "=== Deploy concluído ==="
echo "O Render vai servir automaticamente a pasta dist/"
