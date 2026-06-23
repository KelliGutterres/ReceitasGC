#!/usr/bin/env bash
set -euo pipefail

: "${SONAR_TOKEN:?SONAR_TOKEN obrigatório}"
: "${SONAR_PROJECT_KEY:?SONAR_PROJECT_KEY obrigatório}"

DEMO_RULES="${DEMO_RULES:-javascript:S1481}"
MAX_WAIT_SECS="${MAX_WAIT_SECS:-120}"
INTERVAL_SECS="${INTERVAL_SECS:-5}"

echo "Regras da demo monitoradas: ${DEMO_RULES}"
echo "Aguardando conclusão da análise no SonarCloud (até ${MAX_WAIT_SECS}s)..."

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT_SECS" ]; do
  ce_json=$(curl -sf -u "${SONAR_TOKEN}:" \
    "https://sonarcloud.io/api/ce/component?component=${SONAR_PROJECT_KEY}" || echo "{}")
  status=$(echo "$ce_json" | jq -r '.current.status // "NONE"')

  if [ "$status" != "PENDING" ] && [ "$status" != "IN_PROGRESS" ]; then
    break
  fi

  sleep "$INTERVAL_SECS"
  elapsed=$((elapsed + INTERVAL_SECS))
done

sleep 5

total=$(curl -sf -u "${SONAR_TOKEN}:" \
  "https://sonarcloud.io/api/issues/search?projectKeys=${SONAR_PROJECT_KEY}&rules=${DEMO_RULES}&statuses=OPEN&ps=1" \
  | jq -r '.total // 0')

echo "Issues abertas (regras demo): ${total}"

if [ "$total" -gt 0 ]; then
  echo "::error::Pipeline bloqueada: ${total} issue(s) da demo (${DEMO_RULES}). Remova o arquivo demo ou corrija o código."
  exit 1
fi

echo "Nenhuma issue da demo — pipeline liberada (issues de segurança não bloqueiam este passo)."
