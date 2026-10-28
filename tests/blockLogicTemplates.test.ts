import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBlockIntentAndDiagnostics,
  BLOCK_LOGIC_TEMPLATES,
  catalog,
  generateBlockCode,
  getLogicTemplatesForKind,
  LOGIC_CATEGORIES,
  validate,
  type Kind,
} from '../src/engine';
import {
  addBlock,
  applyLogicRecommendation,
  createAndBindTargetBlock,
  createBlock,
  emptyGraph,
  updateConfig,
} from '../src/state/graphOps';

test('Funções Pré-Montadas: cobre todos os 30 tipos de blocos (Kinds) por categoria', () => {
  const allKinds = Object.keys(catalog) as Kind[];
  assert.ok(allKinds.length >= 30);

  for (const kind of allKinds) {
    const grouped = getLogicTemplatesForKind(kind, false);
    const totalForKind = LOGIC_CATEGORIES.reduce(
      (acc, cat) => acc + grouped[cat].length,
      0,
    );
    assert.ok(
      totalForKind > 0,
      `O tipo de bloco "${kind}" deve ter pelo menos uma função/lógica pré-montada compatível`,
    );
  }
});

test('Funções Pré-Montadas: propriedades escolhidas geram código e conexões automaticamente', () => {
  let g = emptyGraph('Teste Propriedades Geram Blocos e Código');
  const screen = createBlock('screen', { x: 0, y: 0 }, '', g);
  g = addBlock(g, screen);

  const fnBlock = createBlock('function', { x: 400, y: 100 }, screen.id, g);
  g = addBlock(g, fnBlock);

  const valBlock = createBlock('validator', { x: 800, y: 100 }, screen.id, g);
  g = addBlock(g, valBlock);

  const authBlock = createBlock('auth', { x: 1200, y: 100 }, screen.id, g);
  g = addBlock(g, authBlock);

  g = updateConfig(g, fnBlock.id, {
    logicTemplateId: 'fn_call_validator_and_auth',
    callValidatorId: valBlock.id,
    nextAuthOrDbId: authBlock.id,
  });

  const createdEdge = g.edges.find(
    (e) => e.source === fnBlock.id && e.target === authBlock.id,
  );
  assert.ok(createdEdge);
  assert.equal(createdEdge.sourceHandle, 'then');

  const updatedFn = g.nodes.find((n) => n.id === fnBlock.id)!;
  const generatedCode = generateBlockCode(g, updatedFn);
  assert.ok(generatedCode.includes(valBlock.id));
  assert.ok(generatedCode.includes(authBlock.id));
});

test('Funções Pré-Montadas: recomendações inteligentes criam e conectam blocos em 1 clique', () => {
  let g = emptyGraph('Teste Criação Automática');
  const screen = createBlock('screen', { x: 0, y: 0 }, '', g);
  g = addBlock(g, screen);

  const valBlock = createBlock('validator', { x: 400, y: 100 }, screen.id, g);
  g = addBlock(g, valBlock);
  g = updateConfig(g, valBlock.id, { logicTemplateId: 'val_email_rule' });

  const currentVal = g.nodes.find((n) => n.id === valBlock.id)!;
  const analysisBefore = analyzeBlockIntentAndDiagnostics(g, currentVal);
  assert.ok(analysisBefore.recommendations.length > 0);

  const authRec = analysisBefore.recommendations.find((r) => r.targetKind === 'auth');
  assert.ok(authRec);

  const { graph: nextGraph, targetBlockId } = applyLogicRecommendation(
    g,
    valBlock.id,
    authRec,
  );

  const createdAuth = nextGraph.nodes.find((n) => n.id === targetBlockId);
  assert.ok(createdAuth);
  assert.equal(createdAuth.data.kind, 'auth');

  const edge = nextGraph.edges.find(
    (e) =>
      e.source === valBlock.id &&
      e.target === targetBlockId &&
      e.sourceHandle === 'valid',
  );
  assert.ok(edge);

  const { graph: graphWithError, createdBlock: errBlock } = createAndBindTargetBlock(
    nextGraph,
    valBlock.id,
    'error',
    {
      slotKey: 'invalidTargetId',
      sourceHandle: 'invalid',
    },
  );
  assert.equal(
    graphWithError.edges.some(
      (e) =>
        e.source === valBlock.id &&
        e.target === errBlock.id &&
        e.sourceHandle === 'invalid',
    ),
    true,
  );
});

test('Funções Pré-Montadas: detecta erros e incompatibilidades de lógica e referências', () => {
  let g = emptyGraph('Teste Diagnóstico de Incompatibilidade');
  const screen = createBlock('screen', { x: 0, y: 0 }, '', g);
  g = addBlock(g, screen);

  const fnBlock = createBlock('function', { x: 400, y: 100 }, screen.id, g);
  g = addBlock(g, fnBlock);

  g = updateConfig(g, fnBlock.id, {
    logicTemplateId: 'payment_checkout_flow',
  });

  const nodeWithWrongTemplate = g.nodes.find((n) => n.id === fnBlock.id)!;
  const analysis1 = analyzeBlockIntentAndDiagnostics(g, nodeWithWrongTemplate);
  assert.equal(
    analysis1.diagnostics.some((d) => d.code === 'INCOMPATIBLE_LOGIC_TEMPLATE'),
    true,
  );

  const graphErrors = validate(g);
  assert.equal(
    graphErrors.some((err) => err.includes('não é compatível')),
    true,
  );

  g = updateConfig(g, fnBlock.id, {
    logicTemplateId: 'fn_call_validator_and_auth',
    callValidatorId: 'bloco_inexistente_999',
  });

  const nodeWithMissingRef = g.nodes.find((n) => n.id === fnBlock.id)!;
  const analysis2 = analyzeBlockIntentAndDiagnostics(g, nodeWithMissingRef);
  assert.equal(
    analysis2.diagnostics.some((d) => d.code === 'MISSING_REFERENCED_BLOCK'),
    true,
  );

  g = updateConfig(g, fnBlock.id, {
    logicTemplateId: 'fn_call_validator_and_auth',
    callValidatorId: screen.id,
  });
  const nodeWithIncompatibleTarget = g.nodes.find((n) => n.id === fnBlock.id)!;
  const analysis3 = analyzeBlockIntentAndDiagnostics(g, nodeWithIncompatibleTarget);
  assert.equal(
    analysis3.diagnostics.some((d) => d.code === 'INCOMPATIBLE_REFERENCED_BLOCK_KIND'),
    true,
  );
  assert.ok(BLOCK_LOGIC_TEMPLATES.length >= 20);
});
