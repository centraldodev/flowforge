import test from 'node:test';
import assert from 'node:assert/strict';
import { appTemplates } from '../src/engine/appTemplates';
import { compile } from '../src/compiler';
import { createTypeScriptPlan } from '../src/export/typescript';
import { lowerBlock } from '../src/compiler/lower';

for (const [name, graph] of Object.entries(appTemplates)) {
  test(`modelo ${name} compila e exporta blocos reais conectados`, () => {
    const compiled = compile(graph);
    assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
    assert.ok(graph.edges.length > 20);
    assert.ok(
      graph.nodes
        .filter((node) => node.data.kind === 'auth')
        .every((node) => node.data.config.execution === 'real'),
    );
    assert.ok(
      graph.nodes
        .filter((node) => node.data.kind === 'database')
        .every((node) => node.data.config.mode === 'real'),
    );
    assert.ok(
      graph.nodes.some((node) => node.data.kind === 'form'),
      'Deve conter bloco de formulário completo',
    );
    assert.ok(
      graph.nodes.some((node) => node.data.kind === 'loop'),
      'Deve conter bloco de repetição / loop',
    );
    assert.ok(
      graph.nodes
        .filter((node) => node.data.kind === 'button')
        .every(
          (node) =>
            Boolean(node.data.config.buttonText) &&
            Boolean(node.data.config.variant) &&
            Boolean(node.data.config.logicTemplateId),
        ),
      'Botões devem usar as novas propriedades (buttonText, variant, logicTemplateId)',
    );
    assert.ok(
      graph.nodes
        .filter((node) => node.data.kind === 'input')
        .every(
          (node) =>
            Boolean(node.data.config.required) &&
            Boolean(node.data.config.mask) &&
            Boolean(node.data.config.logicTemplateId),
        ),
      'Inputs devem usar as novas propriedades (required, mask, logicTemplateId)',
    );
    assert.ok(
      graph.dataModel &&
        graph.dataModel.entities.length >= 3 &&
        graph.dataModel.relationships.length >= 2,
      'Modelo deve incluir Modelagem de Dados Conceitual e Lógica completa de exemplo',
    );
    const plan = createTypeScriptPlan(graph);
    assert.ok(plan.files.has('apps/api/src/auth/store.mjs'));
    assert.ok(plan.files.has('apps/api/src/database/gateway.mjs'));
    assert.ok(plan.files.has('apps/api/src/database/schema/schema.postgres.sql'));
    assert.ok(plan.files.has('apps/api/src/database/schema/schema.sqlite.sql'));
    const object = graph.nodes.find((node) => node.id === 'montar_registro')!;
    const instruction = lowerBlock(object, graph)[0];
    assert.equal(instruction.kind, 'call_operation');
    if (instruction.kind !== 'call_operation') throw new Error('Montagem não compilada');
    assert.equal(instruction.operation, 'object_from_fields');
    assert.ok(
      instruction.args.some(
        (expr) => expr.kind === 'read_input' && expr.inputId === 'registro_titulo',
      ),
    );
    const deletion = graph.nodes.find((node) => node.id === 'db_delete')!;
    const deletionFlow = lowerBlock(deletion, graph)[0];
    assert.equal(deletionFlow.kind, 'try_catch');
    if (deletionFlow.kind !== 'try_catch') throw new Error('Tratamento de erro ausente');
    const call = deletionFlow.body.find((item) => item.kind === 'adapter_call');
    assert.ok(call && call.kind === 'adapter_call');
    assert.deepEqual(call.payload.data, {
      kind: 'literal',
      value: {},
      valueType: { kind: 'object' },
    });
  });
}
