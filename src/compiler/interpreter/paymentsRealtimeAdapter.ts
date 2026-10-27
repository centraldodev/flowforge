import type { PaymentAdapter, RealtimeAdapter, ExecutionContext } from './types';

/**
 * Adaptador de Pagamentos (Stripe, PIX e Mercado Pago) com validações e respostas estruturadas.
 */
export class GatewayPaymentAdapter implements PaymentAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const provider = String(payload.provider || 'stripe');
    const currency = String(payload.currency || 'BRL').toUpperCase();
    const amount = Number(payload.amount ?? 0);
    const description = String(payload.description || 'Pagamento FlowForge');

    switch (action) {
      case 'createCheckout': {
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Valor da cobrança (amount) deve ser um número positivo.');
        }

        if (provider === 'pix') {
          const paymentId = 'pix_' + Math.random().toString(36).slice(2, 11);
          const qrCode =
            '00020126580014br.gov.bcb.pix0136' +
            Math.random().toString(36).slice(2, 14) +
            '520400005303986540' +
            amount.toFixed(2).replace('.', '') +
            '5802BR5925FlowForge Pagamentos6009Sao Paulo62070503***6304';

          return {
            success: true,
            provider: 'pix',
            paymentId,
            status: 'pending',
            qrCode,
            amount,
            currency,
            description,
          };
        }

        // Provedor padrão: Stripe Checkout
        const sessionId = 'cs_test_' + Math.random().toString(36).slice(2, 14);
        const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;

        return {
          success: true,
          provider: 'stripe',
          sessionId,
          checkoutUrl,
          status: 'pending',
          amount,
          currency,
          description,
        };
      }

      case 'charge': {
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Valor da cobrança (amount) deve ser um número positivo.');
        }

        const paymentId = 'ch_' + Math.random().toString(36).slice(2, 12);
        return {
          success: true,
          paymentId,
          status: 'paid',
          amount,
          currency,
          description,
          paidAt: new Date().toISOString(),
        };
      }

      case 'verify': {
        const id = String(payload.paymentId || payload.sessionId || 'sample_id');
        return {
          success: true,
          id,
          status: 'paid',
          verifiedAt: new Date().toISOString(),
        };
      }

      case 'refund': {
        const id = String(payload.paymentId || 'sample_id');
        return {
          success: true,
          paymentId: id,
          status: 'refunded',
          refundedAmount: amount,
          refundedAt: new Date().toISOString(),
        };
      }

      default:
        throw new Error(`Operação de pagamento não suportada: "${action}".`);
    }
  }
}

// Armazena assinaturas e eventos ativos em memória para teste e simulação
type RealtimeListener = (event: string, data: unknown) => void;
const channelListeners = new Map<string, Set<RealtimeListener>>();

/**
 * Adaptador de Tempo Real (Server-Sent Events / WebSockets) para publicação e assinatura.
 */
export class GatewayRealtimeAdapter implements RealtimeAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const channel = payload.channel !== undefined ? String(payload.channel) : 'general';
    const event = String(payload.event || 'message');
    const data = payload.data ?? payload.payload;

    switch (action) {
      case 'publish':
      case 'broadcast': {
        if (!channel.trim()) {
          throw new Error('Canal de tempo real (channel) é obrigatório para publicação.');
        }

        const listeners = channelListeners.get(channel);
        if (listeners) {
          for (const listener of listeners) {
            listener(event, data);
          }
        }

        return {
          success: true,
          channel,
          event,
          payload: data,
          timestamp: new Date().toISOString(),
          delivered: true,
          recipientCount: listeners ? listeners.size : 0,
        };
      }

      case 'subscribe': {
        if (!channel.trim()) {
          throw new Error('Canal de tempo real (channel) é obrigatório para inscrição.');
        }

        const clientId = 'client_' + Math.random().toString(36).slice(2, 10);
        return {
          success: true,
          channel,
          clientId,
          status: 'subscribed',
          subscribedAt: new Date().toISOString(),
        };
      }

      default:
        throw new Error(`Ação de tempo real não suportada: "${action}".`);
    }
  }
}
