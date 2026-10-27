import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demo,
  run,
  validate,
  parseGraph,
  getBlockPorts,
  generateBlockCode,
  generateProjectCode,
  executeProjectCode,
  syncGraphCode,
  type Graph,
  type Kind,
} from '../src/engine';
import {
  createBlock,
  addPortToBlock,
  removePortFromBlock,
  validateBlockId,
  renameBlockId,
  duplicateBlock,
  connect,
  connectionError,
  findFreePosition,
  MIN_BLOCK_DISTANCE_X,
  MIN_BLOCK_DISTANCE_Y,
  MIN_BLOCK_GAP,
  preventBlockCollision,
  organizeGraphByFlow,
  addFlowToGraph,
  removeFlowFromGraph,
  snapCoord,
} from '../src/state/graphOps';
import { fieldsFor, flowOptions } from '../src/features/inspector/blockFields';
import { getGraphFlows, resolveBlockFlow, GRID_SNAP_SIZE } from '../src/features/canvas/constants';
import { filterFlowElements, toFlowEdges, toFlowNodes } from '../src/features/canvas/toFlow';
test('login válido navega para início; senha inválida segue ramo falso', () => {
  assert.equal(validate(demo).length, 0);
  const r = run(demo, 'btn_entrar', {
    email: 'demo@exemplo.com',
    senha: '123456',
    password: '123456',
  });
  assert.equal(r.screen, 'home');
  assert.equal(r.outputs.auth_login, true);
  assert.equal(
    run(demo, 'btn_entrar', { email: 'demo@exemplo.com', senha: 'errada', password: 'errada' })
      .screen,
    undefined,
  );
});
test('cadastro local é reutilizado no login e rejeita duplicação', () => {
  const g: Graph = {
    version: 1,
    name: 'auth-reg',
    nodes: [
      {
        id: 'signup',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Cadastrar', config: {} },
      },
      {
        id: 'register',
        position: { x: 0, y: 0 },
        data: { kind: 'auth', label: 'Reg', config: { provider: 'email', mode: 'register' } },
      },
      {
        id: 'enter',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Entrar', config: {} },
      },
      {
        id: 'login',
        position: { x: 0, y: 0 },
        data: { kind: 'auth', label: 'Login', config: { provider: 'email', mode: 'login' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'signup',
        target: 'register',
        sourceHandle: 'onClick',
        targetHandle: 'trigger',
      },
      {
        id: 'e2',
        source: 'enter',
        target: 'login',
        sourceHandle: 'onClick',
        targetHandle: 'trigger',
      },
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
      {
        id: 'google',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Google', config: {} },
      },
      {
        id: 'oauth',
        position: { x: 0, y: 0 },
        data: { kind: 'auth', label: 'OAuth', config: { provider: 'google', mode: 'login' } },
      },
      {
        id: 'nav',
        position: { x: 0, y: 0 },
        data: { kind: 'navigate', label: 'Nav', config: { target: 'home' } },
      },
      {
        id: 'forgot',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Forgot', config: {} },
      },
      {
        id: 'reset',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Reset',
          config: { code: 'return String(read("email")).includes("@");' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'google',
        target: 'oauth',
        sourceHandle: 'onClick',
        targetHandle: 'trigger',
      },
      {
        id: 'e2',
        source: 'oauth',
        target: 'nav',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
      },
      {
        id: 'e3',
        source: 'forgot',
        target: 'reset',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
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
    target: 'btn_entrar',
    sourceHandle: 'then',
    targetHandle: 'onClick',
  });
  assert.throws(
    () => run(g, 'btn_entrar', { email: 'demo@exemplo.com', senha: '123456', password: '123456' }),
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
    target: 'auth_login',
    sourceHandle: 'value',
    targetHandle: 'exec',
  });
  assert.ok(validate(g).some((e) => e.includes('dados')));
});

test('funções em cadeia: transformação, validação e persistência em memória', () => {
  const block = (id: string, kind: Kind, config: Record<string, string>) => ({
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
    { id: 'r1', trigger: 'auth_login', when: 'true', target: 'home' },
  ]);
  const store: Record<string, unknown[]> = {};
  const success = run(
    g,
    'btn_entrar',
    { email: 'demo@exemplo.com', senha: '123456', password: '123456' },
    store,
    'login',
  );
  assert.equal(success.screen, 'home');
  assert.ok(store.__session);
  assert.ok(success.trace.at(-1)?.message.startsWith('Transição'));
  assert.equal(
    run(
      g,
      'btn_entrar',
      { email: 'demo@exemplo.com', senha: 'erro', password: 'erro' },
      store,
      'login',
    ).screen,
    undefined,
  );
});
test('transição false e limite de tela de origem', () => {
  const g = structuredClone(demo);
  g.nodes.find((n) => n.id === 'login')!.data.config.routes = JSON.stringify([
    { id: 'failed', trigger: 'auth_login', when: 'false', target: 'home' },
  ]);
  assert.equal(run(g, 'btn_entrar', { email: 'x', senha: 'x', password: 'x' }, {}).screen, 'home');
  assert.equal(
    run(g, 'btn_entrar', { email: 'x', senha: 'x', password: 'x' }, {}, 'home').screen,
    undefined,
  );
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
  assert.equal(validateBlockId(g, 'auth_login', '').valid, false);
  assert.equal(validateBlockId(g, 'auth_login', '   ').valid, false);

  // Rejeita espaços
  assert.equal(validateBlockId(g, 'auth_login', 'meu bloco').valid, false);

  // Rejeita início com número ou caracteres inválidos
  assert.equal(validateBlockId(g, 'auth_login', '123auth').valid, false);
  assert.equal(validateBlockId(g, 'auth_login', 'auth@user').valid, false);

  // Rejeita IDs duplicados existentes no projeto (case-insensitive)
  assert.equal(validateBlockId(g, 'auth_login', 'home').valid, false);
  assert.equal(validateBlockId(g, 'auth_login', 'HOME').valid, false);
  assert.ok(validateBlockId(g, 'auth_login', 'home').error?.includes('já está em uso'));

  // Aceita o mesmo ID (sem alterações)
  assert.equal(validateBlockId(g, 'auth_login', 'auth_login').valid, true);

  // Aceita novo ID único e válido
  assert.equal(validateBlockId(g, 'auth_login', 'auth_usuario_v2').valid, true);
  assert.equal(validateBlockId(g, 'auth_login', 'login-auth').valid, true);
});

test('renomeação atômica de ID propaga para conexões, rotas e telas dependentes', () => {
  let g = structuredClone(demo);

  // Renomear o botão 'btn_entrar' para 'btn_submit'
  g = renameBlockId(g, 'btn_entrar', 'btn_submit');
  assert.ok(g.nodes.some((n) => n.id === 'btn_submit'));
  assert.ok(!g.nodes.some((n) => n.id === 'btn_entrar'));

  // Todas as conexões que partiam de 'btn_entrar' agora devem partir de 'btn_submit'
  assert.ok(g.edges.some((e) => e.source === 'btn_submit' && e.target === 'validar_login'));
  assert.ok(!g.edges.some((e) => e.source === 'btn_entrar'));

  // Renomear a tela 'home' para 'tela_principal'
  g = renameBlockId(g, 'home', 'tela_principal');
  assert.ok(g.nodes.some((n) => n.id === 'tela_principal'));
  assert.ok(!g.nodes.some((n) => n.id === 'home'));

  // As conexões de navegação direta que apontavam para 'home' agora apontam para 'tela_principal'
  assert.ok(g.edges.some((e) => e.target === 'tela_principal'));
  assert.ok(!g.edges.some((e) => e.target === 'home'));

  // Não deve permitir renomear se o destino já existir
  const beforeAttempt = g;
  const afterAttempt = renameBlockId(g, 'auth_login', 'tela_principal');
  assert.equal(afterAttempt, beforeAttempt);
});

test('bloco de tratamento de erro captura falha, expõe msg e emite onDismiss', () => {
  const g: Graph = {
    version: 1,
    name: 'err-test',
    nodes: [
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Disparar', config: {} },
      },
      {
        id: 'err',
        position: { x: 0, y: 0 },
        data: {
          kind: 'error',
          label: 'Alerta',
          config: { message: 'Erro crítico detectado', type: 'modal' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'err', sourceHandle: 'onClick', targetHandle: 'execute' },
    ],
  };
  const res = run(g, 'btn');
  const errOutput = res.outputs.err as {
    error: boolean;
    msg: string;
    message: string;
    type: string;
  };
  assert.equal(errOutput.error, true);
  assert.equal(errOutput.msg, 'Erro crítico detectado');
  assert.equal(errOutput.message, 'Erro crítico detectado');
  assert.equal(errOutput.type, 'modal');
});

test('simulação do fluxo real de erro: executa retry para re-testar função e detecta persistência da falha', () => {
  assert.equal(validate(demo).length, 0);

  // Execução com senha errada: auth falha -> show_error trata erro -> retry tenta de novo -> auth falha -> show_error encerra
  const res = run(demo, 'btn_entrar', {
    email: 'demo@exemplo.com',
    senha: '123456',
    password: 'senha-incorreta',
  });

  // Telas não devem navegar pois credenciais falharam
  assert.equal(res.screen, undefined);

  // Saída do bloco de erro deve conter o objeto e mensagem tratados
  const errOut = res.outputs['show_error'] as { error: boolean; msg: string };
  assert.equal(errOut.error, true);
  assert.equal(errOut.msg, 'E-mail ou senha incorretos. Verifique suas credenciais.');

  // Verifica o trace completo da simulação do ciclo de validação, condição, autenticação, erro e retry
  const traceLabels = res.trace.map((t) => t.id);
  assert.deepEqual(traceLabels, [
    'btn_entrar',
    'validar_login',
    'checar_dados',
    'auth_login',
    'show_error',
    'validar_login',
    'checar_dados',
    'auth_login',
    'show_error',
  ]);

  // Primeiro disparo do erro indica tentativa 1 de re-execução via retry
  assert.ok(res.trace[4].message.includes('Tentativa 1/1 de re-execução via retry'));
  // Segundo disparo após a re-execução indica que o erro persistiu e encerra com segurança
  assert.ok(res.trace[8].message.includes('Erro persistiu após re-execução'));
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

test('ao adicionar bloco em uma aba ativa, o bloco vincula-se automaticamente àquela aba/tela', () => {
  const allKinds: Kind[] = [
    'button',
    'input',
    'function',
    'condition',
    'auth',
    'error',
    'database',
    'api',
    'navigate',
  ];

  // 1. Garante que todos os tipos de blocos (exceto screen) possuem o campo screenId (Pertence à tela)
  for (const k of allKinds) {
    const fields = fieldsFor(k);
    const hasScreenId = fields.some((f) => f.key === 'screenId');
    assert.equal(hasScreenId, true, `Bloco do tipo ${k} deve ter campo screenId no inspetor`);
  }
  assert.equal(
    fieldsFor('screen').some((f) => f.key === 'screenId'),
    false,
  );

  // 2. Cria grafo com duas telas: 'login' e 'home'
  const g: Graph = {
    version: 1,
    name: 'multi-tab-test',
    nodes: [
      {
        id: 'login',
        position: { x: 40, y: 40 },
        data: { kind: 'screen', label: 'Tela Login', config: {} },
      },
      {
        id: 'home',
        position: { x: 640, y: 40 },
        data: { kind: 'screen', label: 'Tela Home', config: {} },
      },
    ],
    edges: [],
  };

  // Simula adicionar bloco na aba 'home'
  const activeScreenTab = 'home';
  const pos = findFreePosition(g, { x: 100, y: 100 }, activeScreenTab);
  const newBlock = createBlock('function', pos, activeScreenTab, g);
  newBlock.data.config.screenId = activeScreenTab;
  g.nodes.push(newBlock);

  // O novo bloco deve estar explicitamente vinculado à aba 'home'
  assert.equal(newBlock.data.config.screenId, 'home');

  // Ao visualizar nós para a aba 'home', o bloco recém-criado deve estar visível
  const homeVisibleNodes = toFlowNodes(g, null, 'home');
  assert.equal(
    homeVisibleNodes.some((n) => n.id === newBlock.id),
    true,
  );

  // Ao mudar para a aba 'login', o bloco da aba 'home' NÃO deve ser exibido como bloco ativo de login
  const loginVisibleNodes = toFlowNodes(g, null, 'login');
  assert.equal(
    loginVisibleNodes.some((n) => n.id === newBlock.id),
    false,
  );
});

test('generateBlockCode gera funções JavaScript prontas com nomes derivados do ID e campos visíveis', () => {
  const kinds: Kind[] = [
    'screen',
    'input',
    'button',
    'function',
    'condition',
    'auth',
    'error',
    'api',
    'database',
    'navigate',
  ];

  for (const k of kinds) {
    const fields = fieldsFor(k);
    const codeField = fields.find((f) => f.key === 'code');
    if (k === 'api') assert.equal(codeField, undefined, 'API é configurada visualmente');
    else {
      assert.ok(codeField, `Bloco ${k} deve possuir o campo 'code'`);
      assert.equal(codeField?.label, 'Código');
      assert.equal(codeField?.area, true);
    }

    const b = createBlock(k, { x: 0, y: 0 }, 'screen_1');
    const directGenerated = generateBlockCode(demo, b);
    assert.ok(directGenerated.length > 0);
    assert.ok(
      b.data.config.code.includes(`function ${b.id}`) ||
        b.data.config.code.includes(`async function ${b.id}`),
      `Bloco ${k} deve gerar código de função nomeada com seu ID`,
    );
  }
});

test('conexões dinâmicas: conectar e desconectar blocos atualiza chamadas de função e parâmetros no código', () => {
  const btn = createBlock('button', { x: 0, y: 0 }, 'login');
  const fn = createBlock('function', { x: 200, y: 0 }, 'login');
  const cond = createBlock('condition', { x: 400, y: 0 }, 'login');
  const auth = createBlock('auth', { x: 600, y: 0 }, 'login');

  let g: Graph = {
    version: 1,
    name: 'dynamic-code-test',
    nodes: [btn, fn, cond, auth],
    edges: [],
  };

  // 1. Conecta o botão à função
  g = connect(g, {
    source: btn.id,
    target: fn.id,
    sourceHandle: 'onClick',
    targetHandle: 'listenerClick',
  });

  const updatedBtn = g.nodes.find((n) => n.id === btn.id)!;
  assert.ok(
    updatedBtn.data.config.code.includes(`return ${fn.id}();`),
    'Código do botão deve chamar a função conectada',
  );

  // 2. Conecta a função à condição
  g = connect(g, {
    source: fn.id,
    target: cond.id,
    sourceHandle: 'then',
    targetHandle: 'listener',
  });

  const updatedFn = g.nodes.find((n) => n.id === fn.id)!;
  assert.ok(
    updatedFn.data.config.code.includes(`return ${cond.id}(`),
    'Código da função deve chamar a condição conectada',
  );

  // 3. Conecta a condição (ramo true) à autenticação
  g = connect(g, {
    source: cond.id,
    target: auth.id,
    sourceHandle: 'true',
    targetHandle: 'trigger',
  });

  const updatedCond = g.nodes.find((n) => n.id === cond.id)!;
  assert.ok(
    updatedCond.data.config.code.includes(`return ${auth.id}(`),
    'Ramo true da condição deve chamar o bloco de autenticação',
  );
});

test('renomeação de ID atualiza a declaração e as chamadas dinâmicas em outros blocos', () => {
  const btn = createBlock('button', { x: 0, y: 0 }, 'login');
  const fn = createBlock('function', { x: 200, y: 0 }, 'login');

  let g: Graph = {
    version: 1,
    name: 'rename-code-test',
    nodes: [btn, fn],
    edges: [],
  };

  g = connect(g, {
    source: btn.id,
    target: fn.id,
    sourceHandle: 'onClick',
    targetHandle: 'listenerClick',
  });

  assert.ok(g.nodes.find((n) => n.id === btn.id)!.data.config.code.includes(`return ${fn.id}();`));

  // Renomeia a função
  const newFnId = 'validar_dados_usuario';
  g = renameBlockId(g, fn.id, newFnId);

  const renamedFn = g.nodes.find((n) => n.id === newFnId)!;
  assert.ok(
    renamedFn.data.config.code.includes(`function ${newFnId}`),
    'A declaração da função renomeada deve ter o novo nome',
  );

  const callerBtn = g.nodes.find((n) => n.id === btn.id)!;
  assert.ok(
    callerBtn.data.config.code.includes(`return ${newFnId}();`),
    'O chamador deve ter seu código atualizado para o novo nome da função',
  );
});

test('demo possui código JavaScript válido e sincronizado em todos os blocos do fluxo solicitado', () => {
  const synced = syncGraphCode(demo);
  assert.equal(synced.nodes.length, demo.nodes.length);

  for (const node of demo.nodes) {
    const code = node.data.config.code;
    assert.ok(code, `Bloco ${node.id} deve possuir código`);
    assert.ok(
      code.includes(`function ${node.id}`) || code.includes(`async function ${node.id}`),
      `Código do bloco ${node.id} deve declarar função com o seu ID`,
    );
  }

  // Valida conexões do exemplo do usuário
  const btnEntrar = demo.nodes.find((n) => n.id === 'btn_entrar')!;
  assert.ok(btnEntrar.data.config.code.includes('validar_login'));

  const validarLogin = demo.nodes.find((n) => n.id === 'validar_login')!;
  assert.ok(validarLogin.data.config.code.includes('checar_dados'));

  const checarDados = demo.nodes.find((n) => n.id === 'checar_dados')!;
  assert.ok(checarDados.data.config.code.includes('auth_login'));
  assert.ok(checarDados.data.config.code.includes('show_error'));

  const authLogin = demo.nodes.find((n) => n.id === 'auth_login')!;
  assert.ok(authLogin.data.config.code.includes('home'));
  assert.ok(authLogin.data.config.code.includes('show_error'));
});

test('demo: login com google oauth autentica com token fictício e salva no banco de dados', () => {
  const store: Record<string, unknown[]> = {};
  const res = run(demo, 'btn_google', {}, store);

  assert.equal(res.screen, 'home');
  assert.equal(res.outputs.auth_google, true);

  // Verifica persistência automática no banco de dados (tabela usuarios)
  const usuarios = store.usuarios as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(usuarios));
  const googleUser = usuarios.find((u) => u.email === 'google.teste@gmail.com');
  assert.ok(googleUser);
  assert.equal(googleUser?.provider, 'google');
  assert.equal(googleUser?.token, 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE');

  // Sessão ativa deve conter o usuário do Google
  assert.ok(store.__session);
  assert.equal(
    (store.__session as Array<Record<string, unknown>>)[0].email,
    'google.teste@gmail.com',
  );
});

test('demo: verificação de email existente no banco de dados bloqueia email inexistente e aceita credenciais válidas', () => {
  // 1. E-mail cadastrado no banco com senha correta -> Sucesso (vai para home)
  const validRes = run(demo, 'btn_entrar', {
    email: 'demo@exemplo.com',
    senha: '123456',
    password: '123456',
  });
  assert.equal(validRes.screen, 'home');
  assert.equal(validRes.outputs.auth_login, true);

  // 2. E-mail que NÃO existe no banco de dados -> Falha (capturado por show_error)
  const notFoundRes = run(demo, 'btn_entrar', {
    email: 'inexistente@empresa.com',
    senha: '123456',
    password: '123456',
  });
  assert.equal(notFoundRes.screen, undefined);
  assert.equal((notFoundRes.outputs.show_error as { error: boolean }).error, true);

  // 3. E-mail do Google existente no banco com a senha correspondente -> Sucesso
  const googleDbRes = run(demo, 'btn_entrar', {
    email: 'google.teste@gmail.com',
    senha: 'google_oauth_pass',
    password: 'google_oauth_pass',
  });
  assert.equal(googleDbRes.screen, 'home');
});

test('demo: cadastro de nova conta grava no banco de dados e permite login subsequente', () => {
  const store: Record<string, unknown[]> = {};

  // 1. Cadastra nova conta com e-mail e senha
  const regRes = run(
    demo,
    'btn_cadastrar',
    { email: 'maria.dev@empresa.com', senha: 'senhaForte123', password: 'senhaForte123' },
    store,
  );
  assert.equal(regRes.screen, 'home');
  assert.equal(regRes.outputs.cadastrar_usuario, true);

  // 2. Verifica se a conta foi gravada na tabela 'usuarios' do banco
  const usuarios = store.usuarios as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(usuarios));
  const newAccount = usuarios.find((u) => u.email === 'maria.dev@empresa.com');
  assert.ok(newAccount);
  assert.equal(newAccount?.senha, 'senhaForte123');

  // 3. Tenta fazer login com a conta recém-cadastrada -> Deve permitir login
  const loginRes = run(
    demo,
    'btn_entrar',
    { email: 'maria.dev@empresa.com', senha: 'senhaForte123', password: 'senhaForte123' },
    store,
  );
  assert.equal(loginRes.screen, 'home');
  assert.equal(loginRes.outputs.auth_login, true);

  // 4. Tentativa de cadastrar o mesmo e-mail novamente -> Rejeita duplicata
  const dupRes = run(
    demo,
    'btn_cadastrar',
    { email: 'maria.dev@empresa.com', senha: 'senhaForte123', password: 'senhaForte123' },
    store,
  );
  assert.equal(dupRes.screen, undefined);
  assert.equal((dupRes.outputs.show_error as { error: boolean }).error, true);
});

test('distâncias mínimas entre blocos: demo não possui blocos sobrepostos e respeita espaçamento seguro', () => {
  // Verifica pares de blocos pertencentes à mesma tela no demo
  const loginNodes = demo.nodes.filter(
    (n) => n.id === 'login' || n.data.config.screenId === 'login' || n.id === 'home',
  );

  for (let i = 0; i < loginNodes.length; i++) {
    for (let j = i + 1; j < loginNodes.length; j++) {
      const a = loginNodes[i];
      const b = loginNodes[j];
      const diffX = Math.abs(a.position.x - b.position.x);
      const diffY = Math.abs(a.position.y - b.position.y);

      // Blocos na mesma coluna (diffX < 200) devem respeitar a distância vertical mínima
      if (diffX < 200) {
        assert.ok(
          diffY >= 140,
          `Blocos na mesma coluna ${a.id} e ${b.id} devem ter distância vertical segura (atual: ${diffY}px)`,
        );
      } else {
        // Blocos em colunas adjacentes devem respeitar a distância horizontal mínima
        assert.ok(
          diffX >= MIN_BLOCK_DISTANCE_X || diffY >= 120,
          `Blocos ${a.id} e ${b.id} não podem colidir em X e Y (diffX: ${diffX}px, diffY: ${diffY}px)`,
        );
      }
    }
  }
});

test('prevenção de colisão: afasta blocos automaticamente quando soltos um em cima do outro', () => {
  const b1 = createBlock('input', { x: 400, y: 100 }, 'login');
  const b2 = createBlock('button', { x: 400, y: 120 }, 'login'); // Tentativa de sobrepor em Y (+20px)

  const nodes = [b1, b2];
  const adjusted = preventBlockCollision(nodes, b2.id);
  const adjustedB2 = adjusted.find((n) => n.id === b2.id)!;

  const diffY = Math.abs(adjustedB2.position.y - b1.position.y);
  assert.ok(
    diffY >= MIN_BLOCK_DISTANCE_Y,
    `Bloco sobreposto deve ser empurrado para além de MIN_BLOCK_DISTANCE_Y (atual: ${diffY}px)`,
  );
});

test('organizeGraphByFlow organiza qualquer grafo nas colunas de fases com espaçamento ordenado', () => {
  const disorganizedGraph: Graph = {
    version: 1,
    name: 'Disorganized',
    nodes: [
      {
        id: 'login',
        type: 'block',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Login', config: {} },
      },
      createBlock('auth', { x: 0, y: 0 }, 'login'),
      createBlock('input', { x: 0, y: 0 }, 'login'),
      createBlock('database', { x: 0, y: 0 }, 'login'),
      createBlock('function', { x: 0, y: 0 }, 'login'),
    ],
    edges: [],
  };

  const organized = organizeGraphByFlow(disorganizedGraph, 'login');
  const screenNode = organized.nodes.find((n) => n.data.kind === 'screen')!;
  const inputNode = organized.nodes.find((n) => n.data.kind === 'input')!;
  const fnNode = organized.nodes.find((n) => n.data.kind === 'function')!;
  const dbNode = organized.nodes.find((n) => n.data.kind === 'database')!;
  const authNode = organized.nodes.find((n) => n.data.kind === 'auth')!;

  // A sequência no eixo X deve seguir rigorosamente o fluxo: Tela < Inputs < Validação < Banco < Auth
  assert.ok(screenNode.position.x < inputNode.position.x);
  assert.ok(inputNode.position.x < fnNode.position.x);
  assert.ok(fnNode.position.x < dbNode.position.x);
  assert.ok(dbNode.position.x < authNode.position.x);

  // Espaçamento entre fases sucessivas deve ser no mínimo 380px
  assert.ok(inputNode.position.x - screenNode.position.x >= 380);
  assert.ok(fnNode.position.x - inputNode.position.x >= 380);
  assert.ok(dbNode.position.x - fnNode.position.x >= 380);
  assert.ok(authNode.position.x - dbNode.position.x >= 380);
});

test('fluxos dinâmicos: adicionar fluxo, vincular blocos nas propriedades, remover fluxo e resolver fases sem emojis', () => {
  let g: Graph = {
    version: 1,
    name: 'Test Flows',
    nodes: [],
    edges: [],
  };

  // 1. Sem emojis nos fluxos padrão
  const defaultFlows = getGraphFlows(g.flows);
  assert.ok(defaultFlows.length >= 6);
  const emojis = ['📱', '📝', '⚡', '🗄️', '🔐', '🎯', '📦'];
  for (const f of defaultFlows) {
    // Não deve conter emojis nos nomes dos fluxos
    assert.ok(
      !emojis.some((emoji) => f.name.includes(emoji)),
      `Fluxo ${f.name} não deve ter emoji`,
    );
  }

  // 2. Adicionar fluxo dinâmico
  g = addFlowToGraph(g, 'Processamento Assíncrono', '#ec4899');
  const customFlow = g.flows?.find((f) => f.name === 'Processamento Assíncrono');
  assert.ok(customFlow, 'Novo fluxo deve ser adicionado ao grafo');
  assert.equal(customFlow?.color, '#ec4899');

  // 3. flowOptions expõe os fluxos do projeto para o dropdown do inspetor
  const options = flowOptions(g);
  assert.ok(options.some((opt) => opt.value === customFlow?.id));

  // 4. Todas as tipologias de blocos suportam vínculo ao fluxo (flowId nas propriedades)
  const kinds: Kind[] = [
    'screen',
    'input',
    'button',
    'function',
    'condition',
    'auth',
    'database',
    'error',
    'navigate',
    'api',
  ];
  for (const k of kinds) {
    const fields = fieldsFor(k);
    assert.ok(
      fields.some((f) => f.key === 'flowId' && f.options === 'flows'),
      `Bloco ${k} deve ter o campo flowId com opções de fluxos nas propriedades`,
    );
  }

  // 5. Vincular bloco a um fluxo explicitamente (alterável depois)
  const block = createBlock('function', { x: 100, y: 100 }, 'login', g);
  block.data.config.flowId = customFlow.id;
  g.nodes.push(block);

  const resolved = resolveBlockFlow(g.flows!, block.data.kind, block.id, block.data.config.flowId);
  assert.equal(resolved.flow.id, customFlow.id);
  assert.equal(resolved.flow.name, 'Processamento Assíncrono');

  // 6. Alterar o vínculo do bloco para outro fluxo
  block.data.config.flowId = defaultFlows[0].id;
  const resolvedChanged = resolveBlockFlow(
    g.flows!,
    block.data.kind,
    block.id,
    block.data.config.flowId,
  );
  assert.equal(resolvedChanged.flow.id, defaultFlows[0].id);

  // 7. Remover fluxo desvincula os blocos que estavam associados a ele
  block.data.config.flowId = customFlow.id;
  g = removeFlowFromGraph(g, customFlow.id);
  assert.ok(
    !g.flows?.some((f) => f.id === customFlow.id),
    'Fluxo removido não deve constar em g.flows',
  );
  const blockAfterRemove = g.nodes.find((n) => n.id === block.id)!;
  assert.equal(
    blockAfterRemove.data.config.flowId,
    undefined,
    'Bloco deve ter flowId desvinculado ao remover o fluxo',
  );
});

test('alinhamento à grade magnética de alta precisão: blocos novos, duplicados e ajustados alinham-se rigorosamente a GRID_SNAP_SIZE (10px)', () => {
  assert.equal(GRID_SNAP_SIZE, 10);

  // 1. snapCoord arredonda para o múltiplo mais próximo de 10
  assert.equal(snapCoord(17), 20);
  assert.equal(snapCoord(23), 20);
  assert.equal(snapCoord(31), 30);
  assert.equal(snapCoord(0), 0);

  // 2. createBlock cria o bloco cravado na grade
  const block = createBlock('button', { x: 103, y: 198 }, 'login');
  assert.equal(block.position.x % GRID_SNAP_SIZE, 0, 'Posição X deve ser múltiplo de 10');
  assert.equal(block.position.y % GRID_SNAP_SIZE, 0, 'Posição Y deve ser múltiplo de 10');
  assert.equal(block.position.x, 100);
  assert.equal(block.position.y, 200);

  // 3. duplicateBlock mantém as coordenadas na grade
  const copy = duplicateBlock(block);
  assert.equal(copy.position.x % GRID_SNAP_SIZE, 0);
  assert.equal(copy.position.y % GRID_SNAP_SIZE, 0);

  // 4. findFreePosition retorna coordenadas na grade
  const g: Graph = { version: 1, name: 'GridTest', nodes: [block], edges: [] };
  const freePos = findFreePosition(g, { x: 101, y: 204 }, 'login');
  assert.equal(freePos.x % GRID_SNAP_SIZE, 0);
  assert.equal(freePos.y % GRID_SNAP_SIZE, 0);

  // 5. preventBlockCollision reposiciona mantendo alinhamento na grade
  const overlappingBlock = createBlock('input', { x: 100, y: 220 }, 'login');
  const adjusted = preventBlockCollision([block, overlappingBlock], overlappingBlock.id);
  const adjustedBlock = adjusted.find((n) => n.id === overlappingBlock.id)!;
  assert.equal(adjustedBlock.position.x % GRID_SNAP_SIZE, 0);
  assert.equal(adjustedBlock.position.y % GRID_SNAP_SIZE, 0);
});

test('prevenção de colisão em cascata: quando múltiplos blocos estão empilhados, encontra a próxima posição totalmente livre', () => {
  const b1 = createBlock('input', { x: 400, y: 100 }, 'login');
  const b2 = createBlock('button', { x: 400, y: 280 }, 'login');
  const b3 = createBlock('function', { x: 400, y: 460 }, 'login');

  // Tenta soltar um novo bloco exatamente onde b1 está
  const b4 = createBlock('state', { x: 400, y: 105 }, 'login');

  const nodes = [b1, b2, b3, b4];
  const adjusted = preventBlockCollision(nodes, b4.id);
  const adjustedB4 = adjusted.find((n) => n.id === b4.id)!;

  // Garante que não sobrepõe NENHUM dos 3 blocos existentes
  assert.ok(Math.abs(adjustedB4.position.y - b1.position.y) >= MIN_BLOCK_DISTANCE_Y);
  assert.ok(Math.abs(adjustedB4.position.y - b2.position.y) >= MIN_BLOCK_DISTANCE_Y);
  assert.ok(Math.abs(adjustedB4.position.y - b3.position.y) >= MIN_BLOCK_DISTANCE_Y);

  // Garante alinhamento rigoroso à grade magnética de 10px
  assert.equal(adjustedB4.position.x % GRID_SNAP_SIZE, 0);
  assert.equal(adjustedB4.position.y % GRID_SNAP_SIZE, 0);
});

test('aproximação de blocos: permite distância de 20px ou um quadrado maior (50px) em todas as direções (cima, baixo, esquerda, direita)', () => {
  assert.equal(MIN_BLOCK_GAP, 20);
  const b1 = createBlock('input', { x: 100, y: 100 }, 'login');

  // 1. Lado direito com gap de 20px (x = 100 + 260 + 20 = 380)
  const bRight20 = createBlock('button', { x: 380, y: 100 }, 'login');
  const nodesRight = [b1, bRight20];
  const adjustedRight = preventBlockCollision(nodesRight, bRight20.id);
  assert.equal(
    adjustedRight.find((n) => n.id === bRight20.id)!.position.x,
    380,
    'Deve permitir 20px à direita',
  );

  // 2. Lado direito com um quadrado maior de 50px (x = 100 + 260 + 50 = 410)
  const bRight50 = createBlock('button', { x: 410, y: 100 }, 'login');
  const nodesRight50 = [b1, bRight50];
  const adjustedRight50 = preventBlockCollision(nodesRight50, bRight50.id);
  assert.equal(
    adjustedRight50.find((n) => n.id === bRight50.id)!.position.x,
    410,
    'Deve permitir 50px à direita',
  );

  // 3. Parte de baixo com gap de 20px (y = 100 + 138 + 20 = 258 -> snap 260)
  const bBottom20 = createBlock('button', { x: 100, y: 260 }, 'login');
  const nodesBottom = [b1, bBottom20];
  const adjustedBottom = preventBlockCollision(nodesBottom, bBottom20.id);
  assert.equal(
    adjustedBottom.find((n) => n.id === bBottom20.id)!.position.y,
    260,
    'Deve permitir 20px abaixo',
  );

  // 4. Parte de cima com gap de 20px (300 - 140 - 20 = 140):
  const bBase = createBlock('input', { x: 100, y: 300 }, 'login');
  const bTop20 = createBlock('button', { x: 100, y: 140 }, 'login');
  const nodesTop = [bBase, bTop20];
  const adjustedTop = preventBlockCollision(nodesTop, bTop20.id);
  assert.equal(
    adjustedTop.find((n) => n.id === bTop20.id)!.position.y,
    140,
    'Deve permitir 20px acima',
  );

  // 5. Lado esquerdo com gap de 20px:
  const bBaseRight = createBlock('input', { x: 400, y: 100 }, 'login');
  const bLeft20 = createBlock('button', { x: 120, y: 100 }, 'login');
  const nodesLeft = [bBaseRight, bLeft20];
  const adjustedLeft = preventBlockCollision(nodesLeft, bLeft20.id);
  assert.equal(
    adjustedLeft.find((n) => n.id === bLeft20.id)!.position.x,
    120,
    'Deve permitir 20px à esquerda',
  );
});

test('validação de código real executável: projeto demo executa JavaScript nativo via executeProjectCode com sucesso e captura erros', async () => {
  // 1. Executa fluxo completo com credenciais válidas
  const resSuccess = await executeProjectCode(demo, 'btn_entrar', {
    email: 'demo@exemplo.com',
    senha: '123456',
  });
  assert.equal(resSuccess.screen, 'home', 'Deve ter navegado para a tela home');
  assert.ok(resSuccess.store.__session, 'Deve conter sessão ativa do usuário');
  assert.ok(resSuccess.logs.some((l) => l.msg.includes('Navegou para a tela: home')));

  // 2. Executa fluxo com senha errada: deve acionar show_error e não navegar
  const resError = await executeProjectCode(demo, 'btn_entrar', {
    email: 'demo@exemplo.com',
    senha: 'senha-incorreta',
  });
  assert.notEqual(resError.screen, 'home', 'Não deve navegar para home com credenciais inválidas');
  assert.equal((resError.result as { error: boolean }).error, true);
});

test('validação de código real executável: projeto criado do zero (checkout e pedidos com condição e banco) gera JavaScript funcional e autônomo', async () => {
  const g: Graph = {
    version: 1,
    name: 'Loja Virtual',
    nodes: [
      {
        id: 'tela_checkout',
        position: { x: 40, y: 40 },
        data: { kind: 'screen', label: 'Checkout', config: {} },
      },
      {
        id: 'campo_qtd',
        position: { x: 440, y: 80 },
        data: {
          kind: 'input',
          label: 'Quantidade',
          config: { value: '4', screenId: 'tela_checkout' },
        },
      },
      {
        id: 'campo_preco',
        position: { x: 440, y: 240 },
        data: { kind: 'input', label: 'Preço', config: { value: '35', screenId: 'tela_checkout' } },
      },
      {
        id: 'btn_fechar_pedido',
        position: { x: 440, y: 400 },
        data: { kind: 'button', label: 'Concluir Compra', config: { screenId: 'tela_checkout' } },
      },
      {
        id: 'calcular_subtotal',
        position: { x: 860, y: 140 },
        data: {
          kind: 'function',
          label: 'Calcular Subtotal',
          config: {
            screenId: 'tela_checkout',
            code: 'const qtd = Number(read("campo_qtd", "value", 1));\n  const preco = Number(read("campo_preco", "value", 0));\n  return qtd * preco;',
          },
        },
      },
      {
        id: 'checar_desconto_vip',
        position: { x: 1280, y: 140 },
        data: {
          kind: 'condition',
          label: 'Valor > 100?',
          config: { screenId: 'tela_checkout', operator: 'gt', compare: '100' },
        },
      },
      {
        id: 'aplicar_desconto_10',
        position: { x: 1700, y: 100 },
        data: {
          kind: 'function',
          label: 'Aplica 10%',
          config: {
            screenId: 'tela_checkout',
            code: 'return { cliente: "VIP", totalOriginal: value, totalFinal: value * 0.9, descontoAplicado: true };',
          },
        },
      },
      {
        id: 'salvar_pedido_db',
        position: { x: 2140, y: 100 },
        data: {
          kind: 'database',
          label: 'Salvar Pedido',
          config: { screenId: 'tela_checkout', operation: 'insert', table: 'pedidos' },
        },
      },
      {
        id: 'ir_tela_sucesso',
        position: { x: 2560, y: 100 },
        data: {
          kind: 'navigate',
          label: 'Ir para Confirmação',
          config: { screenId: 'tela_checkout', target: 'tela_sucesso' },
        },
      },
      {
        id: 'tela_sucesso',
        position: { x: 2980, y: 100 },
        data: { kind: 'screen', label: 'Pedido Confirmado', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_fechar_pedido',
        target: 'calcular_subtotal',
        sourceHandle: 'onClick',
        targetHandle: 'listener',
      },
      {
        id: 'e2',
        source: 'calcular_subtotal',
        target: 'checar_desconto_vip',
        sourceHandle: 'then',
        targetHandle: 'listener',
      },
      {
        id: 'e3',
        source: 'checar_desconto_vip',
        target: 'aplicar_desconto_10',
        sourceHandle: 'true',
        targetHandle: 'listener',
      },
      {
        id: 'e4',
        source: 'aplicar_desconto_10',
        target: 'salvar_pedido_db',
        sourceHandle: 'then',
        targetHandle: 'payload',
      },
      {
        id: 'e5',
        source: 'salvar_pedido_db',
        target: 'ir_tela_sucesso',
        sourceHandle: 'onSuccess',
        targetHandle: 'listener',
      },
    ],
  };

  // Garante que o código de todos os nós seja sincronizado com as conexões
  const synced = syncGraphCode(g);

  // Gera o código JavaScript completo do projeto
  const generatedJs = generateProjectCode(synced);
  assert.ok(generatedJs.includes('export function createFlowRunner'));
  assert.ok(generatedJs.includes('function btn_fechar_pedido()'));
  assert.ok(generatedJs.includes('function checar_desconto_vip('));
  assert.ok(generatedJs.includes('async function salvar_pedido_db('));

  // Executa o projeto a partir do clique no botão com inputs de 4 * 35 = 140 (> 100)
  const execResult = await executeProjectCode(synced, 'btn_fechar_pedido', {
    campo_qtd: '4',
    campo_preco: '35',
  });

  // O pedido com desconto deve ter sido inserido no banco de dados com totalFinal = 126
  assert.equal(execResult.screen, 'tela_sucesso', 'Deve navegar para a tela_sucesso');
  const pedidos = execResult.store.pedidos as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(pedidos), 'Deve ter criado a tabela pedidos');
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].totalOriginal, 140);
  assert.equal(pedidos[0].totalFinal, 126);
  assert.equal(pedidos[0].descontoAplicado, true);
});

test('validação de código real executável: projeto criado do zero (cadastro com validação, auth register e alerta de erro) gera JavaScript funcional', async () => {
  const g: Graph = {
    version: 1,
    name: 'Sistema de Registro',
    nodes: [
      {
        id: 'tela_registro',
        position: { x: 40, y: 40 },
        data: { kind: 'screen', label: 'Cadastro', config: {} },
      },
      {
        id: 'input_email',
        position: { x: 440, y: 80 },
        data: { kind: 'input', label: 'E-mail', config: { screenId: 'tela_registro' } },
      },
      {
        id: 'input_senha',
        position: { x: 440, y: 220 },
        data: { kind: 'input', label: 'Senha', config: { screenId: 'tela_registro' } },
      },
      {
        id: 'btn_cadastrar_novo',
        position: { x: 440, y: 360 },
        data: { kind: 'button', label: 'Criar Minha Conta', config: { screenId: 'tela_registro' } },
      },
      {
        id: 'validar_preenchimento',
        position: { x: 860, y: 140 },
        data: {
          kind: 'condition',
          label: 'Campos preenchidos?',
          config: { screenId: 'tela_registro', operator: 'truthy' },
        },
      },
      {
        id: 'alerta_campos_vazios',
        position: { x: 1280, y: 300 },
        data: {
          kind: 'error',
          label: 'Erro Validação',
          config: { screenId: 'tela_registro', message: 'Preencha todos os campos obrigatórios' },
        },
      },
      {
        id: 'registrar_usuario_auth',
        position: { x: 1280, y: 100 },
        data: {
          kind: 'auth',
          label: 'Registrar Auth',
          config: { screenId: 'tela_registro', provider: 'email', mode: 'register' },
        },
      },
      {
        id: 'ir_para_dashboard',
        position: { x: 1700, y: 100 },
        data: {
          kind: 'navigate',
          label: 'Ir para Dashboard',
          config: { screenId: 'tela_registro', target: 'tela_dashboard' },
        },
      },
      {
        id: 'tela_dashboard',
        position: { x: 2120, y: 100 },
        data: { kind: 'screen', label: 'Dashboard', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_cadastrar_novo',
        target: 'validar_preenchimento',
        sourceHandle: 'onClick',
        targetHandle: 'listener',
      },
      {
        id: 'e2',
        source: 'validar_preenchimento',
        target: 'alerta_campos_vazios',
        sourceHandle: 'false',
        targetHandle: 'execute',
      },
      {
        id: 'e3',
        source: 'validar_preenchimento',
        target: 'registrar_usuario_auth',
        sourceHandle: 'true',
        targetHandle: 'trigger',
      },
      {
        id: 'e4',
        source: 'registrar_usuario_auth',
        target: 'ir_para_dashboard',
        sourceHandle: 'onSuccess',
        targetHandle: 'listener',
      },
    ],
  };

  const synced = syncGraphCode(g);

  // Cenário 1: Tentativa com campos vazios -> Dispara alerta_campos_vazios
  const emptyRes = await executeProjectCode(synced, 'btn_cadastrar_novo', {
    input_email: '',
    input_senha: '',
  });
  assert.notEqual(emptyRes.screen, 'tela_dashboard');
  assert.equal((emptyRes.result as { error: boolean; message: string }).error, true);
  assert.equal(
    (emptyRes.result as { message: string }).message,
    'Preencha todos os campos obrigatórios',
  );

  // Cenário 2: Dados válidos informados -> Cria usuário, salva na sessão e navega para tela_dashboard
  const successRes = await executeProjectCode(synced, 'btn_cadastrar_novo', {
    input_email: 'novo.cliente@empresa.com',
    input_senha: 'senhaSegura123',
  });
  assert.equal(successRes.screen, 'tela_dashboard');
  const session = successRes.store.__session as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(session));
  assert.equal(session[0].email, 'novo.cliente@empresa.com');

  // Cenário 3: Usuário gravado na tabela usuarios
  const usuarios = successRes.store.usuarios as Array<Record<string, unknown>>;
  assert.ok(usuarios.some((u) => u.email === 'novo.cliente@empresa.com'));
});

test('validação sintática: todos os tipos de blocos do catálogo compilam para JavaScript executável válido sem erros de sintaxe', () => {
  const allKinds: Kind[] = [
    'screen',
    'input',
    'button',
    'function',
    'condition',
    'auth',
    'error',
    'api',
    'database',
    'navigate',
    'notify',
    'state',
    'validator',
    'switch',
    'delay',
  ];

  for (const kind of allKinds) {
    const block = createBlock(kind, { x: 0, y: 0 }, 'tela_teste');
    const dummyGraph: Graph = {
      version: 1,
      name: `Teste ${kind}`,
      nodes: [block],
      edges: [],
    };
    const blockCode = generateBlockCode(dummyGraph, block);

    // Valida que a função compila sem lançar erro de sintaxe
    assert.doesNotThrow(() => {
      new Function(
        'read',
        'navigateTo',
        'db',
        'authenticate',
        'authenticateGoogle',
        'registerUser',
        'notify',
        'setVar',
        'getVar',
        'clearVar',
        'validate',
        'sleep',
        blockCode,
      );
    }, `O código gerado para o bloco "${kind}" deve ser JavaScript válido.`);

    // Valida que o projeto contendo este bloco compila e produz createFlowRunner executável
    const projectJs = generateProjectCode(dummyGraph);
    const executableScript = projectJs.replace(
      /export function createFlowRunner/,
      'function createFlowRunner',
    );
    assert.doesNotThrow(() => {
      new Function(`${executableScript}; return createFlowRunner;`);
    }, `O projeto contendo o bloco "${kind}" deve compilar para JavaScript executável.`);
  }
});

test('filtro de fluxos isola blocos e conexões do fluxo selecionado e oculta os demais', () => {
  const flows = getGraphFlows(demo.flows);
  const allNodes = toFlowNodes(demo, null, 'login');
  assert.ok(allNodes.length > 3, 'Deve haver blocos na tela de login');

  // Sem filtro ativo: todos os nós e conexões da tela permanecem visíveis
  const unfiltered = filterFlowElements(allNodes, demo, flows, null);
  assert.equal(unfiltered.nodes.length, allNodes.length);
  const unfilteredEdges = toFlowEdges(demo, [], unfiltered.visibleNodeIds);
  assert.ok(unfilteredEdges.length > 0);

  // Filtro ativo: apenas blocos de 'inputs'
  const inputsFiltered = filterFlowElements(allNodes, demo, flows, 'inputs');
  assert.ok(inputsFiltered.nodes.length > 0);
  assert.ok(inputsFiltered.nodes.length < allNodes.length);
  for (const n of inputsFiltered.nodes) {
    const block = demo.nodes.find((bn) => bn.id === n.id);
    assert.ok(block);
    const { flow } = resolveBlockFlow(flows, block.data.kind, block.id, block.data.config?.flowId);
    assert.equal(flow.id, 'inputs');
  }

  // As arestas visíveis devem conter apenas conexões onde ambos os blocos pertencem ao fluxo filtrado
  const filteredEdges = toFlowEdges(demo, [], inputsFiltered.visibleNodeIds);
  for (const edge of filteredEdges) {
    assert.ok(inputsFiltered.visibleNodeIds.has(edge.source));
    assert.ok(inputsFiltered.visibleNodeIds.has(edge.target));
  }

  // Conexões com blocos de outros fluxos (ex: inputs -> validation) são ocultadas
  assert.ok(filteredEdges.length <= unfilteredEdges.length);
});
