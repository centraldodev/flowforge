import type { SubflowDefinition } from '../../engine/composition';
import { detectSubflowCycles } from '../../engine/composition';
import type { Block, Graph } from '../../engine/types';
import type { InstructionIR, ProgramIR } from '../ir';
import { lowerBlock } from '../lower';
import { executeInstructions } from './interpret';
import type { ExecutionContext, SubflowAdapter } from './types';

export class ModularSubflowAdapter implements SubflowAdapter {
  private subflows: Map<string, SubflowDefinition> = new Map();

  constructor(initialSubflows: SubflowDefinition[] = []) {
    for (const sf of initialSubflows) {
      this.subflows.set(sf.id, sf);
    }
  }

  registerSubflow(def: SubflowDefinition): void {
    this.subflows.set(def.id, def);
  }

  getSubflow(id: string): SubflowDefinition | undefined {
    return this.subflows.get(id);
  }

  async execute(
    subflowId: string,
    inputs: Record<string, unknown>,
    context: ExecutionContext,
    subflowDefinition?: SubflowDefinition,
  ): Promise<unknown> {
    if (subflowDefinition) {
      this.subflows.set(subflowDefinition.id, subflowDefinition);
    }

    const def = subflowDefinition ?? this.subflows.get(subflowId);
    if (!def) {
      throw new Error(`Subfluxo "${subflowId}" não foi encontrado no registro.`);
    }

    // 1. Prevenção e diagnóstico de ciclo estático
    const allDefs = Array.from(this.subflows.values());
    const cycleCheck = detectSubflowCycles(allDefs);
    if (cycleCheck.hasCycle) {
      const pathStr = cycleCheck.cyclePath ? cycleCheck.cyclePath.join(' -> ') : subflowId;
      throw new Error(`Ciclo recursivo detectado entre subfluxos: ${pathStr}`);
    }

    // 2. Prevenção dinâmica contra chamadas recursivas infinitas
    const stack =
      ((context as unknown as Record<string, unknown>).__subflowStack as string[]) ?? [];
    if (stack.includes(subflowId)) {
      const fullPath = [...stack, subflowId].join(' -> ');
      throw new Error(
        `Ciclo de recursão em tempo de execução detectado no subfluxo "${subflowId}" (${fullPath}).`,
      );
    }
    const nextStack = [...stack, subflowId];

    // 3. Montagem do sub-grafo e compilação das instruções internas
    const subGraph: Graph = {
      version: 1,
      name: subflowId,
      nodes: def.nodes,
      edges: def.edges,
    };

    // Identifica pontos de entrada do subfluxo
    const entryNodes = this.findEntryNodes(subGraph);
    if (entryNodes.length === 0 && subGraph.nodes.length > 0) {
      entryNodes.push(subGraph.nodes[0]);
    }

    const instructions: InstructionIR[] = [];
    const visited = new Set<string>();
    for (const entry of entryNodes) {
      instructions.push(...lowerBlock(entry, subGraph, visited));
    }

    // 4. Criação do contexto de execução filho isolado
    const initialVarValue = inputs.input ?? Object.values(inputs)[0] ?? '';
    const childContext: ExecutionContext = {
      inputs: { ...inputs },
      store: context.store, // Compartilha store de estado/banco de dados
      variables: {
        ...inputs,
        value: initialVarValue,
      },
      outputs: {},
      notifications: context.notifications,
      logs: context.logs,
      trace: context.trace,
      stepCount: context.stepCount,
      maxSteps: context.maxSteps,
      signal: context.signal,
      adapters: context.adapters,
    };
    (childContext as unknown as Record<string, unknown>).__subflowStack = nextStack;

    // 5. Execução do fluxo interno
    const dummyProgram: ProgramIR = {
      version: 1,
      name: `subflow_${subflowId}`,
      screens: [],
      steps: [],
    };

    await executeInstructions(instructions, childContext, dummyProgram);

    // Propaga contador de passos de volta para proteger o total
    context.stepCount = childContext.stepCount;

    // 6. Resolução dos valores de retorno
    let returnValue: unknown;
    if (def.returns && def.returns.length > 0) {
      for (const retPort of def.returns) {
        if (retPort.id in childContext.outputs) {
          returnValue = childContext.outputs[retPort.id];
          break;
        }
      }
    }

    if (returnValue === undefined) {
      returnValue =
        childContext.outputs['output'] ??
        childContext.outputs['result'] ??
        childContext.variables['result'] ??
        childContext.variables['return'] ??
        childContext.variables['value'];
    }

    return returnValue;
  }

  private findEntryNodes(graph: Graph): Block[] {
    const targetNodeIds = new Set(
      graph.edges
        .filter(
          (e) => e.targetHandle === 'execute' || e.targetHandle === 'listener' || !e.targetHandle,
        )
        .map((e) => e.target),
    );

    // Blocos sem dependências de controle upstream
    const roots = graph.nodes.filter((n) => !targetNodeIds.has(n.id));
    if (roots.length > 0) return roots;
    return graph.nodes;
  }
}
