import type { ExprIR, InstructionIR, ProgramIR } from '../ir';
import { BUILTIN_OPERATIONS } from './operations';
import type { ExecutionContext, ExecutionResult } from './types';

/** Avalia uma expressão da IR dentro do contexto de execução */
export async function evaluateExpr(
  expr: ExprIR,
  context: ExecutionContext,
  program: ProgramIR,
): Promise<unknown> {
  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'read_input':
      return context.inputs[expr.inputId] ?? '';

    case 'read_state':
      return context.store[expr.key];

    case 'read_var': {
      if (expr.name in context.variables) return context.variables[expr.name];
      if (expr.name in context.outputs) return context.outputs[expr.name];
      if (expr.name in context.store) return context.store[expr.name];
      if (expr.name in context.inputs) return context.inputs[expr.name];

      // Heurística de conveniência para 'value' quando não definido explicitamente
      if (expr.name === 'value') {
        const inputVals = Object.values(context.inputs);
        if (inputVals.length > 0) {
          return inputVals.every((v) => Boolean(v) && v !== '');
        }
      }
      return '';
    }

    case 'call_operation': {
      const args = await Promise.all(expr.args.map((a) => evaluateExpr(a, context, program)));
      if (expr.operation in BUILTIN_OPERATIONS) {
        return BUILTIN_OPERATIONS[expr.operation](...args);
      }
      if (context.adapters.legacyFunction) {
        return context.adapters.legacyFunction.execute(expr.operation, args, context);
      }
      return true;
    }

    case 'unary_op': {
      const val = await evaluateExpr(expr.expr, context, program);
      if (expr.op === 'not') return !val;
      if (expr.op === 'neg') return -Number(val);
      return val;
    }

    case 'binary_op': {
      const left = await evaluateExpr(expr.left, context, program);
      const right = await evaluateExpr(expr.right, context, program);

      switch (expr.op) {
        case 'eq':
          return String(left ?? '') === String(right ?? '');
        case 'neq':
          if (right === '') {
            return Boolean(left) && left !== '';
          }
          return String(left ?? '') !== String(right ?? '');
        case 'gt':
          return Number(left) > Number(right);
        case 'lt':
          return Number(left) < Number(right);
        case 'gte':
          return Number(left) >= Number(right);
        case 'lte':
          return Number(left) <= Number(right);
        case 'and':
          return Boolean(left) && Boolean(right);
        case 'or':
          return Boolean(left) || Boolean(right);
        case 'add':
          return typeof left === 'number' && typeof right === 'number'
            ? left + right
            : String(left ?? '') + String(right ?? '');
        case 'sub':
          return Number(left) - Number(right);
        case 'contains':
          return String(left ?? '').includes(String(right ?? ''));
      }
    }
  }
}

/** Executa uma lista sequencial de instruções da ProgramIR */
export async function executeInstructions(
  instructions: InstructionIR[],
  context: ExecutionContext,
  program: ProgramIR,
): Promise<void> {
  for (const inst of instructions) {
    if (context.signal?.aborted) {
      throw new Error('Execução cancelada pelo usuário.');
    }

    context.stepCount++;
    if (context.stepCount > context.maxSteps) {
      throw new Error(`Limite de ${context.maxSteps} passos excedido (possível ciclo infinito).`);
    }

    switch (inst.kind) {
      case 'invoke': {
        const step = program.steps.find((candidate) => candidate.blockId === inst.blockId);
        if (!step) throw new Error(`Fluxo não encontrado: ${inst.blockId}`);
        if (context.debugger) {
          await context.debugger.beforeStep(
            {
              blockId: step.blockId,
              blockKind: step.kind,
              blockLabel: step.label,
              message: `Executando ${step.label} (#${step.blockId})`,
            },
            context,
          );
        }
        await executeInstructions(step.instructions, context, program);
        if (context.debugger) {
          await context.debugger.afterStep(
            {
              blockId: step.blockId,
              blockKind: step.kind,
              blockLabel: step.label,
              message: `Concluído ${step.label} (#${step.blockId})`,
            },
            context,
          );
        }
        break;
      }
      case 'assign_state': {
        const val = await evaluateExpr(inst.value, context, program);
        context.store[inst.key] = val;
        context.outputs[inst.key] = val;
        context.trace.push({
          id: inst.key,
          label: 'Estado',
          message: `Estado [${inst.key}] atualizado: ${JSON.stringify(val)}`,
        });
        break;
      }

      case 'assign_var': {
        const val = await evaluateExpr(inst.value, context, program);
        context.variables[inst.name] = val;
        context.outputs[inst.name] = val;
        break;
      }

      case 'call_operation': {
        const evaluatedArgs = await Promise.all(
          inst.args.map((a) => evaluateExpr(a, context, program)),
        );

        let result: unknown;
        if (inst.operation in BUILTIN_OPERATIONS) {
          result = BUILTIN_OPERATIONS[inst.operation](...evaluatedArgs);
        } else if (context.adapters.legacyFunction) {
          result = await context.adapters.legacyFunction.execute(
            inst.operation,
            evaluatedArgs,
            context,
          );
        } else {
          result = evaluatedArgs[0] ?? true;
        }

        if (inst.targetVar) {
          context.variables[inst.targetVar] = result;
          context.outputs[inst.targetVar] = result;
        }
        context.variables['value'] = result;
        context.outputs['value'] = result;
        break;
      }

      case 'sequence': {
        await executeInstructions(inst.instructions, context, program);
        break;
      }

      case 'conditional': {
        const cond = await evaluateExpr(inst.condition, context, program);
        if (cond) {
          await executeInstructions(inst.thenBranch, context, program);
        } else if (inst.elseBranch && inst.elseBranch.length > 0) {
          await executeInstructions(inst.elseBranch, context, program);
        }
        break;
      }

      case 'switch': {
        const val = await evaluateExpr(inst.expr, context, program);
        const strVal = String(val ?? '');
        const matched = inst.cases.find((c) => String(c.value) === strVal);

        if (matched) {
          await executeInstructions(matched.branch, context, program);
        } else if (inst.defaultBranch && inst.defaultBranch.length > 0) {
          await executeInstructions(inst.defaultBranch, context, program);
        }
        break;
      }

      case 'return': {
        if (inst.value) {
          const retVal = await evaluateExpr(inst.value, context, program);
          context.variables['return'] = retVal;
        }
        return;
      }

      case 'navigate': {
        context.screen = inst.targetScreenId;
        context.trace.push({
          id: inst.targetScreenId,
          label: 'Navegação',
          message: `Navegando para ${inst.targetScreenId}`,
        });
        break;
      }

      case 'notify': {
        const msg = String(await evaluateExpr(inst.message, context, program));
        context.notifications.push({
          message: msg,
          type: inst.notifyType,
          duration: inst.duration,
        });
        const logMsg = `[${inst.notifyType.toUpperCase()}] ${msg}`;
        context.logs.push(logMsg);
        context.trace.push({
          id: 'notify',
          label: 'Notificação',
          message: logMsg,
        });
        break;
      }

      case 'delay': {
        await context.adapters.delay.execute(inst.durationMs, context.signal);
        context.trace.push({
          id: 'delay',
          label: 'Atraso',
          message: `Atraso / Timer de ${inst.durationMs}ms executado`,
        });
        break;
      }

      case 'try_catch': {
        try {
          await executeInstructions(inst.body, context, program);
        } catch (err) {
          if (inst.catchVar) {
            context.variables[inst.catchVar] = err;
            context.outputs[inst.catchVar] = err;
          }
          await executeInstructions(inst.catchBranch, context, program);
        }
        break;
      }

      case 'adapter_call': {
        const evaluatedPayload: Record<string, unknown> = {};
        for (const [k, expr] of Object.entries(inst.payload)) {
          evaluatedPayload[k] = await evaluateExpr(expr, context, program);
        }

        let res: unknown;
        if (inst.adapter === 'auth') {
          res = await context.adapters.auth.execute(inst.action, evaluatedPayload, context);
          context.trace.push({
            id: 'auth',
            label: 'Autenticação',
            message: `Autenticação (${inst.action}): sucesso`,
          });
        } else if (inst.adapter === 'database') {
          res = await context.adapters.database.execute(inst.action, evaluatedPayload, context);
          context.trace.push({
            id: 'database',
            label: 'Banco de Dados',
            message: `Banco de Dados (${inst.action}): concluído`,
          });
        } else if (inst.adapter === 'api') {
          res = await context.adapters.api.execute(inst.action, evaluatedPayload, context);
          context.trace.push({
            id: 'api',
            label: 'API',
            message: `API (${inst.action}): resposta recebida`,
          });
        } else if (inst.adapter === 'storage') {
          if (context.adapters.storage) {
            res = await context.adapters.storage.execute(inst.action, evaluatedPayload, context);
          } else {
            res = {
              success: true,
              fileUrl: 'https://storage.flowforge.dev/' + (evaluatedPayload.path || 'upload'),
            };
          }
          context.trace.push({
            id: 'storage',
            label: 'Armazenamento',
            message: `Armazenamento (${inst.action}): sucesso`,
          });
        } else if (inst.adapter === 'email') {
          if (context.adapters.email) {
            res = await context.adapters.email.execute(inst.action, evaluatedPayload, context);
          } else {
            res = { success: true, messageId: '<msg_' + Date.now() + '@flowforge.dev>' };
          }
          context.trace.push({
            id: 'email',
            label: 'E-mail',
            message: `E-mail (${inst.action}): enviado`,
          });
        } else if (inst.adapter === 'webhook') {
          if (context.adapters.webhook) {
            res = await context.adapters.webhook.execute(inst.action, evaluatedPayload, context);
          } else {
            res = { success: true, payload: evaluatedPayload };
          }
          context.trace.push({
            id: 'webhook',
            label: 'Webhook',
            message: `Webhook (${inst.action}): recebido`,
          });
        } else if (inst.adapter === 'task') {
          if (context.adapters.task) {
            res = await context.adapters.task.execute(inst.action, evaluatedPayload, context);
          } else {
            res = { success: true, taskId: evaluatedPayload.taskName || 'tarefa' };
          }
          context.trace.push({
            id: 'task',
            label: 'Tarefa',
            message: `Tarefa (${inst.action}): agendada`,
          });
        } else if (inst.adapter === 'payment') {
          if (context.adapters.payment) {
            res = await context.adapters.payment.execute(inst.action, evaluatedPayload, context);
          } else {
            res = {
              success: true,
              sessionId: 'cs_test_mock',
              checkoutUrl: 'https://checkout.stripe.com/pay/mock',
              status: 'pending',
            };
          }
          context.trace.push({
            id: 'payment',
            label: 'Pagamento',
            message: `Pagamento (${inst.action}): processado`,
          });
        } else if (inst.adapter === 'realtime') {
          if (context.adapters.realtime) {
            res = await context.adapters.realtime.execute(inst.action, evaluatedPayload, context);
          } else {
            res = {
              success: true,
              channel: evaluatedPayload.channel || 'general',
              delivered: true,
            };
          }
          context.trace.push({
            id: 'realtime',
            label: 'Tempo Real',
            message: `Tempo Real (${inst.action}): transmitido`,
          });
        }

        if (inst.targetVar) {
          context.variables[inst.targetVar] = res;
          context.outputs[inst.targetVar] = res;
        }
        break;
      }

      case 'call_subflow': {
        const evaluatedInputs: Record<string, unknown> = {};
        for (const [k, expr] of Object.entries(inst.inputs)) {
          evaluatedInputs[k] = await evaluateExpr(expr, context, program);
        }

        let res: unknown;
        if (context.adapters.subflow) {
          res = await context.adapters.subflow.execute(
            inst.subflowId,
            evaluatedInputs,
            context,
            inst.subflowDefinition,
          );
        } else {
          res = evaluatedInputs.input ?? Object.values(evaluatedInputs)[0];
        }

        const target = inst.targetVar || inst.subflowId;
        context.variables[target] = res;
        context.outputs[target] = res;
        context.variables['value'] = res;
        context.outputs['value'] = res;
        context.trace.push({
          id: inst.subflowId,
          label: 'Subfluxo',
          message: `Subfluxo [${inst.subflowId}] executado com sucesso`,
        });
        break;
      }
    }
  }
}

/**
 * Ponto de entrada assíncrono do interpretador da ProgramIR.
 * Executa o fluxo associado a um bloco ou handler de botão dentro de um ExecutionContext.
 */
export async function interpret(
  program: ProgramIR,
  entryId: string,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  try {
    let instructionsToRun: InstructionIR[] | undefined;

    // 1. Procura handler em tela
    for (const scr of program.screens) {
      if (scr.handlers[entryId]) {
        instructionsToRun = scr.handlers[entryId];
        context.trace.push({
          id: entryId,
          label: 'Botão',
          message: 'Evento onClick disparado',
        });
        break;
      }
    }

    // 2. Se não encontrou em handlers de tela, procura nos steps gerais
    if (!instructionsToRun) {
      const step = program.steps.find((s) => s.id === entryId || s.blockId === entryId);
      if (step) {
        instructionsToRun = step.instructions;
        context.trace.push({
          id: step.id,
          label: step.label,
          message: `Iniciando execução de ${step.label}`,
        });
      }
    }

    if (!instructionsToRun) {
      throw new Error(`Ponto de entrada não encontrado na IR: "${entryId}".`);
    }

    if (context.debugger && context.debugger.getState().status === 'idle') {
      context.debugger.startExecution(false);
    }

    await executeInstructions(instructionsToRun, context, program);

    context.debugger?.completeExecution();

    return {
      success: true,
      screen: context.screen,
      trace: context.trace,
      notifications: context.notifications,
      messages: context.logs,
      outputs: context.outputs,
      store: context.store,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    context.debugger?.failExecution(error);
    return {
      success: false,
      screen: context.screen,
      trace: context.trace,
      notifications: context.notifications,
      messages: context.logs,
      outputs: context.outputs,
      store: context.store,
      error,
    };
  }
}
