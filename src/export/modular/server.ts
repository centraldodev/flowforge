import type { Graph } from '../../engine/types';
import { buildHttpManifest, httpConnection } from '../../engine/http';
import { staticSource } from '../../server/templates/static';
import { httpGatewayModules } from '../../server/httpGateway';
import { ArtifactPlan, identity, json } from './artifacts';
import { emitDatabase } from './database';
import { emitAuth } from './auth';
import { emitAdditionalIntegrations } from './integrations';
import { emitDiagnostics } from './diagnostics';
import { emitPaymentsAndRealtime } from './paymentsRealtime';
import { emitOpenApi } from './openapi';

export function emitServer(plan: ArtifactPlan, graph: Graph) {
  const hasAuth = emitAuth(plan, graph);
  const hasDb = emitDatabase(plan, graph, hasAuth);
  const hasIntegrations = emitAdditionalIntegrations(plan, graph);
  const hasPaymentsRealtime = emitPaymentsAndRealtime(plan, graph);
  const manifest = buildHttpManifest(graph);
  const hasHttp = manifest.requests.length > 0;
  if (!hasHttp && !hasDb && !hasAuth && !hasIntegrations && !hasPaymentsRealtime) return false;
  emitDiagnostics(plan, graph, true);
  emitOpenApi(plan, graph);
  const root = 'apps/api/src/';
  if (hasHttp) {
    for (const [filename, content] of Object.entries(httpGatewayModules)) {
      const deps = [...content.matchAll(/from '\.\/([^']+)'/g)].map(
        (match) => root + 'http/' + match[1],
      );
      plan.text(root + 'http/' + filename, content, 'http-runtime', [], deps);
    }
    const connections = new Map<string, { path: string; requests: string[] }>();
    for (const request of manifest.requests.sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
      const connection = httpConnection(graph, request.id)!;
      const directory = root + 'integrations/' + identity(connection.id);
      const connectionPath = directory + '/connection.mjs';
      if (!connections.has(connection.id)) {
        plan.text(connectionPath, `export default ${json(request.connection)};\n`, 'connection', [
          connection.id,
        ]);
        connections.set(connection.id, { path: directory, requests: [] });
      }
      const requestPath = directory + '/requests/' + identity(request.id) + '.mjs';
      const { connection: _private, ...definition } = request;
      plan.text(
        requestPath,
        `import connection from '../connection.mjs';\nexport default { ...${json(definition).trim()}, connection };\n`,
        'http-request',
        [request.id],
        [connectionPath],
      );
      connections.get(connection.id)!.requests.push(requestPath);
    }
    // Um registro por conexão; as operações são carregadas do diretório privado.
    const indexes = [];
    for (const [id, resource] of connections) {
      const index = resource.path + '/index.mjs';
      plan.text(
        index,
        `import { readdir } from 'node:fs/promises';\nconst directory = new URL('./requests/', import.meta.url);\nconst files = (await readdir(directory)).filter((file) => file.endsWith('.mjs')).sort();\nexport default await Promise.all(files.map(async (file) => (await import(new URL(file, directory).href)).default));\n`,
        'connection-registry',
        [id],
        resource.requests,
      );
      indexes.push(index);
    }
    plan.text(
      root + 'integrations/registry.mjs',
      `import { readdir } from 'node:fs/promises';\nconst root = new URL('./', import.meta.url);\nconst directories = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));\nconst requests = (await Promise.all(directories.map(async (entry) => (await import(new URL(entry.name + '/index.mjs', root).href)).default))).flat();\nexport default { environment: ${JSON.stringify(manifest.environment)}, requests };\n`,
      'integration-registry',
      [],
      indexes,
    );
    // Os contratos públicos de transporte não contêm configurações privadas.
    plan.text(
      'packages/contracts/src/http.ts',
      `export type HttpResult<T = unknown> = { ok: true; status: number; data: T };\nexport type HttpFailure = { error: { code: string; message: string; status?: number } };\n`,
      'contract',
    );
    plan.text(
      root + 'http/transport.d.mts',
      `import type { HttpResult } from '@flowforge/contracts/http';\nexport function executeHttpRequest(spec: unknown, input?: { body?: unknown; query?: unknown }, options?: { environment?: string; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<HttpResult>;\n`,
      'contract',
    );
  }

  plan.text(
    root + 'config/environment.mjs',
    `export function environment(env = process.env) {\n const port = Number(env.FLOWFORGE_PORT || 8787);\n if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('FLOWFORGE_PORT inválida.');\n return { host: env.FLOWFORGE_HOST || '127.0.0.1', port };\n}\n`,
    'configuration',
  );

  plan.text(root + 'runtime/static.mjs', staticSource, 'runtime');

  const imports: string[] = [
    "import { fileURLToPath } from 'node:url';",
    "import { serveStatic } from './runtime/static.mjs';",
  ];
  const appDeps: string[] = [root + 'runtime/static.mjs'];
  const inits: string[] = [
    "const staticRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));",
  ];
  const routes: string[] = [];

  if (hasHttp) {
    imports.push("import { createHttpGateway } from './http/gateway.mjs';");
    imports.push("import manifest from './integrations/registry.mjs';");
    inits.push('const http = createHttpGateway({ manifest, staticRoot });');
    routes.push(
      "if (['/__flowforge/http', '/__flowforge/secrets'].includes(p)) return http(req, res);",
    );
    appDeps.push(root + 'http/gateway.mjs', root + 'integrations/registry.mjs');
  }

  if (hasDb) {
    imports.push("import { createDatabaseGateway } from './database/gateway.mjs';");
    inits.push('const db = createDatabaseGateway();');
    routes.unshift("if (['/__flowforge/db', '/api/db'].includes(p)) return db(req, res);");
    appDeps.push(root + 'database/gateway.mjs');
  }

  if (hasAuth) {
    imports.push("import { createAuthGateway } from './auth/gateway.mjs';");
    inits.push('const auth = createAuthGateway();');
    routes.unshift(
      "if (['/__flowforge/auth', '/api/auth'].some((prefix) => p.startsWith(prefix))) return auth(req, res);",
    );
    appDeps.push(root + 'auth/gateway.mjs');
  }

  if (hasIntegrations) {
    imports.push("import { createIntegrationsGateway } from './integrations/gateway.mjs';");
    inits.push('const integrations = createIntegrationsGateway();');
    routes.unshift(
      "if (['/api/storage', '/api/email', '/api/webhooks', '/api/tasks'].some((prefix) => p.startsWith(prefix))) return integrations(req, res);",
    );
    appDeps.push(root + 'integrations/gateway.mjs');
  }

  const hasPaymentNodes = graph.nodes.some((n) => n.data.kind === 'payment');
  if (hasPaymentNodes) {
    imports.push("import { createPaymentGateway } from './payments/gateway.mjs';");
    inits.push('const payments = createPaymentGateway();');
    routes.unshift("if (p.startsWith('/api/payments')) return payments(req, res);");
    appDeps.push(root + 'payments/gateway.mjs');
  }

  const hasRealtimeNodes = graph.nodes.some((n) => n.data.kind === 'realtime');
  if (hasRealtimeNodes) {
    imports.push("import { createRealtimeGateway } from './realtime/gateway.mjs';");
    inits.push('const realtime = createRealtimeGateway();');
    routes.unshift("if (p.startsWith('/api/realtime')) return realtime(req, res);");
    appDeps.push(root + 'realtime/gateway.mjs');
  }

  imports.push("import { createDiagnosticsGateway } from './runtime/diagnostics.mjs';");
  imports.push("import { logger } from './runtime/logger.mjs';");
  imports.push("import { createOpenApiGateway } from './openapi/gateway.mjs';");
  inits.push('const diagnostics = createDiagnosticsGateway();');
  inits.push('const openapi = createOpenApiGateway();');
  routes.unshift(
    "if (['/api/health', '/api/diagnostics'].includes(p)) return diagnostics(req, res);",
  );
  routes.unshift(
    "if (['/api/openapi.json', '/api/docs', '/api/swagger'].includes(p)) return openapi(req, res);",
  );
  appDeps.push(
    root + 'runtime/diagnostics.mjs',
    root + 'runtime/logger.mjs',
    root + 'openapi/gateway.mjs',
  );

  const appCode = `${imports.join('\n')}
export function createApp() {
  ${inits.join('\n  ')}
  return async (req, res) => {
    const p = req.url?.split('?')[0] || '';
    logger.info(\`\${req.method || 'GET'} \${p}\`);
    ${routes.join('\n    ')}
    if (req.method === 'GET') {
      if (await serveStatic(req, res, p, staticRoot)) return;
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  };
}
`;

  plan.text(root + 'app.mjs', appCode, 'app', [], appDeps);
  plan.text(
    root + 'main.mjs',
    `import { createServer } from 'node:http';\nimport { createApp } from './app.mjs';\nimport { environment } from './config/environment.mjs';\nconst config = environment();\nconst server = createServer(createApp());\nserver.listen(config.port, config.host, () => console.log('FlowForge backend: http://' + config.host + ':' + server.address().port));\n`,
    'entrypoint',
    [],
    [root + 'app.mjs', root + 'config/environment.mjs'],
  );
  return true;
}
