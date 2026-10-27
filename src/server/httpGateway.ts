import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpManifest } from '../engine/http';
import { errorsSource } from './templates/errors';
import { guardsSource } from './templates/guards';
import { configurationSource } from './templates/configuration';
import { messagesSource } from './templates/messages';
import { transportSource } from './templates/transport';
import { staticSource } from './templates/static';
import { gatewaySource } from './templates/gateway';

export const httpGatewayModules = {
  'errors.mjs': errorsSource,
  'guards.mjs': guardsSource,
  'configuration.mjs': configurationSource,
  'messages.mjs': messagesSource,
  'transport.mjs': transportSource,
  'static.mjs': staticSource,
  'gateway.mjs': gatewaySource,
};

// O editor usa a mesma implementação, sem imports relativos, em um módulo isolado.
export const httpGatewaySource = Object.values(httpGatewayModules)
  .map((source) =>
    source
      .split('\n')
      .filter((line) => !line.startsWith('import ') || !line.includes("from './"))
      .join('\n'),
  )
  .join('\n');

export type HttpGatewayModule = {
  createHttpGateway(options?: {
    manifest?: HttpManifest;
    preview?: boolean;
    env?: Record<string, string | undefined>;
    staticRoot?: string;
    fetchImpl?: typeof fetch;
  }): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  executeHttpRequest(
    spec: HttpManifest['requests'][number],
    input?: { body?: unknown; query?: unknown },
    options?: {
      environment?: string;
      env?: Record<string, string | undefined>;
      fetchImpl?: typeof fetch;
      signal?: AbortSignal;
    },
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
};

export async function loadHttpGateway(): Promise<HttpGatewayModule> {
  return import(/* @vite-ignore */ 'data:text/javascript,' + encodeURIComponent(httpGatewaySource));
}
