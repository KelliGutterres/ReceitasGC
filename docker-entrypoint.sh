#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"

start_postgres() {
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Inicializando cluster PostgreSQL..."
    mkdir -p "$PGDATA" /run/postgresql
    chown -R postgres:postgres "$PGDATA" /run/postgresql
    su-exec postgres initdb -D "$PGDATA"
    echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
    {
      echo "local all all trust"
      echo "host all all 127.0.0.1/32 trust"
    } >> "$PGDATA/pg_hba.conf"
  fi

  mkdir -p /run/postgresql
  chown -R postgres:postgres "$PGDATA" /run/postgresql

  if ! su-exec postgres pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    su-exec postgres pg_ctl -D "$PGDATA" -w start
  fi
}

setup_database() {
  if ! su-exec postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PGUSER}'" | grep -q 1; then
    su-exec postgres psql -v ON_ERROR_STOP=1 -c \
      "CREATE USER \"${PGUSER}\" WITH PASSWORD '${PGPASSWORD}' SUPERUSER;"
  fi

  if ! su-exec postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}'" | grep -q 1; then
    su-exec postgres psql -v ON_ERROR_STOP=1 -c \
      "CREATE DATABASE \"${PGDATABASE}\" OWNER \"${PGUSER}\";"
  fi
}

wait_for_postgres() {
  echo "Aguardando PostgreSQL em ${PGHOST}:${PGPORT}..."
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
  node src/db/scripts/migrate.js
fi

if [ "$1" = "node" ] && [ "$2" = "src/server.js" ]; then
  node src/server.js &
  NODE_PID=$!
  wait "$NODE_PID"
else
  exec "$@"
fi
