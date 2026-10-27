import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph, Block, Link } from '../src/engine/types';
import {
  GatewayPaymentAdapter,
  GatewayRealtimeAdapter,
} from '../src/compiler/interpreter/paymentsRealtimeAdapter';
import {
  createDefaultAdapters,
  createExecutionContext,
} from '../src/compiler/interpreter/adapters';
import { compile } from '../src/compiler';
import { interpret } from '../src/compiler/interpreter/interpret';
import { createTypeScriptPlan } from '../src/export/typescript';

const b = (id: string, x: number, y: number, data: Block['data']): Block => ({
  id,
  type: 'block',
  position: { x, y },
  data,
});

const l = (
  id: string,
  source: string,
  target: string,
  sourceHandle = 'output',
  targetHandle = 'input',
): Link => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
});

test('Fase 8: GatewayPaymentAdapter processa checkout Stripe e valida valores', async () => {
  const adapter = new GatewayPaymentAdapter();
  const context = createExecutionContext();

  // 1. Checkout válido via Stripe
  const checkout = (await adapter.execute(
    'createCheckout',
    {
      provider: 'stripe',
      amount: 4990,
      currency: 'BRL',
      description: 'Plano Pro Anual',
    },
    context,
  )) as {
    success: boolean;
    provider: string;
    sessionId: string;
    checkoutUrl: string;
    status: string;
    amount: number;
  };

  assert.strictEqual(checkout.success, true);
  assert.strictEqual(checkout.provider, 'stripe');
  assert.ok(checkout.sessionId.startsWith('cs_test_'));
  assert.ok(checkout.checkoutUrl.includes('checkout.stripe.com'));
  assert.strictEqual(checkout.status, 'pending');
  assert.strictEqual(checkout.amount, 4990);

  // 2. Rejeição de valor inválido ou zerado
  await assert.rejects(
    () => adapter.execute('createCheckout', { provider: 'stripe', amount: 0 }, context),
    /positivo/,
  );

  // 3. Verificação de pagamento
  const verification = (await adapter.execute(
    'verify',
    { paymentId: checkout.sessionId },
    context,
  )) as { success: boolean; status: string };

  assert.strictEqual(verification.success, true);
  assert.strictEqual(verification.status, 'paid');
});

test('Fase 8: GatewayPaymentAdapter gera cobrança PIX com QR Code dinâmico', async () => {
  const adapter = new GatewayPaymentAdapter();
  const context = createExecutionContext();

  const pix = (await adapter.execute(
    'createCheckout',
    {
      provider: 'pix',
      amount: 125.5,
      currency: 'BRL',
      description: 'Taxa de Inscrição',
    },
    context,
  )) as {
    success: boolean;
    provider: string;
    paymentId: string;
    status: string;
    qrCode: string;
    amount: number;
  };

  assert.strictEqual(pix.success, true);
  assert.strictEqual(pix.provider, 'pix');
  assert.ok(pix.paymentId.startsWith('pix_'));
  assert.strictEqual(pix.status, 'pending');
  assert.ok(pix.qrCode.startsWith('00020126580014br.gov.bcb.pix'));
  assert.strictEqual(pix.amount, 125.5);
});

test('Fase 8: GatewayRealtimeAdapter publica eventos e gerencia canais em tempo real', async () => {
  const adapter = new GatewayRealtimeAdapter();
  const context = createExecutionContext();

  // 1. Inscrição em canal
  const sub = (await adapter.execute('subscribe', { channel: 'pedidos_realtime' }, context)) as {
    success: boolean;
    channel: string;
    clientId: string;
    status: string;
  };

  assert.strictEqual(sub.success, true);
  assert.strictEqual(sub.channel, 'pedidos_realtime');
  assert.ok(sub.clientId.startsWith('client_'));
  assert.strictEqual(sub.status, 'subscribed');

  // 2. Publicação de evento
  const pub = (await adapter.execute(
    'publish',
    {
      channel: 'pedidos_realtime',
      event: 'pedido_pago',
      data: { orderId: 1042, total: 199.9 },
    },
    context,
  )) as {
    success: boolean;
    channel: string;
    event: string;
    payload: { orderId: number };
    delivered: boolean;
  };

  assert.strictEqual(pub.success, true);
  assert.strictEqual(pub.channel, 'pedidos_realtime');
  assert.strictEqual(pub.event, 'pedido_pago');
  assert.strictEqual(pub.payload.orderId, 1042);
  assert.strictEqual(pub.delivered, true);

  // 3. Validação de canal obrigatório
  await assert.rejects(() => adapter.execute('publish', { channel: '' }, context), /obrigatório/);
});

test('Fase 8: Fluxo integrado (Botão -> Pagamento -> Tempo Real -> Notificação)', async () => {
  const graph: Graph = {
    version: 1,
    name: 'E-commerce Checkout com Notificação em Tempo Real',
    nodes: [
      b('screen_checkout', 50, 50, {
        kind: 'screen',
        label: 'Tela de Checkout',
        config: { title: 'Checkout da Loja' },
      }),
      b('btn_pagar', 100, 150, {
        kind: 'button',
        label: 'Finalizar Pagamento',
        config: { text: 'Pagar com Stripe', screenId: 'screen_checkout' },
      }),
      b('bloco_pagamento', 350, 150, {
        kind: 'payment',
        label: 'Processar Pagamento Stripe',
        config: {
          provider: 'stripe',
          operation: 'createCheckout',
          amount: '8990',
          currency: 'BRL',
          description: 'Combo Gamer',
          secretEnv: 'FLOWFORGE_SECRET_STRIPE_KEY',
        },
      }),
      b('bloco_realtime', 600, 150, {
        kind: 'realtime',
        label: 'Emitir Evento de Pedido',
        config: {
          protocol: 'sse',
          action: 'publish',
          channel: 'vendas_ao_vivo',
          event: 'nova_venda',
        },
      }),
      b('bloco_notif', 850, 150, {
        kind: 'notify',
        label: 'Aviso Visual de Sucesso',
        config: {
          type: 'success',
          message: 'Sessão de checkout criada e transmitida!',
        },
      }),
    ],
    edges: [
      l('e1', 'btn_pagar', 'bloco_pagamento', 'onClick', 'execute'),
      l('e2', 'bloco_pagamento', 'bloco_realtime', 'onSuccess', 'execute'),
      l('e3', 'bloco_realtime', 'bloco_notif', 'then', 'execute'),
    ],
  };

  const comp = compile(graph);
  assert.strictEqual(comp.ok, true, 'Grafo deve compilar para ProgramIR sem erros');

  const adapters = createDefaultAdapters();
  const context = createExecutionContext({ adapters });
  const result = await interpret(comp.value, 'btn_pagar', context);

  assert.strictEqual(result.success, true);
  assert.ok(result.notifications.length > 0);
  assert.strictEqual(result.notifications[0].message, 'Sessão de checkout criada e transmitida!');

  // Valida rastreamento na execução
  const traces = result.trace.map((t) => t.id);
  assert.ok(traces.includes('payment'));
  assert.ok(traces.includes('realtime'));
});

test('Fase 8: Exportação modular gera artefatos de Pagamento e Tempo Real com segredos protegidos', () => {
  const graph: Graph = {
    version: 1,
    name: 'App com Pagamento e SSE',
    nodes: [
      b('screen_loja', 50, 50, {
        kind: 'screen',
        label: 'Loja',
        config: { title: 'Loja Virtual' },
      }),
      b('pay_node', 100, 150, {
        kind: 'payment',
        label: 'Checkout',
        config: {
          provider: 'stripe',
          amount: '5000',
          currency: 'BRL',
          secretEnv: 'FLOWFORGE_SECRET_STRIPE_KEY',
        },
      }),
      b('rt_node', 300, 150, {
        kind: 'realtime',
        label: 'Canais SSE',
        config: {
          protocol: 'sse',
          channel: 'feed',
        },
      }),
    ],
    edges: [],
  };

  const plan = createTypeScriptPlan(graph);

  // 1. Contratos de tipos públicos
  assert.ok(
    plan.files.has('packages/contracts/src/payments.ts'),
    'Contratos de pagamentos devem ser emitidos',
  );
  assert.ok(
    plan.files.has('packages/contracts/src/realtime.ts'),
    'Contratos de tempo real devem ser emitidos',
  );

  // 2. Gateways privados no backend
  const paymentGateway = plan.files.get('apps/api/src/payments/gateway.mjs');
  const realtimeGateway = plan.files.get('apps/api/src/realtime/gateway.mjs');
  assert.ok(paymentGateway, 'Gateway de pagamento deve ser emitido');
  assert.ok(realtimeGateway, 'Gateway de tempo real SSE deve ser emitido');

  assert.ok(paymentGateway.content.includes('/api/payments/checkout'));
  assert.ok(realtimeGateway.content.includes('text/event-stream'));

  // 3. Roteamento registrado no app.mjs
  const appFile = plan.files.get('apps/api/src/app.mjs');
  assert.ok(appFile);
  assert.ok(appFile.content.includes('/api/payments'));
  assert.ok(appFile.content.includes('/api/realtime'));

  // 4. Arquivos .env com chave secreta Stripe mapeada
  const devEnv = plan.files.get('.env.development.example');
  assert.ok(devEnv);
  assert.ok(devEnv.content.includes('FLOWFORGE_SECRET_STRIPE_KEY='));

  // 5. Garantia contra vazamento de credenciais
  for (const [path, artifact] of plan.files) {
    assert.ok(
      !artifact.content.includes('sk_live_super_secret_never_leak'),
      `Vazamento de segredo encontrado em ${path}`,
    );
  }
});
