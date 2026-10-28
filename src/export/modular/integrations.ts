import type { Graph } from '../../engine/types';
import { buildIntegrationsManifest } from '../../engine/integrations';
import { ArtifactPlan, json } from './artifacts';

export function emitAdditionalIntegrations(plan: ArtifactPlan, graph: Graph): boolean {
  if (plan.files.has('packages/contracts/src/integrations.ts')) return true;

  const manifest = buildIntegrationsManifest(graph);
  const hasIntegrations =
    manifest.storage.length > 0 ||
    manifest.email.length > 0 ||
    manifest.webhooks.length > 0 ||
    manifest.tasks.length > 0;

  if (!hasIntegrations) return false;

  const root = 'apps/api/src/';

  // 1. Contratos de tipos
  plan.text(
    'packages/contracts/src/integrations.ts',
    `export type StorageResult = { ok: true; fileUrl: string; size: number; path: string };
export type EmailResult = { ok: true; messageId: string };
export type WebhookResult = { ok: true; event: string; payload: unknown };
export type TaskResult = { ok: true; taskId: string };
`,
    'contract',
  );

  // 2. Módulo de Gateway de Integrações no Servidor
  const gatewayCode = `import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
const MANIFEST = ${json(manifest)};

export function createIntegrationsGateway(options = {}) {
  const storageBucket = new Map();
  const sentEmails = [];
  const scheduledTasks = [];
  const env = options.env || process.env;
  const stateDir = options.stateDir || env.FLOWFORGE_WEBHOOK_STATE_DIR || join(process.cwd(), '.flowforge', 'webhook-events');

  return async (req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    res.setHeader('Content-Type', 'application/json');

    // Leitura do corpo original para verificação criptográfica
    let rawText = '';
    let body = {};
    if (['POST', 'PUT'].includes(req.method)) {
      try {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        rawText = Buffer.concat(buffers).toString('utf-8');
        if (rawText) body = JSON.parse(rawText);
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'JSON malformado' }));
      }
    }

    // Rotas de Storage
    if (pathname.startsWith('/api/storage')) {
      const configured = MANIFEST.storage.find((item) => item.id === body.blockId);
      if (!configured) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integração não configurada.' } })); }
      if (configured.execution !== 'demo') { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_IMPLEMENTED', message: 'Integração real ainda não está disponível.' } })); }

      if (req.method === 'POST') {
        const maxSizeBytes = Number(body.maxSizeBytes || 5242880);
        const size = Number(body.size || 1024);
        if (size > maxSizeBytes) {
          res.statusCode = 413;
          return res.end(JSON.stringify({ ok: false, error: 'Arquivo excede o limite permitido' }));
        }
        const filePath = body.path || ('upload_' + Date.now() + '.bin');
        const fileUrl = 'https://storage.flowforge.dev/' + filePath;
        storageBucket.set(filePath, { fileUrl, size, uploadedAt: new Date().toISOString() });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, demo: true, fileUrl, size, path: filePath }));
      }
    }

    // Rotas de Email
    if (pathname.startsWith('/api/email')) {
      const configured = MANIFEST.email.find((item) => item.id === body.blockId);
      if (!configured) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integração não configurada.' } })); }
      if (configured.execution !== 'demo') { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_IMPLEMENTED', message: 'Integração real ainda não está disponível.' } })); }

      if (req.method === 'POST') {
        if (!body.to) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ ok: false, error: 'Destinatário (to) é obrigatório' }));
        }
        const messageId = '<msg_' + Date.now() + '@flowforge.dev>';
        sentEmails.push({ messageId, to: body.to, subject: body.subject, sentAt: new Date().toISOString() });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, demo: true, messageId }));
      }
    }

    // Rotas de Webhook
    if (pathname.startsWith('/api/webhooks')) {
      const signatureHeader = req.headers['x-hub-signature-256'] || req.headers['x-signature'] || req.headers['stripe-signature'];
      if (!signatureHeader) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: { code: 'MISSING_SIGNATURE', message: 'Cabeçalho de assinatura do webhook obrigatório.' } }));
      }

      const config = MANIFEST.webhooks.find((item) => item.path === pathname);
      if (!config) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook não configurado.' } })); }
      const envSecret = env[config.secretEnv];
      if (!envSecret) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ ok: false, error: { code: 'WEBHOOK_SECRET_NOT_CONFIGURED', message: 'Segredo de validação de webhook não configurado no servidor.' } }));
      }

      // Verificação HMAC SHA-256 sobre o corpo bruto
      const expectedHmac = createHmac('sha256', envSecret).update(rawText).digest('hex');
      const cleanSignature = String(signatureHeader).replace(/^sha256=/i, '');

      let signaturesMatch = false;
      try {
        signaturesMatch = timingSafeEqual(Buffer.from(expectedHmac, 'hex'), Buffer.from(cleanSignature, 'hex'));
      } catch {
        signaturesMatch = false;
      }

      if (!signaturesMatch) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: { code: 'INVALID_SIGNATURE', message: 'Assinatura HMAC de webhook inválida.' } }));
      }

      // Persistência atômica por identidade autenticada: cabeçalhos de transporte não definem o evento.
      const identity = body.id ? String(body.id) : createHash('sha256').update(rawText).digest('hex');
      const eventHash = createHash('sha256').update(pathname + ':' + identity).digest('hex');
      try {
        await mkdir(stateDir, { recursive: true, mode: 0o700 });
        const marker = await open(join(stateDir, eventHash), 'wx', 0o600);
        await marker.close();
      } catch (error) {
        if (error.code === 'EEXIST') { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: { code: 'DUPLICATE_EVENT', message: 'Evento de webhook já processado anteriormente.' } })); }
        res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: { code: 'WEBHOOK_STATE_UNAVAILABLE', message: 'Não foi possível registrar o evento.' } }));
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, event: body.event || 'received', payload: body.payload || body }));
    }

    // Rotas de Tarefas
    if (pathname.startsWith('/api/tasks')) {
      const configured = MANIFEST.tasks.find((item) => item.id === body.blockId);
      if (!configured) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integração não configurada.' } })); }
      if (configured.execution !== 'demo') { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: { code: 'INTEGRATION_NOT_IMPLEMENTED', message: 'Integração real ainda não está disponível.' } })); }

      const taskName = body.taskName || 'tarefa';
      scheduledTasks.push({ taskName, triggeredAt: new Date().toISOString() });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, demo: true, taskId: taskName }));
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false, error: 'Integração não encontrada' }));
  };
}
`;

  plan.text(
    root + 'integrations/gateway.mjs',
    gatewayCode,
    'integration-runtime',
    [],
    ['packages/contracts/src/integrations.ts'],
  );

  plan.text(root + 'integrations/manifest.json', json(manifest), 'configuration');

  return true;
}
