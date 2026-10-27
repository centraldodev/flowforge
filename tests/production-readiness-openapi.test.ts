import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerOrdersProject,
  roleApprovalPortalProject,
  schedulingConflictProject,
} from '../src/engine/referenceProjects';
import { auditProductionReadiness } from '../src/engine/productionReadiness';
import {
  generateOpenApiSpec,
  generateSwaggerHtml,
  emitOpenApi,
} from '../src/export/modular/openapi';
import { ArtifactPlan } from '../src/export/modular/artifacts';
import { createTypeScriptPlan } from '../src/export/typescript';
import type { Graph } from '../src/engine/types';

test('Fase Final: auditProductionReadiness avalia projetos canônicos com alta prontidão (Classe A)', () => {
  const g1 = customerOrdersProject;
  const report1 = auditProductionReadiness(g1);
  assert.ok(report1.score >= 85, `Score esperado >= 85, obtido: ${report1.score}`);
  assert.equal(report1.grade, 'A');
  assert.equal(report1.status, 'ready');
  assert.ok(report1.checks.length >= 6);

  const g2 = schedulingConflictProject;
  const report2 = auditProductionReadiness(g2);
  assert.ok(report2.score >= 80);
  assert.ok(report2.checks.some((c) => c.id === 'sec-zero-secrets' && c.status === 'pass'));

  const g3 = roleApprovalPortalProject;
  const report3 = auditProductionReadiness(g3);
  assert.ok(report3.score >= 85);
  assert.ok(report3.checks.some((c) => c.id === 'sec-auth-configured' && c.status === 'pass'));
});

test('Fase Final: auditProductionReadiness detecta avisos e falhas em grafos incompletos', () => {
  const incompleteGraph: Graph = {
    version: 1,
    name: 'Projeto Incompleto',
    nodes: [
      {
        id: 's1',
        type: 'block',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Home', config: {} },
      },
    ],
    edges: [],
    // Entidades sem primary key
    entities: [
      {
        id: 'ent_prod',
        name: 'produtos',
        fields: [{ name: 'descricao', type: 'string' }],
      },
    ],
    // Sem testes
    tests: [],
  };

  const report = auditProductionReadiness(incompleteGraph);
  assert.ok(report.summary.warnings > 0 || report.summary.failures > 0);
  assert.ok(report.checks.some((c) => c.id === 'db-primary-keys' && c.status === 'fail'));
  assert.ok(report.checks.some((c) => c.id === 'test-scenarios' && c.status === 'warn'));
});

test('Fase Final: generateOpenApiSpec produz especificação OpenAPI 3.0.3 válida com esquemas e tags', () => {
  const graph = customerOrdersProject;
  const spec = generateOpenApiSpec(graph);

  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.title, graph.name);
  assert.equal(spec.info.version, '1.0.0');
  assert.ok(spec.servers.length >= 1);

  // Observabilidade e Endpoints
  assert.ok(spec.paths['/api/health']);
  assert.ok(spec.paths['/api/diagnostics']);
  assert.ok(spec.paths['/api/auth/login']);
  assert.ok(spec.paths['/api/db']);

  // Schemas gerados para entidades
  assert.ok(spec.components.schemas['clientes']);
  assert.ok(spec.components.schemas['pedidos']);

  // Swagger HTML interativo
  const html = generateSwaggerHtml(spec);
  assert.ok(html.includes('SwaggerUIBundle'));
  assert.ok(html.includes(graph.name));
});

test('Fase Final: emitOpenApi gera contratos e gateway para monorepo exportado', () => {
  const graph = customerOrdersProject;
  const plan = new ArtifactPlan();
  const ok = emitOpenApi(plan, graph);
  assert.equal(ok, true);

  const files = plan.files;
  assert.ok(files.has('packages/contracts/src/openapi.ts'));
  assert.ok(files.has('apps/api/src/openapi/spec.mjs'));
  assert.ok(files.has('apps/api/src/openapi/gateway.mjs'));

  const gatewayContent = files.get('apps/api/src/openapi/gateway.mjs')!;
  assert.ok(gatewayContent.content.includes('/api/openapi.json'));
  assert.ok(gatewayContent.content.includes('/api/docs'));
});

test('Fase Final: createTypeScriptPlan integra OpenAPI 3.0 e Swagger no monorepo completo', () => {
  const graph = customerOrdersProject;
  const plan = createTypeScriptPlan(graph);
  const files = plan.files;

  // Contratos unificados
  assert.ok(files.has('packages/contracts/src/openapi.ts'));

  // Servidor backend com rotas montadas
  assert.ok(files.has('apps/api/src/openapi/spec.mjs'));
  assert.ok(files.has('apps/api/src/openapi/gateway.mjs'));

  const appFile = files.get('apps/api/src/app.mjs')!;
  assert.ok(appFile.content.includes('/api/openapi.json'));
  assert.ok(appFile.content.includes('/api/docs'));
  assert.ok(appFile.content.includes('createOpenApiGateway'));
});
