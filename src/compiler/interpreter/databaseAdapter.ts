import type { Graph } from '../../engine/types';
import { buildDatabaseManifest, type DatabaseManifest } from '../../engine/database';
import type { DatabaseAdapter, ExecutionContext } from './types';
import { MockDatabaseAdapter } from './adapters';

/** Adaptador de banco de dados do FlowForge: delega mock para simulação e operações reais para o gateway seguro do servidor */
export class GatewayDatabaseAdapter implements DatabaseAdapter {
  private mock = new MockDatabaseAdapter();
  private manifest?: DatabaseManifest;

  constructor(graph?: Graph) {
    if (graph) {
      try {
        this.manifest = buildDatabaseManifest(graph);
      } catch {
        // Se houver nós incompletos no canvas durante edição, ignora até execução
      }
    }
  }

  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    if (payload.mode !== 'real') {
      return this.mock.execute(action, payload, context);
    }

    const response = await fetch('/__flowforge/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: context.signal,
      body: JSON.stringify({
        id: payload.blockId,
        action,
        payload: {
          data: payload.data ?? payload.value,
          id: payload.id ?? payload.recordId,
          filter: payload.filter,
          limit: payload.limit,
          offset: payload.offset,
          orderBy: payload.orderBy,
          orderDirection: payload.orderDirection,
        },
        ...(this.manifest ? { manifest: this.manifest } : {}),
      }),
    });

    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(
        'Backend de banco de dados indisponível. Inicie o servidor do FlowForge ou o backend do projeto exportado.',
      );
    }

    const result = await response.json();
    if (!response.ok || !result.ok) {
      const err = new Error(result.error?.message || 'Falha na operação de banco de dados.');
      throw Object.assign(err, { code: result.error?.code || 'DB_ERROR' });
    }

    context.variables['value'] = result.data;
    context.outputs['value'] = result.data;
    if (result.total !== undefined) {
      context.variables['total'] = result.total;
      context.outputs['total'] = result.total;
    }
    if (result.deletedCount !== undefined) {
      context.variables['deletedCount'] = result.deletedCount;
      context.outputs['deletedCount'] = result.deletedCount;
    }

    return result.data;
  }
}
