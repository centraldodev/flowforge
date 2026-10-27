import type { ApiAdapter, ExecutionContext } from './types';

/** Adaptador mock de API determinístico (sem requisições de rede) */
export class MockApiAdapter implements ApiAdapter {
  async execute(
    _action: string,
    payload: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    if (payload.mode === 'real')
      throw new Error('Uma requisição real exige o adaptador de backend HTTP.');
    if (payload.mock && typeof payload.mock === 'string') {
      try {
        return JSON.parse(payload.mock);
      } catch {
        // Fallback
      }
    }
    return { ok: true, status: 200, data: payload.body ?? null };
  }
}
