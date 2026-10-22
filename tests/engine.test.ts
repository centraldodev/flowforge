import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, run, validate, parseGraph, getBlockPorts, type Graph } from '../src/engine';
import { createBlock, addPortToBlock, removePortFromBlock } from '../src/state/graphOps';
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
test('função executa código personalizado com dados conectados e contexto', () => {
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
        data: {
          kind: 'function',
          label: 'M',
          config: { code: 'return Number(value) * 3;' },
        },
      },
    ],
    edges: [{ id: 'd', source: 'x', target: 'm', sourceHandle: 'value', targetHandle: 'value' }],
  };
  assert.equal(run(g, 'm').outputs.m, 21);
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

test('funções em cadeia: transformação, validação e persistência em memória', () => {
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
    name: 'Pipeline de Funções',
    nodes: [
      block('inputVal', 'input', { value: 'demo@exemplo.com', screenId: '' }),
      block('start', 'button', {}),
      block('validate', 'condition', { operator: 'truthy' }),
      block('upper', 'function', { code: 'return String(value).toUpperCase();' }),
      block('save', 'function', { code: 'store["user"] = [value]; return value;' }),
    ],
    edges: [
      edge('inputVal', 'validate', 'value', 'value'),
      edge('start', 'validate', 'next', 'exec'),
      edge('validate', 'upper', 'true', 'exec'),
      edge('inputVal', 'upper', 'value', 'value'),
      edge('upper', 'save', 'next', 'exec'),
      edge('upper', 'save', 'value', 'value'),
    ],
  };
  const store: Record<string, unknown[]> = {};
  const r = run(g, 'start', {}, store);
  assert.equal(r.outputs.validate, true);
  assert.equal(store['user'][0], 'DEMO@EXEMPLO.COM');
});

test('condição avalia valores e função limpa sessão', () => {
  const g: Graph = {
    version: 1,
    name: 'cond',
    nodes: [
      {
        id: 'val',
        position: { x: 0, y: 0 },
        data: { kind: 'input', label: 'Val', config: { value: '' } },
      },
      {
        id: 'rule',
        position: { x: 0, y: 0 },
        data: { kind: 'condition', label: 'Tem valor?', config: { operator: 'truthy' } },
      },
      {
        id: 'logout',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Sair',
          config: { code: 'delete store.__session; return true;' },
        },
      },
    ],
    edges: [
      { id: 'a', source: 'val', target: 'rule', sourceHandle: 'value', targetHandle: 'value' },
    ],
  };
  assert.equal(run(g, 'rule').outputs.rule, false);
  assert.equal(run(g, 'rule', { val: 'teste' }).outputs.rule, true);
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

test('novos blocos iniciam sem portas e suportam adição/remoção dinâmica de conexões', () => {
  const newBlock = createBlock('button', { x: 0, y: 0 }, '');
  assert.deepEqual(newBlock.data.ports, []);
  assert.deepEqual(getBlockPorts(newBlock), { inputs: [], outputs: [] });

  let g: Graph = {
    version: 1,
    name: 'custom-ports-test',
    nodes: [newBlock],
    edges: [],
  };

  g = addPortToBlock(g, newBlock.id, { id: 'next', name: 'next', direction: 'output' });
  g = addPortToBlock(g, newBlock.id, { id: 'value', name: 'value', direction: 'output' });

  const updated = g.nodes.find((n) => n.id === newBlock.id)!;
  assert.equal(updated.data.ports?.length, 2);
  assert.deepEqual(getBlockPorts(updated), { inputs: [], outputs: ['next', 'value'] });

  g.edges.push({
    id: 'e1',
    source: newBlock.id,
    target: newBlock.id,
    sourceHandle: 'next',
    targetHandle: 'exec',
  });

  g = removePortFromBlock(g, newBlock.id, 'next');
  const afterRemove = g.nodes.find((n) => n.id === newBlock.id)!;
  assert.equal(afterRemove.data.ports?.length, 1);
  assert.deepEqual(getBlockPorts(afterRemove), { inputs: [], outputs: ['value'] });
  // O fio conectado à porta removida deve ter sido limpo automaticamente
  assert.equal(g.edges.length, 0);
});
