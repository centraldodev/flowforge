import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, run, validate, parseGraph, getBlockPorts, type Graph } from '../src/engine';
import {
  createBlock,
  addPortToBlock,
  removePortFromBlock,
  validateBlockId,
  renameBlockId,
  generateUniqueBlockId,
  duplicateBlock,
  connect,
  connectionError,
} from '../src/state/graphOps';
test('login válido navega para início; senha inválida segue ramo falso', () => {
  assert.equal(validate(demo).length, 0);
  const r = run(demo, 'btn-login', { email: 'demo@exemplo.com', password: '123456' });
  assert.equal(r.screen, 'home');
  assert.equal(r.outputs.auth, true);
  assert.equal(
    run(demo, 'btn-login', { email: 'demo@exemplo.com', password: 'errada' }).screen,
    undefined,
  );
});
test('cadastro local é reutilizado no login e rejeita duplicação', () => {
  const g: Graph = {
    version: 1,
    name: 'auth-reg',
    nodes: [
      { id: 'signup', position: { x: 0, y: 0 }, data: { kind: 'button', label: 'Cadastrar', config: {} } },
      { id: 'register', position: { x: 0, y: 0 }, data: { kind: 'auth', label: 'Reg', config: { provider: 'email', mode: 'register' } } },
      { id: 'enter', position: { x: 0, y: 0 }, data: { kind: 'button', label: 'Entrar', config: {} } },
      { id: 'login', position: { x: 0, y: 0 }, data: { kind: 'auth', label: 'Login', config: { provider: 'email', mode: 'login' } } },
    ],
    edges: [
      { id: 'e1', source: 'signup', target: 'register', sourceHandle: 'onClick', targetHandle: 'trigger' },
      { id: 'e2', source: 'enter', target: 'login', sourceHandle: 'onClick', targetHandle: 'trigger' },
    ],
  };
  const store = {};
  const values = { email: 'nova@exemplo.com', password: '654321' };
  assert.equal(run(g, 'signup', values, store).outputs.register, true);
  assert.equal(run(g, 'enter', values, store).outputs.login, true);
  assert.equal(run(g, 'signup', values, store).outputs.register, false);
});
test('OAuth e recuperação são simulações', () => {
  const g: Graph = {
    version: 1,
    name: 'oauth-sim',
    nodes: [
      { id: 'google', position: { x: 0, y: 0 }, data: { kind: 'button', label: 'Google', config: {} } },
      { id: 'oauth', position: { x: 0, y: 0 }, data: { kind: 'auth', label: 'OAuth', config: { provider: 'google', mode: 'login' } } },
      { id: 'nav', position: { x: 0, y: 0 }, data: { kind: 'navigate', label: 'Nav', config: { target: 'home' } } },
      { id: 'forgot', position: { x: 0, y: 0 }, data: { kind: 'button', label: 'Forgot', config: {} } },
      { id: 'reset', position: { x: 0, y: 0 }, data: { kind: 'function', label: 'Reset', config: { code: 'return String(read("email")).includes("@");' } } },
    ],
    edges: [
      { id: 'e1', source: 'google', target: 'oauth', sourceHandle: 'onClick', targetHandle: 'trigger' },
      { id: 'e2', source: 'oauth', target: 'nav', sourceHandle: 'onSuccess', targetHandle: 'execute' },
      { id: 'e3', source: 'forgot', target: 'reset', sourceHandle: 'onClick', targetHandle: 'execute' },
    ],
  };
  assert.equal(run(g, 'google').screen, 'home');
  assert.equal(run(g, 'forgot', { email: 'x@y.com' }).outputs.reset, true);
  assert.equal(run(g, 'forgot', { email: 'invalido' }).outputs.reset, false);
});
test('ciclos não travam interpretador', () => {
  const g = structuredClone(demo);
  g.edges.push({
    id: 'cycle',
    source: 'home',
    target: 'btn-login',
    sourceHandle: 'then',
    targetHandle: 'onClick',
  });
  assert.throws(
    () => run(g, 'btn-login', { email: 'demo@exemplo.com', password: '123456' }),
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

test('transições de tela: rotas configuradas na tela realizam transição de tela', () => {
  const g = structuredClone(demo);
  g.nodes.find((n) => n.id === 'login')!.data.config.routes = JSON.stringify([
    { id: 'r1', trigger: 'auth', when: 'true', target: 'home' },
  ]);
  const store: Record<string, unknown[]> = {};
  const success = run(
    g,
    'btn-login',
    { email: 'demo@exemplo.com', password: '123456' },
    store,
    'login',
  );
  assert.equal(success.screen, 'home');
  assert.ok(store.__session);
  assert.ok(success.trace.at(-1)?.message.startsWith('Transição'));
  assert.equal(
    run(g, 'btn-login', { email: 'demo@exemplo.com', password: 'erro' }, store, 'login').screen,
    undefined,
  );
});
test('transição false e limite de tela de origem', () => {
  const g = structuredClone(demo);
  g.nodes.find((n) => n.id === 'login')!.data.config.routes = JSON.stringify([
    { id: 'failed', trigger: 'auth', when: 'false', target: 'home' },
  ]);
  assert.equal(run(g, 'btn-login', { email: 'x', password: 'x' }, {}).screen, 'home');
  assert.equal(run(g, 'btn-login', { email: 'x', password: 'x' }, {}, 'home').screen, undefined);
});
test('validação detecta destino inexistente, evento de outra tela e condições sobrepostas', () => {
  const g = structuredClone(demo);
  const page = g.nodes.find((n) => n.id === 'login')!;
  page.data.config.routes = JSON.stringify([
    { id: 'a', trigger: 'home', when: 'true', target: 'missing' },
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

test('validação de ID do bloco: impede duplicados, vazios e formatos inválidos', () => {
  const g = structuredClone(demo);
  // Rejeita vazio
  assert.equal(validateBlockId(g, 'auth', '').valid, false);
  assert.equal(validateBlockId(g, 'auth', '   ').valid, false);

  // Rejeita espaços
  assert.equal(validateBlockId(g, 'auth', 'meu bloco').valid, false);

  // Rejeita início com número ou caracteres inválidos
  assert.equal(validateBlockId(g, 'auth', '123auth').valid, false);
  assert.equal(validateBlockId(g, 'auth', 'auth@user').valid, false);

  // Rejeita IDs duplicados existentes no projeto (case-insensitive)
  assert.equal(validateBlockId(g, 'auth', 'home').valid, false);
  assert.equal(validateBlockId(g, 'auth', 'HOME').valid, false);
  assert.ok(validateBlockId(g, 'auth', 'home').error?.includes('já está em uso'));

  // Aceita o mesmo ID (sem alterações)
  assert.equal(validateBlockId(g, 'auth', 'auth').valid, true);

  // Aceita novo ID único e válido
  assert.equal(validateBlockId(g, 'auth', 'auth_usuario_v2').valid, true);
  assert.equal(validateBlockId(g, 'auth', 'login-auth').valid, true);
});

test('renomeação atômica de ID propaga para conexões, rotas e telas dependentes', () => {
  let g = structuredClone(demo);

  // Renomear o botão 'btn-login' para 'btn_entrar'
  g = renameBlockId(g, 'btn-login', 'btn_entrar');
  assert.ok(g.nodes.some((n) => n.id === 'btn_entrar'));
  assert.ok(!g.nodes.some((n) => n.id === 'btn-login'));

  // Todas as conexões que partiam de 'btn-login' agora devem partir de 'btn_entrar'
  assert.ok(g.edges.some((e) => e.source === 'btn_entrar' && e.target === 'auth'));
  assert.ok(!g.edges.some((e) => e.source === 'btn-login'));

  // Renomear a tela 'home' para 'tela_principal'
  g = renameBlockId(g, 'home', 'tela_principal');
  assert.ok(g.nodes.some((n) => n.id === 'tela_principal'));
  assert.ok(!g.nodes.some((n) => n.id === 'home'));

  // As conexões de navegação direta que apontavam para 'home' agora apontam para 'tela_principal'
  assert.ok(g.edges.some((e) => e.target === 'tela_principal'));
  assert.ok(!g.edges.some((e) => e.target === 'home'));

  // Não deve permitir renomear se o destino já existir
  const beforeAttempt = g;
  const afterAttempt = renameBlockId(g, 'auth', 'tela_principal');
  assert.equal(afterAttempt, beforeAttempt);
});

test('bloco de tratamento de erro captura falha, expõe msg e emite onDismiss', () => {
  const g: Graph = {
    version: 1,
    name: 'err-test',
    nodes: [
      { id: 'btn', position: { x: 0, y: 0 }, data: { kind: 'button', label: 'Disparar', config: {} } },
      { id: 'err', position: { x: 0, y: 0 }, data: { kind: 'error', label: 'Alerta', config: { message: 'Erro crítico detectado', type: 'modal' } } },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'err', sourceHandle: 'onClick', targetHandle: 'execute' },
    ],
  };
  const res = run(g, 'btn');
  const errOutput = res.outputs.err as { error: boolean; msg: string; message: string; type: string };
  assert.equal(errOutput.error, true);
  assert.equal(errOutput.msg, 'Erro crítico detectado');
  assert.equal(errOutput.message, 'Erro crítico detectado');
  assert.equal(errOutput.type, 'modal');
});

test('simulação do fluxo real de erro: executa retry para re-testar função e detecta persistência da falha', () => {
  assert.equal(validate(demo).length, 0);

  // Execução com senha errada: auth falha -> show-error trata erro -> retry tenta de novo -> auth falha -> show-error encerra
  const res = run(demo, 'btn-login', { email: 'demo@exemplo.com', password: 'senha-incorreta' });
  
  // Telas não devem navegar pois credenciais falharam
  assert.equal(res.screen, undefined);

  // Saída do bloco de erro deve conter o objeto e mensagem tratados
  const errOut = res.outputs['show-error'] as { error: boolean; msg: string };
  assert.equal(errOut.error, true);
  assert.equal(errOut.msg, 'E-mail ou senha incorretos. Verifique suas credenciais.');

  // Verifica o trace completo da simulação do ciclo de erro e retry
  const traceLabels = res.trace.map((t) => t.id);
  assert.deepEqual(traceLabels, [
    'btn-login',
    'auth',
    'show-error',
    'auth',
    'show-error',
  ]);

  // Primeiro disparo do erro indica tentativa 1 de re-execução via retry
  assert.ok(res.trace[2].message.includes('Tentativa 1/1 de re-execução via retry'));
  // Segundo disparo após a re-execução indica que o erro persistiu e encerra com segurança
  assert.ok(res.trace[4].message.includes('Erro persistiu após re-execução'));
});

test('geração de IDs únicos e legíveis para novos blocos e duplicações', () => {
  const g = structuredClone(demo);

  const b1 = createBlock('function', { x: 0, y: 0 }, '', g);
  assert.equal(b1.id, 'function_1');

  g.nodes.push(b1);
  const b2 = createBlock('function', { x: 0, y: 0 }, '', g);
  assert.equal(b2.id, 'function_2');

  const copy = duplicateBlock(b1, g);
  assert.equal(copy.id, 'function_1_copy');
});

test('conexões com termos reais da programação: Lado A (onClick, then, onSuccess) conecta a Lado B (listenerClick, listener, handler)', () => {
  const btn = createBlock('button', { x: 0, y: 0 }, '');
  const fn = createBlock('function', { x: 100, y: 0 }, '');
  fn.data.config.code = 'return "clicado com sucesso";';

  let g: Graph = {
    version: 1,
    name: 'event-listener-test',
    nodes: [btn, fn],
    edges: [],
  };

  // Lado A: onClick (output) no botão
  g = addPortToBlock(g, btn.id, { id: 'onClick', name: 'onClick', direction: 'output' });
  // Lado B: listenerClick (input) na função
  g = addPortToBlock(g, fn.id, { id: 'listenerClick', name: 'listenerClick', direction: 'input' });
  // Saída de retorno
  g = addPortToBlock(g, fn.id, { id: 'result', name: 'result', direction: 'output' });

  // Conectar onClick (Lado A) com listenerClick (Lado B)
  const connection = {
    source: btn.id,
    sourceHandle: 'onClick',
    target: fn.id,
    targetHandle: 'listenerClick',
  };
  assert.equal(connectionError(connection), null);

  g = connect(g, connection);
  assert.equal(g.edges.length, 1);

  // Executar a partir do botão
  const r = run(g, btn.id);
  assert.equal(r.outputs[fn.id], 'clicado com sucesso');

  // Tentar conectar evento (onClick) com porta de dados (value) deve gerar erro
  const badConnection = {
    source: btn.id,
    sourceHandle: 'onClick',
    target: fn.id,
    targetHandle: 'value',
  };
  assert.ok(connectionError(badConnection)?.includes('eventos'));
});
