import type { Block, Graph } from './types';

export type PaymentProvider = 'stripe' | 'pix' | 'mercadopago';
export type PaymentOperation = 'createCheckout' | 'charge' | 'verify' | 'refund';
export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

export interface PaymentConfig {
  id: string;
  provider: PaymentProvider;
  operation: PaymentOperation;
  currency: CurrencyCode;
  amount?: number;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  secretEnv: string;
  execution: 'real' | 'demo';
}

export type RealtimeProtocol = 'sse' | 'websocket';
export type RealtimeAction = 'publish' | 'subscribe' | 'broadcast';

export interface RealtimeConfig {
  id: string;
  protocol: RealtimeProtocol;
  action: RealtimeAction;
  channel: string;
  event?: string;
}

export interface PaymentManifest {
  payments: PaymentConfig[];
}

export interface RealtimeManifest {
  channels: RealtimeConfig[];
}

export function parsePaymentBlock(node: Block): PaymentConfig {
  const c = node.data.config || {};
  const provider = (c.provider as PaymentProvider) || 'stripe';
  const secretEnv =
    c.secretEnv ||
    (provider === 'pix' ? 'FLOWFORGE_SECRET_PIX_KEY' : 'FLOWFORGE_SECRET_STRIPE_KEY');

  return {
    id: node.id,
    provider,
    operation: (c.operation as PaymentOperation) || 'createCheckout',
    currency: (c.currency as CurrencyCode) || 'BRL',
    amount: c.amount ? Number(c.amount) : undefined,
    description: c.description || node.data.label,
    successUrl: c.successUrl,
    cancelUrl: c.cancelUrl,
    secretEnv,
    execution: c.execution === 'demo' ? 'demo' : 'real',
  };
}

export function parseRealtimeBlock(node: Block): RealtimeConfig {
  const c = node.data.config || {};
  return {
    id: node.id,
    protocol: (c.protocol as RealtimeProtocol) || 'sse',
    action: (c.action as RealtimeAction) || 'publish',
    channel: c.channel || 'general',
    event: c.event || 'message',
  };
}

export function buildPaymentManifest(graph: Graph): PaymentManifest {
  const payments = graph.nodes.filter((n) => n.data.kind === 'payment').map(parsePaymentBlock);
  return { payments };
}

export function buildRealtimeManifest(graph: Graph): RealtimeManifest {
  const channels = graph.nodes.filter((n) => n.data.kind === 'realtime').map(parseRealtimeBlock);
  return { channels };
}
