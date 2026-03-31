# Receitas GC — protótipo Node.js + Express + PostgreSQL

Aplicação simples com tela de login e listagem de receitas (doces e salgadas).

## Pré-requisitos

- Node.js 18+
- PostgreSQL com usuário `postgres`, senha `postgres`, banco `projetoreceitas_db` (ou ajuste `db/pool.js`)

## Banco de dados (local)

1. Crie o banco:

```sql
CREATE DATABASE projetoreceitas_db;
```

2. Aplique o schema e os seeds:

```bash
npm install
npm run db:init
npm run db:seed
```

Os inserts das receitas e do usuário também podem ser executados manualmente no `psql` com os arquivos `db/seed_receitas.sql` e `db/seed_usuario.sql`.

### Credencial padrão

- **Login:** `admin`
- **Senha:** `senha123`

## Executar

```bash
npm start
```

Acesse `http://localhost:3000` (ou o IP da VM na porta configurada).

Variáveis opcionais: `PORT`, `HOST` (padrão `0.0.0.0`), `SESSION_SECRET`.

## Implantação em VM (sem Docker)

1. Conecte-se à VM por SSH.
2. Instale Node.js (LTS) e PostgreSQL pelos repositórios oficiais da distribuição.
3. Configure PostgreSQL: usuário `postgres` com senha `postgres`, crie `projetoreceitas_db`. Se usar outra senha, atualize `db/pool.js` na cópia do projeto.
4. Ajuste `pg_hba.conf` se o app rodar só em localhost (recomendado: app e Postgres na mesma VM).
5. Copie o projeto (`git clone`, `scp` ou `rsync`), rode `npm install`, `npm run db:init`, `npm run db:seed`.
6. Inicie com `npm start` ou use `systemd` / `pm2` para manter o processo no ar.
7. Libere a porta no firewall (ex.: `3000`) e acesse `http://<IP-da-VM>:3000`.

Em produção, defina `SESSION_SECRET` com um valor longo e aleatório.
