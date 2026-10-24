import type { Block, Graph } from '../engine/types';
import type { ExprIR, InstructionIR, ProgramIR, ScreenIR, StepIR } from './ir';

/** Converte valores literais seguros em expressões IR */
function toLiteralExpr(val: unknown): ExprIR {
  if (typeof val === 'number') {
    return { kind: 'literal', value: val, valueType: { kind: 'number' } };
  }
  if (typeof val === 'boolean') {
    return { kind: 'literal', value: val, valueType: { kind: 'boolean' } };
  }
  if (val === null) {
    return { kind: 'literal', value: null, valueType: { kind: 'null' } };
  }
  return { kind: 'literal', value: String(val ?? ''), valueType: { kind: 'string' } };
}

/** Localiza blocos destino conectados por arestas de controle a partir de uma porta */
function findTargetBlocks(graph: Graph, sourceId: string, sourceHandle?: string | null): Block[] {
  const matchingEdges = graph.edges.filter(
    (e) =>
      e.source === sourceId &&
      (!sourceHandle || e.sourceHandle === sourceHandle || !e.sourceHandle),
  );
  const targets: Block[] = [];
  for (const edge of matchingEdges) {
    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (targetNode) targets.push(targetNode);
  }
  return targets;
}

/** Localiza e resolve a expressão de entrada a partir de conexões de dados ou fallback */
function resolveInputExpr(graph: Graph, blockId: string, handle: string, fallback: ExprIR): ExprIR {
  const edge = graph.edges.find((e) => e.target === blockId && e.targetHandle === handle);
  if (!edge) return fallback;
  const sourceNode = graph.nodes.find((n) => n.id === edge.source);
  if (!sourceNode) return fallback;
  if (sourceNode.data.kind === 'input') {
    return { kind: 'read_input', inputId: sourceNode.id, valueType: { kind: 'string' } };
  }
  return { kind: 'read_var', name: sourceNode.id, valueType: { kind: 'any' } };
}

/** Converte um bloco individual em suas instruções semânticas equivalentes com prevenção de ciclos */
export function lowerBlock(
  block: Block,
  graph: Graph,
  visited: Set<string> = new Set<string>(),
): InstructionIR[] {
  if (visited.has(block.id)) {
    return [{ kind: 'call_operation', operation: block.id, args: [] }];
  }
  const nextVisited = new Set(visited);
  nextVisited.add(block.id);

  const { kind, config } = block.data;
  const instructions: InstructionIR[] = [];

  switch (kind) {
    case 'screen': {
      instructions.push({ kind: 'navigate', targetScreenId: block.id });
      break;
    }

    case 'button': {
      const targets = findTargetBlocks(graph, block.id, 'onClick');
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'input': {
      instructions.push({
        kind: 'assign_state',
        key: config.field || block.id,
        value: {
          kind: 'read_input',
          inputId: block.id,
          valueType: { kind: 'string' },
        },
      });
      break;
    }

    case 'function': {
      const thenTargets = findTargetBlocks(graph, block.id, 'then');
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'call_operation',
        operation: block.id,
        args: [
          {
            kind: 'read_var',
            name: 'value',
            valueType: { kind: 'any' },
          },
        ],
        targetVar: 'result',
      };

      const downstream: InstructionIR[] = [callInst];
      for (const t of thenTargets) {
        downstream.push(...lowerBlock(t, graph, nextVisited));
      }

      if (errorTargets.length > 0) {
        const errorDownstream: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorDownstream.push(...lowerBlock(t, graph, nextVisited));
        }
        instructions.push({
          kind: 'try_catch',
          body: downstream,
          catchVar: 'error',
          catchBranch: errorDownstream,
        });
      } else {
        instructions.push(...downstream);
      }
      break;
    }

    case 'condition': {
      const trueTargets = findTargetBlocks(graph, block.id, 'true');
      const falseTargets = findTargetBlocks(graph, block.id, 'false');

      let condExpr: ExprIR;
      const op = config.operator || (config.compare ? 'equals' : 'truthy');
      if (op === 'gt') {
        condExpr = {
          kind: 'binary_op',
          op: 'gt',
          left: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
          right: toLiteralExpr(Number(config.compare ?? config.value ?? 0)),
          valueType: { kind: 'boolean' },
        };
      } else if (op === 'equals') {
        condExpr = {
          kind: 'binary_op',
          op: 'eq',
          left: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
          right: toLiteralExpr(config.compare ?? config.value ?? config.target ?? ''),
          valueType: { kind: 'boolean' },
        };
      } else {
        condExpr = {
          kind: 'binary_op',
          op: 'neq',
          left: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
          right: { kind: 'literal', value: '', valueType: { kind: 'string' } },
          valueType: { kind: 'boolean' },
        };
      }

      const trueBranch: InstructionIR[] = [];
      for (const t of trueTargets) {
        trueBranch.push(...lowerBlock(t, graph, nextVisited));
      }

      const falseBranch: InstructionIR[] = [];
      for (const t of falseTargets) {
        falseBranch.push(...lowerBlock(t, graph, nextVisited));
      }

      instructions.push({
        kind: 'conditional',
        condition: condExpr,
        thenBranch: trueBranch,
        elseBranch: falseBranch.length > 0 ? falseBranch : undefined,
      });
      break;
    }

    case 'validator': {
      const validTargets = findTargetBlocks(graph, block.id, 'valid');
      const invalidTargets = findTargetBlocks(graph, block.id, 'invalid');

      const validBranch: InstructionIR[] = [];
      for (const t of validTargets) {
        validBranch.push(...lowerBlock(t, graph, nextVisited));
      }

      const invalidBranch: InstructionIR[] = [];
      for (const t of invalidTargets) {
        invalidBranch.push(...lowerBlock(t, graph, nextVisited));
      }

      instructions.push({
        kind: 'conditional',
        condition: {
          kind: 'call_operation',
          operation: `validate_${config.rule || 'required'}`,
          args: [
            { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
            toLiteralExpr(config.param || ''),
          ],
          valueType: { kind: 'boolean' },
        },
        thenBranch: validBranch,
        elseBranch: invalidBranch.length > 0 ? invalidBranch : undefined,
      });
      break;
    }

    case 'switch': {
      const case1Targets = findTargetBlocks(graph, block.id, 'case1');
      const case2Targets = findTargetBlocks(graph, block.id, 'case2');
      const case3Targets = findTargetBlocks(graph, block.id, 'case3');
      const defTargets = findTargetBlocks(graph, block.id, 'default');

      const cases: { value: string; branch: InstructionIR[] }[] = [];
      if (case1Targets.length > 0 && config.case1) {
        cases.push({
          value: config.case1,
          branch: case1Targets.flatMap((t) => lowerBlock(t, graph, nextVisited)),
        });
      }
      if (case2Targets.length > 0 && config.case2) {
        cases.push({
          value: config.case2,
          branch: case2Targets.flatMap((t) => lowerBlock(t, graph, nextVisited)),
        });
      }
      if (case3Targets.length > 0 && config.case3) {
        cases.push({
          value: config.case3,
          branch: case3Targets.flatMap((t) => lowerBlock(t, graph, nextVisited)),
        });
      }

      instructions.push({
        kind: 'switch',
        expr: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
        cases,
        defaultBranch:
          defTargets.length > 0
            ? defTargets.flatMap((t) => lowerBlock(t, graph, nextVisited))
            : undefined,
      });
      break;
    }

    case 'delay': {
      const nextTargets = findTargetBlocks(graph, block.id, 'next');
      const durationMs = parseInt(config.duration || '1000', 10);
      instructions.push({ kind: 'delay', durationMs });
      for (const t of nextTargets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'auth': {
      const successTargets = findTargetBlocks(graph, block.id, 'onSuccess');
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'auth',
        action: config.mode || 'login',
        payload: {
          email: toLiteralExpr(config.email || ''),
          password: toLiteralExpr(config.password || ''),
          token: toLiteralExpr(config.token || ''),
        },
        targetVar: 'user',
      };

      const successFlow: InstructionIR[] = [callInst];
      for (const t of successTargets) {
        successFlow.push(...lowerBlock(t, graph, nextVisited));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...lowerBlock(t, graph, nextVisited));
        }
        instructions.push({
          kind: 'try_catch',
          body: successFlow,
          catchVar: 'error',
          catchBranch: errorFlow,
        });
      } else {
        instructions.push(...successFlow);
      }
      break;
    }

    case 'database': {
      const successTargets = findTargetBlocks(graph, block.id, 'onSuccess');
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');
      const thenTargets = findTargetBlocks(graph, block.id, 'then');
      const nextTargets = findTargetBlocks(graph, block.id, 'next');
      const allSuccessTargets = [...successTargets, ...thenTargets, ...nextTargets];

      const operation = config.operation || 'query';
      const table = config.table || 'itens';

      const payload: Record<string, ExprIR> = {
        table: toLiteralExpr(table),
        operation: toLiteralExpr(operation),
      };

      if (config.mock) {
        payload.mock = toLiteralExpr(config.mock);
      }

      const dataFallback: ExprIR = config.data
        ? toLiteralExpr(config.data)
        : { kind: 'read_var', name: 'value', valueType: { kind: 'any' } };
      payload.data = resolveInputExpr(
        graph,
        block.id,
        'data',
        resolveInputExpr(
          graph,
          block.id,
          'value',
          resolveInputExpr(graph, block.id, 'user', dataFallback),
        ),
      );

      const idFallback: ExprIR = toLiteralExpr(config.recordId || config.id || '');
      payload.id = resolveInputExpr(graph, block.id, 'id', idFallback);

      let filterFallback: ExprIR;
      if (config.filterField && config.filterValue !== undefined && config.filterValue !== '') {
        filterFallback = {
          kind: 'literal',
          value: { [config.filterField]: config.filterValue },
          valueType: { kind: 'object' },
        };
      } else {
        filterFallback = { kind: 'literal', value: null, valueType: { kind: 'any' } };
      }
      payload.filter = resolveInputExpr(graph, block.id, 'filter', filterFallback);

      const limitFallback: ExprIR = toLiteralExpr(config.limit ? Number(config.limit) : 0);
      payload.limit = resolveInputExpr(graph, block.id, 'limit', limitFallback);

      const offsetFallback: ExprIR = toLiteralExpr(config.offset ? Number(config.offset) : 0);
      payload.offset = resolveInputExpr(graph, block.id, 'offset', offsetFallback);

      if (config.orderBy) {
        payload.orderBy = toLiteralExpr(config.orderBy);
        payload.orderDirection = toLiteralExpr(config.orderDirection || 'asc');
      }

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'database',
        action: operation,
        payload,
        targetVar: 'dbResult',
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: block.id,
        value: { kind: 'read_var', name: 'dbResult', valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: 'dbResult', valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...lowerBlock(t, graph, nextVisited));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...lowerBlock(t, graph, nextVisited));
        }
        instructions.push({
          kind: 'try_catch',
          body: successFlow,
          catchVar: 'error',
          catchBranch: errorFlow,
        });
      } else {
        instructions.push(...successFlow);
      }
      break;
    }

    case 'api': {
      const successTargets = findTargetBlocks(graph, block.id, 'onSuccess');
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'api',
        action: config.method || 'GET',
        payload: {
          url: toLiteralExpr(config.url || ''),
          body: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
        },
        targetVar: 'apiResponse',
      };

      const successFlow: InstructionIR[] = [callInst];
      for (const t of successTargets) {
        successFlow.push(...lowerBlock(t, graph, nextVisited));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...lowerBlock(t, graph, nextVisited));
        }
        instructions.push({
          kind: 'try_catch',
          body: successFlow,
          catchVar: 'error',
          catchBranch: errorFlow,
        });
      } else {
        instructions.push(...successFlow);
      }
      break;
    }

    case 'error': {
      const retryTargets = findTargetBlocks(graph, block.id, 'retry');
      instructions.push({
        kind: 'notify',
        message: toLiteralExpr(config.message || 'Erro inesperado'),
        notifyType: 'error',
      });
      for (const t of retryTargets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'notify': {
      const nextTargets = findTargetBlocks(graph, block.id, 'next');
      const typeStr = config.type || 'info';
      const notifyType: 'success' | 'error' | 'info' | 'warning' =
        typeStr === 'success' || typeStr === 'error' || typeStr === 'warning' ? typeStr : 'info';

      instructions.push({
        kind: 'notify',
        message: toLiteralExpr(config.message || ''),
        notifyType,
        duration: parseInt(config.duration || '3000', 10),
      });
      for (const t of nextTargets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'navigate': {
      instructions.push({
        kind: 'navigate',
        targetScreenId: config.target || '',
      });
      break;
    }

    case 'state': {
      const nextTargets = findTargetBlocks(graph, block.id, 'next');
      instructions.push({
        kind: 'assign_state',
        key: config.key || 'chave',
        value: {
          kind: 'read_var',
          name: 'value',
          valueType: { kind: 'any' },
        },
      });
      for (const t of nextTargets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'constant': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      let val: unknown = config.value ?? '';
      if (config.valueType === 'number') val = Number(val) || 0;
      else if (config.valueType === 'boolean') val = String(val) === 'true';
      const lit = toLiteralExpr(val);
      instructions.push({
        kind: 'assign_var',
        name: 'value',
        value: lit,
      });
      instructions.push({
        kind: 'assign_var',
        name: block.id,
        value: lit,
      });
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'math': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const aExpr = resolveInputExpr(graph, block.id, 'a', toLiteralExpr(Number(config.a ?? 0)));
      const bExpr = resolveInputExpr(graph, block.id, 'b', toLiteralExpr(Number(config.b ?? 0)));
      const op = config.operation || 'add';
      instructions.push({
        kind: 'call_operation',
        operation: `math_${op}`,
        args: [aExpr, bExpr],
        targetVar: 'result',
      });
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'text': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const valExpr = resolveInputExpr(graph, block.id, 'value', toLiteralExpr(config.value ?? ''));
      const argExpr = resolveInputExpr(graph, block.id, 'arg', toLiteralExpr(config.arg ?? ''));
      const op = config.operation || 'concat';
      instructions.push({
        kind: 'call_operation',
        operation: `text_${op}`,
        args: [valExpr, argExpr],
        targetVar: 'result',
      });
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'compare': {
      const trueTargets = [
        ...findTargetBlocks(graph, block.id, 'true'),
        ...findTargetBlocks(graph, block.id, 'then'),
      ];
      const falseTargets = findTargetBlocks(graph, block.id, 'false');
      const leftExpr = resolveInputExpr(graph, block.id, 'left', toLiteralExpr(config.left ?? ''));
      const rightExpr = resolveInputExpr(
        graph,
        block.id,
        'right',
        toLiteralExpr(config.right ?? ''),
      );
      const op = (config.operator || 'eq') as
        'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

      const trueBranch: InstructionIR[] = [];
      for (const t of trueTargets) {
        trueBranch.push(...lowerBlock(t, graph, nextVisited));
      }
      const falseBranch: InstructionIR[] = [];
      for (const t of falseTargets) {
        falseBranch.push(...lowerBlock(t, graph, nextVisited));
      }

      instructions.push({
        kind: 'conditional',
        condition: {
          kind: 'binary_op',
          op,
          left: leftExpr,
          right: rightExpr,
          valueType: { kind: 'boolean' },
        },
        thenBranch: trueBranch,
        elseBranch: falseBranch.length > 0 ? falseBranch : undefined,
      });
      break;
    }

    case 'boolean': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const aExpr = resolveInputExpr(graph, block.id, 'a', toLiteralExpr(config.a === 'true'));
      const bExpr = resolveInputExpr(graph, block.id, 'b', toLiteralExpr(config.b === 'true'));
      const op = config.operation || 'and';

      if (op === 'not') {
        instructions.push({
          kind: 'assign_var',
          name: 'result',
          value: {
            kind: 'unary_op',
            op: 'not',
            expr: aExpr,
            valueType: { kind: 'boolean' },
          },
        });
      } else {
        instructions.push({
          kind: 'assign_var',
          name: 'result',
          value: {
            kind: 'binary_op',
            op: op === 'and' ? 'and' : 'or',
            left: aExpr,
            right: bExpr,
            valueType: { kind: 'boolean' },
          },
        });
      }

      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'object': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const dataExpr = resolveInputExpr(
        graph,
        block.id,
        'data',
        toLiteralExpr(config.fields ?? '{}'),
      );
      instructions.push({
        kind: 'call_operation',
        operation: 'object_create',
        args: [dataExpr],
        targetVar: 'object',
      });
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }

    case 'array': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const itemExpr = resolveInputExpr(graph, block.id, 'item', toLiteralExpr(config.items ?? ''));
      instructions.push({
        kind: 'call_operation',
        operation: 'array_create',
        args: [itemExpr],
        targetVar: 'array',
      });
      for (const t of targets) {
        instructions.push(...lowerBlock(t, graph, nextVisited));
      }
      break;
    }
  }

  return instructions;
}

/** Realiza lowering completo de um grafo normalizado e verificado para ProgramIR */
export function lower(graph: Graph): ProgramIR {
  const screens: ScreenIR[] = [];
  const screenNodes = graph.nodes.filter((n) => n.data.kind === 'screen');

  for (const s of screenNodes) {
    const handlers: Record<string, InstructionIR[]> = {};

    // Handlers de botões associados a esta tela
    const screenButtons = graph.nodes.filter(
      (n) => n.data.kind === 'button' && n.data.config.screenId === s.id,
    );

    for (const btn of screenButtons) {
      handlers[btn.id] = lowerBlock(btn, graph);
    }

    screens.push({
      id: s.id,
      name: s.data.label,
      handlers,
    });
  }

  const steps: StepIR[] = graph.nodes.map((node) => ({
    id: node.id,
    blockId: node.id,
    kind: node.data.kind,
    label: node.data.label,
    instructions: lowerBlock(node, graph),
  }));

  const entryScreenId = screenNodes[0]?.id;

  return {
    version: 1,
    name: graph.name,
    screens,
    entryScreenId,
    steps,
  };
}
