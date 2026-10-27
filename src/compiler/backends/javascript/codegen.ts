import type { ExprIR, InstructionIR, ProgramIR } from '../../ir';
import { emitExpr, emitProgram, safeLiteral, type JSExpr, type JSStmt } from './ast';
import { EMBEDDED_RUNTIME } from './runtimeTemplate';
import { SymbolTable } from './symbols';

/** Converte uma expressão da IR em nó de expressão JS */
function lowerExpr(expr: ExprIR): JSExpr {
  switch (expr.kind) {
    case 'literal':
      return { type: 'literal', value: expr.value };

    case 'read_input':
      return {
        type: 'raw',
        code: `(context.inputs[${safeLiteral(expr.inputId)}] ?? "")`,
      };

    case 'read_state':
      return {
        type: 'raw',
        code: `context.store[${safeLiteral(expr.key)}]`,
      };

    case 'read_var': {
      if (expr.name === 'value') {
        return {
          type: 'raw',
          code: `(context.variables["value"] ?? context.outputs["value"] ?? (Object.values(context.inputs).length > 0 && Object.values(context.inputs).every(Boolean)))`,
        };
      }
      return {
        type: 'raw',
        code: `(context.variables[${safeLiteral(expr.name)}] ?? context.outputs[${safeLiteral(expr.name)}] ?? context.store[${safeLiteral(expr.name)}] ?? context.inputs[${safeLiteral(expr.name)}] ?? "")`,
      };
    }

    case 'call_operation': {
      const args = expr.args.map(lowerExpr);
      return {
        type: 'call',
        callee: {
          type: 'raw',
          code: `BUILTIN_OPERATIONS[${safeLiteral(expr.operation)}]`,
        },
        args,
      };
    }

    case 'unary_op': {
      const sub = lowerExpr(expr.expr);
      if (expr.op === 'not') {
        return { type: 'unary', op: '!', expr: sub };
      }
      return { type: 'unary', op: '-', expr: sub };
    }

    case 'binary_op': {
      const left = lowerExpr(expr.left);
      const right = lowerExpr(expr.right);
      const leftCode = emitExpr(left);
      const rightCode = emitExpr(right);

      switch (expr.op) {
        case 'eq':
          return {
            type: 'raw',
            code: `(String(${leftCode} ?? "") === String(${rightCode} ?? ""))`,
          };
        case 'neq':
          if (expr.right.kind === 'literal' && expr.right.value === '') {
            return {
              type: 'raw',
              code: `(Boolean(${leftCode}) && ${leftCode} !== "")`,
            };
          }
          return {
            type: 'raw',
            code: `(String(${leftCode} ?? "") !== String(${rightCode} ?? ""))`,
          };
        case 'gt':
          return {
            type: 'raw',
            code: `(Number(${leftCode}) > Number(${rightCode}))`,
          };
        case 'lt':
          return {
            type: 'raw',
            code: `(Number(${leftCode}) < Number(${rightCode}))`,
          };
        case 'gte':
          return {
            type: 'raw',
            code: `(Number(${leftCode}) >= Number(${rightCode}))`,
          };
        case 'lte':
          return {
            type: 'raw',
            code: `(Number(${leftCode}) <= Number(${rightCode}))`,
          };
        case 'and':
          return {
            type: 'raw',
            code: `(Boolean(${leftCode}) && Boolean(${rightCode}))`,
          };
        case 'or':
          return {
            type: 'raw',
            code: `(Boolean(${leftCode}) || Boolean(${rightCode}))`,
          };
        case 'add':
          return {
            type: 'raw',
            code: `(${leftCode} + ${rightCode})`,
          };
        case 'sub':
          return {
            type: 'raw',
            code: `(Number(${leftCode}) - Number(${rightCode}))`,
          };
        case 'contains':
          return {
            type: 'raw',
            code: `String(${leftCode} ?? "").includes(String(${rightCode} ?? ""))`,
          };
      }
    }
  }
}

/** Converte uma instrução da IR em statements JS seguros com controle de passos e cancelamento */
export function lowerInstruction(inst: InstructionIR, symbols: SymbolTable): JSStmt[] {
  const checkStep: JSStmt = {
    type: 'raw' as const,
    code: `if (context.signal?.aborted) throw new Error("Execução cancelada pelo usuário."); if (++context.stepCount > context.maxSteps) throw new Error("Limite de " + context.maxSteps + " passos excedido (possível ciclo infinito).");`,
  };

  switch (inst.kind) {
    case 'invoke':
      return [
        checkStep,
        { type: 'raw', code: `await context.invoke(${safeLiteral(inst.blockId)});` },
      ];
    case 'assign_state': {
      const val = lowerExpr(inst.value);
      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(() => { const _v = ${emitExpr(val)}; context.store[${safeLiteral(inst.key)}] = _v; context.outputs[${safeLiteral(inst.key)}] = _v; context.trace.push({ id: ${safeLiteral(inst.key)}, label: "Estado", message: "Estado [" + ${safeLiteral(inst.key)} + "] atualizado: " + JSON.stringify(_v) }); })()`,
          },
        },
      ];
    }

    case 'assign_var': {
      const val = lowerExpr(inst.value);
      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(context.variables[${safeLiteral(inst.name)}] = context.outputs[${safeLiteral(inst.name)}] = ${emitExpr(val)})`,
          },
        },
      ];
    }

    case 'call_operation': {
      const args = inst.args.map(lowerExpr);
      const argsCode = args.map(emitExpr).join(', ');
      const targetVar = inst.targetVar || 'result';

      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(() => {
  let _res;
  if (${safeLiteral(inst.operation)} in BUILTIN_OPERATIONS) {
    _res = BUILTIN_OPERATIONS[${safeLiteral(inst.operation)}](${argsCode});
  } else {
    _res = true;
  }
  context.variables[${safeLiteral(targetVar)}] = _res;
  context.outputs[${safeLiteral(targetVar)}] = _res;
  context.variables["value"] = _res;
  context.outputs["value"] = _res;
})()`,
          },
        },
      ];
    }

    case 'sequence': {
      return inst.instructions.flatMap((i) => lowerInstruction(i, symbols));
    }

    case 'conditional': {
      const cond = lowerExpr(inst.condition);
      const thenBranch = inst.thenBranch.flatMap((i) => lowerInstruction(i, symbols));
      const elseBranch = inst.elseBranch
        ? inst.elseBranch.flatMap((i) => lowerInstruction(i, symbols))
        : undefined;

      return [
        checkStep,
        {
          type: 'if',
          condition: cond,
          thenBranch,
          elseBranch,
        },
      ];
    }

    case 'switch': {
      const expr = lowerExpr(inst.expr);
      const cases = inst.cases.map((c) => ({
        value: { type: 'literal' as const, value: c.value },
        statements: c.branch.flatMap((i) => lowerInstruction(i, symbols)),
      }));
      const defaultBranch = inst.defaultBranch
        ? inst.defaultBranch.flatMap((i) => lowerInstruction(i, symbols))
        : undefined;

      return [
        checkStep,
        {
          type: 'switch',
          expr,
          cases,
          defaultBranch,
        },
      ];
    }

    case 'return': {
      const retVal = inst.value ? lowerExpr(inst.value) : undefined;
      return [checkStep, { type: 'return', value: retVal }];
    }

    case 'navigate': {
      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(context.screen = ${safeLiteral(inst.targetScreenId)}, context.trace.push({ id: ${safeLiteral(inst.targetScreenId)}, label: "Navegação", message: "Navegando para " + ${safeLiteral(inst.targetScreenId)} }))`,
          },
        },
      ];
    }

    case 'notify': {
      const msg = lowerExpr(inst.message);
      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(() => {
  const _m = String(${emitExpr(msg)});
  context.notifications.push({ message: _m, type: ${safeLiteral(inst.notifyType)}, duration: ${safeLiteral(inst.duration ?? 3000)} });
  const _log = "[" + ${safeLiteral(inst.notifyType.toUpperCase())} + "] " + _m;
  context.logs.push(_log);
  context.trace.push({ id: "notify", label: "Notificação", message: _log });
})()`,
          },
        },
      ];
    }

    case 'delay': {
      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `await context.adapters.delay.execute(${safeLiteral(inst.durationMs)}, context.signal)`,
          },
        },
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `context.trace.push({ id: "delay", label: "Atraso", message: "Atraso / Timer de " + ${safeLiteral(inst.durationMs)} + "ms executado" })`,
          },
        },
      ];
    }

    case 'try_catch': {
      const body = inst.body.flatMap((i) => lowerInstruction(i, symbols));
      const catchVar = symbols.getIdentifier(inst.catchVar || 'error');
      const catchBranch: JSStmt[] = [
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(context.variables[${safeLiteral(inst.catchVar || 'error')}] = ${catchVar}, context.outputs[${safeLiteral(inst.catchVar || 'error')}] = ${catchVar})`,
          },
        },
        ...inst.catchBranch.flatMap((i) => lowerInstruction(i, symbols)),
      ];

      return [
        checkStep,
        {
          type: 'try_catch',
          body,
          catchVar,
          catchBranch,
        },
      ];
    }

    case 'adapter_call': {
      const payloadProps: string[] = [];
      for (const [k, v] of Object.entries(inst.payload)) {
        payloadProps.push(`${safeLiteral(k)}: ${emitExpr(lowerExpr(v))}`);
      }
      const payloadCode = `{ ${payloadProps.join(', ')} }`;
      const targetVar = inst.targetVar || 'result';

      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(() => {
  const _p = ${payloadCode};
  return context.adapters[${safeLiteral(inst.adapter)}].execute(${safeLiteral(inst.action)}, _p, context)
    .then((_r) => {
      context.variables[${safeLiteral(targetVar)}] = _r;
      context.outputs[${safeLiteral(targetVar)}] = _r;
      context.variables["value"] = _r;
      context.outputs["value"] = _r;
      context.trace.push({ id: ${safeLiteral(inst.adapter)}, label: ${safeLiteral(inst.adapter)}, message: ${safeLiteral(inst.adapter)} + " (" + ${safeLiteral(inst.action)} + "): sucesso" });
      return _r;
    });
})()`,
            isAwait: true,
          },
        },
      ];
    }

    case 'call_subflow': {
      const inputProps: string[] = [];
      for (const [k, v] of Object.entries(inst.inputs)) {
        inputProps.push(`${safeLiteral(k)}: ${emitExpr(lowerExpr(v))}`);
      }
      const inputsCode = `{ ${inputProps.join(', ')} }`;
      const targetVar = inst.targetVar || inst.subflowId;
      const defJson = inst.subflowDefinition
        ? safeLiteral(JSON.stringify(inst.subflowDefinition))
        : 'undefined';

      return [
        checkStep,
        {
          type: 'expression_stmt',
          expr: {
            type: 'raw',
            code: `(() => {
  const _in = ${inputsCode};
  const _def = ${defJson} ? JSON.parse(${defJson}) : undefined;
  return (context.adapters.subflow ? context.adapters.subflow.execute(${safeLiteral(inst.subflowId)}, _in, context, _def) : Promise.resolve(_in))
    .then((_r) => {
      context.variables[${safeLiteral(targetVar)}] = _r;
      context.outputs[${safeLiteral(targetVar)}] = _r;
      context.variables["value"] = _r;
      context.outputs["value"] = _r;
      context.trace.push({ id: ${safeLiteral(inst.subflowId)}, label: "Subfluxo", message: "Subfluxo [" + ${safeLiteral(inst.subflowId)} + "] executado" });
      return _r;
    });
})()`,
            isAwait: true,
          },
        },
      ];
    }
  }
}

/**
 * Gera código JavaScript / TypeScript autocontido e seguro a partir da ProgramIR.
 */
export function generateProgramCode(program: ProgramIR): string {
  const symbols = new SymbolTable();
  const stmts: JSStmt[] = [];

  // Gera uma função assíncrona para cada handler de tela
  const handlerMapEntries: string[] = [];

  for (const scr of program.screens) {
    for (const [btnId, instructions] of Object.entries(scr.handlers)) {
      const fnName = symbols.getIdentifier(`handle_${scr.id}_${btnId}`);
      const body = instructions.flatMap((i) => lowerInstruction(i, symbols));

      stmts.push({
        type: 'function_decl',
        name: fnName,
        params: ['context'],
        body,
        isAsync: true,
      });

      handlerMapEntries.push(`${safeLiteral(btnId)}: ${fnName}`);
    }
  }

  // Mapeamento dos handlers
  stmts.push({
    type: 'raw' as const,
    code: `const HANDLERS = { ${handlerMapEntries.join(', ')} };`,
  });

  // Classe pública FlowForgeProgram
  stmts.push({
    type: 'raw' as const,
    code: `
export class FlowForgeProgram {
  constructor(options = {}) {
    this.context = createRuntimeContext(options);
    if (!this.context.screen) {
      this.context.screen = ${safeLiteral(program.entryScreenId ?? '')};
    }
  }

  async dispatch(eventId, inputs = {}) {
    Object.assign(this.context.inputs, inputs);
    const handler = HANDLERS[eventId];
    if (!handler) {
      throw new Error("Handler não encontrado para o evento: " + eventId);
    }

    this.context.trace.push({
      id: eventId,
      label: "Evento",
      message: "Evento onClick disparado (" + eventId + ")"
    });

    try {
      await handler(this.context);
      return {
        success: true,
        screen: this.context.screen,
        messages: this.context.logs,
        trace: this.context.trace,
        outputs: this.context.outputs,
        store: this.context.store,
      };
    } catch (err) {
      return {
        success: false,
        screen: this.context.screen,
        messages: this.context.logs,
        trace: this.context.trace,
        outputs: this.context.outputs,
        store: this.context.store,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  getState(key = undefined) {
    if (key !== undefined) return this.context.store[key];
    return this.context.store;
  }

  getScreen() {
    return this.context.screen;
  }

  getTrace() {
    return this.context.trace;
  }

  getNotifications() {
    return this.context.notifications;
  }

  getLogs() {
    return this.context.logs;
  }

  reset(startScreen) {
    if (startScreen !== undefined) this.context.screen = startScreen;
    this.context.trace = [];
    this.context.logs = [];
    this.context.notifications = [];
    this.context.inputs = {};
    this.context.store = {};
    this.context.outputs = {};
    this.context.variables = {};
    this.context.stepCount = 0;
  }
}

export function createProgram(options = {}) {
  return new FlowForgeProgram(options);
}
`,
  });

  const generatedProgramBody = emitProgram(stmts);
  return `// @ts-nocheck — runtime JavaScript gerado automaticamente\n${EMBEDDED_RUNTIME}\n\n${generatedProgramBody}\n`;
}
