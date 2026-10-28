import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalCatalogRepository } from '../src/engine/catalogo/repository';
import { localLogicCatalog, logicDefinition } from '../src/engine/catalogo/logicCatalog';
import { configFields } from '../src/features/inspector/blockFields';
import { createTypeScriptPlan } from '../src/export/typescript';
import { compile } from '../src/compiler';
import { lowerBlock } from '../src/compiler/lower';
import type { Graph } from '../src/engine/types';

test('repositório local persiste publicações imutáveis e mantém auditoria', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const repository = new LocalCatalogRepository(storage);
  const def = { ...logicDefinition('validator'), version: 2 };
  const result = repository.publish(def, 'editor');
  result.definition.options[0].label = 'alterado';
  const reopened = new LocalCatalogRepository(storage);
  assert.equal(
    reopened.getPublished('validator', 2)?.definition.options[0].label,
    def.options[0].label,
  );
  assert.equal(reopened.audit()[0].actor, 'editor');
  assert.throws(() => reopened.publish(def, 'editor'), /imutável/);
  assert.throws(
    () =>
      reopened.publish(
        { ...def, version: 3, options: [{ value: 'x', label: 'x', operation: 'eval' }] },
        'editor',
      ),
    /não suportada/,
  );
  assert.equal(reopened.listPublished().length, 1);
});

test('bloco fixa versão publicada no painel, compilação e exportação', () => {
  const version = 72;
  const definition = logicDefinition('validator');
  definition.version = version;
  definition.options.push({
    value: 'enderecoEletronico',
    label: 'Endereço eletrônico',
    operation: 'validate_email',
  });
  localLogicCatalog.publish(definition, 'teste');
  const graph: Graph = {
    version: 1,
    name: 'Versão fixa',
    nodes: [
      {
        id: 'tela',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: { title: 'Tela' } },
      },
      {
        id: 'validador',
        position: { x: 0, y: 0 },
        data: {
          kind: 'validator',
          label: 'Validador',
          config: { catalogVersion: String(version), rule: 'enderecoEletronico' },
        },
      },
    ],
    edges: [],
  };
  const fields = configFields(graph, graph.nodes[1], () => {});
  assert.ok(
    fields
      .find((field) => field.id === 'rule')
      ?.options?.some((option) => option.value === 'enderecoEletronico'),
  );
  assert.equal(compile(graph).ok, true);
  const instruction = lowerBlock(graph.nodes[1], graph)[0];
  assert.equal(instruction.kind, 'conditional');
  if (instruction.kind !== 'conditional' || instruction.condition.kind !== 'call_operation')
    throw new Error('Condição esperada');
  assert.equal(instruction.condition.operation, 'validate_email');
  const snapshot = JSON.parse(
    createTypeScriptPlan(graph).files.get('flowforge/catalog/logic-definitions.json')!.content,
  );
  assert.equal(snapshot.definitions[0].version, version);
  graph.nodes[1].data.config.catalogVersion = '99999';
  const failure = compile(graph);
  assert.equal(failure.ok, false);
  assert.ok(
    failure.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_CATALOG_VERSION'),
  );
});
