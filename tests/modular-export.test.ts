import test from 'node:test';
import assert from 'node:assert/strict';
import { createTypeScriptPlan } from '../src/export/typescript';
import { ArtifactPlan, identity } from '../src/export/modular/artifacts';
import { compile, interpret, createExecutionContext } from '../src/compiler';
import { catalog } from '../src/engine/catalog';
import type { Graph, Block, Kind } from '../src/engine/types';

function node(kind: Kind, id: string, config: Record<string, string> = {}): Block {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: { ...catalog[kind].defaults, ...config } },
  };
}
function fixture(count = 3): Graph {
  const nodes = [
    node('screen', 'page'),
    node('button', 'start', { screenId: 'page' }),
    node('button', 'second', { screenId: 'page' }),
  ];
  const edges: Graph['edges'] = [
    {
      id: 'start-edge',
      source: 'start',
      sourceHandle: 'onClick',
      target: 'math-0',
      targetHandle: 'execute',
    },
    {
      id: 'second-edge',
      source: 'second',
      sourceHandle: 'onClick',
      target: 'math-0',
      targetHandle: 'execute',
    },
  ];
  for (let i = 0; i < count; i++) {
    nodes.push(
      node('math', 'math-' + i, { operation: 'add', a: String(i), b: '2', screenId: 'page' }),
    );
    if (i + 1 < count)
      edges.push({
        id: 'chain-' + i,
        source: 'math-' + i,
        sourceHandle: 'then',
        target: 'math-' + (i + 1),
        targetHandle: 'execute',
      });
  }
  return { version: 1, name: 'Modular', nodes, edges };
}

test('artefatos: rejeita caminhos inseguros, colisões, dependências ausentes e ciclos', () => {
  const plan = new ArtifactPlan();
  assert.throws(() => plan.text('../outside.ts', '', 'test'), /inválido/);
  plan.text('src/File.ts', '', 'test');
  assert.throws(() => plan.text('src/file.ts', '', 'test'), /Colisão/);
  const missing = new ArtifactPlan();
  missing.text('src/a.ts', '', 'test', [], ['src/b.ts']);
  assert.throws(() => missing.validate(), /ausente/);
  const cycle = new ArtifactPlan();
  cycle.text('a.ts', '', 'test', [], ['b.ts']);
  cycle.text('b.ts', '', 'test', [], ['a.ts']);
  assert.throws(() => cycle.validate(), /circular/);
  const privateImport = new ArtifactPlan();
  privateImport.text('apps/api/secrets.ts', '', 'server');
  privateImport.text('apps/web/a.ts', '', 'client', [], ['apps/api/secrets.ts']);
  assert.throws(() => privateImport.validate(), /privada/);
  assert.throws(
    () => new ArtifactPlan().text('huge.ts', 'const x = 1;\n'.repeat(601), 'test'),
    /TOO_LARGE/,
  );
  assert.throws(() => new ArtifactPlan().text('unsafe.ts', '// @ts-nocheck', 'test'), /Tipos/);
});

test('exportação: 250 operações geram módulos limitados e uma única implementação compartilhada', () => {
  const graph = fixture(250);
  const plan = createTypeScriptPlan(graph);
  const sources = [...plan.files.values()].filter((file) => file.role === 'workflow');
  assert.ok(sources.length > 1);
  assert.ok(sources.length < 100, 'operações pequenas devem ser agrupadas');
  assert.equal(
    sources
      .map((file) => file.content)
      .join('\n')
      .match(/export async function/g)!.length,
    253,
  );
  for (const file of sources)
    assert.ok(file.content.split('\n').filter((line) => line.trim()).length <= 600, file.path);
  const shared = sources.filter((file) => file.owners?.includes('math-0'));
  assert.equal(shared.length, 1);
  assert.ok(![...plan.files.keys()].some((path) => path.startsWith('apps/api/')));
  assert.ok(![...plan.files.keys()].some((path) => /adapters\/(auth|database)/.test(path)));
});

test('exportação: nomes são estáveis com rótulos/posições diferentes, remoção retira referências', () => {
  const graph = fixture();
  const first = createTypeScriptPlan(graph);
  const moved = structuredClone(graph);
  moved.nodes.forEach((block) => {
    block.position.x += 500;
    block.data.label += ' novo';
  });
  const next = createTypeScriptPlan(moved);
  assert.deepEqual([...first.files.keys()], [...next.files.keys()]);
  for (const [path, file] of first.files)
    if (file.role === 'workflow') assert.equal(next.files.get(path)?.content, file.content);
  const removed = {
    ...graph,
    nodes: graph.nodes.filter((block) => block.id !== 'math-2'),
    edges: graph.edges.filter((edge) => edge.target !== 'math-2' && edge.source !== 'math-2'),
  };
  const final = createTypeScriptPlan(removed);
  assert.ok(![...final.files.values()].some((file) => file.owners?.includes('math-2')));
  assert.notEqual(identity('A/B'), identity('A-B'));
  assert.notEqual(identity('A'), identity('a'));
});

test('IR modular: chama o mesmo bloco e preserva resultados do interpretador', async () => {
  const graph = fixture();
  const flat = compile(graph),
    modular = compile(graph, { references: true });
  assert.ok(flat.ok && modular.ok);
  const a = await interpret(flat.value, 'start', createExecutionContext());
  const b = await interpret(modular.value, 'start', createExecutionContext());
  assert.equal(b.success, true);
  assert.deepEqual(b.outputs, a.outputs);
  assert.equal(b.screen, a.screen);
  assert.ok(JSON.stringify(modular.value).length < JSON.stringify(flat.value).length);
});
