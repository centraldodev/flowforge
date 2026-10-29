import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELING_STEPS,
  analyzeElementDeletionImpact,
  applyAppModelingToGraph,
  buildTraceabilityMatrix,
  computeSemanticHash,
  createOrderApprovalReferenceModeling,
  detachGeneratedArtifact,
  ensureAppModeling,
  evaluateBusinessRule,
  executeModeledOperation,
  generateAppSpecificationMarkdown,
  parseExactCents,
  validateAppModeling,
} from '../src/engine/appModeling';
import { parseGraph } from '../src/engine/parse';
import { roleApprovalPortalProject, REFERENCE_PROJECTS } from '../src/engine/referenceProjects';
import { appTemplates } from '../src/engine/appTemplates';
import { createTypeScriptPlan } from '../src/export/typescript';
import { createProject } from '../src/export';

test('Modelagem de Apps: define as 9 etapas guiadas na ordem recomendada com metadados corretos', () => {
  assert.equal(MODELING_STEPS.length, 9);
  assert.deepEqual(
    MODELING_STEPS.map((s) => s.id),
    [
      'vision',
      'domains',
      'data',
      'permissions',
      'rules',
      'lifecycle',
      'operations',
      'apis',
      'scenarios',
    ],
  );
  // Etapas 1 e 2 são descritivas (não geram blocos artificiais)
  assert.equal(MODELING_STEPS[0].generatesBlocks, false);
  assert.equal(MODELING_STEPS[1].generatesBlocks, false);
  // Etapas 3 a 9 geram artefatos executáveis ou testes
  assert.equal(MODELING_STEPS[2].generatesBlocks, true);
  assert.equal(MODELING_STEPS[4].generatesBlocks, true);
  assert.equal(MODELING_STEPS[6].generatesBlocks, true);
});

test('Modelagem de Apps: avalia valores monetários com representação exata em centavos inteiros sem erro de ponto flutuante', () => {
  assert.equal(parseExactCents(5000), 500000);
  assert.equal(parseExactCents('5.000,00'), 500000);
  assert.equal(parseExactCents('R$ 5000.01'), 500001);

  const ref = createOrderApprovalReferenceModeling();
  const rule = ref.draft.rules[0];

  const resNormal = evaluateBusinessRule(rule, { total: 5000 });
  assert.equal(resNormal.valid, true);
  assert.equal(resNormal.primaryOutcome, 'auto_approved');

  const resManager = evaluateBusinessRule(rule, { total: 5000.01 });
  assert.equal(resManager.valid, true);
  assert.equal(resManager.primaryOutcome, 'requires_manager_approval');
});

test('Modelagem de Apps: executa o cenário obrigatório de Aprovação de Pedidos por Organização (Seção 11)', () => {
  const ref = createOrderApprovalReferenceModeling();
  const spec = ref.draft;
  const idempotencyStore = new Map();

  // 1. Vendedor submete pedido de R$ 4.800 (<= R$ 5.000) -> aprovado automaticamente
  const subNormal = executeModeledOperation(
    spec,
    {
      operationId: 'op_submeter_pedido',
      actor: {
        userId: 'usr_vendedor_1',
        role: 'user',
        orgId: 'org_alfa',
        authenticated: true,
      },
      payload: { id: 'ped_1', cliente_id: 'cli_1', total: 4800 },
      idempotencyKey: 'idem_sub_1',
    },
    idempotencyStore,
  );
  assert.equal(subNormal.ok, true);
  assert.equal(subNormal.status, 201);
  assert.equal(subNormal.outcome, 'auto_approved');
  assert.equal(subNormal.record?.status, 'aprovado');

  // Reenvio com mesma chave de idempotência não duplica efeito
  const subRetry = executeModeledOperation(
    spec,
    {
      operationId: 'op_submeter_pedido',
      actor: {
        userId: 'usr_vendedor_1',
        role: 'user',
        orgId: 'org_alfa',
        authenticated: true,
      },
      payload: { id: 'ped_1', cliente_id: 'cli_1', total: 4800 },
      idempotencyKey: 'idem_sub_1',
    },
    idempotencyStore,
  );
  assert.equal(subRetry.ok, true);
  assert.equal(
    subRetry.trace.some((t) => t.includes('Idempotência')),
    true,
  );

  // 2. Vendedor submete pedido de R$ 7.500 (> R$ 5.000) -> fica Em análise
  const subAcima = executeModeledOperation(spec, {
    operationId: 'op_submeter_pedido',
    actor: {
      userId: 'usr_vendedor_1',
      role: 'user',
      orgId: 'org_alfa',
      authenticated: true,
    },
    payload: { id: 'ped_2', cliente_id: 'cli_1', total: 7500 },
  });
  assert.equal(subAcima.ok, true);
  assert.equal(subAcima.outcome, 'requires_manager_approval');
  assert.equal(subAcima.record?.status, 'em_analise');

  const pendingOrderRecord = {
    id: 'ped_2',
    vendedor_id: 'usr_vendedor_1',
    org_id: 'org_alfa',
    status: 'em_analise',
    total: 7500,
    versao: 1,
  };

  // 3. Gerente de outra organização tenta aprovar -> HTTP 403 CROSS_ORG_FORBIDDEN
  const crossOrgAttempt = executeModeledOperation(spec, {
    operationId: 'op_aprovar_pedido',
    actor: {
      userId: 'usr_gerente_beta',
      role: 'manager',
      orgId: 'org_beta',
      authenticated: true,
    },
    payload: { id: 'ped_2', versao: 1 },
    existingRecord: pendingOrderRecord,
  });
  assert.equal(crossOrgAttempt.ok, false);
  assert.equal(crossOrgAttempt.status, 403);
  assert.equal(crossOrgAttempt.error?.code, 'CROSS_ORG_FORBIDDEN');

  // 4. Próprio solicitante tenta aprovar seu pedido -> HTTP 403 SELF_APPROVAL_FORBIDDEN
  const selfApproveAttempt = executeModeledOperation(spec, {
    operationId: 'op_aprovar_pedido',
    actor: {
      userId: 'usr_vendedor_1',
      role: 'manager',
      orgId: 'org_alfa',
      authenticated: true,
    },
    payload: { id: 'ped_2', versao: 1 },
    existingRecord: pendingOrderRecord,
  });
  assert.equal(selfApproveAttempt.ok, false);
  assert.equal(selfApproveAttempt.status, 403);
  assert.equal(selfApproveAttempt.error?.code, 'SELF_APPROVAL_FORBIDDEN');

  // 5. Gerente válido da mesma organização aprova -> HTTP 200 e incrementa versão para 2
  const managerApprove = executeModeledOperation(spec, {
    operationId: 'op_aprovar_pedido',
    actor: {
      userId: 'usr_gerente_alfa',
      role: 'manager',
      orgId: 'org_alfa',
      authenticated: true,
    },
    payload: { id: 'ped_2', versao: 1 },
    existingRecord: pendingOrderRecord,
  });
  assert.equal(managerApprove.ok, true);
  assert.equal(managerApprove.status, 200);
  assert.equal(managerApprove.record?.status, 'aprovado');
  assert.equal(managerApprove.record?.versao, 2);

  // 6. Segunda tentativa concorrente com versão antiga (versao=1 contra versao=2) -> HTTP 409 CONCURRENCY_CONFLICT
  const concurrentAttempt = executeModeledOperation(spec, {
    operationId: 'op_aprovar_pedido',
    actor: {
      userId: 'usr_gerente_alfa_2',
      role: 'manager',
      orgId: 'org_alfa',
      authenticated: true,
    },
    payload: { id: 'ped_2', versao: 1 },
    existingRecord: { ...pendingOrderRecord, versao: 2 },
  });
  assert.equal(concurrentAttempt.ok, false);
  assert.equal(concurrentAttempt.status, 409);
  assert.equal(concurrentAttempt.error?.code, 'CONCURRENCY_CONFLICT');
});

test('Modelagem de Apps: gera blocos determinísticos, preserva posições e não duplica ao repetir aplicação (Seção 7)', () => {
  const baseGraph = structuredClone(roleApprovalPortalProject);
  const modeling = ensureAppModeling(baseGraph);

  // Primeira aplicação
  const firstRun = applyAppModelingToGraph(baseGraph, modeling);
  assert.equal(firstRun.summary.createdBlocks.length > 0, true);
  const nodeCountAfterFirst = firstRun.graph.nodes.length;
  const edgeCountAfterFirst = firstRun.graph.edges.length;

  // Move manualmente um bloco gerado no canvas
  const ruleBlockId = 'mod_rule_rule_alcada_valor';
  const movedGraph = {
    ...firstRun.graph,
    nodes: firstRun.graph.nodes.map((n) =>
      n.id === ruleBlockId ? { ...n, position: { x: 999, y: 888 } } : n,
    ),
  };

  // Segunda aplicação idêntica: não duplica nós nem conexões e preserva posição (999, 888)
  const secondRun = applyAppModelingToGraph(movedGraph, movedGraph.appModeling!);
  assert.equal(secondRun.graph.nodes.length, nodeCountAfterFirst);
  assert.equal(secondRun.graph.edges.length, edgeCountAfterFirst);
  assert.equal(secondRun.summary.createdBlocks.length, 0);

  const ruleNodeAfterSecond = secondRun.graph.nodes.find((n) => n.id === ruleBlockId);
  assert.deepEqual(ruleNodeAfterSecond?.position, { x: 999, y: 888 });
});

test('Modelagem de Apps: atualiza o limite da regra de R$ 5.000 para R$ 10.000 preservando IDs e sinalizando cenários afetados (Seção 11.9)', () => {
  const baseGraph = structuredClone(roleApprovalPortalProject);
  const firstRun = applyAppModelingToGraph(baseGraph, ensureAppModeling(baseGraph));
  const currentModeling = structuredClone(firstRun.graph.appModeling!);

  // Altera o limite de R$ 5.000 para R$ 10.000 no rascunho da regra RN-01
  const rule = currentModeling.draft.rules[0];
  for (const row of rule.rows) {
    if (row.condition.kind === 'comparison') {
      row.condition.rightValue = 10000;
    }
  }

  // Valida: o cenário CEN-02 (R$ 7.500 que antes exigia gerente) e o exemplo de R$ 7.500 agora são sinalizados!
  const validationAfterEdit = validateAppModeling(firstRun.graph, currentModeling);
  const rulesStep = validationAfterEdit.stepStatuses.find((s) => s.stepId === 'rules')!;
  const scenariosStep = validationAfterEdit.stepStatuses.find((s) => s.stepId === 'scenarios')!;

  assert.equal(rulesStep.consistencyStatus, 'needs_review');
  assert.equal(scenariosStep.consistencyStatus, 'needs_review');

  // Atualiza o exemplo para refletir o novo limite de R$ 10.000 e reaplica
  rule.examples[1].inputs = { total: 12000 };
  const updatedRun = applyAppModelingToGraph(firstRun.graph, currentModeling, {
    stepId: 'rules',
  });

  const ruleNode = updatedRun.graph.nodes.find((n) => n.id === 'mod_rule_rule_alcada_valor');
  assert.equal(ruleNode?.data.config.compare, '10000');
});

test('Modelagem de Apps: suporta desvincular bloco da geração e análise de impacto antes de exclusão', () => {
  const baseGraph = structuredClone(roleApprovalPortalProject);
  const applied = applyAppModelingToGraph(baseGraph, ensureAppModeling(baseGraph));

  // Desvincula o bloco da regra
  const detachedGraph = detachGeneratedArtifact(applied.graph, 'mod_rule_rule_alcada_valor');
  const artifact = detachedGraph.appModeling!.generation.artifacts.find(
    (a) => a.artifactId === 'mod_rule_rule_alcada_valor',
  );
  assert.equal(artifact?.detached, true);

  // Análise de impacto ao tentar excluir uma política referenciada por operações
  const impact = analyzeElementDeletionImpact(
    detachedGraph.appModeling!.draft,
    'policy',
    'pol_vendedor_pedidos',
  );
  assert.equal(impact.canDeleteDirectly, false);
  assert.equal(impact.dependents.length > 0, true);
});

test('Modelagem de Apps: exporta manifesto de modelagem, documentação arquitetural e rotas OpenAPI no TypeScript e bloqueia degradação silenciosa no Python', async () => {
  const baseGraph = structuredClone(roleApprovalPortalProject);
  const applied = applyAppModelingToGraph(baseGraph, ensureAppModeling(baseGraph)).graph;

  // 1. Persistência JSON e parseGraph
  const serialized = JSON.stringify(applied);
  const parsed = parseGraph(serialized);
  assert.equal((parsed.appModeling?.generation.appliedRevision || 0) > 0, true);

  // 2. Matriz de rastreabilidade e Markdown
  const matrix = buildTraceabilityMatrix(parsed.appModeling!.draft, parsed.appModeling!.generation);
  assert.equal(
    matrix.every((r) => r.isFullyCovered),
    true,
  );
  const md = generateAppSpecificationMarkdown(parsed);
  assert.equal(md.includes('REQ-01'), true);
  assert.equal(md.includes('ADR-001'), true);

  // 3. Exportação TypeScript inclui manifesto, documentação, gateway de operações e OpenAPI derivado
  const tsPlan = createTypeScriptPlan(parsed);
  assert.equal(tsPlan.files.has('flowforge/app-modeling.manifest.json'), true);
  assert.equal(tsPlan.files.has('docs/ARCHITECTURE_SPECIFICATION.md'), true);
  assert.equal(tsPlan.files.has('apps/api/src/operations/gateway.mjs'), true);

  const openApiContent = tsPlan.files.get('packages/contracts/src/openapi.ts')?.content || '';
  assert.equal(openApiContent.includes('/api/operations/submeter-pedido'), true);
  assert.equal(openApiContent.includes('/api/operations/aprovar-pedido'), true);

  // 4. Exportação Python gera diagnóstico impeditivo explícito sem degradação silenciosa (Seção 8)
  await assert.rejects(() => createProject(parsed, 'python'), /TypeScript \+ React/);

  // Hash semântico ignora coordenadas visuais
  assert.equal(
    computeSemanticHash({ a: 1, x: 10, y: 20 }),
    computeSemanticHash({ a: 1, x: 500, y: 900 }),
  );
});

test('Modelagem de Apps: todos os templates e projetos de referência possuem modelagem completa e válida', () => {
  const allProjects = {
    ...appTemplates,
    ...REFERENCE_PROJECTS,
  };

  for (const [key, graph] of Object.entries(allProjects)) {
    const modeling = ensureAppModeling(graph);
    assert.ok(modeling, `Projeto ${key} deve possuir appModeling`);
    assert.ok(
      modeling.draft.vision.problemStatement,
      `Projeto ${key} deve ter declaração de problema`,
    );
    assert.ok(modeling.draft.vision.requirements.length > 0, `Projeto ${key} deve ter requisitos`);
    assert.ok(modeling.draft.domains.length > 0, `Projeto ${key} deve ter domínios`);
    assert.ok(modeling.draft.actors.length > 0, `Projeto ${key} deve ter atores`);
    assert.ok(modeling.draft.useCases.length > 0, `Projeto ${key} deve ter casos de uso`);
    assert.ok(modeling.draft.policies.length > 0, `Projeto ${key} deve ter políticas`);
    assert.ok(modeling.draft.rules.length > 0, `Projeto ${key} deve ter regras`);
    assert.ok(modeling.draft.operations.length > 0, `Projeto ${key} deve ter operações`);
    assert.ok(modeling.draft.apiContracts.length > 0, `Projeto ${key} deve ter contratos de API`);
    assert.ok(modeling.draft.scenarios.length > 0, `Projeto ${key} deve ter cenários de teste`);
    assert.ok(
      modeling.draft.adrs.length > 0,
      `Projeto ${key} deve ter registros de decisões (ADRs)`,
    );
    assert.ok(
      modeling.draft.qualityTargets.length > 0,
      `Projeto ${key} deve ter metas de qualidade`,
    );

    const validation = validateAppModeling(graph, modeling);
    assert.deepEqual(
      validation.issues,
      [],
      `Projeto ${key} não deve conter pendências de modelagem: ${JSON.stringify(validation.issues)}`,
    );
    assert.equal(
      validation.isModelingReady,
      true,
      `Projeto ${key} deve estar pronto para aplicação`,
    );
  }
});
