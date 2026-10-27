import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadHttpGateway } from '../src/server/httpGateway';
import { buildHttpManifest, httpConfigurationIssues } from '../src/engine/http';
import { catalog } from '../src/engine/catalog';
import { compile, createExecutionContext, interpret, generateProgramCode } from '../src/compiler';
import { GatewayApiAdapter } from '../src/compiler/interpreter/httpAdapter';
import { createProject } from '../src/export';
import { createBlock, updateConfig } from '../src/state/graphOps';
import type { Block, Graph, Kind } from '../src/engine/types';

function node(kind: Kind, id: string, config: Record<string, string> = {}): Block {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: { ...catalog[kind].defaults, ...config } },
  };
}
function project(baseUrl: string): Graph {
  return {
    version: 1,
    name: 'HTTP real',
    nodes: [
      node('screen', 'screen'),
      node('button', 'load', { screenId: 'screen' }),
      node('httpConnection', 'service', { baseUrl }),
      node('api', 'request', {
        mode: 'real',
        method: 'GET',
        url: '/items',
        query: '[{"key":"limit","value":"2"}]',
      }),
    ],
    edges: [
      {
        id: 'run',
        source: 'load',
        sourceHandle: 'onClick',
        target: 'request',
        targetHandle: 'execute',
      },
      {
        id: 'resource',
        source: 'service',
        sourceHandle: 'connection',
        target: 'request',
        targetHandle: 'connection',
      },
    ],
  };
}
async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

const gatewayModule = await loadHttpGateway();

test('HTTP: POST real com corpo, parâmetros, segredo no servidor e resposta sanitizada', async () => {
  let seen: { url?: string; authorization?: string; body?: unknown } = {};
  const external = await listen(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen = {
      url: req.url,
      authorization: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString()),
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ saved: true, leaked: req.headers.authorization }));
  });
  try {
    const g = project(external.url);
    Object.assign(g.nodes[2].data.config, { auth: 'bearer', secretEnv: 'FLOWFORGE_SECRET_TEST' });
    g.nodes[3].data.config.method = 'POST';
    const spec = buildHttpManifest(g).requests[0];
    const result = await gatewayModule.executeHttpRequest(
      spec,
      { body: { name: 'Cliente' }, query: { limit: 5 } },
      { env: { FLOWFORGE_SECRET_TEST: 'segredo-apenas-servidor' } },
    );
    assert.deepEqual(seen, {
      url: '/items?limit=5',
      authorization: 'Bearer segredo-apenas-servidor',
      body: { name: 'Cliente' },
    });
    assert.deepEqual(result, {
      ok: true,
      status: 200,
      data: { saved: true, leaked: 'Bearer [REDACTED]' },
    });
    assert.ok(!JSON.stringify(g).includes('segredo-apenas-servidor'));
  } finally {
    await close(external.server);
  }
});

test('HTTP: timeout, erro HTTP, JSON inválido, 204 e redirecionamento têm resultados definidos', async () => {
  const external = await listen((req, res) => {
    if (req.url === '/slow') {
      setTimeout(() => res.end('{}'), 250);
      return;
    }
    if (req.url === '/fail') {
      res.statusCode = 401;
      res.end('secret diagnostic');
      return;
    }
    if (req.url === '/redirect') {
      res.statusCode = 302;
      res.setHeader('Location', '/items');
      res.end();
      return;
    }
    if (req.url === '/empty') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.end('texto sem json');
  });
  try {
    const spec = buildHttpManifest(project(external.url)).requests[0];
    spec.query = [];
    await assert.rejects(
      gatewayModule.executeHttpRequest({
        ...spec,
        path: '/slow',
        connection: { ...spec.connection, timeoutMs: 100 },
      }),
      (error: unknown) => (error as { code: string }).code === 'HTTP_TIMEOUT',
    );
    await assert.rejects(
      gatewayModule.executeHttpRequest({ ...spec, path: '/fail' }),
      (error: unknown) =>
        (error as { code: string }).code === 'HTTP_STATUS' &&
        !String(error).includes('secret diagnostic'),
    );
    await assert.rejects(
      gatewayModule.executeHttpRequest({ ...spec, path: '/redirect' }),
      (error: unknown) => (error as { code: string }).code === 'HTTP_NETWORK',
    );
    await assert.rejects(
      gatewayModule.executeHttpRequest({ ...spec, path: '/text' }),
      (error: unknown) => (error as { code: string }).code === 'INVALID_RESPONSE',
    );
    assert.equal(
      (await gatewayModule.executeHttpRequest({ ...spec, path: '/text', responseType: 'text' }))
        .data,
      'texto sem json',
    );
    assert.equal((await gatewayModule.executeHttpRequest({ ...spec, path: '/empty' })).data, null);
  } finally {
    await close(external.server);
  }
});

test('HTTP: ambiente de produção e referência de segredo são resolvidos no servidor', async () => {
  const g = project('https://dev.example.test');
  Object.assign(g.nodes[2].data.config, {
    productionBaseUrl: 'https://prod.example.test/v1',
    auth: 'apiKey',
    secretEnv: 'FLOWFORGE_SECRET_KEY',
  });
  const spec = buildHttpManifest(g).requests[0];
  let seen = '';
  const result = await gatewayModule.executeHttpRequest(
    spec,
    {},
    {
      environment: 'production',
      env: { FLOWFORGE_SECRET_KEY: 'server-value' },
      fetchImpl: async (url, options) => {
        seen = String(url);
        assert.equal((options!.headers as Record<string, string>)['X-API-Key'], 'server-value');
        return new Response('{"ok":true}');
      },
    },
  );
  assert.equal(seen, 'https://prod.example.test/v1/items?limit=2');
  assert.equal(result.ok, true);
  await assert.rejects(gatewayModule.executeHttpRequest(spec, {}, { env: {} }), /credencial/);
});

test('HTTP: gateway exportado recusa manifesto do cliente, origem externa e requisição desconhecida', async () => {
  const gateway = await listen(
    gatewayModule.createHttpGateway({
      manifest: buildHttpManifest(project('https://example.test')),
    }),
  );
  const call = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(gateway.url + '/__flowforge/http', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await call({ id: 'request', manifest: {} })).status, 400);
    assert.equal((await call({ id: 'missing' })).status, 404);
    assert.equal((await call({ id: 'request' }, { Origin: 'https://evil.test' })).status, 403);
    assert.equal(
      (await fetch(gateway.url + '/__flowforge/secrets', { method: 'POST' })).status,
      404,
    );
    const spec = buildHttpManifest(project('https://example.test')).requests[0];
    await assert.rejects(
      gatewayModule.executeHttpRequest({ ...spec, path: '//evil.test' }),
      /caminho/,
    );
    await assert.rejects(
      gatewayModule.executeHttpRequest(spec, { query: { unlisted: 'value' } }),
      /não declarado/,
    );
  } finally {
    await close(gateway.server);
  }
});

test('HTTP: credencial local é temporária, nunca retornada e indisponível no backend exportado', async () => {
  const env: Record<string, string | undefined> = {};
  const gateway = await listen(gatewayModule.createHttpGateway({ preview: true, env }));
  try {
    const response = await fetch(gateway.url + '/__flowforge/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'FLOWFORGE_SECRET_TEST', value: 'private-value' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { configured: true });
    assert.equal(env.FLOWFORGE_SECRET_TEST, 'private-value');
  } finally {
    await close(gateway.server);
  }
});

test('HTTP: grafo valida recursos e painel cria o mesmo cabo da seleção manual', () => {
  const g = project('https://example.test');
  assert.deepEqual(httpConfigurationIssues(g), []);
  assert.ok(compile(g).ok);
  const disconnected = { ...g, edges: g.edges.filter((edge) => edge.id !== 'resource') };
  assert.equal(compile(disconnected).ok, false);
  const wired = updateConfig(disconnected, 'request', { connectionId: 'service' });
  assert.equal(buildHttpManifest(wired).requests[0].connection.development, 'https://example.test');
  assert.equal(wired.nodes[3].data.config.connectionId, undefined);
  assert.equal(createBlock('httpConnection', { x: 0, y: 0 }, '').data.ports, undefined);
  assert.equal(createBlock('api', { x: 0, y: 0 }, '').data.config.mode, 'real');
});

test('HTTP: execução interpretada e código exportado chegam ao servidor real, com saída por bloco', async () => {
  const external = await listen((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end('{"items":[1,2]}');
  });
  const g = project(external.url);
  const gateway = await listen(gatewayModule.createHttpGateway({ manifest: buildHttpManifest(g) }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url, options) =>
    originalFetch(
      String(url).startsWith('/__flowforge/') ? gateway.url + url : url,
      options,
    )) as typeof fetch;
  try {
    const compilation = compile(g);
    assert.ok(compilation.ok);
    const result = await interpret(
      compilation.value,
      'load',
      createExecutionContext({
        adapters: { ...createExecutionContext().adapters, api: new GatewayApiAdapter() },
      }),
    );
    assert.equal(result.success, true);
    assert.deepEqual(result.outputs.request, { ok: true, status: 200, data: { items: [1, 2] } });
    const code = generateProgramCode(compilation.value);
    const runtime = await import('data:text/javascript,' + encodeURIComponent(code));
    const compiled = await runtime.createProgram().dispatch('load');
    assert.deepEqual(compiled.outputs.request, result.outputs.request);
  } finally {
    globalThis.fetch = originalFetch;
    await close(gateway.server);
    await close(external.server);
  }
});

test('HTTP: ZIP contém backend independente e nomes de segredos vazios, Python bloqueia HTTP real', async () => {
  const g = project('https://example.test');
  Object.assign(g.nodes[2].data.config, { auth: 'bearer', secretEnv: 'FLOWFORGE_SECRET_KEY' });
  const zip = await createProject(g, 'typescript');
  for (const file of [
    'apps/api/src/main.mjs',
    'apps/api/src/http/gateway.mjs',
    'apps/api/src/integrations/registry.mjs',
    '.env.development.example',
    '.env.production.example',
    'apps/web/vite.config.ts',
    'packages/contracts/src/runtime.ts',
  ])
    assert.ok(zip.file(file), file);
  assert.match(
    await zip.file('.env.development.example')!.async('text'),
    /FLOWFORGE_SECRET_KEY=\n/,
  );
  assert.ok(
    !(await zip.file('apps/web/src/runtime/program.ts')!.async('text')).includes(
      'https://example.test',
    ),
  );
  await assert.rejects(createProject(g, 'python'), /TypeScript/);
});

test('HTTP: falha real segue onError e nunca produz sucesso simulado', async () => {
  const external = await listen((_req, res) => {
    res.statusCode = 503;
    res.end('privado');
  });
  const g = project(external.url);
  g.nodes.push(node('notify', 'failure', { message: 'Serviço indisponível', type: 'error' }));
  g.edges.push({
    id: 'catch',
    source: 'request',
    sourceHandle: 'onError',
    target: 'failure',
    targetHandle: 'execute',
  });
  const gateway = await listen(gatewayModule.createHttpGateway({ manifest: buildHttpManifest(g) }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url, options) =>
    originalFetch(
      String(url).startsWith('/__flowforge/') ? gateway.url + url : url,
      options,
    )) as typeof fetch;
  try {
    const compilation = compile(g);
    assert.ok(compilation.ok);
    const result = await interpret(compilation.value, 'load', createExecutionContext());
    assert.ok(
      result.notifications.some((notification) => notification.message === 'Serviço indisponível'),
    );
    assert.equal(result.outputs.request, undefined);
    assert.equal((result.outputs.error as { code: string }).code, 'HTTP_STATUS');
  } finally {
    globalThis.fetch = originalFetch;
    await close(gateway.server);
    await close(external.server);
  }
});

test('HTTP: cabo de dados do objeto fornece o corpo ao bloco API', async () => {
  const g = project('https://example.test');
  g.nodes[3].data.config.method = 'POST';
  g.nodes.push(node('object', 'payload', { fields: '{"name":"Maria","active":true}' }));
  g.edges = g.edges.filter((edge) => edge.id !== 'run');
  g.edges.push(
    {
      id: 'start',
      source: 'load',
      sourceHandle: 'onClick',
      target: 'payload',
      targetHandle: 'execute',
    },
    {
      id: 'continue',
      source: 'payload',
      sourceHandle: 'then',
      target: 'request',
      targetHandle: 'execute',
    },
    {
      id: 'body',
      source: 'payload',
      sourceHandle: 'object',
      target: 'request',
      targetHandle: 'body',
    },
  );
  const compilation = compile(g);
  assert.ok(compilation.ok);
  let sent: unknown;
  const context = createExecutionContext();
  context.adapters.api = {
    async execute(_action, payload) {
      sent = payload.body;
      return { ok: true, status: 200, data: payload.body };
    },
  };
  const result = await interpret(compilation.value, 'load', context);
  assert.equal(result.success, true);
  assert.deepEqual(sent, { name: 'Maria', active: true });
});
