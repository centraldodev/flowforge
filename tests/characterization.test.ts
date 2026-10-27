import test from 'node:test';
import assert from 'node:assert/strict';
import {
  run,
  executeProjectCode,
  ports,
  getBlockPorts,
  type Graph,
  type Block,
} from '../src/engine';

// ============================================================================
// MATRIZ DE CARACTERIZAÇÃO: 15 KINDS
// ============================================================================

test('caracterização: screen', async () => {
  const p = ports('screen');
  assert.deepEqual(p.inputs, ['onEnter', 'user', 'listener', 'exec']);
  assert.deepEqual(p.outputs, []);

  const g: Graph = {
    version: 1,
    name: 'Screen Test',
    nodes: [
      {
        id: 'tela_1',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela Inicial', config: {} },
      },
    ],
    edges: [],
  };

  // Simulação
  const sim = run(g, 'tela_1');
  assert.equal(sim.screen, 'tela_1');
  assert.ok(sim.trace[0].message.includes('Navegando para Tela Inicial'));

  // JavaScript executável
  const exec = await executeProjectCode(g, 'tela_1');
  assert.equal(exec.screen, 'tela_1');
  assert.deepEqual(exec.result, { id: 'tela_1', label: 'Tela Inicial' });
});

test('caracterização: button', async () => {
  const p = ports('button');
  assert.deepEqual(p.inputs, ['disabled']);
  assert.deepEqual(p.outputs, ['onClick', 'next', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Button Test',
    nodes: [
      {
        id: 'tela_principal',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Principal', config: {} },
      },
      {
        id: 'btn_acao',
        position: { x: 400, y: 0 },
        data: { kind: 'button', label: 'Clique Aqui', config: { screenId: 'tela_principal' } },
      },
      {
        id: 'tela_destino',
        position: { x: 800, y: 0 },
        data: { kind: 'screen', label: 'Destino', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_acao',
        target: 'tela_destino',
        sourceHandle: 'onClick',
        targetHandle: 'onEnter',
      },
    ],
  };

  // Simulação
  const sim = run(g, 'btn_acao');
  assert.equal(sim.screen, 'tela_destino');
  assert.equal(sim.trace[0].message, 'Evento onClick disparado');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'btn_acao');
  assert.equal(exec.screen, 'tela_destino');
});

test('caracterização: input', async () => {
  const p = ports('input');
  assert.deepEqual(p.inputs, ['disabled']);
  assert.deepEqual(p.outputs, ['value', 'onChange']);

  const g: Graph = {
    version: 1,
    name: 'Input Test',
    nodes: [
      {
        id: 'campo_nome',
        position: { x: 0, y: 0 },
        data: {
          kind: 'input',
          label: 'Nome',
          config: { field: 'text', value: 'Arthur Dent' },
        },
      },
    ],
    edges: [],
  };

  // Simulação
  const sim = run(g, 'campo_nome');
  assert.equal(sim.outputs['campo_nome'], 'Arthur Dent');

  // Simulação com sobrescrita de valores
  const simOverride = run(g, 'campo_nome', { campo_nome: 'Ford Prefect' });
  assert.equal(simOverride.outputs['campo_nome'], 'Ford Prefect');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'campo_nome', { campo_nome: 'Trillian' });
  assert.equal(exec.result, 'Trillian');
});

test('caracterização: function', async () => {
  const p = ports('function');
  assert.deepEqual(p.inputs, ['execute', 'message', 'listener', 'listenerClick', 'exec', 'value']);
  assert.deepEqual(p.outputs, ['onDismiss', 'then', 'next', 'result', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Function Test',
    nodes: [
      {
        id: 'num_input',
        position: { x: 0, y: 0 },
        data: {
          kind: 'input',
          label: 'Número',
          config: { value: '21' },
        },
      },
      {
        id: 'fn_dobrar',
        position: { x: 100, y: 0 },
        data: {
          kind: 'function',
          label: 'Dobrar Valor',
          config: {
            code: 'const val = typeof num_input !== "undefined" ? num_input : value; return Number(val || 0) * 2;',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e_val',
        source: 'num_input',
        target: 'fn_dobrar',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
    ],
  };

  // Simulação com entrada conectada
  const sim = run(g, 'fn_dobrar');
  assert.equal(sim.outputs['fn_dobrar'], 42);

  // JavaScript executável: com entrada conectada, recebe 21 e retorna 42
  const exec = await executeProjectCode(g, 'fn_dobrar');
  assert.equal(exec.result, 42);
});

test('caracterização: condition', async () => {
  const p = ports('condition');
  assert.deepEqual(p.inputs, ['execute', 'listener', 'listenerClick', 'exec', 'value']);
  assert.deepEqual(p.outputs, ['true', 'false', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Condition Test',
    nodes: [
      {
        id: 'campo_idade',
        position: { x: 0, y: 0 },
        data: { kind: 'input', label: 'Idade', config: { value: '20' } },
      },
      {
        id: 'checar_idade',
        position: { x: 400, y: 0 },
        data: {
          kind: 'condition',
          label: 'Maior de Idade',
          config: { operator: 'gt', compare: '17' },
        },
      },
      {
        id: 'tela_aprovado',
        position: { x: 800, y: 0 },
        data: { kind: 'screen', label: 'Aprovado', config: {} },
      },
      {
        id: 'tela_reprovado',
        position: { x: 800, y: 200 },
        data: { kind: 'screen', label: 'Reprovado', config: {} },
      },
    ],
    edges: [
      {
        id: 'e0',
        source: 'campo_idade',
        target: 'checar_idade',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
      {
        id: 'e1',
        source: 'checar_idade',
        target: 'tela_aprovado',
        sourceHandle: 'true',
        targetHandle: 'onEnter',
      },
      {
        id: 'e2',
        source: 'checar_idade',
        target: 'tela_reprovado',
        sourceHandle: 'false',
        targetHandle: 'onEnter',
      },
    ],
  };

  // Simulação: ramo true (20 > 17)
  const simTrue = run(g, 'checar_idade');
  assert.equal(simTrue.screen, 'tela_aprovado');

  // Simulação: ramo false com valor 15
  const simFalse = run(g, 'checar_idade', { campo_idade: '15' });
  assert.equal(simFalse.screen, 'tela_reprovado');

  // JavaScript executável: ramo true
  const execTrue = await executeProjectCode(g, 'checar_idade');
  assert.equal(execTrue.screen, 'tela_aprovado');

  // JavaScript executável: ramo false
  const execFalse = await executeProjectCode(g, 'checar_idade', { campo_idade: '15' });
  assert.equal(execFalse.screen, 'tela_reprovado');
});

test('caracterização: auth', async () => {
  const p = ports('auth');
  assert.deepEqual(p.inputs, [
    'trigger',
    'email',
    'password',
    'token',
    'listener',
    'listenerClick',
    'exec',
  ]);
  assert.deepEqual(p.outputs, ['onSuccess', 'onError', 'user', 'then', 'next', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Auth Test',
    nodes: [
      {
        id: 'autenticar',
        position: { x: 0, y: 0 },
        data: {
          kind: 'auth',
          label: 'Login Auth',
          config: { provider: 'email', mode: 'login' },
        },
      },
      {
        id: 'tela_sucesso',
        position: { x: 400, y: 0 },
        data: { kind: 'screen', label: 'Sucesso', config: {} },
      },
      {
        id: 'tela_falha',
        position: { x: 400, y: 200 },
        data: { kind: 'screen', label: 'Falha', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'autenticar',
        target: 'tela_sucesso',
        sourceHandle: 'onSuccess',
        targetHandle: 'onEnter',
      },
      {
        id: 'e2',
        source: 'autenticar',
        target: 'tela_falha',
        sourceHandle: 'onError',
        targetHandle: 'onEnter',
      },
    ],
  };

  // Simulação com credenciais demo
  const simOk = run(g, 'autenticar', { email: 'demo@exemplo.com', password: '123456' });
  assert.equal(simOk.screen, 'tela_sucesso');

  // Simulação com erro
  const simErr = run(g, 'autenticar', { email: 'errado@exemplo.com', password: '000' });
  assert.equal(simErr.screen, 'tela_falha');

  // JavaScript executável
  const execOk = await executeProjectCode(g, 'autenticar', {
    email: 'demo@exemplo.com',
    password: '123456',
  });
  assert.equal(execOk.screen, 'tela_sucesso');
});

test('caracterização: database', async () => {
  const p = ports('database');
  assert.deepEqual(p.inputs, [
    'execute',
    'listener',
    'listenerClick',
    'exec',
    'value',
    'data',
    'user',
  ]);
  assert.deepEqual(p.outputs, ['onSuccess', 'onError', 'data', 'then', 'next', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Database Test',
    nodes: [
      {
        id: 'preparar_item',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Preparar Item',
          config: { code: 'return { id: 2, titulo: "Item 2" };' },
        },
      },
      {
        id: 'banco',
        position: { x: 300, y: 0 },
        data: {
          kind: 'database',
          label: 'Banco de Dados',
          config: {
            table: 'itens',
            operation: 'insert',
            mock: JSON.stringify([{ id: 1, titulo: 'Item 1' }]),
          },
        },
      },
    ],
    edges: [
      {
        id: 'e_exec',
        source: 'preparar_item',
        target: 'banco',
        sourceHandle: 'then',
        targetHandle: 'execute',
      },
      {
        id: 'e_data',
        source: 'preparar_item',
        target: 'banco',
        sourceHandle: 'value',
        targetHandle: 'data',
      },
    ],
  };

  // Simulação
  const sim = run(g, 'preparar_item');
  const rows = sim.outputs['banco'] as Array<{ id: number; titulo: string }>;
  assert.ok(rows.length >= 2);

  // JavaScript executável
  const exec = await executeProjectCode(g, 'preparar_item');
  assert.ok(Array.isArray(exec.store['itens']));
});

test('caracterização: api', async () => {
  const p = ports('api');
  assert.deepEqual(p.inputs, [
    'connection',
    'query',
    'execute',
    'body',
    'listener',
    'listenerClick',
    'exec',
  ]);
  assert.deepEqual(p.outputs, ['onSuccess', 'onError', 'response', 'then', 'next', 'value']);

  const g: Graph = {
    version: 1,
    name: 'API Test',
    nodes: [
      {
        id: 'req_api',
        position: { x: 0, y: 0 },
        data: {
          kind: 'api',
          label: 'API Fake',
          config: { method: 'GET', url: '/api/dados', mock: '{"status":"ok","pontos":100}' },
        },
      },
    ],
    edges: [],
  };

  // Simulação usa config.mock
  const sim = run(g, 'req_api');
  assert.deepEqual(sim.outputs['req_api'], { status: 'ok', pontos: 100 });
});

test('caracterização: error', async () => {
  const p = ports('error');
  assert.deepEqual(p.inputs, ['execute', 'msg']);
  assert.deepEqual(p.outputs, ['retry', 'msg']);

  const g: Graph = {
    version: 1,
    name: 'Error Test',
    nodes: [
      {
        id: 'alerta_erro',
        position: { x: 0, y: 0 },
        data: {
          kind: 'error',
          label: 'Captura Erro',
          config: { message: 'Falha crítica na rede', type: 'toast', maxRetries: '2' },
        },
      },
    ],
    edges: [],
  };

  // Simulação: sem retry conectado, path é onDismiss
  const sim = run(g, 'alerta_erro');
  const out = sim.outputs['alerta_erro'] as { error: boolean; msg: string };
  assert.equal(out.error, true);
  assert.equal(out.msg, 'Falha crítica na rede');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'alerta_erro');
  assert.deepEqual(exec.result, { error: true, message: 'Falha crítica na rede' });
});

test('caracterização: navigate', async () => {
  const p = ports('navigate');
  assert.deepEqual(p.inputs, ['execute', 'route', 'listener', 'listenerClick', 'exec']);
  assert.deepEqual(p.outputs, ['onComplete', 'then', 'next', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Navigate Test',
    nodes: [
      {
        id: 'ir_config',
        position: { x: 0, y: 0 },
        data: {
          kind: 'navigate',
          label: 'Ir para Config',
          config: { target: 'tela_config' },
        },
      },
      {
        id: 'tela_config',
        position: { x: 400, y: 0 },
        data: { kind: 'screen', label: 'Configurações', config: {} },
      },
    ],
    edges: [],
  };

  // Simulação
  const sim = run(g, 'ir_config');
  assert.equal(sim.screen, 'tela_config');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'ir_config');
  assert.equal(exec.screen, 'tela_config');
});

test('caracterização: notify', async () => {
  const p = ports('notify');
  assert.deepEqual(p.inputs, [
    'trigger',
    'listener',
    'listenerClick',
    'exec',
    'execute',
    'message',
    'value',
  ]);
  assert.deepEqual(p.outputs, ['next', 'onDismiss', 'then']);

  const g: Graph = {
    version: 1,
    name: 'Notify Test',
    nodes: [
      {
        id: 'notif',
        position: { x: 0, y: 0 },
        data: {
          kind: 'notify',
          label: 'Notificação',
          config: { type: 'warning', message: 'Atenção aos dados!', duration: '2000' },
        },
      },
    ],
    edges: [],
  };

  // Simulação
  const sim = run(g, 'notif');
  assert.ok(sim.messages.some((m) => m.includes('[WARNING] Atenção aos dados!')));

  // JavaScript executável
  const exec = await executeProjectCode(g, 'notif');
  assert.equal(exec.notifications.length, 1);
  assert.equal(exec.notifications[0].type, 'warning');
  assert.equal(exec.notifications[0].message, 'Atenção aos dados!');
});

test('caracterização: state', async () => {
  const p = ports('state');
  assert.deepEqual(p.inputs, ['execute', 'listener', 'listenerClick', 'exec', 'value', 'key']);
  assert.deepEqual(p.outputs, ['next', 'then', 'value', 'stored']);

  const g: Graph = {
    version: 1,
    name: 'State Test',
    nodes: [
      {
        id: 'set_theme',
        position: { x: 0, y: 0 },
        data: {
          kind: 'state',
          label: 'Definir Tema',
          config: { operation: 'set', key: 'theme', value: 'dark' },
        },
      },
    ],
    edges: [],
  };

  // Simulação recebendo valor
  const sim = run(g, 'set_theme', { value: 'dark' });
  assert.equal(sim.outputs['set_theme'], 'dark');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'set_theme', { value: 'dark' });
  assert.equal(exec.store['theme'], 'dark');
});

test('caracterização: validator', async () => {
  const p = ports('validator');
  assert.deepEqual(p.inputs, ['execute', 'listener', 'listenerClick', 'exec', 'value']);
  assert.deepEqual(p.outputs, ['valid', 'invalid', 'next', 'then', 'value', 'error']);

  const g: Graph = {
    version: 1,
    name: 'Validator Test',
    nodes: [
      {
        id: 'campo_cpf',
        position: { x: 0, y: 0 },
        data: { kind: 'input', label: 'CPF', config: { value: '12345678901' } },
      },
      {
        id: 'validar_cpf',
        position: { x: 400, y: 0 },
        data: {
          kind: 'validator',
          label: 'Validar CPF',
          config: { rule: 'cpf' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'campo_cpf',
        target: 'validar_cpf',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
    ],
  };

  // Simulação
  const sim = run(g, 'validar_cpf');
  const out = sim.outputs['validar_cpf'] as { valid: boolean; value: unknown };
  assert.equal(out.valid, true);

  // JavaScript executável
  const exec = await executeProjectCode(g, 'validar_cpf');
  assert.deepEqual(exec.result, { valid: true, value: '12345678901' });
});

test('caracterização: switch', async () => {
  const p = ports('switch');
  assert.deepEqual(p.inputs, ['execute', 'listener', 'listenerClick', 'exec', 'value']);
  assert.deepEqual(p.outputs, ['case1', 'case2', 'case3', 'default', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Switch Test',
    nodes: [
      {
        id: 'rotear',
        position: { x: 0, y: 0 },
        data: {
          kind: 'switch',
          label: 'Switch Opção',
          config: { cases: 'sim, nao', value: 'sim' },
        },
      },
      {
        id: 'tela_sim',
        position: { x: 400, y: 0 },
        data: { kind: 'screen', label: 'Tela Sim', config: {} },
      },
      {
        id: 'tela_nao',
        position: { x: 400, y: 200 },
        data: { kind: 'screen', label: 'Tela Não', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'rotear',
        target: 'tela_sim',
        sourceHandle: 'case1',
        targetHandle: 'onEnter',
      },
      {
        id: 'e2',
        source: 'rotear',
        target: 'tela_nao',
        sourceHandle: 'case2',
        targetHandle: 'onEnter',
      },
    ],
  };

  // Simulação
  const sim = run(g, 'rotear');
  assert.equal(sim.screen, 'tela_sim');

  // JavaScript executável
  const exec = await executeProjectCode(g, 'rotear');
  assert.equal(exec.screen, 'tela_sim');
});

test('caracterização: delay', async () => {
  const p = ports('delay');
  assert.deepEqual(p.inputs, ['execute', 'listener', 'listenerClick', 'exec', 'duration', 'value']);
  assert.deepEqual(p.outputs, ['next', 'then', 'onComplete', 'value']);

  const g: Graph = {
    version: 1,
    name: 'Delay Test',
    nodes: [
      {
        id: 'esperar',
        position: { x: 0, y: 0 },
        data: {
          kind: 'delay',
          label: 'Espera 10ms',
          config: { duration: '10' },
        },
      },
    ],
    edges: [],
  };

  // Simulação
  const sim = run(g, 'esperar');
  assert.deepEqual(sim.outputs['esperar'], { delayed: true, duration: 10 });

  // JavaScript executável
  const exec = await executeProjectCode(g, 'esperar');
  assert.ok(exec);
});

// ============================================================================
// CASOS ESPECÍFICOS E DIVERGÊNCIAS CONHECIDAS (FASE 0)
// ============================================================================

test('caracterização de ciclos: interpretador run() detecta ciclo e interrompe em 100 passos', () => {
  const g: Graph = {
    version: 1,
    name: 'Ciclo Test',
    nodes: [
      {
        id: 'fn_a',
        position: { x: 0, y: 0 },
        data: { kind: 'function', label: 'Função A', config: { code: 'return value;' } },
      },
      {
        id: 'fn_b',
        position: { x: 400, y: 0 },
        data: { kind: 'function', label: 'Função B', config: { code: 'return value;' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'fn_a', target: 'fn_b', sourceHandle: 'then', targetHandle: 'execute' },
      { id: 'e2', source: 'fn_b', target: 'fn_a', sourceHandle: 'then', targetHandle: 'execute' },
    ],
  };

  assert.throws(
    () => run(g, 'fn_a'),
    /Fluxo interrompido: limite de 100 passos \(possível ciclo\)\./,
  );
});

test('Fase 1: código JS gerado por generateProjectCode() detecta ciclos e interrompe em 100 passos sem RangeError', async () => {
  const g: Graph = {
    version: 1,
    name: 'Ciclo Test JS',
    nodes: [
      {
        id: 'fn_a',
        position: { x: 0, y: 0 },
        data: { kind: 'function', label: 'Função A', config: { code: 'return value;' } },
      },
      {
        id: 'fn_b',
        position: { x: 400, y: 0 },
        data: { kind: 'function', label: 'Função B', config: { code: 'return value;' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'fn_a', target: 'fn_b', sourceHandle: 'then', targetHandle: 'execute' },
      { id: 'e2', source: 'fn_b', target: 'fn_a', sourceHandle: 'then', targetHandle: 'execute' },
    ],
  };

  await assert.rejects(
    async () => executeProjectCode(g, 'fn_a'),
    /Fluxo interrompido: limite de 100 passos \(possível ciclo\)\./,
  );
});

test('caracterização de portas personalizadas: getBlockPorts respeita customPort', () => {
  const block: Block = {
    id: 'bloco_custom',
    position: { x: 0, y: 0 },
    data: {
      kind: 'function',
      label: 'Bloco com Porta Customizada',
      config: {},
      ports: [
        { id: 'porta_entrada_extra', name: 'Entrada Especial', direction: 'input', type: 'number' },
        { id: 'porta_saida_extra', name: 'Saída Especial', direction: 'output', type: 'number' },
      ],
    },
  };

  const blockPorts = getBlockPorts(block);
  assert.deepEqual(blockPorts.inputs, ['porta_entrada_extra']);
  assert.deepEqual(blockPorts.outputs, ['porta_saida_extra']);
});

test('caracterização de cadeia assíncrona: delay -> function -> database', async () => {
  const g: Graph = {
    version: 1,
    name: 'Async Chain',
    nodes: [
      {
        id: 'pausa',
        position: { x: 0, y: 0 },
        data: { kind: 'delay', label: 'Pausa', config: { duration: '10' } },
      },
      {
        id: 'transformar',
        position: { x: 400, y: 0 },
        data: {
          kind: 'function',
          label: 'Prepara Registro',
          config: { code: 'return { id: 10, item: "assíncrono" };' },
        },
      },
      {
        id: 'salvar_db',
        position: { x: 800, y: 0 },
        data: {
          kind: 'database',
          label: 'Salvar DB',
          config: { table: 'registros', operation: 'insert' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'pausa',
        target: 'transformar',
        sourceHandle: 'next',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'transformar',
        target: 'salvar_db',
        sourceHandle: 'then',
        targetHandle: 'execute',
      },
    ],
  };

  // Simulação
  const sim = run(g, 'pausa');
  assert.ok(sim.trace.some((t) => t.id === 'salvar_db'));

  // JavaScript executável
  const exec = await executeProjectCode(g, 'pausa');
  assert.ok(Array.isArray(exec.store['registros']));
});

test('caracterização de conexão de dados incompatíveis: coerção tolerante em run() e JS', async () => {
  const g: Graph = {
    version: 1,
    name: 'Incompatible Data',
    nodes: [
      {
        id: 'origem_incompativel',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Origem Objeto',
          config: { code: 'return { objeto: true };' },
        },
      },
      {
        id: 'validador',
        position: { x: 300, y: 0 },
        data: {
          kind: 'validator',
          label: 'Validador Numérico',
          config: { rule: 'numeric', value: '' },
        },
      },
    ],
    edges: [
      {
        id: 'e_exec',
        source: 'origem_incompativel',
        target: 'validador',
        sourceHandle: 'then',
        targetHandle: 'execute',
      },
      {
        id: 'e_data',
        source: 'origem_incompativel',
        target: 'validador',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
    ],
  };

  // Passando objeto complexo para validação numérica
  const sim = run(g, 'origem_incompativel');
  const out = sim.outputs['validador'] as { valid: boolean };
  // '[object Object]' não é numérico -> avalia para false sem travar
  assert.equal(out.valid, false);

  const exec = await executeProjectCode(g, 'origem_incompativel');
  assert.equal((exec.result as { valid: boolean }).valid, false);
});

test('caracterização de múltiplas conexões saindo da mesma porta: primeiro destino tem precedência no grafo atual', () => {
  const g: Graph = {
    version: 1,
    name: 'Multi Edge Same Port',
    nodes: [
      {
        id: 'btn_multi',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Botão 1', config: {} },
      },
      {
        id: 'tela_a',
        position: { x: 400, y: 0 },
        data: { kind: 'screen', label: 'Tela A', config: {} },
      },
      {
        id: 'tela_b',
        position: { x: 400, y: 200 },
        data: { kind: 'screen', label: 'Tela B', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_multi',
        target: 'tela_a',
        sourceHandle: 'onClick',
        targetHandle: 'onEnter',
      },
      {
        id: 'e2',
        source: 'btn_multi',
        target: 'tela_b',
        sourceHandle: 'onClick',
        targetHandle: 'onEnter',
      },
    ],
  };

  // Na simulação atual, find(e => ...) escolhe a primeira aresta cadastrada no array
  const sim = run(g, 'btn_multi');
  assert.equal(sim.screen, 'tela_a');
});

test('caracterização de strings e caracteres especiais na simulação run()', () => {
  const g: Graph = {
    version: 1,
    name: 'Special Chars',
    nodes: [
      {
        id: 'notif_especial',
        position: { x: 0, y: 0 },
        data: {
          kind: 'notify',
          label: 'Botão "Especial" d\'água \n com ${process.exit()} & Unicode 🚀',
          config: {
            message: 'Texto d\'água "com aspas", \n quebra, \\ barra e 🚀',
            type: 'info',
          },
        },
      },
    ],
    edges: [],
  };

  // Na simulação em memória, objetos JS preservam caracteres literais sem quebra de sintaxe
  const sim = run(g, 'notif_especial');
  assert.ok(sim.messages.some((m) => m.includes('Texto d\'água "com aspas"')));
  assert.ok(sim.messages.some((m) => m.includes('🚀')));
});

test('Fase 1: interpolação segura de literais em codeGen compila e executa sem quebra de sintaxe ou injeção de código', async () => {
  const g: Graph = {
    version: 1,
    name: 'Special Chars JS',
    nodes: [
      {
        id: 'notif_especial',
        position: { x: 0, y: 0 },
        data: {
          kind: 'notify',
          label: 'Botão "Especial" d\'água \n com ${process.exit()} & Unicode 🚀',
          config: {
            message: 'Texto d\'água "com aspas", \n quebra, \\ barra e 🚀 com ${process.exit()}',
            type: 'info',
          },
        },
      },
    ],
    edges: [],
  };

  const exec = await executeProjectCode(g, 'notif_especial');
  assert.equal(exec.notifications.length, 1);
  assert.equal(
    exec.notifications[0].message,
    'Texto d\'água "com aspas", \n quebra, \\ barra e 🚀 com ${process.exit()}',
  );
});

test('Fase 1: bloco api no JavaScript gerado utiliza config.mock por padrão sem realizar acesso à rede', async () => {
  const g: Graph = {
    version: 1,
    name: 'API Mock Test',
    nodes: [
      {
        id: 'api_mock',
        position: { x: 0, y: 0 },
        data: {
          kind: 'api',
          label: 'Consulta CEP',
          config: {
            method: 'GET',
            url: 'https://viacep.com.br/ws/01001000/json/',
            mock: JSON.stringify({ cep: '01001-000', logradouro: 'Praça da Sé' }),
          },
        },
      },
    ],
    edges: [],
  };

  const exec = await executeProjectCode(g, 'api_mock');
  assert.deepEqual(exec.result, { cep: '01001-000', logradouro: 'Praça da Sé' });
});

test('Fase 1: blocos api e database encaminham falhas para a porta onError quando conectada e relançam quando desconectada', async () => {
  // 1. API com erro simulado conectada a onError
  const gApi: Graph = {
    version: 1,
    name: 'API Error Flow',
    nodes: [
      {
        id: 'chamada_api',
        position: { x: 0, y: 0 },
        data: {
          kind: 'api',
          label: 'API com Erro',
          config: {
            method: 'POST',
            url: '/api/falha',
            simulateError: 'true',
            errorMessage: 'Erro 500 no servidor remoto',
          },
        },
      },
      {
        id: 'tratar_erro',
        position: { x: 400, y: 0 },
        data: {
          kind: 'error',
          label: 'Alerta de Falha',
          config: { message: 'Serviço temporariamente indisponível' },
        },
      },
    ],
    edges: [
      {
        id: 'e_err',
        source: 'chamada_api',
        target: 'tratar_erro',
        sourceHandle: 'onError',
        targetHandle: 'error',
      },
    ],
  };

  const execApi = await executeProjectCode(gApi, 'chamada_api');
  assert.ok(execApi.result);
  assert.equal((execApi.result as { error: boolean }).error, true);

  // 2. Database sem onError conectada relança o erro
  const gDbSemTratamento: Graph = {
    version: 1,
    name: 'DB Error Flow Unhandled',
    nodes: [
      {
        id: 'banco_falha',
        position: { x: 0, y: 0 },
        data: {
          kind: 'database',
          label: 'Banco Falho',
          config: {
            table: 'tabela_falha',
            operation: 'query',
            simulateError: 'true',
          },
        },
      },
    ],
    edges: [],
  };

  await assert.rejects(
    async () => executeProjectCode(gDbSemTratamento, 'banco_falha'),
    /Falha na operação de banco de dados/,
  );
});

test('Fase 1: compilação completa com new Function e execução de caminhos de sucesso e erro', async () => {
  const g: Graph = {
    version: 1,
    name: 'Full Compilation Test',
    nodes: [
      {
        id: 'btn_inicio',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: "Botão com d'água", config: {} },
      },
      {
        id: 'transformar',
        position: { x: 200, y: 0 },
        data: {
          kind: 'function',
          label: 'Processar',
          config: { code: 'return { valor: 42, label: "seguro" };' },
        },
      },
      {
        id: 'gravar',
        position: { x: 400, y: 0 },
        data: {
          kind: 'database',
          label: 'Banco',
          config: { table: 'itens', operation: 'insert' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_inicio',
        target: 'transformar',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'transformar',
        target: 'gravar',
        sourceHandle: 'then',
        targetHandle: 'execute',
      },
    ],
  };

  const exec = await executeProjectCode(g, 'btn_inicio');
  assert.ok(exec.store['itens']);
  assert.equal((exec.store['itens'] as Array<unknown>).length, 1);
});
