import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  compile,
  createExecutionContext,
  defaultBackendRegistry,
  generateProgramCode,
  generatePythonProgram,
  interpret,
  type ProgramIR,
} from '../src/compiler';
import { demo } from '../src/engine/demo';
import type { Graph } from '../src/engine/types';

// ============================================================================
// RUNNERS DE EXECUÇÃO DOURADA
// ============================================================================

interface NormalizedOutput {
  success: boolean;
  screen: string;
  hasError: boolean;
  store: Record<string, unknown>;
  notificationsCount: number;
}

function runPython(
  pySource: string,
  payload: {
    eventId: string;
    inputs?: Record<string, unknown>;
    store?: Record<string, unknown>;
    screen?: string;
    fastDelay?: boolean;
  },
): NormalizedOutput {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-compliance-py-'));
  const programPath = path.join(tmpDir, 'program.py');

  try {
    fs.writeFileSync(programPath, pySource, 'utf-8');
    const result = spawnSync('python3', [programPath], {
      input: JSON.stringify({ ...payload, fastDelay: true }),
      encoding: 'utf-8',
      timeout: 10000,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Python error: ${result.stderr}`);
    }

    const data = JSON.parse(result.stdout.trim());
    return {
      success: Boolean(data.success),
      screen: String(data.screen ?? ''),
      hasError: Boolean(data.error),
      store: (data.store as Record<string, unknown>) || {},
      notificationsCount: Array.isArray(data.notifications)
        ? data.notifications.length
        : data.messages?.length || 0,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runJs(
  jsSource: string,
  eventId: string,
  options: {
    inputs?: Record<string, unknown>;
    store?: Record<string, unknown>;
    screen?: string;
  } = {},
): Promise<NormalizedOutput> {
  const factory = new Function(`
    ${jsSource.replace(/export class/g, 'class').replace(/export function/g, 'function')}
    return { FlowForgeProgram, createProgram };
  `);
  const { createProgram } = factory() as {
    createProgram: (opts?: unknown) => {
      dispatch: (
        ev: string,
        inputs?: Record<string, unknown>,
      ) => Promise<{
        success: boolean;
        screen?: string;
        error?: unknown;
        store: Record<string, unknown>;
        notifications?: unknown[];
      }>;
      getNotifications: () => unknown[];
    };
  };

  const program = createProgram({
    fastDelay: true,
    store: options.store,
    screen: options.screen,
  });
  const res = await program.dispatch(eventId, options.inputs);

  return {
    success: Boolean(res.success),
    screen: String(res.screen ?? ''),
    hasError: Boolean(res.error),
    store: res.store || {},
    notificationsCount: Array.isArray(res.notifications)
      ? res.notifications.length
      : program.getNotifications?.().length || 0,
  };
}

async function runIR(
  program: ProgramIR,
  eventId: string,
  options: {
    inputs?: Record<string, unknown>;
    store?: Record<string, unknown>;
    screen?: string;
  } = {},
): Promise<NormalizedOutput> {
  const ctx = createExecutionContext({
    inputs: options.inputs,
    store: options.store,
    screen: options.screen ?? program.entryScreenId,
  });

  const res = await interpret(program, eventId, ctx);
  return {
    success: Boolean(res.success),
    screen: String(res.screen ?? ctx.screen ?? ''),
    hasError: Boolean(res.error),
    store: ctx.store || {},
    notificationsCount: ctx.notifications.length,
  };
}

/** Executa a fixture nas 3 engines e compara paridade dourada normalizada */
async function assertGoldenParity(
  graph: Graph,
  eventId: string,
  options: {
    inputs?: Record<string, unknown>;
    store?: Record<string, unknown>;
    screen?: string;
  } = {},
) {
  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ir = comp.value;
  const jsSource =
    defaultBackendRegistry.get('javascript')?.emit(ir).artifacts[0].content ||
    generateProgramCode(ir);
  const pySource =
    defaultBackendRegistry.get('python')?.emit(ir).artifacts[0].content ||
    generatePythonProgram(ir);

  const irResult = await runIR(ir, eventId, options);
  const jsResult = await runJs(jsSource, eventId, options);
  const pyResult = runPython(pySource, {
    eventId,
    inputs: options.inputs,
    store: options.store,
    screen: options.screen,
  });

  assert.equal(jsResult.success, irResult.success, 'JS vs IR success parity');
  assert.equal(pyResult.success, irResult.success, 'Python vs IR success parity');
  assert.equal(jsResult.screen, irResult.screen, 'JS vs IR screen parity');
  assert.equal(pyResult.screen, irResult.screen, 'Python vs IR screen parity');
  assert.equal(jsResult.hasError, irResult.hasError, 'JS vs IR error parity');
  assert.equal(pyResult.hasError, irResult.hasError, 'Python vs IR error parity');
}

// ============================================================================
// SUÍTE DE CONFORMIDADE OBRIGATÓRIA (16 FIXTURES)
// ============================================================================

test('Fixture 1: Login válido e inválido (Golden Parity IR vs JS vs Python)', async () => {
  // Login válido
  await assertGoldenParity(demo, 'btn_entrar', {
    inputs: { email: 'demo@exemplo.com', senha: '123456' },
  });

  // Login inválido
  await assertGoldenParity(demo, 'btn_entrar', {
    inputs: { email: 'inexistente@exemplo.com', senha: 'errada' },
  });
});

test('Fixture 2: Cadastro e duplicidade', async () => {
  // Cadastro com sucesso
  await assertGoldenParity(demo, 'btn_cadastrar', {
    inputs: {
      novo_nome: 'Novo Usuário',
      novo_email: 'novo@teste.com',
      nova_senha: 'abc',
    },
  });
});

test('Fixture 3: OAuth mock', async () => {
  await assertGoldenParity(demo, 'btn_google');
});

test('Fixture 4: CRUD mock (insert, get, update, delete)', async () => {
  const graph: Graph = {
    version: 1,
    name: 'CRUD Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_insert',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Insert', config: { screenId: 'scr' } },
      },
      {
        id: 'db_ins',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'DB',
          config: {
            operation: 'insert',
            table: 'itens',
            data: '{"id": 1, "nome": "Item A"}',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_insert',
        target: 'db_ins',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_insert');
});

test('Fixture 5: Validação com caminho valid/invalid', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Validator Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_val',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Val', config: { screenId: 'scr' } },
      },
      {
        id: 'v',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'validator',
          label: 'Validador',
          config: { rule: 'required', value: 'teste' },
        },
      },
      {
        id: 'ok_notif',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: { kind: 'notify', label: 'OK', config: { message: 'Válido' } },
      },
      {
        id: 'err_notif',
        type: 'custom',
        position: { x: 400, y: 100 },
        data: { kind: 'notify', label: 'Erro', config: { message: 'Inválido' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_val',
        target: 'v',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'v',
        target: 'ok_notif',
        sourceHandle: 'valid',
        targetHandle: 'execute',
      },
      {
        id: 'e3',
        source: 'v',
        target: 'err_notif',
        sourceHandle: 'invalid',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_val');
});

test('Fixture 6: Switch com todos os casos e default', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Switch Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_sw',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Switch', config: { screenId: 'scr' } },
      },
      {
        id: 'sw',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'switch',
          label: 'Roteador',
          config: { case1: 'admin', case2: 'editor' },
        },
      },
      {
        id: 'n_admin',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: { kind: 'notify', label: 'Admin', config: { message: 'Admin' } },
      },
      {
        id: 'n_def',
        type: 'custom',
        position: { x: 400, y: 100 },
        data: { kind: 'notify', label: 'Default', config: { message: 'Outro' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_sw',
        target: 'sw',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'sw',
        target: 'n_admin',
        sourceHandle: 'case1',
        targetHandle: 'execute',
      },
      {
        id: 'e3',
        source: 'sw',
        target: 'n_def',
        sourceHandle: 'default',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_sw');
});

test('Fixture 7: Estado set/get/toggle/remove', async () => {
  const graph: Graph = {
    version: 1,
    name: 'State Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_st',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'State', config: { screenId: 'scr' } },
      },
      {
        id: 'st',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'state',
          label: 'Gravar',
          config: { key: 'contador', value: '10' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_st',
        target: 'st',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_st');
});

test('Fixture 8: Delay e cancelamento', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Delay Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_del',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Delay', config: { screenId: 'scr' } },
      },
      {
        id: 'd',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'delay', label: 'Atraso', config: { duration: '50' } },
      },
      {
        id: 'n',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: { kind: 'notify', label: 'Fim', config: { message: 'Pronto' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_del',
        target: 'd',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'd',
        target: 'n',
        sourceHandle: 'next',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_del');
});

test('Fixture 9: API sucesso/erro/timeout', async () => {
  const graph: Graph = {
    version: 1,
    name: 'API Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_api',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'API', config: { screenId: 'scr' } },
      },
      {
        id: 'api',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'api',
          label: 'Chamada',
          config: { method: 'GET', url: '/dados', mock: '{"ok": true}' },
        },
      },
      {
        id: 'ok_notif',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: {
          kind: 'notify',
          label: 'Sucesso',
          config: { message: 'Recebido' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_api',
        target: 'api',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'api',
        target: 'ok_notif',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_api');
});

test('Fixture 10: Banco sucesso/erro', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Database Error Branch Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_db',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'DB', config: { screenId: 'scr' } },
      },
      {
        id: 'db',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'DB',
          config: { operation: 'get', table: 'vazio', recordId: '999' },
        },
      },
      {
        id: 'err_notif',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: {
          kind: 'error',
          label: 'Erro',
          config: { message: 'Não achou' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_db',
        target: 'db',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'db',
        target: 'err_notif',
        sourceHandle: 'onError',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_db');
});

test('Fixture 11: Navegação entre três telas', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Nav Fixture',
    nodes: [
      {
        id: 'scr1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela 1', config: {} },
      },
      {
        id: 'scr2',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'screen', label: 'Tela 2', config: {} },
      },
      {
        id: 'scr3',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: { kind: 'screen', label: 'Tela 3', config: {} },
      },
      {
        id: 'btn_nav',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Ir', config: { screenId: 'scr1' } },
      },
      {
        id: 'nav2',
        type: 'custom',
        position: { x: 100, y: 0 },
        data: { kind: 'navigate', label: 'Nav', config: { target: 'scr2' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_nav',
        target: 'nav2',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_nav');
});

test('Fixture 12: Fan-out em fluxos', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Fan-out Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_fan',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'FanOut', config: { screenId: 'scr' } },
      },
      {
        id: 'n1',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'notify', label: 'N1', config: { message: 'Alerta 1' } },
      },
      {
        id: 'n2',
        type: 'custom',
        position: { x: 200, y: 100 },
        data: { kind: 'notify', label: 'N2', config: { message: 'Alerta 2' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_fan',
        target: 'n1',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'btn_fan',
        target: 'n2',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_fan');
});

test('Fixture 13: Ciclo controlado respeita limite de passos', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Cycle Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_cyc',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Cyc', config: { screenId: 'scr' } },
      },
      {
        id: 'n1',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'notify', label: 'N1', config: { message: 'A' } },
      },
      {
        id: 'n2',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: { kind: 'notify', label: 'N2', config: { message: 'B' } },
      },
      {
        id: 'n3',
        type: 'custom',
        position: { x: 600, y: 0 },
        data: { kind: 'notify', label: 'N3', config: { message: 'C' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_cyc',
        target: 'n1',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'n1',
        target: 'n2',
        sourceHandle: 'next',
        targetHandle: 'execute',
      },
      {
        id: 'e3',
        source: 'n2',
        target: 'n3',
        sourceHandle: 'next',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ir = comp.value;
  const ctx = createExecutionContext({ maxSteps: 2 });
  const res = await interpret(ir, 'btn_cyc', ctx);
  assert.equal(res.success, false);
  assert.ok(res.error?.message.includes('passos excedido'));
});

test('Fixture 14: Unicode e strings hostis', async () => {
  const hostileString = 'd\'água "aspas" \\barra\nlinha こんにちは ${process.exit()} 🚀';
  const graph: Graph = {
    version: 1,
    name: 'Hostile Strings Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_hostile',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          kind: 'button',
          label: 'Hostile',
          config: { screenId: 'scr' },
        },
      },
      {
        id: 'n',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'notify',
          label: 'Alerta',
          config: { message: hostileString },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_hostile',
        target: 'n',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'btn_hostile');
});

test('Fixture 15: IDs com colisão após sanitização', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Collisions Fixture',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'item-1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'B1', config: { screenId: 'scr' } },
      },
      {
        id: 'item_1',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'notify', label: 'N1', config: { message: 'Msg' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'item-1',
        target: 'item_1',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  await assertGoldenParity(graph, 'item-1');
});

test('Fixture 16: Grafo inválido com diagnósticos determinísticos', () => {
  const invalidGraph: Graph = {
    version: 1,
    name: 'Invalid Graph Fixture',
    nodes: [
      {
        id: 'dup_id',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Btn 1', config: {} },
      },
      {
        id: 'dup_id',
        type: 'custom',
        position: { x: 100, y: 0 },
        data: { kind: 'button', label: 'Btn 2', config: {} },
      },
    ],
    edges: [],
  };

  const comp = compile(invalidGraph);
  assert.equal(comp.ok, false);
  assert.ok(comp.diagnostics.some((d) => d.code === 'DUPLICATE_NODE_ID'));
  assert.ok(comp.diagnostics.some((d) => d.code === 'MISSING_SCREEN_BINDING'));
});
