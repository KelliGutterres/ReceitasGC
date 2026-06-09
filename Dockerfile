FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash postgresql postgresql-contrib su-exec \
  && mkdir -p /var/lib/postgresql/data /run/postgresql \
  && chown -R postgres:postgres /var/lib/postgresql/data /run/postgresql

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PGHOST=127.0.0.1
ENV PGPORT=5432
ENV PGDATA=/var/lib/postgresql/data

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
