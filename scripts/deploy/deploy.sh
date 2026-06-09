#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=docker-lib.sh
source "${SCRIPT_DIR}/docker-lib.sh"

ENVIRONMENT="${1:-}"
if [ "$ENVIRONMENT" != "beta" ] && [ "$ENVIRONMENT" != "prod" ]; then
  echo "Uso: $0 <beta|prod> [branch]"
  exit 1
fi

BRANCH="${2:-main}"
REPO_DIR="${REPO_DIR:-/opt/receitasgc/ReceitasGC}"
COMPOSE_FILE="${REPO_DIR}/docker/docker-compose.${ENVIRONMENT}.yml"
ENV_FILE="${REPO_DIR}/deploy/env/${ENVIRONMENT}.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente não encontrado: ${ENV_FILE}"
  echo "Copie deploy/env/${ENVIRONMENT}.env.example para deploy/env/${ENVIRONMENT}.env"
  exit 1
fi

echo "==> Deploy ${ENVIRONMENT} (branch: ${BRANCH})"
cd "$REPO_DIR"

echo "==> Atualizando código..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Reconstruindo e subindo container (PostgreSQL + app)..."
docker_compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build app

echo "==> Status do container:"
docker_compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo
echo "Deploy ${ENVIRONMENT} concluído."
