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
    const plan = createTypeScriptPlan(graph);
    assert.ok(plan.files.has('apps/api/src/auth/store.mjs'));
    assert.ok(plan.files.has('apps/api/src/database/gateway.mjs'));
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
