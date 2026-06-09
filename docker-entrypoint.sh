#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"

log() {
  echo "[entrypoint] $*"
}

# psql herda PGUSER do .env; admin deve conectar sempre como postgres.
psql_admin() {
  su-exec postgres psql -U postgres -d postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 "$@"
}

start_postgres() {
  mkdir -p "$PGDATA" /run/postgresql
  chown -R postgres:postgres "$PGDATA" /run/postgresql

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    log "Inicializando cluster PostgreSQL..."
    su-exec postgres initdb -D "$PGDATA" --locale=C -E UTF-8 --auth-local=trust --auth-host=trust
    echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  fi

  if su-exec postgres pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    log "PostgreSQL já está em execução."
    return 0
  fi

  log "Iniciando PostgreSQL..."
  if ! su-exec postgres pg_ctl -D "$PGDATA" -w -t 60 start; then
    log "ERRO: pg_ctl start falhou. Últimas linhas do log:"
    tail -n 30 "$PGDATA/log/"* 2>/dev/null || true
    exit 1
  fi
}

setup_database() {
  log "Configurando usuário e banco (${PGUSER} / ${PGDATABASE})..."

  psql_admin <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PGUSER}') THEN
    CREATE ROLE ${PGUSER} WITH LOGIN PASSWORD '${PGPASSWORD}' SUPERUSER;
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${PGDATABASE} OWNER ${PGUSER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${PGDATABASE}')\gexec
EOSQL
}

wait_for_postgres() {
  log "Aguardando PostgreSQL em ${PGHOST}:${PGPORT}..."
  tries=0
  until node -e "
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    });
    client
      .connect()
      .then(() => client.end())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  "; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
      log "ERRO: PostgreSQL não respondeu a tempo."
      exit 1
    fi
    sleep 1
  done
}

stop_postgres() {
  if su-exec postgres pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop || true
  fi
}

trap stop_postgres SIGTERM SIGINT

start_postgres
setup_database
wait_for_postgres

if [ "${RUN_MIGRATE_ON_START:-true}" = "true" ]; then
  log "Executando migrations..."
  node src/db/scripts/migrate.js
fi

log "Iniciando aplicação..."
if [ "$1" = "node" ] && [ "$2" = "src/server.js" ]; then
  exec node src/server.js
else
  exec "$@"
fi
