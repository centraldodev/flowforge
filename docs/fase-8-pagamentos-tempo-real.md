# Fase 8: Pagamentos (Stripe / PIX) e Comunicação em Tempo Real (SSE / WebSockets)

## Objetivo

Disponibilizar blocos visuais, adaptadores de execução e geração de código modular para monetização e comunicação em tempo real no FlowForge:
- **Pagamentos**: Suporte a checkout e cobranças via **Stripe** e **PIX** (com QR Code dinâmico e código copia-e-cola).
- **Tempo Real**: Publicação e subscrição de eventos via canais com **Server-Sent Events (SSE)** nativo e WebSockets em Node.js.
- **Proteção Estrita de Segredos**: Resolução de credenciais sensíveis via variáveis de ambiente seguras (`FLOWFORGE_SECRET_STRIPE_KEY`, `FLOWFORGE_SECRET_PIX_KEY`) sem vazamento no frontend nem no grafo.
- **Exportação Modular Completa**: Emissão de contratos (`packages/contracts/src/payments.ts`, `packages/contracts/src/realtime.ts`), gateways backend (`apps/api/src/payments/gateway.mjs`, `apps/api/src/realtime/gateway.mjs`) e registro de endpoints em `apps/api/src/app.mjs`.

---

## 1. Blocos no Catálogo (`src/engine/catalog.ts` e `blockRegistry.ts`)

| Bloco | Ícone | Cor | Categoria | Execução | Entradas de Controle | Entradas de Dados | Saídas de Dados |
|---|---|---|---|---|---|---|---|
| `payment` | 💳 | `#059669` | `integrations` | `server` | `execute` | `amount`, `currency`, `customer` | `checkoutUrl`, `qrCode`, `data` |
| `realtime` | 📡 | `#0284c7` | `integrations` | `server` | `execute` | `channel`, `event`, `data`, `payload` | `data` |

### Campos Sem Código (`src/engine/blockFields.ts`)
- **Pagamento**:
  - `provider`: Seleção entre `stripe`, `pix` ou `mercadopago`.
  - `operation`: Seleção entre `createCheckout`, `charge`, `verify` ou `refund`.
  - `currency`: Seleção entre `BRL`, `USD` ou `EUR`.
  - `secretRef`: Referência a segredo configurado (ex: `FLOWFORGE_SECRET_STRIPE_KEY` ou `FLOWFORGE_SECRET_PIX_KEY`).
- **Tempo Real**:
  - `protocol`: Seleção entre `sse` (Server-Sent Events) ou `websocket`.
  - `operation`: Seleção entre `publish`, `subscribe` ou `broadcast`.
  - `channel`: Canal de eventos (ex: `orders`, `notifications`, `chat`).
  - `event`: Nome do evento transmitido (ex: `order_created`, `status_updated`).

---

## 2. Contratos & Modelo de Domínio (`src/engine/paymentsAndRealtime.ts`)

Fornece validadores e construtores de manifestos:
- `buildPaymentManifest(project)`: Extrai todos os blocos de pagamento configurados, agrupando por provedor e operação.
- `buildRealtimeManifest(project)`: Extrai todos os blocos de tempo real configurados, mapeando canais e protocolos ativos.

---

## 3. Adaptadores de Execução no Interpretador (`src/compiler/interpreter/paymentsRealtimeAdapter.ts`)

- `GatewayPaymentAdapter`:
  - Valida parâmetros obrigatórios (`amount > 0`).
  - Simula ou integra checkout Stripe gerando `sessionId` e `checkoutUrl` seguro.
  - Gera payload PIX com QR code em base64 e código `pixCopiaECola` em conformidade com o padrão BACEN / EMV.
- `GatewayRealtimeAdapter`:
  - Gerenciador pub/sub em memória com suporte a `publish` e `broadcast` isolados por canal.
  - Validação estrita de presença de canal não vazio.

---

## 4. Exportação Modular (`src/export/modular/paymentsRealtime.ts`)

Gera arquivos em conformidade com o padrão de monorepo FlowForge:
- `packages/contracts/src/payments.ts`: Tipos TypeScript para requisições de checkout, cobrança PIX e webhook de status.
- `packages/contracts/src/realtime.ts`: Tipos TypeScript para eventos, mensagens e assinaturas de canal.
- `apps/api/src/payments/gateway.mjs`: Gateway Node.js com integração Stripe e emissão de QR Code PIX, resolvendo segredos em `process.env`.
- `apps/api/src/realtime/gateway.mjs`: Broker SSE nativo com streams HTTP mantidos abertos via `text/event-stream` e broadcasting eficiente.
- `apps/api/src/app.mjs`:
  - `POST /api/payments/checkout`: Criação de checkout Stripe ou PIX.
  - `GET /api/realtime/events`: Endpoint SSE para consumo por clientes front-end.
  - `POST /api/realtime/broadcast`: Disparo de eventos para clientes conectados no canal.

---

## 5. Diagnósticos de Ambiente (`src/engine/envDiagnostics.ts`)

Detecta automaticamente projetos que utilizam blocos `payment` e `realtime`:
- Adiciona categoria `'payment'` com flags `FLOWFORGE_SECRET_STRIPE_KEY` e `FLOWFORGE_SECRET_PIX_KEY`.
- Alerta no relatório de diagnóstico (`analyzeEnvironment` / `check-env.mjs`) caso o app possua blocos de pagamento sem as chaves correspondentes configuradas.

---

## 6. Testes Automatizados (`tests/payments-realtime.test.ts`)

- **Stripe Checkout**: Validação de geração de sessão e URL de redirecionamento.
- **Cobrança PIX**: Validação de geração de QR Code dinâmico e código copia-e-cola.
- **Pub/Sub Realtime**: Publicação e entrega de mensagens por canal.
- **Execução na IR**: Execução completa do interpretador com nós de pagamento e tempo real sem código.
- **Exportação Modular**: Validação da presença dos contratos e gateways no plano de exportação.
