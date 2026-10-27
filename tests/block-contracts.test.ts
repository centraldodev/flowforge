import assert from 'node:assert/strict';
import test from 'node:test';
import { blockRegistry, validateBlockContract } from '../src/engine/blockRegistry';
import { catalog } from '../src/engine/catalog';
import { parseGraph } from '../src/engine/parse';
import { compile } from '../src/compiler';
import { createProject } from '../src/export';
import { configFields } from '../src/features/inspector/blockFields';
import type { Block, Graph } from '../src/engine/types';

const block = (): Block => ({
  id: 'api',
  position: { x: 0, y: 0 },
  data: {
    kind: 'api',
    label: 'API',
    config: { ...catalog.api.defaults },
  },
});
const graph = (node = block()): Graph => ({ version: 1, name: 'Legado', nodes: [node], edges: [] });

test('contratos: migração preserva configurações e não altera o projeto original', () => {
  const original = graph();
  const migrated = parseGraph(JSON.stringify(original));
  assert.equal(migrated.nodes[0].data.contractVersion, 1);
  assert.deepEqual(migrated.nodes[0].data.config, original.nodes[0].data.config);
  assert.equal(original.nodes[0].data.contractVersion, undefined);
  assert.deepEqual(parseGraph(JSON.stringify(migrated)), migrated);
});

test('contratos: todos os blocos têm propriedades, portas e matriz de destinos', () => {
  assert.deepEqual(Object.keys(blockRegistry), Object.keys(catalog));
  for (const contract of Object.values(blockRegistry)) {
    assert.equal(contract.version, 1);
    assert.ok(contract.targets.typescript);
    assert.ok(contract.targets.python);
    assert.equal(new Set(contract.properties.map((p) => p.key)).size, contract.properties.length);
    assert.equal(typeof contract.ports, 'function');
  }
  assert.equal(blockRegistry.auth.integration, 'simulated');
  assert.equal(blockRegistry.function.targets.python, 'limited');
});

test('contratos: versão futura bloqueia compilação e exportação', async () => {
  const node = block();
  node.data.contractVersion = 2;
  const result = compile(graph(node));
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_BLOCK_VERSION'));
  await assert.rejects(createProject(graph(node), 'typescript'), /versão 2/);
});

test('contratos: configuração ignorada é diagnosticada e identificada no painel', () => {
  const node = block();
  node.data.kind = 'auth';
  node.data.config = { provider: 'google', clientId: 'exemplo' };
  const issues = validateBlockContract(node);
  assert.ok(issues.some((i) => i.field === 'clientId'));
  assert.ok(
    compile(graph(node)).diagnostics.some((d) => d.field === 'clientId' && d.nodeId === node.id),
  );
  const fields = configFields(graph(node), node, () => {});
  assert.match(fields.find((f) => f.id === 'clientId')!.label, /sem efeito/);
});

test('contratos: importação rejeita versão malformada', () => {
  const node = block();
  node.data.contractVersion = 1.5;
  assert.throws(() => parseGraph(JSON.stringify(graph(node))), /Bloco inválido/);
});

test('contratos: opções desconhecidas não compilam silenciosamente', () => {
  const node = block();
  node.data.config.method = 'INVALID';
  const result = compile(graph(node));
  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === 'INVALID_BLOCK_OPTION' && d.field === 'method'),
  );
});
