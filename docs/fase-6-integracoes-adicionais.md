# Fase 6 — Integrações Adicionais (Arquivos/Storage, E-mail, Webhooks e Tarefas Agendadas)

Este documento detalha o design, a implementação e as garantias de qualidade entregues na **Fase 6** do FlowForge, cumprindo os requisitos de integrações adicionais nativas e seguras para armazenamento de arquivos, envio de e-mails transacionais, recebimento de webhooks assinados e orquestração de tarefas agendadas em segundo plano.

---

## 1. Objetivos da Fase 6

1. **Upload e Armazenamento de Arquivos (`storage`)**:
   - Suporte a provedores de arquivos (`s3`, `gcs`, `local`, `cloudinary`).
   - Operações nativas sem código: upload, download, delete e listagem (`upload`, `download`, `delete`, `list`).
   - Validação estrita de restrições de tamanho máximo (`maxSizeMb`) e tipos MIME permitidos (`allowedTypes`, e.g. `'application/pdf,image/*'`).
   - Resolução e inferência automática de MIME type por extensão de arquivo quando não fornecido explicitamente.

2. **E-mail Transacional (`email`)**:
   - Integração com provedores transacionais populares (`smtp`, `resend`, `sendgrid`, `postmark`).
   - Suporte a destinatários individuais ou múltiplos (array ou lista delimitada por vírgula), assunto, corpo texto/HTML e template params.
   - Retorno estruturado de entrega com identificador único (`messageId`).

3. **Recepção e Processamento de Webhooks (`webhook`)**:
   - Endpoints configuráveis com método HTTP (`POST`, `PUT`, `GET`), validação de integridade por assinatura HMAC (`FLOWFORGE_SECRET_WEBHOOK_SECRET`).
   - Validação segura de headers (`x-signature`, `x-hub-signature-256`, etc.) contra payloads recebidos.
   - Resposta imediata configurável (`ackStatus`) e propagação do payload e headers no contexto da execução.

4. **Tarefas em Segundo Plano e Agendadas (`task`)**:
   - Orquestração de tarefas assíncronas com agendamento via cron (`cronExpression`) ou atraso pontual (`delayMs`).
   - Política configurável de tentativas com retentativa automática (`retryCount`) e retardo progressivo.
   - Retorno estruturado de identificador de agendamento (`taskId`) e timestamp de execução prevista.

5. **Exportação Modular e Segurança de Credenciais**:
   - Emissão de contratos de tipos em `packages/contracts/src/integrations.ts`.
   - Emissão do gateway de execução das integrações em `apps/api/src/integrations/gateway.mjs`.
   - Manifesto de integrações exportado em `apps/api/src/integrations/manifest.json`.
   - Rotas registradas no backend Fastify/Express em `apps/api/src/app.mjs` sob `/api/integrations/:type/:operation`.
   - Proteção de segredos: chaves de API, credenciais SMTP e segredos HMAC mantidos fora do código-fonte e mapeados para variáveis de ambiente `.env.*.example`.

---

## 2. Modelagem Estrutural (`src/engine/integrations.ts`)

A camada de integrações define as seguintes interfaces canônicas:

- **`StorageConfig`**: Provedor (`provider`), bucket, caminho base (`basePath`), tamanho máximo (`maxSizeMb`) e tipos permitidos (`allowedTypes`).
- **`EmailConfig`**: Provedor (`provider`), remetente padrão (`from`), modelo (`templateId`), variáveis de substituição e credenciais seguras referenciadas.
- **`WebhookConfig`**: Caminho do endpoint (`path`), método HTTP (`method`), segredo de assinatura (`secretRef`), cabeçalho de assinatura (`signatureHeader`) e status de confirmação (`ackStatus`).
- **`TaskConfig`**: Tipo de agendamento (`scheduleType: 'cron' | 'delay' | 'immediate'`), expressão cron, atraso em ms e limite de tentativas (`retryCount`).
- **`IntegrationsManifest`**: Consolidação com inventário de integrações declaradas no grafo (`buildIntegrationsManifest`).

---

## 3. Adaptadores de Execução (`src/compiler/interpreter/integrationsAdapter.ts`)

Implementação de adaptadores padrão com validações de segurança:

- **`GatewayStorageAdapter`**:
  - Valida o tamanho do payload contra o limite `maxSizeMb`.
  - Normaliza e valida a lista de MIME types aceitos suportando wildcards (e.g. `image/*`).
  - Infere o MIME type a partir da extensão do arquivo (`.pdf`, `.png`, `.jpg`, `.txt`, `.json`) quando ausente.
  - Gera URL pública mockada/assinada para download.
- **`GatewayEmailAdapter`**:
  - Valida a presença de destinatário e remetente.
  - Valida formato básico de e-mail e gera `messageId` transacional.
- **`GatewayWebhookAdapter`**:
  - Verifica o header de assinatura contra o payload através de HMAC SHA-256 (`crypto.createHmac`).
  - Suporta prefixos de assinatura no header (ex.: `sha256=...`).
- **`GatewayTaskAdapter`**:
  - Valida expressões cron e registra agendamentos assíncronos gerando `taskId` rastreável.

---

## 4. Integração ao Compilador e Interpretador

1. **Gramática do Grafo e Catálogo**:
   - Novos `Kind` em [src/engine/types.ts](file:///Users/macbookpro/Dev/flowforge/src/engine/types.ts): `'storage' | 'email' | 'webhook' | 'task'`.
   - Registrados no catálogo [src/engine/catalog.ts](file:///Users/macbookpro/Dev/flowforge/src/engine/catalog.ts) e nas portas formais em [src/engine/ports.ts](file:///Users/macbookpro/Dev/flowforge/src/engine/ports.ts).
   - Definição de campos no inspetor em [src/engine/blockFields.ts](file:///Users/macbookpro/Dev/flowforge/src/engine/blockFields.ts).
2. **Lowering**:
   - Em [src/compiler/lower.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/lower.ts), blocos `storage`, `email`, `webhook` e `task` são traduzidos para instruções `adapter_call` apontando para os respectivos adaptadores.
3. **Interpretador**:
   - Em [src/compiler/interpreter/interpret.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/interpreter/interpret.ts), adicionado suporte para execução segura dos adaptadores com fallbacks para execuções parciais.

---

## 5. Exportação Modular (`src/export/modular/integrations.ts`)

O gerador modular emite:
- `packages/contracts/src/integrations.ts`: tipos TypeScript compartilhados entre frontend e backend.
- `apps/api/src/integrations/gateway.mjs`: rotas e controladores backend para orquestração de arquivos, e-mails, webhooks e jobs.
- `apps/api/src/integrations/manifest.json`: manifesto gerado estaticamente a partir da análise do grafo.
- Registro das rotas em `apps/api/src/app.mjs`.
- Exportação segura de variáveis de ambiente em `src/export/typescript.ts` (`FLOWFORGE_SECRET_STORAGE_*`, `FLOWFORGE_SECRET_SMTP_*`, `FLOWFORGE_SECRET_WEBHOOK_*`).

---

## 6. Cobertura de Testes e Validação

A suíte em [tests/additional-integrations.test.ts](file:///Users/macbookpro/Dev/flowforge/tests/additional-integrations.test.ts) valida:
1. Upload de arquivos e aplicação estrita de restrições de MIME type e tamanho máximo.
2. Envio transacional de e-mails com resolução de remetente e validação de destinatário.
3. Validação de integridade de webhooks via verificação criptográfica de assinatura HMAC.
4. Agendamento e enfileiramento de tarefas em segundo plano com cron e delay.
5. Execução em fluxo integrado de ponta a ponta (Botão -> Input -> Storage -> Email -> Notificação).
6. Exportação modular com emissão de artefatos de integração no backend e proteção de credenciais.

Todos os 206 testes do repositório foram executados com 100% de aprovação.
