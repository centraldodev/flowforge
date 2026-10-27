import type { ExprIR, InstructionIR, ProgramIR } from '../../ir';
import { emitExpr, emitProgram, safePythonLiteral, type PyExpr, type PyStmt } from './ast';
import { PYTHON_EMBEDDED_RUNTIME } from './runtimeTemplate';
import { PythonSymbolTable } from './symbols';

/**
 * Converte uma expressão da IR em nó de expressão Python seguro.
 */
function lowerExpr(expr: ExprIR): PyExpr {
  switch (expr.kind) {
    case 'literal':
      return { type: 'literal', value: expr.value };

    case 'read_input':
      return {
        type: 'raw',
        code: `(context.inputs.get(${safePythonLiteral(expr.inputId)}) or "")`,
      };

    case 'read_state':
      return {
        type: 'raw',
        code: `context.store.get(${safePythonLiteral(expr.key)})`,
      };

    case 'read_var': {
      if (expr.name === 'value') {
        return {
          type: 'raw',
          code: `(context.variables.get("value") or context.outputs.get("value") or (all(bool(v) for v in context.inputs.values()) if context.inputs else False))`,
        };
      }
      const nameLit = safePythonLiteral(expr.name);
      return {
        type: 'raw',
        code: `(context.variables.get(${nameLit}) or context.outputs.get(${nameLit}) or context.store.get(${nameLit}) or context.inputs.get(${nameLit}) or "")`,
      };
    }

    case 'call_operation': {
      const args = expr.args.map(lowerExpr).map(emitExpr).join(', ');
      return {
        type: 'raw',
        code: `BUILTIN_OPERATIONS[${safePythonLiteral(expr.operation)}](${args})`,
      };
    }

    case 'unary_op': {
      const sub = lowerExpr(expr.expr);
      if (expr.op === 'not') {
        return {
          type: 'raw',
          code: `(not bool(${emitExpr(sub)}))`,
        };
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
            code: `(str(${leftCode} if ${leftCode} is not None else "") == str(${rightCode} if ${rightCode} is not None else ""))`,
          };
        case 'neq':
          if (expr.right.kind === 'literal' && expr.right.value === '') {
            return {
              type: 'raw',
              code: `(bool(${leftCode}) and ${leftCode} != "")`,
            };
          }
          return {
            type: 'raw',
            code: `(str(${leftCode} if ${leftCode} is not None else "") != str(${rightCode} if ${rightCode} is not None else ""))`,
          };
        case 'gt':
          return {
            type: 'raw',
            code: `(float(${leftCode} or 0) > float(${rightCode} or 0))`,
          };
        case 'lt':
          return {
            type: 'raw',
            code: `(float(${leftCode} or 0) < float(${rightCode} or 0))`,
          };
        case 'gte':
          return {
            type: 'raw',
            code: `(float(${leftCode} or 0) >= float(${rightCode} or 0))`,
          };
        case 'lte':
          return {
            type: 'raw',
            code: `(float(${leftCode} or 0) <= float(${rightCode} or 0))`,
          };
        case 'and':
          return { type: 'raw', code: `(bool(${leftCode}) and bool(${rightCode}))` };
        case 'or':
          return { type: 'raw', code: `(bool(${leftCode}) or bool(${rightCode}))` };
        case 'add':
          return {
            type: 'raw',
            code: `((str(${leftCode} if ${leftCode} is not None else "") + str(${rightCode} if ${rightCode} is not None else "")) if isinstance(${leftCode}, str) or isinstance(${rightCode}, str) else (float(${leftCode} or 0) + float(${rightCode} or 0)))`,
          };
        case 'sub':
          return {
            type: 'raw',
            code: `(float(${leftCode} or 0) - float(${rightCode} or 0))`,
          };
        case 'contains':
          return {
            type: 'raw',
            code: `(str(${rightCode} or "") in str(${leftCode} or ""))`,
          };
      }
      break;
    }
  }
}

/**
 * Converte uma instrução da IR em instruções Python equivalentes ao backend JS.
 */
function lowerInstruction(inst: InstructionIR, symbols: PythonSymbolTable): PyStmt[] {
  const checkStep: PyStmt = {
    type: 'raw',
    code: 'context.step_count += 1\nif context.step_count > context.max_steps:\n    raise RuntimeError(f"Limite de {context.max_steps} passos excedido (possivel ciclo infinito).")',
  };

  switch (inst.kind) {
    case 'invoke':
      return [
        checkStep,
        { type: 'raw', code: `await context.invoke(${safePythonLiteral(inst.blockId)})` },
      ];
    case 'assign_state': {
      const val = lowerExpr(inst.value);
      const keyLit = safePythonLiteral(inst.key);
      return [
        checkStep,
        {
          type: 'raw',
          code: `_v = ${emitExpr(val)}\ncontext.store[${keyLit}] = _v\ncontext.outputs[${keyLit}] = _v\ncontext.trace.append({"id": ${keyLit}, "label": "Estado", "message": f"Estado [{${keyLit}}] atualizado: {_v}"})`,
        },
      ];
    }

    case 'assign_var': {
      const val = lowerExpr(inst.value);
      const nameLit = safePythonLiteral(inst.name);
      return [
        checkStep,
        {
          type: 'raw',
          code: `context.variables[${nameLit}] = context.outputs[${nameLit}] = ${emitExpr(val)}`,
        },
      ];
    }

    case 'call_operation': {
      const args = inst.args.map(lowerExpr);
      const argsCode = args.map(emitExpr).join(', ');
      const targetVar = inst.targetVar || 'result';
      const targetLit = safePythonLiteral(targetVar);
      const opLit = safePythonLiteral(inst.operation);

      return [
        checkStep,
        {
          type: 'raw',
          code: `if ${opLit} in BUILTIN_OPERATIONS:\n    _res = BUILTIN_OPERATIONS[${opLit}](${argsCode})\nelse:\n    _res = True\ncontext.variables[${targetLit}] = _res\ncontext.outputs[${targetLit}] = _res\ncontext.variables["value"] = _res\ncontext.outputs["value"] = _res`,
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
          body: thenBranch.length > 0 ? thenBranch : [{ type: 'pass' }],
          elseBody: elseBranch && elseBranch.length > 0 ? elseBranch : undefined,
        },
      ];
    }

    case 'switch': {
      const expr = lowerExpr(inst.expr);
      const exprCode = emitExpr(expr);
      const stmts: PyStmt[] = [checkStep];

      if (inst.cases.length === 0) {
        if (inst.defaultBranch && inst.defaultBranch.length > 0) {
          stmts.push(...inst.defaultBranch.flatMap((i) => lowerInstruction(i, symbols)));
        }
        return stmts;
      }

      const firstCase = inst.cases[0];
      const firstBranch = firstCase.branch.flatMap((i) => lowerInstruction(i, symbols));
      const elifBranches = inst.cases.slice(1).map((c) => ({
        condition: {
          type: 'raw' as const,
          code: `(${exprCode} == ${safePythonLiteral(c.value)})`,
        },
        body: c.branch.flatMap((i) => lowerInstruction(i, symbols)),
      }));

      const defaultBranch = inst.defaultBranch
        ? inst.defaultBranch.flatMap((i) => lowerInstruction(i, symbols))
        : undefined;

      stmts.push({
        type: 'if',
        condition: {
          type: 'raw',
          code: `(${exprCode} == ${safePythonLiteral(firstCase.value)})`,
        },
        body: firstBranch.length > 0 ? firstBranch : [{ type: 'pass' }],
        elifBranches: elifBranches.length > 0 ? elifBranches : undefined,
        elseBody: defaultBranch && defaultBranch.length > 0 ? defaultBranch : undefined,
      });

      return stmts;
    }

    case 'return': {
      const retVal = inst.value ? lowerExpr(inst.value) : undefined;
      return [checkStep, { type: 'return', value: retVal }];
    }

    case 'navigate': {
      const targetLit = safePythonLiteral(inst.targetScreenId);
      return [
        checkStep,
        {
          type: 'raw',
          code: `context.screen = ${targetLit}\ncontext.trace.append({"id": ${targetLit}, "label": "Navegação", "message": f"Navegando para {${targetLit}}"})`,
        },
      ];
    }

    case 'notify': {
      const msg = lowerExpr(inst.message);
      const typeLit = safePythonLiteral(inst.notifyType);
      const durLit = safePythonLiteral(inst.duration ?? 3000);
      return [
        checkStep,
        {
          type: 'raw',
          code: `_m = str(${emitExpr(msg)})\ncontext.notifications.append({"message": _m, "type": ${typeLit}, "duration": ${durLit}})\n_log = f"[{${safePythonLiteral(inst.notifyType.toUpperCase())}}] {_m}"\ncontext.logs.append(_log)\ncontext.trace.append({"id": "notify", "label": "Notificação", "message": _log})`,
        },
      ];
    }

    case 'delay': {
      return [
        checkStep,
        {
          type: 'raw',
          code: `await context.adapters.delay.execute(float(${safePythonLiteral(inst.durationMs)}))\ncontext.trace.append({"id": "delay", "label": "Atraso", "message": f"Atraso / Timer de {${safePythonLiteral(inst.durationMs)}}ms executado"})`,
        },
      ];
    }

    case 'try_catch': {
      const body = inst.body.flatMap((i) => lowerInstruction(i, symbols));
      const catchVarName = symbols.getIdentifier(inst.catchVar || 'error');
      const catchBranch: PyStmt[] = [
        {
          type: 'raw',
          code: `_err_msg = str(${catchVarName})\ncontext.variables[${safePythonLiteral(inst.catchVar || 'error')}] = _err_msg\ncontext.outputs[${safePythonLiteral(inst.catchVar || 'error')}] = _err_msg`,
        },
        ...inst.catchBranch.flatMap((i) => lowerInstruction(i, symbols)),
      ];

      return [
        checkStep,
        {
          type: 'try',
          body: body.length > 0 ? body : [{ type: 'pass' }],
          handlers: [
            {
              exceptionType: 'Exception',
              varName: catchVarName,
              body: catchBranch.length > 0 ? catchBranch : [{ type: 'pass' }],
            },
          ],
        },
      ];
    }

    case 'adapter_call': {
      const payloadProps: string[] = [];
      for (const [k, v] of Object.entries(inst.payload)) {
        payloadProps.push(`${safePythonLiteral(k)}: ${emitExpr(lowerExpr(v))}`);
      }
      const payloadCode = `{ ${payloadProps.join(', ')} }`;
      const targetVar = inst.targetVar || 'result';
      const targetLit = safePythonLiteral(targetVar);
      const adapterLit = safePythonLiteral(inst.adapter);
      const actionLit = safePythonLiteral(inst.action);

      return [
        checkStep,
        {
          type: 'raw',
          code: `_p = ${payloadCode}\n_r = await getattr(context.adapters, ${adapterLit}).execute(${actionLit}, _p, context)\ncontext.variables[${targetLit}] = _r\ncontext.outputs[${targetLit}] = _r\ncontext.variables["value"] = _r\ncontext.outputs["value"] = _r\ncontext.trace.append({"id": ${adapterLit}, "label": ${adapterLit}, "message": f"{${adapterLit}} ({${actionLit}}): sucesso"})`,
        },
      ];
    }

    case 'call_subflow': {
      const inputProps: string[] = [];
      for (const [k, v] of Object.entries(inst.inputs)) {
        inputProps.push(`${safePythonLiteral(k)}: ${emitExpr(lowerExpr(v))}`);
      }
      const inputsCode = `{ ${inputProps.join(', ')} }`;
      const targetVar = inst.targetVar || inst.subflowId;
      const targetLit = safePythonLiteral(targetVar);
      const subflowLit = safePythonLiteral(inst.subflowId);

      return [
        checkStep,
        {
          type: 'raw',
          code: `_in = ${inputsCode}\n_r = await context.adapters.subflow.execute(${subflowLit}, _in, context) if hasattr(context.adapters, "subflow") and context.adapters.subflow else _in\ncontext.variables[${targetLit}] = _r\ncontext.outputs[${targetLit}] = _r\ncontext.variables["value"] = _r\ncontext.outputs["value"] = _r\ncontext.trace.append({"id": ${subflowLit}, "label": "Subfluxo", "message": f"Subfluxo [{${subflowLit}}] executado"})`,
        },
      ];
    }
  }
}

/**
 * Gera código Python autônomo, assíncrono e seguro a partir da ProgramIR.
 */
export function generatePythonProgram(program: ProgramIR): string {
  const symbols = new PythonSymbolTable();
  const stmts: PyStmt[] = [];

  const handlerMapEntries: string[] = [];

  for (const scr of program.screens) {
    for (const [btnId, instructions] of Object.entries(scr.handlers)) {
      const fnName = symbols.getIdentifier(`handle_${scr.id}_${btnId}`);
      const body = instructions.flatMap((i) => lowerInstruction(i, symbols));

      stmts.push({
        type: 'func_def',
        name: fnName,
        params: ['context: RuntimeContext'],
        body: body.length > 0 ? body : [{ type: 'pass' }],
        isAsync: true,
      });

      handlerMapEntries.push(`${safePythonLiteral(btnId)}: ${fnName}`);
    }
  }

  // Dicionário de handlers
  stmts.push({
    type: 'raw',
    code: `HANDLERS = { ${handlerMapEntries.join(', ')} }`,
  });

  // Classe FlowForgeProgram
  const classCode = `
class FlowForgeProgram:
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        opts = options or {}
        fast_delay = bool(opts.get("fastDelay", False))
        self.context = RuntimeContext(
            inputs=opts.get("inputs"),
            store=opts.get("store"),
            fast_delay=fast_delay
        )
        if not self.context.screen:
            self.context.screen = ${safePythonLiteral(program.entryScreenId ?? '')}

    async def dispatch(self, event_id: str, inputs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if inputs:
            self.context.inputs.update(inputs)

        handler = HANDLERS.get(event_id)
        if not handler:
            raise RuntimeError(f"Handler não encontrado para o evento: {event_id}")

        self.context.trace.append({
            "id": event_id,
            "label": "Evento",
            "message": f"Evento onClick disparado ({event_id})"
        })

        try:
            await handler(self.context)
            return {
                "success": True,
                "screen": self.context.screen,
                "messages": list(self.context.logs),
                "trace": list(self.context.trace),
                "outputs": dict(self.context.outputs),
                "store": self.context.store,
            }
        except Exception as err:
            return {
                "success": False,
                "screen": self.context.screen,
                "messages": list(self.context.logs),
                "trace": list(self.context.trace),
                "outputs": dict(self.context.outputs),
                "store": self.context.store,
                "error": str(err),
            }

    def get_state(self, key: Optional[str] = None) -> Any:
        if key is not None:
            return self.context.store.get(key)
        return self.context.store

    def get_screen(self) -> Optional[str]:
        return self.context.screen

    def get_trace(self) -> List[Dict[str, Any]]:
        return list(self.context.trace)

    def get_notifications(self) -> List[Any]:
        return list(self.context.notifications)

    def get_logs(self) -> List[str]:
        return list(self.context.logs)
`;

  stmts.push({ type: 'raw', code: classCode.trim() });

  // Fábrica create_program
  stmts.push({
    type: 'raw',
    code: `def create_program(options: Optional[Dict[str, Any]] = None) -> FlowForgeProgram:
    return FlowForgeProgram(options)`,
  });

  // CLI runner
  const cliRunner = `
if __name__ == "__main__":
    import sys
    async def _cli_main():
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        event_id = payload.get("eventId", "")
        inputs = payload.get("inputs")
        fast_delay = bool(payload.get("fastDelay", True))
        opts = {"fastDelay": fast_delay}
        init_store = payload.get("store")
        if isinstance(init_store, dict):
            opts["store"] = init_store
        prog = create_program(opts)
        init_screen = payload.get("screen")
        if init_screen:
            prog.context.screen = init_screen
        res = await prog.dispatch(event_id, inputs)
        print(json.dumps(res, ensure_ascii=False))
    asyncio.run(_cli_main())
`;

  stmts.push({ type: 'raw', code: cliRunner.trim() });

  const header = `# Auto-generated by FlowForge Python Backend
# FlowForge ProgramIR compilation
from __future__ import annotations
import asyncio
import json
import re
from typing import Any, Dict, List, Optional
`;

  const codeBody = emitProgram([{ type: 'raw', code: PYTHON_EMBEDDED_RUNTIME.trim() }, ...stmts]);

  return `${header}\n${codeBody}\n`;
}
