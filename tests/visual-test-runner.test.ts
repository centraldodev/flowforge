import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerOrdersProject,
  roleApprovalPortalProject,
  runAllScenarios,
  runScenario,
  schedulingConflictProject,
  type TestScenario,
} from '../src/engine';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 13: deve executar cenário de teste com sucesso e validar múltiplas asserções', async () => {
  const scenario: TestScenario = {
    id: 'test_client_validation',
    name: 'Validação e Notificação de Cliente',
    initialScreen: 'screen_clientes',
    entryBlockId: 'btn_salvar_cliente',
    initialInputs: {
      nome: 'Empresa Teste S/A',
      cep: '01001000',
    },
    assertions: [
      {
        id: 'a1',
        kind: 'trace_contains',
        target: 'database',
        expectedValue: 'database',
        message: 'Deve passar pelo bloco de persistência no banco',
      },
      {
        id: 'a2',
        kind: 'notification_emitted',
        expectedValue: 'Cliente cadastrado com sucesso!',
        message: 'Deve emitir notificação de sucesso',
      },
    ],
  };

  const result = await runScenario(scenario, customerOrdersProject);
  assert.equal(result.passed, true);
  assert.equal(result.assertions.length, 2);
  assert.equal(
    result.assertions.every((a) => a.passed),
    true,
  );
  assert.ok(result.durationMs >= 0);
});

test('Fase 13: deve detectar falha de asserção e registrar esperado vs obtido', async () => {
  const failingScenario: TestScenario = {
    id: 'test_failing_screen',
    name: 'Cenário com Falha Intencional',
    entryBlockId: 'btn_login',
    initialInputs: {
      email: 'admin@empresa.com',
      senha: '123',
    },
    assertions: [
      {
        id: 'a_fail',
        kind: 'screen_equals',
        expectedValue: 'tela_que_nao_existe',
        message: 'Deveria navegar para tela inexistente',
      },
    ],
  };

  const result = await runScenario(failingScenario, customerOrdersProject);
  assert.equal(result.passed, false);
  assert.equal(result.assertions[0].passed, false);
  assert.equal(result.assertions[0].expected, 'tela_que_nao_existe');
  assert.notEqual(result.assertions[0].actual, 'tela_que_nao_existe');
});

test('Fase 13: deve executar suite completa nos 3 Apps Canônicos de Referência', async () => {
  // 1. Customer Orders
  const resOrders = await runAllScenarios(customerOrdersProject);
  assert.ok(resOrders.total >= 2);
  assert.equal(resOrders.failed, 0);
  assert.equal(resOrders.passed, resOrders.total);

  // 2. Scheduling Conflict
  const resSched = await runAllScenarios(schedulingConflictProject);
  assert.ok(resSched.total >= 1);
  assert.equal(resSched.failed, 0);
  assert.equal(resSched.passed, resSched.total);

  // 3. Role Approval Portal
  const resRole = await runAllScenarios(roleApprovalPortalProject);
  assert.ok(resRole.total >= 1);
  assert.equal(resRole.failed, 0);
  assert.equal(resRole.passed, resRole.total);
});

test('Fase 13: exportação modular deve emitir contratos e testes automatizados no monorepo', () => {
  const plan = createTypeScriptPlan(customerOrdersProject);

  // Deve emitir arquivo de testes executável
  assert.ok(plan.files.has('tests/scenarios.test.mjs'));
  const testFile = plan.files.get('tests/scenarios.test.mjs')!;
  assert.ok(testFile.content.includes('Suíte E2E do Projeto'));
  assert.ok(testFile.content.includes('Login com Credenciais Válidas'));

  // Deve emitir contratos tipados
  assert.ok(plan.files.has('packages/contracts/src/testScenarios.ts'));
  const contractsFile = plan.files.get('packages/contracts/src/testScenarios.ts')!;
  assert.ok(contractsFile.content.includes('PROJECT_TEST_SCENARIOS'));
});
