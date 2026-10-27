import type { Graph } from '../../engine/types';
import { buildHttpManifest, type HttpManifest } from '../../engine/http';
import type { ApiAdapter, ExecutionContext } from './types';
import { MockApiAdapter } from './mockApiAdapter';

/** Único transporte do editor: a rede externa e os segredos pertencem ao servidor. */
export class GatewayApiAdapter implements ApiAdapter {
  private mock = new MockApiAdapter();
  private manifest?: HttpManifest;
  constructor(graph?: Graph) {
    if (graph) this.manifest = buildHttpManifest(graph);
  }
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    if (payload.mode !== 'real') return this.mock.execute(action, payload, context);
    const response = await fetch('/__flowforge/http', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: context.signal,
      body: JSON.stringify({
        id: payload.blockId,
        body: payload.body,
        query: payload.query,
        ...(this.manifest ? { manifest: this.manifest } : {}),
      }),
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error(
        'Backend HTTP indisponível. Inicie o servidor do FlowForge ou o backend do projeto exportado.',
      );
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(result.error?.message || 'Falha na integração HTTP.'), {
        code: result.error?.code,
        status: result.error?.status,
      });
    return result;
  }
}
