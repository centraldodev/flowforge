import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalog } from '../src/engine/catalog';
import { createTypeScriptPlan } from '../src/export/typescript';
import { compile } from '../src/compiler';
import type { Block, Graph, Kind } from '../src/engine/types';

function block(kind: Kind, id: string, config: Record<string, string> = {}): Block {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: { ...catalog[kind].defaults, ...config } },
  };
}
function databaseGraph(auth: boolean): Graph {
  const nodes = [
    block('screen', 'screen'),
    block('postgresConnection', 'connection', { secretEnv: 'FLOWFORGE_SECRET_REGRESSION' }),
    block('entity', 'entity', {
      name: 'items',
      fields: JSON.stringify([
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'ownerId', type: 'string' },
      ]),
    }),
    ...['insert', 'query', 'update'].map((operation) =>
      block('database', operation, { mode: 'real', operation, table: 'items' }),
    ),
  ];
  if (auth)
    nodes.push(
      block('policy', 'authenticated', {
        target: 'items',
        action: '*',
        effect: 'allow',
        conditions: '[{"operator":"authenticated"}]',
      }),
      block('policy', 'owner', {
        target: 'items',
        action: 'update',
        effect: 'allow',
        conditions: '[{"operator":"isOwner","value":"ownerId"}]',
      }),
    );
  return {
    version: 1,
    name: 'Regression',
    nodes,
    edges: ['insert', 'query', 'update'].map((id) => ({
      id: 'connection-' + id,
      source: 'connection',
      sourceHandle: 'connection',
      target: id,
      targetHandle: 'connection',
    })),
  };
}

test('autenticação real exige conexão selecionada e emite armazenamento persistente', () => {
  const graph = databaseGraph(false);
  graph.nodes.push(block('auth', 'login-real', { execution: 'real', provider: 'email' }));
  const missing = compile(graph);
  assert.equal(missing.ok, false);
  assert.ok(missing.diagnostics.some((item) => item.code === 'MISSING_AUTH_DATABASE'));
  graph.nodes[graph.nodes.length - 1].data.config.authDatabaseId = 'connection';
  const plan = createTypeScriptPlan(graph);
  const store = plan.files.get('apps/api/src/auth/store.mjs');
  assert.ok(store);
  assert.match(store.content, /flowforge_auth_users/);
  assert.match(store.content, /flowforge_auth_sessions/);
  assert.match(store.content, /createHash\('sha256'\)/);
  assert.match(plan.files.get('apps/web/vite.config.ts')!.content, /'\/api'/);
});
async function emit(graph: Graph) {
  const root = await mkdtemp(join(tmpdir(), 'flowforge-regression-'));
  for (const artifact of createTypeScriptPlan(graph).files.values()) {
    const path = join(root, artifact.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, artifact.content);
  }
  return { root, load: (path: string) => import(pathToFileURL(join(root, path)).href) };
}
async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor indisponível');
  return { server, url: `http://127.0.0.1:${address.port}` };
}
async function stop(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
async function post(url: string, path: string, data: unknown, token?: string) {
  const response = await fetch(url + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(data),
  });
  return { status: response.status, data: await response.json() };
}

/** Pool isolado que exercita transações, migrações e SQL gerado sem infraestrutura externa. */
function fakePool() {
  const records = new Map<string, Record<string, unknown>>();
  let calls = 0;
  const client = {
    async query(sql: string, params: unknown[] = []) {
      calls++;
      if (sql.startsWith('SELECT *') && sql.includes('FOR UPDATE'))
        return { rows: records.has(String(params[0])) ? [records.get(String(params[0]))] : [] };
      if (sql.startsWith('SELECT * FROM')) return { rows: [...records.values()] };
      if (sql.startsWith('INSERT INTO "public"."items"')) {
        const row = { id: params[0], name: params[1], ownerId: params[2] };
        records.set(String(row.id), row);
        return { rows: [row] };
      }
      if (sql.startsWith('UPDATE "public"."items"')) {
        const id = String(params.at(-1));
        const row = { ...records.get(id), name: params[0], ownerId: params[1] };
        records.set(id, row);
        return { rows: [row] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    pool: {
      async connect() {
        return client;
      },
    },
    get calls() {
      return calls;
    },
  };
}

test('gateway exportado usa pool e autoriza sobre o registro existente', async () => {
  const artifact = await emit(databaseGraph(true));
  const { createAuthGateway } = await artifact.load('apps/api/src/auth/gateway.mjs');
  const { createDatabaseGateway } = await artifact.load('apps/api/src/database/gateway.mjs');
  const auth = await listen(createAuthGateway()),
    fake = fakePool(),
    db = await listen(createDatabaseGateway({ pool: fake.pool }));
  try {
    const alice = await post(auth.url, '/api/auth', {
      action: 'register',
      payload: { email: 'alice@example.test', password: 'local-test-password' },
    });
    const bob = await post(auth.url, '/api/auth', {
      action: 'register',
      payload: { email: 'bob@example.test', password: 'local-test-password' },
    });
    assert.equal(
      (
        await post(db.url, '/api/db', {
          id: 'insert',
          payload: { data: { id: '1', name: 'Alice', ownerId: alice.data.user.id } },
        })
      ).status,
      401,
    );
    const insert = await post(
      db.url,
      '/api/db',
      { id: 'insert', payload: { data: { id: '1', name: 'Alice', ownerId: alice.data.user.id } } },
      alice.data.session.token,
    );
    assert.equal(insert.status, 200);
    const attack = await post(
      db.url,
      '/api/db',
      { id: 'update', payload: { id: '1', data: { name: 'Bob', ownerId: bob.data.user.id } } },
      bob.data.session.token,
    );
    assert.equal(attack.status, 403);
    assert.ok(fake.calls > 0);
    const query = await post(
      db.url,
      '/api/db',
      { id: 'query', payload: {} },
      alice.data.session.token,
    );
    assert.equal(query.data.data[0].name, 'Alice');
  } finally {
    await stop(auth.server);
    await stop(db.server);
    await rm(artifact.root, { recursive: true, force: true });
  }
});

test('banco público importa corretamente e operação real sem credencial falha', async () => {
  const artifact = await emit(databaseGraph(false));
  const { createDatabaseGateway } = await artifact.load('apps/api/src/database/gateway.mjs');
  const db = await listen(createDatabaseGateway({ env: {} }));
  try {
    const result = await post(db.url, '/api/db', { id: 'insert', payload: { data: { id: '1' } } });
    assert.equal(result.status, 503);
    assert.equal(result.data.error.code, 'DATABASE_NOT_CONFIGURED');
  } finally {
    await stop(db.server);
    await rm(artifact.root, { recursive: true, force: true });
  }
});

test('webhook usa segredo da rota e bloqueia repetição após recriar gateway', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Webhook',
    nodes: [
      block('webhook', 'hook', {
        path: '/api/webhooks/test',
        secretEnv: 'FLOWFORGE_SECRET_SPECIFIC',
      }),
    ],
    edges: [],
  };
  const artifact = await emit(graph);
  const { createIntegrationsGateway } = await artifact.load(
    'apps/api/src/integrations/gateway.mjs',
  );
  const opts = {
    env: { FLOWFORGE_SECRET_SPECIFIC: 'local-only' },
    stateDir: join(artifact.root, 'state'),
  };
  let service = await listen(createIntegrationsGateway(opts));
  const body = JSON.stringify({ id: 'event-one', value: 1 });
  const signature = 'sha256=' + createHmac('sha256', 'local-only').update(body).digest('hex');
  const send = (requestId: string) =>
    fetch(service.url + '/api/webhooks/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-request-id': requestId,
      },
      body,
    });
  try {
    assert.equal((await send('one')).status, 200);
    await stop(service.server);
    service = await listen(createIntegrationsGateway(opts));
    assert.equal((await send('two')).status, 409);
  } finally {
    await stop(service.server);
    await rm(artifact.root, { recursive: true, force: true });
  }
});

test('pagamento real não gera checkout fictício e adaptador não converte 401 em sucesso', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Services',
    nodes: [
      block('payment', 'payment', { execution: 'real', amount: '10' }),
      block('email', 'email', { execution: 'real' }),
    ],
    edges: [],
  };
  const artifact = await emit(graph);
  const { createPaymentGateway } = await artifact.load('apps/api/src/payments/gateway.mjs');
  const service = await listen(
    createPaymentGateway({ env: { FLOWFORGE_SECRET_STRIPE_SECRET_KEY: 'test-only' } }),
  );
  const { MockEmailAdapter } = await artifact.load('apps/web/src/runtime/adapters/email.js');
  const originalFetch = globalThis.fetch;
  try {
    assert.equal(
      (await post(service.url, '/api/payments/checkout', { blockId: 'payment', amount: 10 }))
        .status,
      501,
    );
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'Acesso negado' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    await assert.rejects(
      new MockEmailAdapter().execute('send', { blockId: 'email' }, {}),
      /Acesso negado/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await stop(service.server);
    await rm(artifact.root, { recursive: true, force: true });
  }
});

test('subfluxo exportado executa definição e referência ausente impede compilação', async () => {
  const definition = {
    id: 'double',
    name: 'Dobrar',
    parameters: [{ id: 'input', name: 'Valor', direction: 'input', required: true }],
    returns: [{ id: 'result', name: 'Resultado', direction: 'output' }],
    nodes: [block('math', 'inner', { operation: 'mul', a: '', b: '2' })],
    edges: [],
  };
  const graph: Graph = {
    version: 1,
    name: 'Subflow',
    nodes: [
      block('screen', 'screen'),
      block('button', 'start', { screenId: 'screen' }),
      block('input', 'number', { screenId: 'screen' }),
      block('subflow', 'calculate', {
        subflowId: 'double',
        subflowDefinition: JSON.stringify(definition),
      }),
    ],
    edges: [
      {
        id: 'run',
        source: 'start',
        sourceHandle: 'onClick',
        target: 'calculate',
        targetHandle: 'execute',
      },
      {
        id: 'data',
        source: 'number',
        sourceHandle: 'value',
        target: 'calculate',
        targetHandle: 'input',
      },
    ],
  };
  const invalid = structuredClone(graph);
  invalid.nodes[3].data.config.subflowDefinition = '';
  assert.ok(compile(invalid).diagnostics.some((item) => item.code === 'MISSING_SUBFLOW'));
  const artifact = await emit(graph);
  try {
    const { createProgram } = await artifact.load('apps/web/src/runtime/program.ts');
    const result = await createProgram().dispatch('start', { number: '21' });
    assert.equal(result.success, true, result.error?.message);
    assert.equal(result.outputs.calculate, 42);
  } finally {
    await rm(artifact.root, { recursive: true, force: true });
  }
});
