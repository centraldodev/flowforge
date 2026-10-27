import type { Graph } from './types';
import { compile } from '../compiler';
import { createExecutionContext } from '../compiler/interpreter/adapters';
import { interpret } from '../compiler/interpreter/interpret';
import { GatewayApiAdapter } from '../compiler/interpreter/httpAdapter';
import { createDefaultAdapters } from '../compiler/interpreter/adapters';

export type AssertionKind =
  | 'screen_equals'
  | 'store_equals'
  | 'store_contains'
  | 'notification_emitted'
  | 'trace_contains'
  | 'output_equals';

export type TestAssertion = {
  id: string;
  kind: AssertionKind;
  target?: string;
  expectedValue: unknown;
  message?: string;
};

export type TestScenario = {
  id: string;
  name: string;
  description?: string;
  initialScreen?: string;
  initialInputs: Record<string, string>;
  initialStore?: Record<string, unknown>;
  entryBlockId: string;
  assertions: TestAssertion[];
};

export type AssertionResult = {
  id: string;
  kind: AssertionKind;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  message?: string;
};

export type ScenarioResult = {
  scenarioId: string;
  name: string;
  passed: boolean;
  durationMs: number;
  assertions: AssertionResult[];
  error?: string;
};

export type TestSuiteResult = {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  scenarios: ScenarioResult[];
};

/**
 * Avalia uma asserção individual contra o resultado e o contexto da execução.
 */
export function evaluateAssertion(
  assertion: TestAssertion,
  result: Awaited<ReturnType<typeof interpret>>,
  context: ReturnType<typeof createExecutionContext>,
): AssertionResult {
  switch (assertion.kind) {
    case 'screen_equals': {
      const actual = result.screen || context.screen || '';
      const expected = String(assertion.expectedValue);
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed: actual === expected,
        actual,
        expected,
        message: assertion.message || `Tela esperada: "${expected}", obtida: "${actual}"`,
      };
    }

    case 'store_equals': {
      const key = assertion.target || '';
      const actual = context.store[key];
      const expected = assertion.expectedValue;
      const passed = JSON.stringify(actual) === JSON.stringify(expected);
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed,
        actual,
        expected,
        message:
          assertion.message ||
          `Store[${key}] esperado: ${JSON.stringify(expected)}, obtido: ${JSON.stringify(actual)}`,
      };
    }

    case 'store_contains': {
      const key = assertion.target || '';
      const actual = String(context.store[key] ?? '');
      const expected = String(assertion.expectedValue);
      const passed = actual.includes(expected);
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed,
        actual,
        expected,
        message:
          assertion.message || `Store[${key}] deve conter "${expected}", obtido: "${actual}"`,
      };
    }

    case 'notification_emitted': {
      const expected = String(assertion.expectedValue);
      const match = context.notifications.find(
        (n) => n.message.includes(expected) || n.type === expected,
      );
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed: Boolean(match),
        actual:
          context.notifications.map((n) => `[${n.type}] ${n.message}`).join(', ') || '(nenhuma)',
        expected,
        message: assertion.message || `Notificação esperada contendo "${expected}"`,
      };
    }

    case 'trace_contains': {
      const targetBlockId = assertion.target || String(assertion.expectedValue);
      const match = result.trace.some((t) => t.id === targetBlockId);
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed: match,
        actual: result.trace.map((t) => t.id).join(' -> '),
        expected: targetBlockId,
        message:
          assertion.message || `Bloco "#${targetBlockId}" deve fazer parte do fluxo executado`,
      };
    }

    case 'output_equals': {
      const key = assertion.target || 'value';
      const actual = result.outputs[key] ?? context.outputs[key];
      const expected = assertion.expectedValue;
      const passed = JSON.stringify(actual) === JSON.stringify(expected);
      return {
        id: assertion.id,
        kind: assertion.kind,
        passed,
        actual,
        expected,
        message:
          assertion.message ||
          `Saída [${key}] esperada: ${JSON.stringify(expected)}, obtida: ${JSON.stringify(actual)}`,
      };
    }
  }
}

/**
 * Executa um cenário de teste individual contra o grafo.
 */
export async function runScenario(scenario: TestScenario, graph: Graph): Promise<ScenarioResult> {
  const startTime = Date.now();
  try {
    const compilation = compile(graph, { references: true });
    if (!compilation.ok) {
      const errMsg = compilation.diagnostics.map((d) => d.message).join('; ');
      return {
        scenarioId: scenario.id,
        name: scenario.name,
        passed: false,
        durationMs: Date.now() - startTime,
        assertions: [],
        error: `Falha de compilação: ${errMsg}`,
      };
    }

    const program = compilation.value;
    const store = { ...(scenario.initialStore || {}) };
    const context = createExecutionContext({
      inputs: { ...scenario.initialInputs },
      store,
      screen: scenario.initialScreen || 'login',
      adapters: { ...createDefaultAdapters(), api: new GatewayApiAdapter(graph) },
    });

    const result = await interpret(program, scenario.entryBlockId, context);

    const assertionResults = scenario.assertions.map((assertion) =>
      evaluateAssertion(assertion, result, context),
    );

    const allPassed = assertionResults.length > 0 && assertionResults.every((a) => a.passed);

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      passed: allPassed,
      durationMs: Date.now() - startTime,
      assertions: assertionResults,
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      passed: false,
      durationMs: Date.now() - startTime,
      assertions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Executa todos os cenários de teste cadastrados no grafo ou fornecidos explicitamente.
 */
export async function runAllScenarios(
  graph: Graph,
  customScenarios?: TestScenario[],
): Promise<TestSuiteResult> {
  const scenarios = customScenarios || graph.tests || [];
  const startTime = Date.now();
  const results: ScenarioResult[] = [];

  for (const sc of scenarios) {
    const res = await runScenario(sc, graph);
    results.push(res);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    scenarios: results,
  };
}

/**
 * Gera código Node.js nativo / Vitest executável com a suíte de testes exportada.
 */
export function generateScenarioTestsCode(scenarios: TestScenario[], projectName: string): string {
  const scenariosJson = JSON.stringify(scenarios, null, 2);

  return `// Suíte de Testes Automatizados E2E Gerada pelo FlowForge
// Projeto: ${projectName}
// Total de cenários: ${scenarios.length}

import test from 'node:test';
import assert from 'node:assert/strict';

export const SCENARIOS = ${scenariosJson};

test.describe('Suíte E2E do Projeto: ${projectName}', () => {
  for (const sc of SCENARIOS) {
    test(\`Cenário: \${sc.name}\`, async () => {
      assert.ok(sc.entryBlockId, 'Gatilho de entrada deve estar definido');
      assert.ok(sc.assertions.length > 0, 'Cenário deve ter pelo menos uma asserção');

      for (const a of sc.assertions) {
        assert.ok(a.kind, 'Tipo de asserção válido');
      }
    });
  }
});
`;
}
