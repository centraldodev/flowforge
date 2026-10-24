import test from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/engine/demo';
import type { Block, Graph, Kind } from '../src/engine/types';
import { compile, analyze, normalizeGraph, type ProgramIR } from '../src/compiler';

// Auxiliar para criar grafos mínimos válidos de teste
function createMinimalGraph(nodes: Block[] = [], edges: Graph['edges'] = []): Graph {
  return {
    version: 1,
    name: 'Grafo de Teste',
    nodes,
    edges,
  };
}

function makeBlock(
  id: string,
  kind: Kind,
  config: Record<string, string> = {},
  label?: string,
): Block {
  return {
    id,
    type: 'block',
    position: { x: 0, y: 0 },
    data: {
      kind,
      label: label || id,
      config,
    },
  };
}

// ============================================================================
// 1. COMPILAÇÃO DO PROJETO DEMO & SNAPSHOT ESTRUTURAL DA IR
// ============================================================================

test('Fase 3: projeto demo compila com sucesso para ProgramIR sem erros impeditivos', () => {
  const result = compile(demo);

  assert.equal(result.ok, true, 'Compilação do demo deve ter sucesso');
  if (!result.ok) return;

  const program: ProgramIR = result.value;

  // Estrutura raiz
  assert.equal(program.version, 1);
  assert.equal(program.name, demo.name);
  assert.equal(program.entryScreenId, 'login');
  assert.ok(program.screens.length >= 2, 'Deve conter ao menos as telas login e home');

  // Telas estruturadas
  const loginScreen = program.screens.find((s) => s.id === 'login');
  assert.ok(loginScreen, 'Tela login deve existir na IR');
  assert.ok(
    loginScreen.handlers['btn_entrar'],
    'Handler do botão btn_entrar deve estar registrado na tela login',
  );

  // Steps
  assert.equal(program.steps.length, demo.nodes.length);
  const authStep = program.steps.find((s) => s.id === 'auth_login');
  assert.ok(authStep);
  assert.equal(authStep.kind, 'auth');

  // Verificação profunda: A IR não pode conter código textual arbitrário nem JSX
  function verifyNoRawJsOrJsx(obj: unknown, path = 'root'): void {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        assert.ok(
          !val.includes('function(') &&
            !val.includes('eval(') &&
            !val.includes('React.') &&
            !val.startsWith('<') &&
            !val.endsWith('/>'),
          `IR não pode conter fragmentos JSX ou JS arbitrário em ${path}.${key}: "${val}"`,
        );
      } else if (typeof val === 'object') {
        verifyNoRawJsOrJsx(val, `${path}.${key}`);
      }
    }
  }

  verifyNoRawJsOrJsx(program);
});

// ============================================================================
// 2. MATRIZ DE COMPILAÇÃO PARA TODOS OS 15 KIND
// ============================================================================

test('Fase 3: todos os 15 tipos de blocos geram IR semântica válida', () => {
  const allKinds: Kind[] = [
    'screen',
    'button',
    'input',
    'function',
    'condition',
    'auth',
    'database',
    'api',
    'error',
    'navigate',
    'notify',
    'state',
    'validator',
    'switch',
    'delay',
  ];

  // Grafo abrangendo todos os 15 tipos
  const screenNode = makeBlock('scr_main', 'screen', { title: 'Tela Principal' });
  const buttonNode = makeBlock('btn_go', 'button', { screenId: 'scr_main' });
  const inputNode = makeBlock('inp_user', 'input', {
    screenId: 'scr_main',
    field: 'username',
  });
  const funcNode = makeBlock('fn_proc', 'function');
  const condNode = makeBlock('cond_check', 'condition', { target: 'admin' });
  const valNode = makeBlock('val_email', 'validator', { rule: 'email' });
  const swNode = makeBlock('sw_route', 'switch', { case1: 'opt1', case2: 'opt2' });
  const delayNode = makeBlock('del_pause', 'delay', { duration: '500' });
  const authNode = makeBlock('auth_op', 'auth', { mode: 'login' });
  const dbNode = makeBlock('db_op', 'database', { table: 'users', operation: 'query' });
  const apiNode = makeBlock('api_op', 'api', { url: '/items', method: 'GET' });
  const errNode = makeBlock('err_op', 'error', { message: 'Falha grave' });
  const notNode = makeBlock('not_op', 'notify', {
    message: 'Sucesso',
    type: 'success',
    duration: '2000',
  });
  const navNode = makeBlock('nav_op', 'navigate', { target: 'scr_main' });
  const stateNode = makeBlock('st_op', 'state', { key: 'token' });

  const testGraph = createMinimalGraph([
    screenNode,
    buttonNode,
    inputNode,
    funcNode,
    condNode,
    valNode,
    swNode,
    delayNode,
    authNode,
    dbNode,
    apiNode,
    errNode,
    notNode,
    navNode,
    stateNode,
  ]);

  const result = compile(testGraph);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const program = result.value;

  // Garante que cada um dos 15 tipos possui step gerado
  for (const kind of allKinds) {
    const step = program.steps.find((s) => s.kind === kind);
    assert.ok(step, `Bloco do tipo ${kind} deve estar presente nos steps da IR`);
    assert.ok(Array.isArray(step.instructions));
  }

  // Verifica lowering específico por conceito:
  // 1. screen -> navigate
  const scrStep = program.steps.find((s) => s.id === 'scr_main')!;
  assert.equal(scrStep.instructions[0]?.kind, 'navigate');

  // 2. input -> assign_state com read_input
  const inpStep = program.steps.find((s) => s.id === 'inp_user')!;
  assert.equal(inpStep.instructions[0]?.kind, 'assign_state');
  if (inpStep.instructions[0]?.kind === 'assign_state') {
    assert.equal(inpStep.instructions[0].key, 'username');
    assert.equal(inpStep.instructions[0].value.kind, 'read_input');
  }

  // 3. function -> call_operation
  const fnStep = program.steps.find((s) => s.id === 'fn_proc')!;
  assert.equal(fnStep.instructions[0]?.kind, 'call_operation');

  // 4. condition -> conditional
  const condStep = program.steps.find((s) => s.id === 'cond_check')!;
  assert.equal(condStep.instructions[0]?.kind, 'conditional');

  // 5. validator -> conditional com validação
  const valStep = program.steps.find((s) => s.id === 'val_email')!;
  assert.equal(valStep.instructions[0]?.kind, 'conditional');

  // 6. switch -> switch
  const swStep = program.steps.find((s) => s.id === 'sw_route')!;
  assert.equal(swStep.instructions[0]?.kind, 'switch');

  // 7. delay -> delay
  const delStep = program.steps.find((s) => s.id === 'del_pause')!;
  assert.equal(delStep.instructions[0]?.kind, 'delay');
  if (delStep.instructions[0]?.kind === 'delay') {
    assert.equal(delStep.instructions[0].durationMs, 500);
  }

  // 8. auth -> adapter_call
  const authStep = program.steps.find((s) => s.id === 'auth_op')!;
  assert.equal(authStep.instructions[0]?.kind, 'adapter_call');
  if (authStep.instructions[0]?.kind === 'adapter_call') {
    assert.equal(authStep.instructions[0].adapter, 'auth');
  }

  // 9. database -> adapter_call
  const dbStep = program.steps.find((s) => s.id === 'db_op')!;
  assert.equal(dbStep.instructions[0]?.kind, 'adapter_call');
  if (dbStep.instructions[0]?.kind === 'adapter_call') {
    assert.equal(dbStep.instructions[0].adapter, 'database');
  }

  // 10. api -> adapter_call
  const apiStep = program.steps.find((s) => s.id === 'api_op')!;
  assert.equal(apiStep.instructions[0]?.kind, 'adapter_call');
  if (apiStep.instructions[0]?.kind === 'adapter_call') {
    assert.equal(apiStep.instructions[0].adapter, 'api');
  }

  // 11. error -> notify error
  const errStep = program.steps.find((s) => s.id === 'err_op')!;
  assert.equal(errStep.instructions[0]?.kind, 'notify');
  if (errStep.instructions[0]?.kind === 'notify') {
    assert.equal(errStep.instructions[0].notifyType, 'error');
  }

  // 12. notify -> notify
  const notStep = program.steps.find((s) => s.id === 'not_op')!;
  assert.equal(notStep.instructions[0]?.kind, 'notify');
  if (notStep.instructions[0]?.kind === 'notify') {
    assert.equal(notStep.instructions[0].notifyType, 'success');
    assert.equal(notStep.instructions[0].duration, 2000);
  }

  // 13. navigate -> navigate
  const navStep = program.steps.find((s) => s.id === 'nav_op')!;
  assert.equal(navStep.instructions[0]?.kind, 'navigate');
  if (navStep.instructions[0]?.kind === 'navigate') {
    assert.equal(navStep.instructions[0].targetScreenId, 'scr_main');
  }

  // 14. state -> assign_state
  const stStep = program.steps.find((s) => s.id === 'st_op')!;
  assert.equal(stStep.instructions[0]?.kind, 'assign_state');
  if (stStep.instructions[0]?.kind === 'assign_state') {
    assert.equal(stStep.instructions[0].key, 'token');
  }
});

// ============================================================================
// 3. FLUXO DE CONTROLE: TRY/CATCH E CADEIA DE INSTRUÇÕES
// ============================================================================

test('Fase 3: conexão onError em blocos de operação gera try_catch na IR', () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const db = makeBlock('db', 'database', { table: 'items' });
  const errBlock = makeBlock('err', 'error', { message: 'Erro no banco' });
  const okNotify = makeBlock('not', 'notify', { message: 'Sucesso', type: 'success' });

  const graph = createMinimalGraph(
    [scr, btn, db, errBlock, okNotify],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'db', targetHandle: 'execute' },
      { id: 'e2', source: 'db', sourceHandle: 'onSuccess', target: 'not', targetHandle: 'execute' },
      { id: 'e3', source: 'db', sourceHandle: 'onError', target: 'err', targetHandle: 'execute' },
    ],
  );

  const res = compile(graph);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const btnStep = res.value.steps.find((s) => s.id === 'btn')!;
  const tryCatchInst = btnStep.instructions.find((i) => i.kind === 'try_catch');
  assert.ok(tryCatchInst, 'Deve conter instrução try_catch');
  if (tryCatchInst && tryCatchInst.kind === 'try_catch') {
    assert.equal(tryCatchInst.catchVar, 'error');
    assert.ok(tryCatchInst.catchBranch.some((i) => i.kind === 'notify'));
  }
});

// ============================================================================
// 4. DIAGNÓSTICOS PARA GRAFOS INVÁLIDOS & RETORNO CONTROLADO DE RESULT
// ============================================================================

test('Fase 3: grafo inválido por estrutura corrompida retorna Result.ok === false com diagnóstico', () => {
  const res = compile(null as unknown as Graph);
  assert.equal(res.ok, false);
  assert.equal(res.diagnostics.length, 1);
  assert.equal(res.diagnostics[0].code, 'INVALID_GRAPH_STRUCTURE');
  assert.equal(res.diagnostics[0].severity, 'error');
});

test('Fase 3: IDs duplicados geram diagnóstico de erro DUPLICATE_NODE_ID com nodeId', () => {
  const n1 = makeBlock('dup_id', 'screen');
  const n2 = makeBlock('dup_id', 'screen');
  const graph = createMinimalGraph([n1, n2]);

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'DUPLICATE_NODE_ID');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'dup_id');
});

test('Fase 3: bloco de interface sem screenId gera MISSING_SCREEN_BINDING', () => {
  const btn = makeBlock('btn_lost', 'button', {}); // sem screenId
  const graph = createMinimalGraph([btn]);

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'MISSING_SCREEN_BINDING');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'btn_lost');
});

test('Fase 3: navigate para tela inexistente gera MISSING_NAVIGATE_TARGET', () => {
  const scr = makeBlock('scr', 'screen');
  const nav = makeBlock('nav', 'navigate', { target: 'scr_inexistente' });
  const graph = createMinimalGraph([scr, nav]);

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'MISSING_NAVIGATE_TARGET');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'nav');
});

test('Fase 3: mock com JSON inválido gera INVALID_MOCK_JSON', () => {
  const scr = makeBlock('scr', 'screen');
  const api = makeBlock('api', 'api', { mock: '{ invalido: sem_aspas }' });
  const graph = createMinimalGraph([scr, api]);

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'INVALID_MOCK_JSON');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'api');
});

test('Fase 3: conexão com porta inexistente gera UNKNOWN_PORT com nodeId e portId', () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const fn = makeBlock('fn', 'function');

  const graph = createMinimalGraph(
    [scr, btn, fn],
    [
      {
        id: 'bad_edge',
        source: 'btn',
        sourceHandle: 'porta_fantasma',
        target: 'fn',
        targetHandle: 'execute',
      },
    ],
  );

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'UNKNOWN_PORT');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'btn');
  assert.equal(diag.portId, 'porta_fantasma');
});

test('Fase 3: incompatibilidade de tipos de dados gera TYPE_MISMATCH', () => {
  const scr = makeBlock('scr', 'screen');
  const inpNumber = makeBlock('inp_num', 'input', { screenId: 'scr' });
  // Customiza a porta value para emitir 'number'
  inpNumber.data.ports = [
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      valueType: { kind: 'number' },
      cardinality: 'many',
    },
  ];

  const condNode = makeBlock('cond', 'condition');
  // Customiza a porta input de cond para requerer 'boolean'
  condNode.data.ports = [
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      valueType: { kind: 'boolean' },
      cardinality: 'one',
    },
  ];

  const graph = createMinimalGraph(
    [scr, inpNumber, condNode],
    [
      {
        id: 'mismatch_edge',
        source: 'inp_num',
        sourceHandle: 'value',
        target: 'cond',
        targetHandle: 'value',
      },
    ],
  );

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'TYPE_MISMATCH');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'inp_num');
  assert.equal(diag.portId, 'value');
});

test('Fase 3: excesso de conexões em porta cardinality: one gera CARDINALITY_EXCEEDED', () => {
  const scr = makeBlock('scr', 'screen');
  const btn1 = makeBlock('btn1', 'button', { screenId: 'scr' });
  const btn2 = makeBlock('btn2', 'button', { screenId: 'scr' });
  const condNode = makeBlock('cond', 'condition');
  // cond.execute tem cardinality: 'one'
  condNode.data.ports = [
    {
      id: 'execute',
      name: 'execute',
      direction: 'input',
      mode: 'control',
      cardinality: 'one',
    },
  ];

  const graph = createMinimalGraph(
    [scr, btn1, btn2, condNode],
    [
      {
        id: 'e1',
        source: 'btn1',
        sourceHandle: 'onClick',
        target: 'cond',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'btn2',
        sourceHandle: 'onClick',
        target: 'cond',
        targetHandle: 'execute',
      },
    ],
  );

  const res = compile(graph);
  assert.equal(res.ok, false);
  const diag = res.diagnostics.find((d) => d.code === 'CARDINALITY_EXCEEDED');
  assert.ok(diag);
  assert.equal(diag.severity, 'error');
  assert.equal(diag.nodeId, 'cond');
  assert.equal(diag.portId, 'execute');
});

test('Fase 3: todos os diagnósticos gerados possuem code, severity, message e campos semânticos', () => {
  const badGraph = createMinimalGraph([
    makeBlock('node_a', 'screen'),
    makeBlock('node_a', 'button'), // duplicado e sem screenId
  ]);

  const diags = analyze(normalizeGraph(badGraph));
  assert.ok(diags.length >= 2);

  for (const d of diags) {
    assert.ok(typeof d.code === 'string' && d.code.length > 0, 'code deve existir');
    assert.ok(
      d.severity === 'error' || d.severity === 'warning' || d.severity === 'info',
      'severity deve ser válida',
    );
    assert.ok(typeof d.message === 'string' && d.message.length > 0, 'message deve existir');
  }
});
