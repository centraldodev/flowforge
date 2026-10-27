import type { ArtifactPlan } from './artifacts';
import type { Graph } from '../../engine/types';
import { generateScenarioTestsCode } from '../../engine/testScenarios';

/**
 * Emite cenários de teste automatizados para o monorepo exportado (Fase 13).
 */
export function emitTests(plan: ArtifactPlan, graph: Graph): void {
  const scenarios = graph.tests || [];
  if (scenarios.length === 0) return;

  // 1. Contratos tipados dos cenários
  plan.text(
    'packages/contracts/src/testScenarios.ts',
    `export const PROJECT_TEST_SCENARIOS = ${JSON.stringify(scenarios, null, 2)};\n`,
    'contracts',
  );

  // 2. Arquivo de execução automatizada de testes
  plan.text(
    'tests/scenarios.test.mjs',
    generateScenarioTestsCode(scenarios, graph.name),
    'test-scenarios',
  );
}
