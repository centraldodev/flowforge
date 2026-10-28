import type { Block, Graph } from '../engine/types';
import { buildCompositionManifest } from '../engine/composition';
import { logicOperation, selectedLogicVersion } from '../engine/catalogo/logicCatalog';
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
  references = false,
): InstructionIR[] {
  if (visited.has(block.id)) {
    return [{ kind: 'call_operation', operation: block.id, args: [] }];
  }
  const nextVisited = new Set(visited);
  nextVisited.add(block.id);

  const descend = (target: Block): InstructionIR[] =>
    references ? [{ kind: 'invoke', blockId: target.id }] : lowerBlock(target, graph, nextVisited);

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
        instructions.push(...descend(t));
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
        downstream.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorDownstream: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorDownstream.push(...descend(t));
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
      const op = logicOperation(
        'condition',
        config.operator || (config.compare ? 'equals' : 'truthy'),
        selectedLogicVersion(config),
      );
      if (op === 'gt') {
        condExpr = {
          kind: 'binary_op',
          op: 'gt',
          left: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
          right: toLiteralExpr(Number(config.compare ?? config.value ?? 0)),
          valueType: { kind: 'boolean' },
        };
      } else if (op === 'eq') {
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
        trueBranch.push(...descend(t));
      }

      const falseBranch: InstructionIR[] = [];
      for (const t of falseTargets) {
        falseBranch.push(...descend(t));
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
        validBranch.push(...descend(t));
      }

      const invalidBranch: InstructionIR[] = [];
      for (const t of invalidTargets) {
        invalidBranch.push(...descend(t));
      }

      instructions.push({
        kind: 'conditional',
        condition: {
          kind: 'call_operation',
          operation: logicOperation('validator', config.rule, selectedLogicVersion(config)),
          args: [
            resolveInputExpr(graph, block.id, 'value', {
              kind: 'read_var',
              name: 'value',
              valueType: { kind: 'any' },
            }),
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
          branch: case1Targets.flatMap((t) => descend(t)),
        });
      }
      if (case2Targets.length > 0 && config.case2) {
        cases.push({
          value: config.case2,
          branch: case2Targets.flatMap((t) => descend(t)),
        });
      }
      if (case3Targets.length > 0 && config.case3) {
        cases.push({
          value: config.case3,
          branch: case3Targets.flatMap((t) => descend(t)),
        });
      }

      instructions.push({
        kind: 'switch',
        expr: { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
        cases,
        defaultBranch: defTargets.length > 0 ? defTargets.flatMap((t) => descend(t)) : undefined,
      });
      break;
    }

    case 'delay': {
      const nextTargets = findTargetBlocks(graph, block.id, 'next');
      const durationMs = parseInt(config.duration || '1000', 10);
      instructions.push({ kind: 'delay', durationMs });
      for (const t of nextTargets) {
        instructions.push(...descend(t));
      }
      break;
    }

    case 'auth': {
      const successTargets = ['onSuccess', 'then', 'next']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'auth',
        action: config.mode || 'login',
        payload: {
          blockId: toLiteralExpr(block.id),
          provider: toLiteralExpr(config.provider || 'email'),
          execution: toLiteralExpr(config.execution || 'demo'),
          mode: toLiteralExpr(config.mode || 'login'),
          email: resolveInputExpr(graph, block.id, 'email', toLiteralExpr(config.email || '')),
          password: resolveInputExpr(
            graph,
            block.id,
            'password',
            toLiteralExpr(config.password || ''),
          ),
          token: resolveInputExpr(graph, block.id, 'token', toLiteralExpr(config.token || '')),
        },
        targetVar: 'user',
      };

      const successFlow: InstructionIR[] = [callInst];
      for (const t of successTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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
        mode: toLiteralExpr(config.mode || 'mock'),
        blockId: toLiteralExpr(block.id),
        table: toLiteralExpr(table),
        operation: toLiteralExpr(operation),
      };

      if (config.mock) {
        payload.mock = toLiteralExpr(config.mock);
      }

      const dataFallback: ExprIR = config.data
        ? toLiteralExpr(config.data)
        : { kind: 'read_var', name: 'value', valueType: { kind: 'any' } };
      payload.data = ['insert', 'update'].includes(operation)
        ? resolveInputExpr(
            graph,
            block.id,
            'data',
            resolveInputExpr(
              graph,
              block.id,
              'value',
              resolveInputExpr(graph, block.id, 'user', dataFallback),
            ),
          )
        : { kind: 'literal', value: {}, valueType: { kind: 'object' } };

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
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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
      const successTargets = ['onSuccess', 'then', 'next']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'api',
        action: config.method || 'GET',
        payload: {
          mode: toLiteralExpr(config.mode || 'demo'),
          blockId: toLiteralExpr(block.id),
          url: toLiteralExpr(config.url || ''),
          mock: toLiteralExpr(config.mock || ''),
          query: resolveInputExpr(graph, block.id, 'query', toLiteralExpr('')),
          body: resolveInputExpr(
            graph,
            block.id,
            'body',
            config.mode === 'real'
              ? toLiteralExpr('')
              : { kind: 'read_var', name: 'value', valueType: { kind: 'any' } },
          ),
        },
        targetVar: 'apiResponse',
      };

      const successFlow: InstructionIR[] = [
        callInst,
        {
          kind: 'assign_var',
          name: block.id,
          value: { kind: 'read_var', name: 'apiResponse', valueType: { kind: 'any' } },
        },
      ];
      for (const t of successTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'subflow': {
      const allSuccessTargets = ['onSuccess', 'then', 'output', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      let def: import('../engine/composition').SubflowDefinition | undefined;
      if (config.subflowDefinition) {
        try {
          def = JSON.parse(config.subflowDefinition);
        } catch {
          // ignora JSON inválido
        }
      }
      def ??= buildCompositionManifest(graph).subflows.find((item) => item.id === config.subflowId);

      const inputs: Record<string, ExprIR> = {
        input: resolveInputExpr(graph, block.id, 'input', {
          kind: 'read_var',
          name: 'value',
          valueType: { kind: 'any' },
        }),
      };

      if (block.data.ports) {
        for (const p of block.data.ports) {
          if (p.mode === 'data' && p.direction === 'input') {
            inputs[p.id] = resolveInputExpr(graph, block.id, p.id, toLiteralExpr(''));
          }
        }
      }

      const callInst: InstructionIR = {
        kind: 'call_subflow',
        subflowId: config.subflowId || block.id,
        subflowDefinition: def,
        inputs,
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'storage': {
      const allSuccessTargets = ['onSuccess', 'then', 'fileUrl', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'storage',
        action: config.action || 'upload',
        payload: {
          blockId: toLiteralExpr(block.id),
          execution: toLiteralExpr(config.execution || 'real'),
          provider: toLiteralExpr(config.provider || 'local'),
          bucket: toLiteralExpr(config.bucket || 'uploads'),
          maxSizeBytes: toLiteralExpr(config.maxSizeBytes || '5242880'),
          allowedTypes: toLiteralExpr(config.allowedTypes || 'image/*,application/pdf'),
          secretEnv: toLiteralExpr(config.secretEnv || 'FLOWFORGE_SECRET_STORAGE_KEY'),
          file: resolveInputExpr(graph, block.id, 'file', {
            kind: 'read_var',
            name: 'value',
            valueType: { kind: 'any' },
          }),
          path: resolveInputExpr(graph, block.id, 'path', toLiteralExpr(config.path || '')),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'email': {
      const allSuccessTargets = ['onSuccess', 'then', 'messageId', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'email',
        action: 'send',
        payload: {
          blockId: toLiteralExpr(block.id),
          execution: toLiteralExpr(config.execution || 'real'),
          provider: toLiteralExpr(config.provider || 'smtp'),
          from: toLiteralExpr(config.from || 'contato@exemplo.com'),
          to: resolveInputExpr(graph, block.id, 'to', toLiteralExpr(config.to || '')),
          subject: resolveInputExpr(
            graph,
            block.id,
            'subject',
            toLiteralExpr(config.subject || ''),
          ),
          body: resolveInputExpr(graph, block.id, 'body', toLiteralExpr(config.body || '')),
          secretEnv: toLiteralExpr(config.secretEnv || 'FLOWFORGE_SECRET_EMAIL_API_KEY'),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'webhook': {
      const allSuccessTargets = ['onEvent', 'then', 'payload', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'webhook',
        action: 'receive',
        payload: {
          blockId: toLiteralExpr(block.id),
          path: toLiteralExpr(config.path || `/api/webhooks/${block.id}`),
          secretEnv: toLiteralExpr(config.secretEnv || 'FLOWFORGE_SECRET_WEBHOOK_SECRET'),
          eventType: toLiteralExpr(config.eventType || '*'),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'task': {
      const allSuccessTargets = ['onTick', 'then', 'payload', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'task',
        action: 'schedule',
        payload: {
          blockId: toLiteralExpr(block.id),
          execution: toLiteralExpr(config.execution || 'real'),
          taskName: toLiteralExpr(config.taskName || 'Tarefa'),
          schedule: toLiteralExpr(config.schedule || '0 * * * *'),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'payment': {
      const allSuccessTargets = [
        'onSuccess',
        'then',
        'checkoutUrl',
        'sessionId',
        'paymentId',
        'status',
        'qrCode',
        'result',
      ]
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'payment',
        action: config.operation || 'createCheckout',
        payload: {
          blockId: toLiteralExpr(block.id),
          execution: toLiteralExpr(config.execution || 'real'),
          provider: toLiteralExpr(config.provider || 'stripe'),
          currency: toLiteralExpr(config.currency || 'BRL'),
          amount: resolveInputExpr(
            graph,
            block.id,
            'amount',
            toLiteralExpr(config.amount ? Number(config.amount) : 0),
          ),
          description: resolveInputExpr(
            graph,
            block.id,
            'description',
            toLiteralExpr(config.description || ''),
          ),
          customer: resolveInputExpr(graph, block.id, 'customer', toLiteralExpr('')),
          successUrl: toLiteralExpr(config.successUrl || ''),
          cancelUrl: toLiteralExpr(config.cancelUrl || ''),
          secretEnv: toLiteralExpr(
            config.secretEnv ||
              (config.provider === 'pix'
                ? 'FLOWFORGE_SECRET_PIX_KEY'
                : 'FLOWFORGE_SECRET_STRIPE_KEY'),
          ),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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

    case 'realtime': {
      const allSuccessTargets = ['onEvent', 'onMessage', 'then', 'payload', 'result']
        .flatMap((port) => findTargetBlocks(graph, block.id, port))
        .filter((node, i, all) => all.findIndex((other) => other.id === node.id) === i);
      const errorTargets = findTargetBlocks(graph, block.id, 'onError');

      const callInst: InstructionIR = {
        kind: 'adapter_call',
        adapter: 'realtime',
        action: config.action || 'publish',
        payload: {
          blockId: toLiteralExpr(block.id),
          protocol: toLiteralExpr(config.protocol || 'sse'),
          channel: resolveInputExpr(
            graph,
            block.id,
            'channel',
            toLiteralExpr(config.channel || 'general'),
          ),
          event: resolveInputExpr(
            graph,
            block.id,
            'event',
            toLiteralExpr(config.event || 'message'),
          ),
          data: resolveInputExpr(graph, block.id, 'data', {
            kind: 'read_var',
            name: 'value',
            valueType: { kind: 'any' },
          }),
        },
        targetVar: block.id,
      };

      const assignResult: InstructionIR = {
        kind: 'assign_var',
        name: 'result',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };
      const assignValue: InstructionIR = {
        kind: 'assign_var',
        name: 'value',
        value: { kind: 'read_var', name: block.id, valueType: { kind: 'any' } },
      };

      const successFlow: InstructionIR[] = [callInst, assignResult, assignValue];
      for (const t of allSuccessTargets) {
        successFlow.push(...descend(t));
      }

      if (errorTargets.length > 0) {
        const errorFlow: InstructionIR[] = [];
        for (const t of errorTargets) {
          errorFlow.push(...descend(t));
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
        instructions.push(...descend(t));
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
        instructions.push(...descend(t));
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
        instructions.push(...descend(t));
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
        instructions.push(...descend(t));
      }
      break;
    }

    case 'math': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const aFallback: ExprIR =
        config.a !== undefined && config.a !== ''
          ? toLiteralExpr(Number(config.a))
          : { kind: 'read_var', name: 'value', valueType: { kind: 'number' } };
      const aExpr = resolveInputExpr(graph, block.id, 'a', aFallback);
      const bExpr = resolveInputExpr(graph, block.id, 'b', toLiteralExpr(Number(config.b ?? 0)));
      const op = config.operation || 'add';
      instructions.push({
        kind: 'call_operation',
        operation: `math_${op}`,
        args: [aExpr, bExpr],
        targetVar: 'result',
      });
      for (const t of targets) {
        instructions.push(...descend(t));
      }
      break;
    }

    case 'text': {
      const targets = [
        ...findTargetBlocks(graph, block.id, 'then'),
        ...findTargetBlocks(graph, block.id, 'next'),
      ];
      const valFallback: ExprIR =
        config.value !== undefined && config.value !== ''
          ? toLiteralExpr(config.value)
          : { kind: 'read_var', name: 'value', valueType: { kind: 'string' } };
      const valExpr = resolveInputExpr(graph, block.id, 'value', valFallback);
      const argExpr = resolveInputExpr(graph, block.id, 'arg', toLiteralExpr(config.arg ?? ''));
      const op = config.operation || 'concat';
      instructions.push({
        kind: 'call_operation',
        operation: `text_${op}`,
        args: [valExpr, argExpr],
        targetVar: 'result',
      });
      for (const t of targets) {
        instructions.push(...descend(t));
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
        trueBranch.push(...descend(t));
      }
      const falseBranch: InstructionIR[] = [];
      for (const t of falseTargets) {
        falseBranch.push(...descend(t));
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
        instructions.push(...descend(t));
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
      const fields = (config.fieldNames || '')
        .split(',')
        .map((field) => field.trim())
        .filter((field) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(field));
      instructions.push({
        kind: 'call_operation',
        operation: fields.length ? 'object_from_fields' : 'object_create',
        args: fields.length
          ? fields.flatMap((field) => [
              toLiteralExpr(field),
              resolveInputExpr(graph, block.id, field, toLiteralExpr('')),
            ])
          : [dataExpr],
        targetVar: 'object',
      });
      instructions.push({
        kind: 'assign_var',
        name: block.id,
        value: { kind: 'read_var', name: 'object', valueType: { kind: 'object' } },
      });
      for (const t of targets) {
        instructions.push(...descend(t));
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
        instructions.push(...descend(t));
      }
      break;
    }
  }

  return instructions;
}

/** Realiza lowering completo de um grafo normalizado e verificado para ProgramIR */
export function lower(graph: Graph, references = false): ProgramIR {
  const screens: ScreenIR[] = [];
  const screenNodes = graph.nodes.filter((n) => n.data.kind === 'screen');

  for (const s of screenNodes) {
    const handlers: Record<string, InstructionIR[]> = {};

    // Handlers de botões associados a esta tela
    const screenButtons = graph.nodes.filter(
      (n) => n.data.kind === 'button' && n.data.config.screenId === s.id,
    );

    for (const btn of screenButtons) {
      handlers[btn.id] = references
        ? [{ kind: 'invoke', blockId: btn.id }]
        : lowerBlock(btn, graph);
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
    instructions: lowerBlock(node, graph, new Set(), references),
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
