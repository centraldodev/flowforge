import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerOrdersProject,
  schedulingConflictProject,
  roleApprovalPortalProject,
  analyzeEnvironment,
} from '../src/engine';
import { emptyGraph, screensOf } from '../src/state/graphOps';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 9: Instanciação dos 3 Templates Canônicos e Projeto Vazio', () => {
  // 1. Template Vazio
  const empty = emptyGraph('App Vazio');
  assert.equal(empty.name, 'App Vazio');
  assert.equal(screensOf(empty).length, 0);

  // 2. Template Customer Orders
  const orders = {
    ...structuredClone(customerOrdersProject),
    name: 'Loja Virtual Teste',
  };
  assert.equal(orders.name, 'Loja Virtual Teste');
  assert.ok(orders.nodes.length >= 10);
  assert.ok(orders.nodes.some((n) => n.data.kind === 'postgresConnection'));
  assert.ok(orders.nodes.some((n) => n.data.kind === 'auth'));
  assert.ok(orders.nodes.some((n) => n.data.kind === 'api'));

  // 3. Template Scheduling Conflict
  const sched = {
    ...structuredClone(schedulingConflictProject),
    name: 'Clínica de Consultas',
  };
  assert.equal(sched.name, 'Clínica de Consultas');
  assert.ok(sched.nodes.some((n) => n.data.kind === 'validator'));

  // 4. Template Role Approval
  const approval = {
    ...structuredClone(roleApprovalPortalProject),
    name: 'Portal Financeiro',
  };
  assert.equal(approval.name, 'Portal Financeiro');
  assert.ok(approval.nodes.some((n) => n.data.kind === 'auth'));
});

test('Fase 9: Diagnóstico de Ambiente dos Templates Canônicos', () => {
  const report = analyzeEnvironment(customerOrdersProject);
  assert.equal(report.featuresDetected.hasDatabase, true);
  assert.equal(report.featuresDetected.hasAuth, true);
  assert.ok(report.requiredVariables.some((v) => v.name === 'FLOWFORGE_SECRET_DATABASE_URL'));
  assert.ok(!report.requiredVariables.some((v) => v.name === 'FLOWFORGE_SECRET_JWT_SECRET'));
});

test('Fase 9: Exportação Modular dos Templates contém docker-compose e check-env', () => {
  const plan = createTypeScriptPlan(customerOrdersProject);
  assert.ok(plan.files.has('docker-compose.yml'));
  assert.ok(plan.files.has('Dockerfile'));
  assert.ok(plan.files.has('scripts/check-env.mjs'));

  const dockerCompose = plan.files.get('docker-compose.yml');
  assert.ok(dockerCompose);
  assert.ok(dockerCompose.content.includes('postgres:16-alpine'));
  assert.ok(dockerCompose.content.includes('POSTGRES_DB'));

  const checkEnv = plan.files.get('scripts/check-env.mjs');
  assert.ok(checkEnv);
  assert.ok(checkEnv.content.includes('FLOWFORGE_SECRET_DATABASE_URL'));
});
