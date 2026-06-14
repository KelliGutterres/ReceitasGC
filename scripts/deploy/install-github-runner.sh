#!/usr/bin/env bash
set -euo pipefail

# Instala o GitHub Actions self-hosted runner na VM.
# O token de registro expira em poucos minutos — gere um novo em:
#   GitHub → Settings → Actions → Runners → New self-hosted runner → Linux

RUNNER_USER="${RUNNER_USER:-univates}"
RUNNER_HOME="${RUNNER_HOME:-/home/${RUNNER_USER}/actions-runner}"
RUNNER_VERSION="${RUNNER_VERSION:-2.323.0}"
REPO_URL="${REPO_URL:-https://github.com/KelliGutterres/ReceitasGC}"

if [ -z "${GITHUB_RUNNER_TOKEN:-}" ]; then
  echo "Erro: defina GITHUB_RUNNER_TOKEN com o token do GitHub."
  echo
  echo "1. Abra: ${REPO_URL}/settings/actions/runners/new"
  echo "2. Escolha Linux x64"
  echo "3. Copie o token exibido em ./config.sh --token ..."
  echo
  echo "Exemplo:"
  echo "  GITHUB_RUNNER_TOKEN=SEU_TOKEN bash scripts/deploy/install-github-runner.sh"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: Docker não encontrado. Rode scripts/deploy/vm-setup.sh primeiro."
  exit 1
fi

mkdir -p "${RUNNER_HOME}"
cd "${RUNNER_HOME}"

if [ ! -f ./config.sh ]; then
  echo "==> Baixando runner ${RUNNER_VERSION}..."
  curl -fsSL -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf "./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  rm -f "./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
fi

if [ -f .runner ]; then
  echo "Runner já configurado em ${RUNNER_HOME}."
  echo "Para reconfigurar: ./config.sh remove --token NOVO_TOKEN"
  exit 0
fi

echo "==> Configurando runner para ${REPO_URL}..."
./config.sh \
  --url "${REPO_URL}" \
  --token "${GITHUB_RUNNER_TOKEN}" \
  --name "VMLS35-receitasgc" \
  --labels "self-hosted,receitasgc,Linux,X64" \
  --unattended \
  --replace

echo
echo "==> Instalando serviço systemd (persiste após reboot)..."
sudo ./svc.sh install "${RUNNER_USER}"
sudo ./svc.sh start

echo
echo "Runner instalado e iniciado."
echo "Verifique no GitHub: Settings → Actions → Runners (deve aparecer online)."
echo
echo "Depois disso, dispare Deploy Beta / Deploy Prod na aba Actions."
