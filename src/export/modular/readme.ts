export function exportReadme(name: string, hasServer: boolean): string {
  return `# ${name}

Aplicação web e API autônoma gerada pelo FlowForge.
Executa de forma totalmente independente do editor em Node >=20.19 e npm.

---

## 1. Guia Rápido de Execução

### 1.1 Instalação
\`\`\`bash
npm install
\`\`\`
Todos os workspaces (\`apps/web\`, \`apps/api\`, \`packages/contracts\`) são instalados simultaneamente.

${
  hasServer
    ? `### 1.2 Assistente de Ambiente e Verificação
Copie o arquivo de exemplo de ambiente:
\`\`\`bash
cp .env.development.example .env
\`\`\`

Execute o assistente de diagnóstico de ambiente:
\`\`\`bash
npm run check-env
\`\`\`
O assistente verifica se todas as variáveis necessárias (banco de dados, chaves de autenticação, integrações de arquivos, e-mail e webhooks) estão configuradas e emite orientações acionáveis para qualquer item pendente.

### 1.3 Desenvolvimento Local
\`\`\`bash
npm run dev
\`\`\`
Frontend e backend são iniciados em conjunto:
- Frontend Vite: [http://127.0.0.1:5173](http://127.0.0.1:5173) (com proxy automático para o backend)
- Backend Fastify/Node: [http://127.0.0.1:8787](http://127.0.0.1:8787)
`
    : `### 1.2 Desenvolvimento Local
\`\`\`bash
npm run dev
\`\`\`
O frontend Vite é iniciado em [http://127.0.0.1:5173](http://127.0.0.1:5173).
`
}
### 1.4 Testes e Build
\`\`\`bash
# Executa testes automatizados de integridade
npm test

# Valida e compila todos os workspaces para produção
npm run build

# Executa o build final em modo servidor
npm start
\`\`\`

---

${
  hasServer
    ? `## 2. Execução com Docker e Containers

O projeto exportado já inclui \`Dockerfile\` multi-stage e \`docker-compose.yml\` prontos para produção.

### 2.1 Executar com Docker Compose (recomendado)
\`\`\`bash
# Inicia a aplicação e dependências (incluindo PostgreSQL se utilizado)
docker compose up --build -d

# Visualizar logs em tempo real
docker compose logs -f app
\`\`\`

### 2.2 Build de Imagem Docker Isolada
\`\`\`bash
npm run docker:build
docker run -p 8787:8787 --env-file .env flowforge-app
\`\`\`

---

## 3. Destinos de Implantação (Deploy em Produção)

- **Railway / Render**: Conecte o repositório Git, selecione \`Dockerfile\` como buildpack e configure as variáveis listadas em \`.env.production.example\` nas configurações de ambiente do painel.
- **Fly.io**: Execute \`fly launch\` na raiz do projeto; o Fly detectará o \`Dockerfile\` automaticamente.
- **VPS Linux / Cloud VM**: Utilize o \`docker-compose.yml\` com um reverse proxy (Caddy ou Nginx) para terminação SSL.

### Monitoramento e Healthcheck
O servidor exporta endpoints nativos para observabilidade:
- \`GET /api/health\`: Verificação de liveness/readiness para balanceadores de carga e orquestradores (Kubernetes/Docker).
- \`GET /api/diagnostics\`: Status operacional de integrações sem expor credenciais em texto claro.

---

`
    : ''
}## 4. Estrutura do Projeto

\`\`\`
├── apps/
│   ├── web/                     # Frontend React SPA
│   │   ├── src/pages/           # Telas visuais da aplicação
│   │   ├── src/workflows/       # Fluxos de tela e lógicas de composição
│   │   └── src/runtime/         # Renderizadores e contexto de execução
${
  hasServer
    ? `│   └── api/                     # Backend Node.js independente
│       ├── src/http/            # Transporte, validação e gateways
│       ├── src/database/        # Repositórios e conexão PostgreSQL
│       ├── src/auth/            # Gateway de autenticação e sessão JWT
│       ├── src/integrations/    # Operações privadas de storage, e-mail e webhooks
│       └── src/runtime/         # Logger estruturado e diagnósticos operacionais
`
    : ''
}├── packages/
│   └── contracts/               # Contratos de tipos TypeScript compartilhados
├── scripts/                     # Scripts de auxílio (dev, verificação de ambiente)
├── flowforge/                   # Fonte visual e mapa de rastreabilidade (source-map.json)
└── tests/                       # Testes de integridade da estrutura exportada
\`\`\`

---

## 5. Boas Práticas e Segurança

1. **Segredos Protegidos**: Chaves de API, credenciais de banco e tokens **nunca** são inseridos no frontend nem no repositório. Use sempre variáveis de ambiente (\`.env\`).
2. **Logs Estruturados**: O backend utiliza logger estruturado JSON com higienização automática para evitar vazamento de credenciais nos logs.
3. **Isolamento de Origem**: Chamadas externas são mediadas exclusivamente pelo gateway privado da API.
`;
}
