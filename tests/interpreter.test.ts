import test from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/engine/demo';
import { run } from '../src/engine/run';
import type { Block, Graph, Kind, Store } from '../src/engine/types';
import {
  compile,
  interpret,
  createExecutionContext,
  MockDelayAdapter,
  MockAuthAdapter,
  MockApiAdapter,
  MockDatabaseAdapter,
} from '../src/compiler';

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

function createGraph(nodes: Block[] = [], edges: Graph['edges'] = []): Graph {
  return {
    version: 1,
    name: 'Grafo de Teste do Interpretador',
    nodes,
    edges,
  };
}

// ============================================================================
// 1. EXECUÇÃO ASSÍNCRONA E INJEÇÃO DE DELAY
// ============================================================================

test('Fase 4: interpretador executa de forma assíncrona com delay mock rápido', async () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const del = makeBlock('del', 'delay', { duration: '200' });
  const not = makeBlock('not', 'notify', { message: 'Pronto após delay', type: 'info' });

  const graph = createGraph(
    [scr, btn, del, not],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'del', targetHandle: 'execute' },
      { id: 'e2', source: 'del', sourceHandle: 'next', target: 'not', targetHandle: 'execute' },
    ],
  );

  const compilation = compile(graph);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const context = createExecutionContext({
    adapters: {
      auth: new MockAuthAdapter(),
      api: new MockApiAdapter(),
      database: new MockDatabaseAdapter(),
      delay: new MockDelayAdapter(true), // fast mode
    },
  });

  const res = await interpret(compilation.value, 'btn', context);
  assert.equal(res.success, true);
  assert.ok(res.trace.some((t) => t.id === 'delay'));
  assert.ok(res.notifications.some((n) => n.message === 'Pronto após delay'));
});

// ============================================================================
// 2. CANCELAMENTO COM ABORTSIGNAL
// ============================================================================

test('Fase 4: abortSignal interrompe execução imediatamente com erro controlado', async () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const del = makeBlock('del', 'delay', { duration: '1000' });
  const not = makeBlock('not', 'notify', { message: 'Nunca executado' });

  const graph = createGraph(
    [scr, btn, del, not],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'del', targetHandle: 'execute' },
      { id: 'e2', source: 'del', sourceHandle: 'next', target: 'not', targetHandle: 'execute' },
    ],
  );

  const compilation = compile(graph);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const controller = new AbortController();
  const context = createExecutionContext({
    signal: controller.signal,
    adapters: {
      auth: new MockAuthAdapter(),
      api: new MockApiAdapter(),
      database: new MockDatabaseAdapter(),
      delay: new MockDelayAdapter(false), // delay real
    },
  });

  // Dispara o cancelamento logo após o início
  setTimeout(() => controller.abort(), 10);

  const res = await interpret(compilation.value, 'btn', context);
  assert.equal(res.success, false);
  assert.ok(res.error);
  assert.ok(res.error?.message.includes('cancelada'));
  assert.ok(!res.notifications.some((n) => n.message === 'Nunca executado'));
});

// ============================================================================
// 3. LIMITE DE PASSOS (PROTEÇÃO CONTRA CICLOS INFINITOS)
// ============================================================================

test('Fase 4: limite maxSteps é respeitado e evita estouro de execução', async () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const not1 = makeBlock('not1', 'notify', { message: 'A' });
  const not2 = makeBlock('not2', 'notify', { message: 'B' });
  const not3 = makeBlock('not3', 'notify', { message: 'C' });

  const graph = createGraph(
    [scr, btn, not1, not2, not3],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'not1', targetHandle: 'execute' },
      { id: 'e2', source: 'not1', sourceHandle: 'next', target: 'not2', targetHandle: 'execute' },
      { id: 'e3', source: 'not2', sourceHandle: 'next', target: 'not3', targetHandle: 'execute' },
    ],
  );

  const compilation = compile(graph);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const context = createExecutionContext({ maxSteps: 2 });
  const res = await interpret(compilation.value, 'btn', context);

  assert.equal(res.success, false);
  assert.ok(res.error?.message.includes('Limite de 2 passos excedido'));
});

// ============================================================================
// 4. SEMÂNTICA TRY/CATCH E ONERROR
// ============================================================================

test('Fase 4: erro em adaptador de autenticação é capturado pelo ramo onError na IR', async () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const auth = makeBlock('auth', 'auth', {
    mode: 'login',
    email: 'inexistente@exemplo.com',
    password: 'errada',
  });
  const errBlock = makeBlock('err', 'error', { message: 'Credenciais inválidas' });
  const successNot = makeBlock('ok', 'notify', { message: 'Autenticado com sucesso' });

  const graph = createGraph(
    [scr, btn, auth, errBlock, successNot],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'auth', targetHandle: 'trigger' },
      {
        id: 'e2',
        source: 'auth',
        sourceHandle: 'onSuccess',
        target: 'ok',
        targetHandle: 'execute',
      },
      { id: 'e3', source: 'auth', sourceHandle: 'onError', target: 'err', targetHandle: 'execute' },
    ],
  );

  const compilation = compile(graph);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const context = createExecutionContext();
  const res = await interpret(compilation.value, 'btn', context);

  assert.equal(res.success, true);
  // O ramo onError tratou a falha gerando a notificação de erro
  assert.ok(res.notifications.some((n) => n.type === 'error'));
  assert.ok(!res.notifications.some((n) => n.message === 'Autenticado com sucesso'));
});

// ============================================================================
// 5. EQUIVALÊNCIA ENTRE RUN LEGADO E INTERPRETADOR DA IR (PARIDADE)
// ============================================================================

test('Fase 4: equivalência demo - login com credenciais válidas navega para home', async () => {
  const storeLegado: Store = {};
  const values = {
    email: 'demo@exemplo.com',
    senha: '123456',
  };

  // 1. Execução legada
  const resLegado = run(demo, 'btn_entrar', values, storeLegado, 'login');
  assert.equal(resLegado.screen, 'home');
  assert.ok(storeLegado.__session);

  // 2. Execução IR
  const compilation = compile(demo);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const storeIR: Record<string, unknown> = {};
  const context = createExecutionContext({
    inputs: values,
    store: storeIR,
    screen: 'login',
  });

  const resIR = await interpret(compilation.value, 'btn_entrar', context);

  assert.equal(resIR.success, true);
  assert.equal(resIR.screen, 'home');
  assert.ok(storeIR.__session);
});

test('Fase 4: equivalência demo - login com senha incorreta segue ramo de erro', async () => {
  const storeLegado: Store = {};
  const values = {
    email: 'demo@exemplo.com',
    senha: 'senha_errada_123',
  };

  // 1. Execução legada
  const resLegado = run(demo, 'btn_entrar', values, storeLegado, 'login');
  assert.notEqual(resLegado.screen, 'home');
  assert.equal(storeLegado.__session, undefined);

  // 2. Execução IR
  const compilation = compile(demo);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const storeIR: Record<string, unknown> = {};
  const context = createExecutionContext({
    inputs: values,
    store: storeIR,
    screen: 'login',
  });

  const resIR = await interpret(compilation.value, 'btn_entrar', context);

  assert.equal(resIR.success, true);
  assert.notEqual(resIR.screen, 'home');
  assert.equal(storeIR.__session, undefined);
  assert.ok(resIR.notifications.some((n) => n.type === 'error'));
});

test('Fase 4: equivalência - cadastro de novo usuário grava no banco e permite login', async () => {
  const storeLegado: Store = {};
  const valuesCadastro = {
    email: 'novouser@teste.com',
    senha: 'password123',
  };

  const resLegado = run(demo, 'btn_cadastrar', valuesCadastro, storeLegado, 'login');
  assert.equal(resLegado.screen, 'home');
  assert.ok(storeLegado.__session);

  // Execução IR
  const compilation = compile(demo);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const storeIR: Record<string, unknown> = {};
  const context = createExecutionContext({
    inputs: valuesCadastro,
    store: storeIR,
    screen: 'login',
  });

  const resIR = await interpret(compilation.value, 'btn_cadastrar', context);
  assert.equal(resIR.success, true);
  assert.equal(resIR.screen, 'home');
  assert.ok(storeIR.__session);

  // Verifica que o novo usuário está na tabela do banco
  const usersTable = storeIR.usuarios as Array<{ email: string }>;
  assert.ok(usersTable.some((u) => u.email === 'novouser@teste.com'));
});

test('Fase 4: validador nativo executa sem new Function e ramifica corretamente', async () => {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const val = makeBlock('val', 'validator', { rule: 'email' });
  const okNot = makeBlock('ok', 'notify', { message: 'Email válido', type: 'success' });
  const badNot = makeBlock('bad', 'notify', { message: 'Email inválido', type: 'error' });

  const graph = createGraph(
    [scr, btn, val, okNot, badNot],
    [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'val', targetHandle: 'execute' },
      { id: 'e2', source: 'val', sourceHandle: 'valid', target: 'ok', targetHandle: 'execute' },
      { id: 'e3', source: 'val', sourceHandle: 'invalid', target: 'bad', targetHandle: 'execute' },
    ],
  );

  const compilation = compile(graph);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  // 1. Email válido
  const ctxValid = createExecutionContext({
    variables: { value: 'usuario@dominio.com' },
  });
  const resValid = await interpret(compilation.value, 'btn', ctxValid);
  assert.ok(resValid.notifications.some((n) => n.message === 'Email válido'));

  // 2. Email inválido
  const ctxInvalid = createExecutionContext({
    variables: { value: 'formato-invalido' },
  });
  const resInvalid = await interpret(compilation.value, 'btn', ctxInvalid);
  assert.ok(resInvalid.notifications.some((n) => n.message === 'Email inválido'));
});

// ============================================================================
// 6. ISOLAMENTO E DIAGNÓSTICO DE JAVASCRIPT LEGADO
// ============================================================================

test('Fase 4: função com JavaScript textual legado emite diagnóstico de aviso', () => {
  const scr = makeBlock('scr', 'screen');
  const fnLegacy = makeBlock('fn_old', 'function', {
    code: 'const x = 10; return x * 2;',
  });

  const graph = createGraph([scr, fnLegacy]);
  const compilation = compile(graph);

  assert.equal(compilation.ok, true); // avisos não impedem compilação
  const diag = compilation.diagnostics.find((d) => d.code === 'LEGACY_JAVASCRIPT_FUNCTION');
  assert.ok(diag, 'Deve registrar diagnóstico de código legado');
  assert.equal(diag.severity, 'warning');
  assert.equal(diag.nodeId, 'fn_old');
});
