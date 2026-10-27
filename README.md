<div align="center">

# ⚡ FlowForge

**Plataforma de Desenvolvimento Visual Sem Código para Aplicações Reais Full-Stack.**  
*Crie telas, regras de negócio, banco de dados, autenticação e integrações sem digitar código. Exporte um monorepo autônomo, profissional e pronto para produção.*

[![CI](https://github.com/centraldodev/flowforge/actions/workflows/ci.yml/badge.svg)](https://github.com/centraldodev/flowforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker&logoColor=white)

[**▶ Abrir Demonstração**](https://centraldodev.github.io/flowforge) · [Funcionalidades](#-funcionalidades) · [Apps de Referência](#-apps-de-referência-canônicos) · [Exportação](#-arquitetura-do-projeto-exportado) · [Roadmap](#-roadmap-e-fases-concluídas)

</div>

---

## ✨ Funcionalidades

- **Canvas Visual Reativo**: Modelagem por blocos, nós e cabos tipados com separação estrita de fluxo de controle, dados e políticas de segurança.
- **Telas e Componentes Ricos**: Formulários sem código com validações nativas, tabelas com paginação e ordenação, cards e layouts responsivos.
- **Banco de Dados Persistente (PostgreSQL)**: Conexões seguras, entidades visuais, DDLs e migrações SQL geradas automaticamente com suporte a transações ACID.
- **Identidade e Segurança (RBAC)**: Autenticação real com PBKDF2 e tokens de sessão, políticas de controle de acesso granulares com negação por padrão.
- **Composição Sem Código**: Subfluxos reutilizáveis com versionamento e operações sobre coleções (`filter`, `map`, `find`, `sum`, `count`).
- **Integrações de Negócio**: Upload e gestão de arquivos (S3/GCS), envio de e-mails transacionais (Resend/SendGrid), tarefas agendadas em fila e webhooks protegidos.
- **Monetização e Tempo Real**: Checkouts **Stripe** e cobranças dinâmicas **PIX** com QR Code EMV, além de publicação/subscrição de eventos via **Server-Sent Events (SSE)**.
- **Exportação Modular Independente**: Monorepo completo (`apps/web`, `apps/api`, `packages/contracts`) com `docker-compose.yml`, `Dockerfile` multi-stage e verificador de ambiente (`scripts/check-env.mjs`).
- **Zero Secrets Leakage**: Garantia de que nenhuma chave ou connection string sensível vaza para o frontend ou para o grafo.

---

## 📦 Apps de Referência Canônicos

O FlowForge inclui 3 modelos canônicos disponíveis no modal de novo projeto:

1. **🛍️ Gestor de Clientes e Pedidos**:
   - Autenticação de sessão, CRUD persistente em PostgreSQL, itens de pedido com cálculo de total, transações atômicas e chamada a APIs externas com tratamento de indisponibilidade.
2. **📅 Agendamento sem Conflito**:
   - Regras de negócio visuais sem código, validação de sobreposição de horários e alertas em tempo real.
3. **🛡️ Portal de Aprovação por Papéis**:
   - Controle estrito de acesso baseado em funções (Admin, Manager, User), telas protegidas e autorização validada no servidor.

---

## 🏗 Arquitetura do Projeto Exportado

Ao exportar seu aplicativo em TypeScript, o FlowForge gera um monorepo autônomo e profissional que executa sem depender do editor:

```
├── package.json               # Gerenciador raiz (npm/pnpm workspaces)
├── Dockerfile                 # Contêiner multi-stage Node.js 20 Alpine
├── docker-compose.yml         # Orquestração local (App + PostgreSQL 16)
├── scripts/check-env.mjs      # Assistente de validação de ambiente e segredos
├── packages/contracts/        # Contratos TypeScript unificados (@flowforge/contracts)
├── apps/web/                  # SPA React 19 + Vite com páginas e rotas declarativas
└── apps/api/                  # Backend Node.js nativo com gateways de banco, auth e integrações
```

---

## 🚦 Roadmap e Fases Concluídas

Todas as fases do [Plano de Apps Reais Sem Código](docs/plano-apps-reais-sem-codigo.md) foram concluídas com 100% de cobertura de testes:

| Fase | Título | Documentação |
|---|---|---|
| **0** | Contratos, Catálogo Central e Validação Tipada | [`docs/fase-0-contratos.md`](docs/fase-0-contratos.md) |
| **1** | Conexões HTTP Reais e Gateway Backend | [`docs/fase-1-http-real.md`](docs/fase-1-http-real.md) |
| **1.1**| Exportação Modular e Divisão de Workspaces | [`docs/arquitetura-projeto-exportado.md`](docs/arquitetura-projeto-exportado.md) |
| **2** | Dados Persistentes com PostgreSQL e CRUD Visual | [`docs/fase-2-banco-real.md`](docs/fase-2-banco-real.md) |
| **3** | Identidade, Autenticação Real e Políticas RBAC | [`docs/fase-3-identidade-regras.md`](docs/fase-3-identidade-regras.md) |
| **4** | Interface Completa (Formulários, Tabelas e Layouts) | [`docs/fase-4-interface-completa.md`](docs/fase-4-interface-completa.md) |
| **5** | Composição (Subfluxos Reutilizáveis e Coleções) | [`docs/fase-5-composicao.md`](docs/fase-5-composicao.md) |
| **6** | Integrações (Arquivos, E-mail, Webhooks e Tarefas) | [`docs/fase-6-integracoes-adicionais.md`](docs/fase-6-integracoes-adicionais.md) |
| **7** | Entrega Operacional (Diagnósticos, Docker e Apps Canônicos) | [`docs/fase-7-entrega-operacional.md`](docs/fase-7-entrega-operacional.md) |
| **8** | Pagamentos (Stripe / PIX) e Comunicação em Tempo Real (SSE) | [`docs/fase-8-pagamentos-tempo-real.md`](docs/fase-8-pagamentos-tempo-real.md) |
| **9** | Modelos Visuais no Editor e Diagnóstico de Ambiente na UI | [`docs/fase-9-ui-templates-diagnosticos.md`](docs/fase-9-ui-templates-diagnosticos.md) |
| **10**| Auditoria E2E de Independência e Consolidação Final | [`docs/fase-10-validacao-e2e-monorepo.md`](docs/fase-10-validacao-e2e-monorepo.md) |
| **11**| Múltiplos Esquemas, Multi-Tenancy e Migrações SQL | [`docs/fase-11-multitenancy-migracoes.md`](docs/fase-11-multitenancy-migracoes.md) |
| **12**| Depurador Visual, Breakpoints e Time-Travel Trace | [`docs/fase-12-depurador-visual.md`](docs/fase-12-depurador-visual.md) |
| **13**| Cenários de Teste Visuais e Exportação E2E/Integração | [`docs/fase-13-testes-visuais-e2e.md`](docs/fase-13-testes-visuais-e2e.md) |
| **Final**| Entrega v1.0.0, OpenAPI 3.0 / Swagger UI e Prontidão de Produção | [`docs/fase-final-producao-openapi.md`](docs/fase-final-producao-openapi.md) |

---

## 🚀 Começando Localmente

**Requisitos:** Node.js `>= 20.19` e npm.

```sh
# Clone o repositório
git clone https://github.com/centraldodev/flowforge.git
cd flowforge

# Instale as dependências
npm install

# Inicie o servidor do editor
npm run dev
```

### Comandos de Verificação e Qualidade

```sh
npm run check      # Executa lint, prettier, typecheck e os 240 testes automatizados
npm test           # Executa a suíte de testes com node:test
npm run build      # Compila o bundle otimizado de produção com Vite
```

---

## 📜 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
