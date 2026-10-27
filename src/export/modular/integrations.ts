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
  const gatewayCode = `import { createHmac } from 'node:crypto';

export function createIntegrationsGateway(options = {}) {
  const storageBucket = new Map();
  const sentEmails = [];
  const scheduledTasks = [];

  return async (req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    res.setHeader('Content-Type', 'application/json');

    // Leitura do corpo JSON
    let body = {};
    if (['POST', 'PUT'].includes(req.method)) {
      try {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const text = Buffer.concat(buffers).toString('utf-8');
        if (text) body = JSON.parse(text);
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'JSON malformado' }));
      }
    }

    // Rotas de Storage
    if (pathname.startsWith('/api/storage')) {
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
        return res.end(JSON.stringify({ ok: true, fileUrl, size, path: filePath }));
      }
    }

    // Rotas de Email
    if (pathname.startsWith('/api/email')) {
      if (req.method === 'POST') {
        if (!body.to) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ ok: false, error: 'Destinatário (to) é obrigatório' }));
        }
        const messageId = '<msg_' + Date.now() + '@flowforge.dev>';
        sentEmails.push({ messageId, to: body.to, subject: body.subject, sentAt: new Date().toISOString() });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, messageId }));
      }
    }

    // Rotas de Webhook
    if (pathname.startsWith('/api/webhooks')) {
      const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'] || body.signature;
      const secretEnvName = body.secretEnv || 'FLOWFORGE_SECRET_WEBHOOK_SECRET';
      const secret = process.env[secretEnvName] || 'secret';
      
      // Validação de assinatura se fornecida
      if (body.expectedSignature && signature !== body.expectedSignature) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: 'Assinatura inválida' }));
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, event: body.event || 'received', payload: body.payload || body }));
    }

    // Rotas de Tarefas
    if (pathname.startsWith('/api/tasks')) {
      const taskName = body.taskName || 'tarefa';
      scheduledTasks.push({ taskName, triggeredAt: new Date().toISOString() });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, taskId: taskName }));
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
