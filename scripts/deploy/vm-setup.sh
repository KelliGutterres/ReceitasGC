#!/usr/bin/env bash
set -euo pipefail

VM_USER="${VM_USER:-univates}"
REPO_URL="${REPO_URL:-https://github.com/KelliGutterres/ReceitasGC.git}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/receitasgc}"
REPO_DIR="${REPO_DIR:-${DEPLOY_ROOT}/ReceitasGC}"

echo "==> Instalando Docker (se necessário)..."
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$VM_USER"
  echo "Docker instalado. Se este for o primeiro uso, faça logout/login ou execute: newgrp docker"
fi

echo "==> Criando estrutura de deploy em ${DEPLOY_ROOT}..."
sudo mkdir -p "$DEPLOY_ROOT"
sudo chown -R "$VM_USER:$VM_USER" "$DEPLOY_ROOT"

if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "Repositório já existe em ${REPO_DIR}"
fi

mkdir -p "$REPO_DIR/deploy/env"

if [ ! -f "$REPO_DIR/deploy/env/beta.env" ]; then
  echo "Aviso: deploy/env/beta.env não encontrado. Use git pull ou copie deploy/env/beta.env.example."
fi

if [ ! -f "$REPO_DIR/deploy/env/prod.env" ]; then
  echo "Aviso: deploy/env/prod.env não encontrado. Use git pull ou copie deploy/env/prod.env.example."
fi

echo "==> Liberando portas no firewall (3000 Beta/Prod, 3001 Beta)..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 3000/tcp || true
  sudo ufw allow 3001/tcp || true
  sudo ufw reload || true
fi

echo
echo "Setup concluído."
echo "Próximos passos:"
echo "  1. Execute o deploy (configuração já vem do Git em deploy/env/*.env):"
echo "       bash ${REPO_DIR}/scripts/deploy/deploy.sh beta"
echo "       bash ${REPO_DIR}/scripts/deploy/deploy.sh prod"
echo "  2. (Opcional) Rode seed só no Beta (com o container já em execução):"
echo "       cd ${REPO_DIR} && docker compose -f docker/docker-compose.beta.yml --env-file deploy/env/beta.env exec app npm run db:seed"
