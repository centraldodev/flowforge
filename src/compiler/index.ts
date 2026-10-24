import type { Graph } from '../engine/types';
import { analyze } from './analyze';
import { err, ok, type Diagnostic, type Result } from './diagnostics';
import type { ProgramIR } from './ir';
import { lower } from './lower';
import { normalizeGraph } from './normalize';

export * from './analyze';
export * from './backends';
export * from './backends/javascript';
export * from './backends/python';
export * from './diagnostics';
export * from './interpreter';
export * from './ir';
export * from './lower';
export * from './normalize';
export * from './ui';

/**
 * Ponto de entrada do compilador semântico FlowForge.
 *
 * Normaliza o grafo, executa análise estática de tipos, rotas e cardinalidade,
 * e gera a ProgramIR se não houver erros diagnósticos impeditivos.
 */
export function compile(graph: Graph): Result<ProgramIR, Diagnostic[]> {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return err([
      {
        code: 'INVALID_GRAPH_STRUCTURE',
        severity: 'error',
        message: 'Estrutura de grafo inválida ou ausente.',
      },
    ]);
  }

  const normalized = normalizeGraph(graph);
  const diagnostics = analyze(normalized);

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  if (hasErrors) {
    return err(diagnostics);
  }

  const program = lower(normalized);
  return ok(program, diagnostics);
}
