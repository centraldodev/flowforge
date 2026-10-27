import type { Graph } from '../../engine/types';
import { buildAuthManifest, type AuthManifest } from '../../engine/auth';
import type { AuthAdapter, ExecutionContext } from './types';
import { MockAuthAdapter } from './adapters';

/** Adaptador de autenticação do FlowForge: delega simulação para MockAuthAdapter e operações reais para o authGateway seguro */
export class GatewayAuthAdapter implements AuthAdapter {
  private mock = new MockAuthAdapter();
  private manifest?: AuthManifest;

  constructor(graph?: Graph) {
    if (graph) {
      try {
        this.manifest = buildAuthManifest(graph);
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

    let email = String(payload.email || '');
    let password = String(payload.password || '');
    let token = String(payload.token || '');

    // Fallback para inputs caso a chamada venha com valores vazios
    if (!email) {
      const emailKey = Object.keys(context.inputs).find((k) => k.toLowerCase().includes('email'));
      if (emailKey) email = String(context.inputs[emailKey] ?? '');
    }
    if (!password) {
      const passKey = Object.keys(context.inputs).find(
        (k) => k.toLowerCase().includes('senha') || k.toLowerCase().includes('password'),
      );
      if (passKey) password = String(context.inputs[passKey] ?? '');
    }
    if (!token && action === 'session') {
      const activeSession = context.variables['session'] as { token?: string } | undefined;
      token = activeSession?.token || '';
    }

    const response = await fetch('/__flowforge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: context.signal,
      body: JSON.stringify({
        action,
        payload: {
          email,
          password,
          name: payload.name || payload.nome || (email ? email.split('@')[0] : 'Usuário'),
          token,
          role: payload.role || 'user',
          provider: payload.provider || 'email',
        },
        manifest: this.manifest,
      }),
    });

    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(
        'Serviço de autenticação indisponível. Inicie o servidor do FlowForge ou o backend do projeto exportado.',
      );
    }

    const result = await response.json();
    if (!response.ok || !result.ok) {
      delete context.store.__session;
      const err = new Error(result.error?.message || 'Falha na autenticação.');
      throw Object.assign(err, { code: result.error?.code || 'AUTH_ERROR' });
    }

    if (action === 'logout') {
      delete context.store.__session;
      delete context.variables['user'];
      delete context.outputs['user'];
      delete context.variables['session'];
      delete context.outputs['session'];
      return { ok: true };
    }

    if (result.user) {
      context.store.__session = [result.user];
      context.variables['user'] = result.user;
      context.outputs['user'] = result.user;
    }
    if (result.session) {
      context.variables['session'] = result.session;
      context.outputs['session'] = result.session;
    }

    return result.user || result.session;
  }
}
