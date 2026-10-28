import type { Graph } from '../../engine/types';
import { buildDatabaseManifest } from '../../engine/database';
import { ArtifactPlan } from './artifacts';

export function emitDeployment(plan: ArtifactPlan, graph: Graph, hasServer: boolean): boolean {
  if (!hasServer) return false;

  const dbManifest = buildDatabaseManifest(graph);
  const hasDb =
    dbManifest.connections.length > 0 || graph.nodes.some((n) => n.data.kind === 'database');

  // Dockerfile multi-stage production-ready
  const dockerfile = `# Stage 1: Build Frontend and Contracts
FROM node:20-alpine AS builder
WORKDIR /app

# Instala ferramentas necessárias
RUN apk add --no-cache libc6-compat

# Copia manifestos de pacotes para otimização de cache
COPY package.json tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/contracts/tsconfig.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm install

# Copia código fonte
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

# Compila contratos e frontend
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV FLOWFORGE_ENV=production
ENV FLOWFORGE_PORT=8787
ENV FLOWFORGE_HOST=0.0.0.0

RUN apk add --no-cache dumb-init

# Cria usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 flowforge

# Copia artefatos necessários para execução
COPY package.json ./
COPY --chown=flowforge:nodejs apps/api ./apps/api
COPY --chown=flowforge:nodejs packages/contracts ./packages/contracts
COPY --from=builder --chown=flowforge:nodejs /app/apps/web/dist ./apps/web/dist
COPY --chown=flowforge:nodejs scripts ./scripts

# Instala dependências de produção
RUN npm install --omit=dev

USER flowforge

EXPOSE 8787

# dumb-init gerencia sinais SIGTERM/SIGINT adequadamente no container
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/src/main.mjs"]
`;

  plan.text('Dockerfile', dockerfile, 'deployment');

  // docker-compose.yml para execução local simples
  const dbService = hasDb
    ? `
  postgres:
    image: postgres:16-alpine
    container_name: flowforge-postgres
    restart: always
    environment:
      POSTGRES_DB: flowforge_db
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgrespassword}
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    volumes:
      - flowforge_pgdata:/var/lib/postgresql/data
`
    : '';

  const dbVolume = hasDb
    ? `
volumes:
  flowforge_pgdata:
`
    : '';

  const dbDepends = hasDb
    ? `
    depends_on:
      - postgres`
    : '';

  const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: flowforge-app
    restart: unless-stopped
    ports:
      - "\${FLOWFORGE_PORT:-8787}:8787"
    environment:
      - FLOWFORGE_ENV=\${FLOWFORGE_ENV:-production}
      - FLOWFORGE_PORT=8787
      - FLOWFORGE_HOST=0.0.0.0${hasDb ? '\n      - FLOWFORGE_SECRET_DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgrespassword}@postgres:5432/flowforge_db' : ''}
    env_file:
      - path: .env
        required: false${dbDepends}
${dbService}${dbVolume}`;

  plan.text('docker-compose.yml', dockerCompose, 'deployment');

  // .dockerignore
  const dockerignore = `node_modules
apps/web/dist
.env
.env.local
*.tsbuildinfo
.git
.github
`;

  plan.text('.dockerignore', dockerignore, 'deployment');

  return true;
}
