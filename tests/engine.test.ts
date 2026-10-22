import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, run, validate, parseGraph, type Graph } from '../src/engine';
test('login válido navega para início; senha inválida segue ramo falso', () => {
  assert.equal(validate(demo).length, 0);
  const r = run(demo, 'enter', { email: 'demo@exemplo.com', password: '123456' });
  assert.equal(r.screen, 'home');
  assert.equal(r.outputs.auth, true);
  assert.equal(
    run(demo, 'enter', { email: 'demo@exemplo.com', password: 'errada' }).screen,
    undefined,
  );
});
test('cadastro local é reutilizado no login e rejeita duplicação', () => {
  const store = {};
  const values = { email: 'nova@exemplo.com', password: '654321' };
  assert.equal(run(demo, 'signup', values, store).outputs.register, true);
  assert.equal(run(demo, 'enter', values, store).outputs.auth, true);
  assert.equal(run(demo, 'signup', values, store).outputs.register, false);
});
test('OAuth e recuperação são simulações', () => {
  assert.equal(run(demo, 'google').screen, 'home');
  assert.equal(run(demo, 'forgot', { email: 'x@y.com' }).outputs.reset, true);
  assert.equal(run(demo, 'forgot', { email: 'invalido' }).outputs.reset, false);
});
test('ciclos não travam interpretador', () => {
  const g = structuredClone(demo);
  g.nodes.filter((n) => n.data.kind === 'screen').forEach((n) => (n.data.config.routes = '[]'));
  g.edges.push({
    id: 'cycle',
    source: 'home',
    target: 'enter',
    sourceHandle: 'next',
    targetHandle: 'exec',
  });
  assert.throws(
    () => run(g, 'enter', { email: 'demo@exemplo.com', password: '123456' }),
    /100 passos/,
  );
});
test('JSON estrutural inválido é rejeitado', () => {
  assert.throws(() => parseGraph('{}'));
  assert.equal(parseGraph(JSON.stringify(demo)).nodes.length, demo.nodes.length);
});
test('matemática usa dados conectados e erro de divisão por zero', () => {
  const g: Graph = {
    version: 1,
    name: 'calc',
    nodes: [
      {
        id: 'x',
        position: { x: 0, y: 0 },
        data: { kind: 'input', label: 'X', config: { value: '7', screenId: 's' } },
      },
      { id: 's', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'S', config: {} } },
      {
        id: 'm',
        position: { x: 0, y: 0 },
        data: { kind: 'math', label: 'M', config: { operation: 'multiply', a: '1', b: '3' } },
      },
    ],
    edges: [{ id: 'd', source: 'x', target: 'm', sourceHandle: 'value', targetHandle: 'a' }],
  };
  assert.equal(run(g, 'm').outputs.m, 21);
  g.nodes[2].data.config = { operation: 'divide', a: '3', b: '0' };
  assert.throws(() => run(g, 'm'), /zero/);
});
test('validação detecta referência a tela excluída e ligação incompatível', () => {
  const g = structuredClone(demo);
  g.nodes = g.nodes.filter((n) => n.id !== 'login');
  assert.ok(validate(g).some((e) => e.includes('tela')));
  g.edges.push({
    id: 'bad',
    source: 'email',
    target: 'auth',
    sourceHandle: 'value',
    targetHandle: 'exec',
  });
  assert.ok(validate(g).some((e) => e.includes('dados')));
});

test('novos blocos: constantes, validação, transformação, variável e mensagem', () => {
  const block = (id: string, kind: any, config: Record<string, string>) => ({
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: id, config },
  });
  const edge = (source: string, target: string, sourceHandle: string, targetHandle: string) => ({
    id: source + target + sourceHandle,
    source,
    target,
    sourceHandle,
    targetHandle,
  });
  const g: Graph = {
    version: 1,
    name: 'Novos blocos',
    nodes: [
      block('value', 'constant', { valueType: 'text', value: 'demo@exemplo.com' }),
      block('start', 'button', {}),
      block('validation', 'validation', { rule: 'email' }),
      block('upper', 'transform', { operation: 'upper', value: '', suffix: '' }),
      block('save', 'variable', { key: 'email', operation: 'set', value: '' }),
      block('message', 'notify', { message: 'Concluído' }),
    ],
    edges: [
      edge('value', 'validation', 'value', 'value'),
      edge('start', 'validation', 'next', 'exec'),
      edge('validation', 'upper', 'true', 'exec'),
      edge('value', 'upper', 'value', 'value'),
      edge('upper', 'save', 'next', 'exec'),
      edge('upper', 'save', 'value', 'value'),
      edge('save', 'message', 'next', 'exec'),
      edge('save', 'message', 'value', 'value'),
    ],
  };
  const store: Record<string, unknown[]> = {};
  const r = run(g, 'start', {}, store);
  assert.equal(r.outputs.validation, true);
  assert.equal(store['variable:email'][0], 'DEMO@EXEMPLO.COM');
  assert.deepEqual(r.messages, ['DEMO@EXEMPLO.COM']);
  g.nodes[0].data.config.value = 'inválido';
  assert.equal(run(g, 'start').trace.length, 2);
});
test('checkbox fornece booleano e logout limpa a sessão', () => {
  const g: Graph = {
    version: 1,
    name: 'checkbox',
    nodes: [
      {
        id: 'check',
        position: { x: 0, y: 0 },
        data: { kind: 'checkbox', label: 'Termos', config: { value: 'false' } },
      },
      {
        id: 'rule',
        position: { x: 0, y: 0 },
        data: { kind: 'condition', label: 'Aceitou?', config: { operator: 'truthy' } },
      },
      {
        id: 'logout',
        position: { x: 0, y: 0 },
        data: { kind: 'logout', label: 'Sair', config: {} },
      },
    ],
    edges: [
      { id: 'a', source: 'check', target: 'rule', sourceHandle: 'value', targetHandle: 'value' },
    ],
  };
  assert.equal(run(g, 'rule').outputs.rule, false);
  assert.equal(run(g, 'rule', { check: 'true' }).outputs.rule, true);
  const store = { __session: [{ user: 1 }] };
  run(g, 'logout', {}, store);
  assert.equal(store.__session, undefined);
});

test('transições de tela: autenticação válida abre início e logout volta a login', () => {
  const store: Record<string, unknown[]> = {};
  const success = run(
    demo,
    'enter',
    { email: 'demo@exemplo.com', password: '123456' },
    store,
    'login',
  );
  assert.equal(success.screen, 'home');
  assert.ok(store.__session);
  assert.ok(success.trace.at(-1)?.message.startsWith('Transição'));
  assert.equal(run(demo, 'logout-button', {}, store, 'home').screen, 'login');
  assert.equal(store.__session, undefined);
  assert.equal(
    run(demo, 'enter', { email: 'demo@exemplo.com', password: 'erro' }, store, 'login').screen,
    undefined,
  );
});
test('transição false e limite de tela de origem', () => {
  const g = structuredClone(demo);
  g.nodes.find((n) => n.id === 'login')!.data.config.routes = JSON.stringify([
    { id: 'failed', trigger: 'auth', when: 'false', target: 'home' },
  ]);
  assert.equal(run(g, 'enter', { email: 'x', password: 'x' }, {}).screen, 'home');
  assert.equal(run(g, 'enter', { email: 'x', password: 'x' }, {}, 'home').screen, undefined);
});
test('validação detecta destino inexistente, evento de outra tela e condições sobrepostas', () => {
  const g = structuredClone(demo);
  const page = g.nodes.find((n) => n.id === 'login')!;
  page.data.config.routes = JSON.stringify([
    { id: 'a', trigger: 'logout-action', when: 'true', target: 'missing' },
  ]);
  assert.ok(validate(g).some((e) => e.includes('destino')));
  assert.ok(validate(g).some((e) => e.includes('botão desta tela')));
  page.data.config.routes = JSON.stringify([
    { id: 'a', trigger: 'auth', when: 'true', target: 'home' },
    { id: 'b', trigger: 'auth', when: 'always', target: 'home' },
  ]);
  assert.ok(validate(g).some((e) => e.includes('sobrepostas')));
  page.data.config.routes = '{}';
  assert.throws(() => parseGraph(JSON.stringify(g)), /Transições/);
});
