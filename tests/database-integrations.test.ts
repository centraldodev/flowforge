import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { catalog } from '../src/engine/catalog';
import { compile, createExecutionContext, interpret } from '../src/compiler';
import { createProject } from '../src/export';
import {
  buildDatabaseManifest,
  databaseConfigurationIssues,
  generatePostgresDDL,
} from '../src/engine/database';
import {
  createDatabaseGateway,
  clearDevDatabase,
  executeDatabaseOperation,
} from '../src/server/databaseGateway';
import type { Block, Graph, Kind } from '../src/engine/types';

function node(kind: Kind, id: string, config: Record<string, string> = {}): Block {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: { ...catalog[kind].defaults, ...config } },
  };
}

function dbProject(): Graph {
  return {
    version: 1,
    name: 'PostgreSQL Real',
    nodes: [
      node('screen', 'screen'),
      node('button', 'btn_save', { screenId: 'screen' }),
      node('postgresConnection', 'pg_conn', {
        host: 'localhost',
        port: '5432',
        database: 'meu_app',
        user: 'postgres',
        secretEnv: 'FLOWFORGE_SECRET_DB_PASS',
      }),
      node('entity', 'ent_clientes', {
        name: 'clientes',
        fields: JSON.stringify([
          { name: 'id', type: 'string', required: true, primaryKey: true },
          { name: 'nome', type: 'string', required: true },
          { name: 'email', type: 'string', unique: true },
        ]),
      }),
      node('database', 'db_insert', {
        mode: 'real',
        operation: 'insert',
        table: 'clientes',
      }),
      node('database', 'db_query', {
        mode: 'real',
        operation: 'query',
        table: 'clientes',
        filterField: 'nome',
        filterValue: 'Alice',
      }),
    ],
    edges: [
      {
        id: 'conn_insert',
        source: 'pg_conn',
        sourceHandle: 'connection',
        target: 'db_insert',
        targetHandle: 'connection',
      },
      {
        id: 'conn_query',
        source: 'pg_conn',
        sourceHandle: 'connection',
        target: 'db_query',
        targetHandle: 'connection',
      },
      {
        id: 'run_insert',
        source: 'btn_save',
        sourceHandle: 'onClick',
        target: 'db_insert',
        targetHandle: 'execute',
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

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test('Banco de Dados: validações de configuração, segredos e conexões', () => {
  const g = dbProject();
  assert.equal(databaseConfigurationIssues(g).length, 0);

  // Sem conexão configurada no bloco real
  const disconnected = structuredClone(g);
  disconnected.edges = disconnected.edges.filter((e) => e.id !== 'conn_insert');
  const issues1 = databaseConfigurationIssues(disconnected);
  assert.ok(issues1.some((i) => i.blockId === 'db_insert'));

  // Nome de segredo sem prefixo FLOWFORGE_SECRET_
  const invalidSecret = structuredClone(g);
  invalidSecret.nodes[2].data.config.secretEnv = 'SENHA_INCORRETA';
  const issues2 = databaseConfigurationIssues(invalidSecret);
  assert.ok(issues2.some((i) => i.blockId === 'pg_conn'));

  // Nome de tabela inválido (proteção contra identificadores inseguros)
  const invalidTable = structuredClone(g);
  invalidTable.nodes[4].data.config.table = 'clientes; DROP TABLE usuarios;--';
  const issues3 = databaseConfigurationIssues(invalidTable);
  assert.ok(issues3.some((i) => i.blockId === 'db_insert'));
});

test('Banco de Dados: geração de DDL e migrações SQL estruturadas', () => {
  const g = dbProject();
  const manifest = buildDatabaseManifest(g);
  assert.equal(manifest.entities.length, 1);
  const ddl = generatePostgresDDL(manifest.entities[0]);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS "clientes"/);
  assert.match(ddl, /"id" TEXT PRIMARY KEY/);
  assert.match(ddl, /"nome" TEXT NOT NULL/);
  assert.match(ddl, /"email" TEXT UNIQUE/);
});

test('Banco de Dados: operações CRUD completas (insert, query, get, update, delete)', async () => {
  clearDevDatabase();
  const g = dbProject();
  const manifest = buildDatabaseManifest(g);

  // 1. INSERT
  const insertSpec = manifest.operations.find((op) => op.id === 'db_insert')!;
  const resInsert = await executeDatabaseOperation(insertSpec, {
    data: { id: 'cli_1', nome: 'Alice', email: 'alice@empresa.com' },
  });
  assert.equal(resInsert.ok, true);
  assert.equal((resInsert.data as { id: string }).id, 'cli_1');

  // 2. QUERY com filtro
  const querySpec = manifest.operations.find((op) => op.id === 'db_query')!;
  const resQuery = await executeDatabaseOperation(querySpec, {
    filter: { nome: 'Alice' },
  });
  assert.equal(resQuery.ok, true);
  assert.equal(Array.isArray(resQuery.data), true);
  assert.equal((resQuery.data as unknown[]).length, 1);

  // 3. GET por ID
  const getSpec = { ...insertSpec, id: 'db_get', operation: 'get' as const, recordId: 'cli_1' };
  const resGet = await executeDatabaseOperation(getSpec, { id: 'cli_1' });
  assert.equal(resGet.ok, true);
  assert.equal((resGet.data as { nome: string }).nome, 'Alice');

  // 4. UPDATE
  const updateSpec = {
    ...insertSpec,
    id: 'db_up',
    operation: 'update' as const,
    recordId: 'cli_1',
  };
  const resUpdate = await executeDatabaseOperation(updateSpec, {
    id: 'cli_1',
    data: { email: 'novo_alice@empresa.com' },
  });
  assert.equal(resUpdate.ok, true);
  assert.equal((resUpdate.data as { email: string }).email, 'novo_alice@empresa.com');

  // 5. DELETE
  const deleteSpec = {
    ...insertSpec,
    id: 'db_del',
    operation: 'delete' as const,
    recordId: 'cli_1',
  };
  const resDelete = await executeDatabaseOperation(deleteSpec, { id: 'cli_1' });
  assert.equal(resDelete.ok, true);
  assert.equal(resDelete.deletedCount, 1);

  // Confirma que não existe mais após delete
  const resGetAfter = await executeDatabaseOperation(getSpec, { id: 'cli_1' });
  assert.equal(resGetAfter.ok, false);
  assert.equal(resGetAfter.error?.code, 'NOT_FOUND');
});

test('Banco de Dados: execução pelo interpretador via GatewayDatabaseAdapter', async () => {
  clearDevDatabase();
  const g = dbProject();
  const manifest = buildDatabaseManifest(g);
  const gateway = await listen(createDatabaseGateway({ manifest }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url, options) =>
    originalFetch(
      String(url).startsWith('/__flowforge/') ? gateway.url + url : url,
      options,
    )) as typeof fetch;

  try {
    const compilation = compile(g);
    assert.equal(compilation.ok, true);

    const context = createExecutionContext({
      variables: {
        value: { id: 'cli_2', nome: 'Carlos', email: 'carlos@empresa.com' },
      },
    });

    const result = await interpret(compilation.value, 'btn_save', context);
    assert.equal(result.success, true);
    assert.equal((result.outputs['value'] as { nome: string })?.nome, 'Carlos');
  } finally {
    globalThis.fetch = originalFetch;
    await close(gateway.server);
  }
});

test('Banco de Dados: falha no banco segue ramo onError e não quebra fluxo', async () => {
  const g = dbProject();
  g.nodes.push(node('notify', 'erro_banco', { message: 'Erro na gravação', type: 'error' }));
  g.edges.push({
    id: 'edge_err',
    source: 'db_insert',
    sourceHandle: 'onError',
    target: 'erro_banco',
    targetHandle: 'execute',
  });

  const gateway = await listen(
    createDatabaseGateway({
      queryRunner: async () => {
        throw new Error('Conexão recusada pelo PostgreSQL.');
      },
    }),
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url, options) =>
    originalFetch(
      String(url).startsWith('/__flowforge/') ? gateway.url + url : url,
      options,
    )) as typeof fetch;

  try {
    const compilation = compile(g);
    assert.equal(compilation.ok, true);

    const context = createExecutionContext({
      variables: { value: { id: 'cli_3', nome: 'Falha' } },
    });

    const result = await interpret(compilation.value, 'btn_save', context);
    assert.equal(result.success, true);
    assert.ok(result.notifications.some((n) => n.message === 'Erro na gravação'));
  } finally {
    globalThis.fetch = originalFetch;
    await close(gateway.server);
  }
});

test('Banco de Dados: exportação modular gera contratos, migrações e repositórios sem vazar segredos', async () => {
  const g = dbProject();
  const zip = await createProject(g, 'typescript');

  for (const file of [
    'apps/api/src/database/manifest.mjs',
    'apps/api/src/database/gateway.mjs',
    'apps/api/src/database/migrations/001_init.sql',
    'apps/api/src/modules/clientes/repository.mjs',
    '.env.development.example',
    '.env.production.example',
  ]) {
    assert.ok(zip.file(file), `Arquivo esperado ausente no ZIP: ${file}`);
  }

  const envDev = await zip.file('.env.development.example')!.async('text');
  assert.match(envDev, /FLOWFORGE_SECRET_DB_PASS=\n/);

  const migration = await zip.file('apps/api/src/database/migrations/001_init.sql')!.async('text');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "clientes"/);

  const repo = await zip.file('apps/api/src/modules/clientes/repository.mjs')!.async('text');
  assert.match(repo, /class ClientesRepository/);

  // Python recusa exportar banco real
  await assert.rejects(createProject(g, 'python'), /TypeScript/);
});
