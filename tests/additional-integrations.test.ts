import test from 'node:test';
import assert from 'node:assert/strict';
import type { Block, Graph } from '../src/engine/types';
import {
  GatewayStorageAdapter,
  GatewayEmailAdapter,
  GatewayWebhookAdapter,
  GatewayTaskAdapter,
} from '../src/compiler/interpreter/integrationsAdapter';
import { createExecutionContext } from '../src/compiler/interpreter/adapters';
import { interpret } from '../src/compiler/interpreter/interpret';
import { compile } from '../src/compiler';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 6: Storage - Upload válido, limites de tamanho e validação de MIME type', async () => {
  const adapter = new GatewayStorageAdapter();
  const context = createExecutionContext();

  // 1. Upload bem-sucedido
  const uploadRes = (await adapter.execute(
    'upload',
    {
      path: 'documentos/relatorio.pdf',
      size: 2048,
      maxSizeBytes: 5242880,
      mimeType: 'application/pdf',
      allowedTypes: 'image/*,application/pdf',
    },
    context,
  )) as { success: boolean; fileUrl: string; size: number };

  assert.equal(uploadRes.success, true);
  assert.ok(uploadRes.fileUrl.includes('documentos/relatorio.pdf'));
  assert.equal(uploadRes.size, 2048);

  // 2. Rejeição por tamanho excessivo
  await assert.rejects(
    async () => {
      await adapter.execute(
        'upload',
        {
          path: 'video_gigante.mp4',
          size: 10485760, // 10MB
          maxSizeBytes: 5242880, // 5MB max
          mimeType: 'video/mp4',
        },
        context,
      );
    },
    /Arquivo excede o limite/,
    'Deve rejeitar arquivo que ultrapasse o limite de tamanho',
  );

  // 3. Rejeição por tipo MIME não autorizado
  await assert.rejects(
    async () => {
      await adapter.execute(
        'upload',
        {
          path: 'script.sh',
          size: 100,
          maxSizeBytes: 5242880,
          mimeType: 'application/x-sh',
          allowedTypes: 'image/*,application/pdf',
        },
        context,
      );
    },
    /Tipo de arquivo não permitido/,
    'Deve bloquear extensões ou tipos MIME não permitidos',
  );
});

test('Fase 6: E-mail - Envio transacional e validação de destinatário', async () => {
  const adapter = new GatewayEmailAdapter();
  const context = createExecutionContext();

  // 1. Envio bem-sucedido
  const emailRes = (await adapter.execute(
    'send',
    {
      from: 'sistema@empresa.com',
      to: 'cliente@exemplo.com',
      subject: 'Confirmação de Pedido',
      body: 'Seu pedido #123 foi recebido com sucesso!',
    },
    context,
  )) as { success: boolean; messageId: string; to: string };

  assert.equal(emailRes.success, true);
  assert.ok(emailRes.messageId.startsWith('<msg_'));
  assert.equal(emailRes.to, 'cliente@exemplo.com');

  const sent = context.store.__sentEmails as Array<Record<string, unknown>>;
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, 'Confirmação de Pedido');

  // 2. Falha quando destinatário ausente
  await assert.rejects(
    async () => {
      await adapter.execute(
        'send',
        {
          from: 'sistema@empresa.com',
          to: '',
          subject: 'Sem destinatário',
        },
        context,
      );
    },
    /Destinatário de e-mail \(to\) é obrigatório/,
    'Deve validar presença obrigatória do destinatário',
  );
});

test('Fase 6: Webhooks - Validação de integridade e assinatura', async () => {
  const adapter = new GatewayWebhookAdapter();
  const context = createExecutionContext();

  // 1. Webhook válido
  const validRes = (await adapter.execute(
    'receive',
    {
      signature: 'sha256_mock_valid_signature_123',
      expectedSignature: 'sha256_mock_valid_signature_123',
      event: 'payment.succeeded',
      data: { orderId: 9988, amount: 150.0 },
    },
    context,
  )) as { success: boolean; event: string; payload: { orderId: number } };

  assert.equal(validRes.success, true);
  assert.equal(validRes.event, 'payment.succeeded');
  assert.equal(validRes.payload.orderId, 9988);

  // 2. Webhook com assinatura adulterada
  await assert.rejects(
    async () => {
      await adapter.execute(
        'receive',
        {
          signature: 'assinatura_falsificada',
          expectedSignature: 'sha256_mock_valid_signature_123',
          event: 'payment.succeeded',
        },
        context,
      );
    },
    /Assinatura do webhook inválida/,
    'Deve rejeitar requisições de webhook com assinatura divergente',
  );
});

test('Fase 6: Tarefas Agendadas - Execução e registro no servidor', async () => {
  const adapter = new GatewayTaskAdapter();
  const context = createExecutionContext();

  const taskRes = (await adapter.execute(
    'schedule',
    {
      taskName: 'SincronizarEstoque',
      schedule: '0 3 * * *', // 3h da manhã
    },
    context,
  )) as { success: boolean; taskName: string; schedule: string };

  assert.equal(taskRes.success, true);
  assert.equal(taskRes.taskName, 'SincronizarEstoque');
  assert.equal(taskRes.schedule, '0 3 * * *');

  const tasks = context.store.__scheduledTasks as Array<Record<string, unknown>>;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taskName, 'SincronizarEstoque');
});

test('Fase 6: Execução interpretada de fluxo integrado (Storage + Email)', async () => {
  const screenBlock: Block = {
    id: 'scr_main',
    position: { x: 0, y: 0 },
    data: {
      kind: 'screen',
      contractVersion: 1,
      label: 'Tela Principal',
      config: { title: 'Tela Principal' },
    },
  };

  const buttonBlock: Block = {
    id: 'btn_upload',
    position: { x: 0, y: 50 },
    data: {
      kind: 'button',
      contractVersion: 1,
      label: 'Enviar Comprovante',
      config: { screenId: 'scr_main' },
    },
  };

  const storageBlock: Block = {
    id: 'storage_1',
    position: { x: 150, y: 50 },
    data: {
      kind: 'storage',
      contractVersion: 1,
      label: 'Upload Comprovante',
      config: {
        path: 'comprovantes/recibo.pdf',
        maxSizeBytes: '10485760',
        allowedTypes: 'application/pdf,image/*',
      },
    },
  };

  const emailBlock: Block = {
    id: 'email_1',
    position: { x: 300, y: 50 },
    data: {
      kind: 'email',
      contractVersion: 1,
      label: 'Notificar Suporte',
      config: {
        to: 'financeiro@empresa.com',
        subject: 'Novo Comprovante Anexado',
        body: 'Um novo comprovante foi recebido.',
      },
    },
  };

  const graph: Graph = {
    version: 1,
    name: 'Fluxo Storage e Email',
    nodes: [screenBlock, buttonBlock, storageBlock, emailBlock],
    edges: [
      {
        id: 'e1',
        source: 'btn_upload',
        target: 'storage_1',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'storage_1',
        target: 'email_1',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
      },
    ],
  };

  const compilation = compile(graph);
  assert.equal(compilation.ok, true, 'Grafo com storage e email deve compilar sem erros');

  const context = createExecutionContext();
  const result = await interpret(compilation.value, 'btn_upload', context);

  assert.equal(result.success, true, 'Execução interpretada do fluxo deve ter sucesso');
  assert.ok(
    context.trace.some((t) => t.id === 'storage'),
    'Deve registrar trace da operação de storage',
  );
  assert.ok(
    context.trace.some((t) => t.id === 'email'),
    'Deve registrar trace do envio de e-mail',
  );

  const sent = context.store.__sentEmails as Array<Record<string, unknown>>;
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'financeiro@empresa.com');
});

test('Fase 6: Exportação modular do servidor com Storage, Email, Webhook e Tasks', () => {
  const graph: Graph = {
    version: 1,
    name: 'App Com Todas as Integracoes',
    nodes: [
      {
        id: 'node_storage',
        position: { x: 0, y: 0 },
        data: {
          kind: 'storage',
          contractVersion: 1,
          label: 'Storage',
          config: {
            bucket: 'meu-bucket-s3',
            secretEnv: 'FLOWFORGE_SECRET_STORAGE_PROD',
          },
        },
      },
      {
        id: 'node_email',
        position: { x: 100, y: 0 },
        data: {
          kind: 'email',
          contractVersion: 1,
          label: 'Email',
          config: {
            from: 'noreply@empresa.com',
            secretEnv: 'FLOWFORGE_SECRET_RESEND_KEY',
          },
        },
      },
      {
        id: 'node_webhook',
        position: { x: 200, y: 0 },
        data: {
          kind: 'webhook',
          contractVersion: 1,
          label: 'Webhook',
          config: {
            path: '/api/webhooks/stripe',
            secretEnv: 'FLOWFORGE_SECRET_STRIPE_WEBHOOK',
          },
        },
      },
      {
        id: 'node_task',
        position: { x: 300, y: 0 },
        data: {
          kind: 'task',
          contractVersion: 1,
          label: 'Task',
          config: {
            taskName: 'LimpezaDiaria',
            schedule: '0 0 * * *',
          },
        },
      },
    ],
    edges: [],
  };

  const plan = createTypeScriptPlan(graph);

  // 1. Contratos e Gateway de Integrações
  assert.ok(
    plan.files.has('packages/contracts/src/integrations.ts'),
    'Deve gerar contratos em packages/contracts/src/integrations.ts',
  );
  assert.ok(
    plan.files.has('apps/api/src/integrations/gateway.mjs'),
    'Deve gerar gateway de integrações em apps/api/src/integrations/gateway.mjs',
  );
  assert.ok(
    plan.files.has('apps/api/src/integrations/manifest.json'),
    'Deve gerar manifesto em apps/api/src/integrations/manifest.json',
  );

  // 2. Roteamento no app.mjs
  const appContent = plan.files.get('apps/api/src/app.mjs');
  assert.ok(appContent?.content.includes('/api/storage'), 'app.mjs deve rotear /api/storage');
  assert.ok(appContent?.content.includes('/api/email'), 'app.mjs deve rotear /api/email');
  assert.ok(appContent?.content.includes('/api/webhooks'), 'app.mjs deve rotear /api/webhooks');
  assert.ok(appContent?.content.includes('/api/tasks'), 'app.mjs deve rotear /api/tasks');

  // 3. .env.example com segredos sanitizados (sem plain text)
  const devEnv = plan.files.get('.env.development.example');
  assert.ok(
    devEnv?.content.includes('FLOWFORGE_SECRET_STORAGE_PROD='),
    'Deve conter chave de storage vazia',
  );
  assert.ok(
    devEnv?.content.includes('FLOWFORGE_SECRET_RESEND_KEY='),
    'Deve conter chave de email vazia',
  );
  assert.ok(
    devEnv?.content.includes('FLOWFORGE_SECRET_STRIPE_WEBHOOK='),
    'Deve conter chave de webhook vazia',
  );

  // 4. Validação formal de dependências e integridade
  plan.validate();
});
