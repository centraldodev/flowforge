import test from 'node:test';
import assert from 'node:assert/strict';
import {
  logicDefinition,
  logicOperation,
  validateLogicCatalog,
} from '../src/engine/catalogo/logicCatalog';
import { fieldsFor } from '../src/engine/blockFields';
import { createTypeScriptPlan } from '../src/export/typescript';
import { compile } from '../src/compiler';
import { catalog } from '../src/engine/catalog';
import type { Block, Graph, Kind } from '../src/engine/types';

const node = (id: string, kind: Kind, config: Record<string, string> = {}): Block => ({
  id,
  position: { x: 0, y: 0 },
  data: { kind, label: id, config: { ...catalog[kind].defaults, ...config } },
});
const source = () => ({
  schemaVersion: 1,
  definitions: [logicDefinition('condition'), logicDefinition('validator')],
});

test('painel e compilador usam opções do mesmo catálogo e não compartilham objetos mutáveis', () => {
  const options = fieldsFor('validator').find((field) => field.key === 'rule')?.options;
  assert.deepEqual(
    options,
    logicDefinition('validator').options.map(({ value, label }) => ({ value, label })),
  );
  const copy = logicDefinition('validator');
  copy.options[0].operation = 'injetado';
  assert.equal(logicOperation('validator', 'required'), 'validate_required');
});

test('catálogo aceita opções declarativas para operações conhecidas e rejeita código desconhecido', () => {
  const candidate = source();
  candidate.definitions[1].options.push({
    value: 'emailCorporativo',
    label: 'E-mail',
    operation: 'validate_email',
  });
  assert.equal(validateLogicCatalog(candidate)[1].options.at(-1)?.operation, 'validate_email');
  candidate.definitions[1].options.at(-1)!.operation = 'eval';
  assert.throws(() => validateLogicCatalog(candidate), /não suportada/);
  assert.throws(() => validateLogicCatalog({ ...source(), schemaVersion: 9 }), /versão/);
});

test('compilação rejeita opção desconhecida e exportação inclui cópia versionada', () => {
  const graph: Graph = {
    version: 1,
    name: 'Catálogo',
    nodes: [node('screen', 'screen'), node('validar', 'validator', { rule: 'email' })],
    edges: [],
  };
  const plan = createTypeScriptPlan(graph);
  const snapshot = JSON.parse(plan.files.get('flowforge/catalog/logic-definitions.json')!.content);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.definitions[0].id, 'validator');
  assert.equal(snapshot.definitions[0].version, 1);
  graph.nodes[1].data.config.rule = 'eval';
  const result = compile(graph);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'INVALID_BLOCK_OPTION'));
});
