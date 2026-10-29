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
  const hasModeledOps = Boolean(graph.appModeling?.applied?.operations?.length);
  if (!hasHttp && !hasDb && !hasAuth && !hasIntegrations && !hasPaymentsRealtime && !hasModeledOps)
    return false;
  emitDiagnostics(plan, graph, true);
  emitOpenApi(plan, graph);
  const root = 'apps/api/src/';
  if (hasModeledOps && graph.appModeling?.applied) {
    const specJson = JSON.stringify(graph.appModeling.applied);
    const opsGatewayCode = `// Runtime Determinístico de Operações Modeladas, Regras e Políticas (Gerado por FlowForge)
const spec = ${specJson};
const idempotencyStore = new Map();
const recordsStore = new Map();

function parseExactCents(val) {
  if (typeof val === 'number') return Math.round(val * 100);
  const str = String(val ?? '').trim().replace(/[R$\\s]/g, '');
  if (!str) return 0;
  const normalized = str.includes(',') && str.includes('.')
    ? str.replace(/\\./g, '').replace(',', '.')
    : str.includes(',') ? str.replace(',', '.') : str;
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : Math.round(num * 100);
}

function evaluateCondition(node, inputs) {
  if (node.kind === 'logical') {
    if (!node.children?.length) return true;
    return node.logicalOp === 'and'
      ? node.children.every((c) => evaluateCondition(c, inputs))
      : node.children.some((c) => evaluateCondition(c, inputs));
  }
  const left = inputs[node.leftField];
  const right = node.rightValue;
  if (node.useExactCents) {
    const l = parseExactCents(left), r = parseExactCents(right);
    if (node.operator === 'lte') return l <= r;
    if (node.operator === 'gt') return l > r;
    if (node.operator === 'gte') return l >= r;
    if (node.operator === 'lt') return l < r;
    if (node.operator === 'eq') return l === r;
    return l !== r;
  }
  if (node.operator === 'lte') return Number(left) <= Number(right);
  if (node.operator === 'gt') return Number(left) > Number(right);
  if (node.operator === 'gte') return Number(left) >= Number(right);
  if (node.operator === 'lt') return Number(left) < Number(right);
  if (node.operator === 'eq') return String(left ?? '') === String(right ?? '');
  return String(left ?? '') !== String(right ?? '');
}

export function createOperationsGateway() {
  return async (req, res) => {
    const p = req.url?.split('?')[0] || '';
    const contract = (spec.apiContracts || []).find((c) => c.path === p && c.method === (req.method || 'POST'));
    if (!contract) return false;
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const idemKey = contract.idempotencyKeyHeader ? req.headers[contract.idempotencyKeyHeader.toLowerCase()] : undefined;
    if (idemKey && idempotencyStore.has(idemKey)) {
      const cached = idempotencyStore.get(idemKey);
      res.statusCode = cached.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(cached.body));
      return true;
    }
    const op = (spec.operations || []).find((o) => o.id === contract.operationId);
    const actor = body.__actor || {
      userId: req.headers['x-user-id'] || '',
      role: req.headers['x-user-role'] || 'guest',
      orgId: req.headers['x-org-id'] || '',
      authenticated: Boolean(req.headers['x-user-id'] || req.headers.authorization),
    };
    const payload = body.payload || body;
    const existing = body.existingRecord || recordsStore.get(String(payload.id || '')) || null;
    if (op.accessMode !== 'public') {
      if (!actor.authenticated || !actor.userId) {
        res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão obrigatória.' } }));
        return true;
      }
      const policy = (spec.policies || []).find((pol) => pol.id === op.policyId);
      if (!policy || (!policy.actorRoles.includes('*') && !policy.actorRoles.includes(actor.role))) {
        res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN_ROLE', message: policy?.errorMessage || 'Acesso negado.' } }));
        return true;
      }
      if (policy.scope === 'organization' && existing && existing.org_id && String(existing.org_id) !== String(actor.orgId)) {
        res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'CROSS_ORG_FORBIDDEN', message: 'Acesso negado entre organizações.' } }));
        return true;
      }
      if (policy.forbidSelfApproval && existing && String(existing.vendedor_id || '') === String(actor.userId)) {
        res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'SELF_APPROVAL_FORBIDDEN', message: 'Autoaprovação proibida.' } }));
        return true;
      }
    }
    let outcome = 'success';
    for (const ruleId of op.ruleIds || []) {
      const rule = (spec.rules || []).find((r) => r.id === ruleId);
      if (!rule) continue;
      const matched = (rule.rows || []).find((row) => evaluateCondition(row.condition, { ...(existing || {}), ...payload }));
      outcome = matched ? matched.outcome : (rule.defaultOutcome || 'unmatched');
    }
    const record = { ...(existing || {}), ...payload, org_id: existing?.org_id || actor.orgId || 'org_default' };
    if (record.id) recordsStore.set(String(record.id), record);
    const status = op.entityAction === 'create' ? 201 : 200;
    const responseBody = { ok: true, outcome, record };
    if (idemKey) idempotencyStore.set(idemKey, { status, body: responseBody });
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(responseBody));
    return true;
  };
}
`;
    plan.text(root + 'operations/gateway.mjs', opsGatewayCode, 'operations-runtime');
  }
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

  if (hasModeledOps && graph.appModeling?.applied) {
    imports.push("import { createOperationsGateway } from './operations/gateway.mjs';");
    inits.push('const modeledOps = createOperationsGateway();');
    routes.unshift(
      "if (p.startsWith('/api/operations')) { if (await modeledOps(req, res)) return; }",
    );
    appDeps.push(root + 'operations/gateway.mjs');
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
