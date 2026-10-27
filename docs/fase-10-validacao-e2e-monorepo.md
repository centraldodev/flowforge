# Fase 10: Auditoria E2E de Independência do Monorepo Exportado e Consolidação Final

## Objetivo

Realizar a validação e auditoria formal de ponta a ponta dos projetos exportados pelo FlowForge em conformidade estrita com a **Seção 14 (Qualidade e Definição de Pronto)** do plano mestre (`docs/plano-apps-reais-sem-codigo.md`).

A plataforma garante que o aplicativo gerado é **100% autônomo, independente do editor**, com divisão rigorosa de responsabilidades entre cliente e servidor, proteção absoluta de credenciais e preparação para contêineres e deploy em produção.

---

## 1. Estrutura do Monorepo Exportado

Para aplicativos com capacidades de servidor (PostgreSQL, Autenticação, APIs, Pagamentos, etc.), o FlowForge gera uma estrutura padrão de monorepo com npm/pnpm workspaces:

```
├── package.json               # Gerenciador raiz com scripts de build, dev e check-env
├── tsconfig.base.json         # Configurações TypeScript base compartilhadas
├── README.md                  # Documentação completa de execução local e deploy
├── Dockerfile                 # Contêiner multi-stage (Node.js 20 Alpine)
├── docker-compose.yml         # Orquestração local (App + PostgreSQL 16 Alpine)
├── .dockerignore              # Otimização de build
├── .env.development.example   # Variáveis de ambiente sem valores sensíveis
├── .env.production.example    # Variáveis de produção
├── flowforge/
│   └── project.flow.json      # Grafo visual original serializado para reedição
├── scripts/
│   ├── dev.mjs                # Orquestrador de execução local simultânea
│   └── check-env.mjs          # Verificador de saúde e prontidão do ambiente
├── packages/
│   └── contracts/             # Pacote tipado compartilhado (@flowforge/contracts)
│       ├── package.json
│       └── src/
│           ├── runtime.ts     # Tipos base de execução e adaptadores
│           ├── ui.ts          # Tipos para componentes visuais e bindings
│           ├── auth.ts        # Contratos de identidade, papéis e permissões
│           ├── payments.ts    # Contratos de checkout e PIX
│           ├── realtime.ts    # Contratos de pub/sub e eventos
│           └── diagnostics.ts # Contratos de monitoramento e auditoria
└── apps/
    ├── web/                   # Frontend SPA React + Vite
    │   ├── package.json
    │   ├── index.html
    │   └── src/
    │       ├── pages/         # Páginas visuais organizadas por identidade estável
    │       ├── workflows/     # Lógica e fluxos sem código transformados em TypeScript
    │       └── runtime/       # Adaptadores cliente de simulação e transporte
    └── api/                   # Backend Node.js nativo (sem dependência pesada de frameworks)
        ├── package.json
        └── src/
            ├── app.mjs        # Roteador central de microsserviços
            ├── main.mjs       # Ponto de entrada HTTP do servidor
            ├── database/      # Gateway PostgreSQL, DDLs e migrações
            ├── auth/          # Gateway de autenticação, hashing e JWT
            ├── payments/      # Gateway Stripe e emissor de QR Code PIX
            ├── realtime/      # Broker de Server-Sent Events (SSE)
            ├── runtime/       # Logger estruturado e sanitizador de segredos
            └── policies/      # Motor RBAC com negação por padrão
```

---

## 2. Princípios de Auditoria e Conformidade (Seção 14)

### A. Zero Secrets Leakage (Proteção Absoluta de Segredos)
- **Frontend Seguro**: Nenhum arquivo em `apps/web/` recebe strings de conexão com banco de dados, senhas de serviço ou chaves secretas.
- **Ambiente Limpo**: Os arquivos `.env.*.example` declaram exclusivamente os nomes das chaves (`FLOWFORGE_SECRET_DATABASE_URL=`), forçando a injeção em tempo de execução.
- **Sanitização de Logs**: O módulo `apps/api/src/runtime/logger.mjs` intercepta payloads e cabeçalhos sensíveis (`Authorization`, senhas, tokens, cartões) substituindo-os por `[REDACTED]` antes de qualquer gravação de log.

### B. Isolamento e Resolução de Módulos
- Todas as operações utilizam caminhos estáveis baseados em identificadores com hash.
- Módulos compartilhados não são duplicados entre rotas; os contratos em `@flowforge/contracts` unificam os tipos de dados do frontend e do backend.

### C. Paridade dos Três Apps de Referência Canônicos
1. **Gestor de Clientes e Pedidos**: Monorepo full-stack completo com banco PostgreSQL, migrações DDL, autenticação real, transações e consumo de APIs externas.
2. **Agendamento sem Conflito**: SPA cliente de alta performance, sem necessidade de container backend desnecessário, executando validações visuais nativas.
3. **Portal de Aprovação por Papéis**: Sistema de autorização de segurança estrito com motor de políticas RBAC e validação no servidor.

---

## 3. Testes Automatizados E2E (`tests/monorepo-e2e-audit.test.ts`)

- `Fase 10: Auditoria E2E de Estrutura do Monorepo Exportado`: Validação dos manifestos, dependências, scripts e contêineres.
- `Fase 10: Auditoria de Segurança e Zero Segredos Vazados`: Varredura em profundidade contra vazamento de senhas e tokens.
- `Fase 10: Auditoria de Contratos e Gateways Backend`: Verificação de todos os endpoints HTTP e contratos de tipos.
- `Fase 10: Auditoria de Compatibilidade dos 3 Apps Canônicos`: Validação cruzada das três famílias de arquitetura suportadas.
