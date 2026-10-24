import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demo,
  validate,
  validateConnection,
  parseGraph,
  isTypeCompatible,
  parseValueType,
  formatValueType,
  getPortDefinition,
  type Graph,
  type Block,
  type ValueType,
} from '../src/engine';
import { connect, addPortToBlock } from '../src/state/graphOps';

// ============================================================================
// 1. COMPATIBILIDADE DE TIPOS (MATRIZ FORMAL)
// ============================================================================

test('Fase 2: tipos idênticos conectam e tipos primitivos incompatíveis são rejeitados', () => {
  assert.equal(isTypeCompatible({ kind: 'string' }, { kind: 'string' }), true);
  assert.equal(isTypeCompatible({ kind: 'number' }, { kind: 'number' }), true);
  assert.equal(isTypeCompatible({ kind: 'boolean' }, { kind: 'boolean' }), true);
  assert.equal(isTypeCompatible({ kind: 'null' }, { kind: 'null' }), true);
  assert.equal(isTypeCompatible({ kind: 'error' }, { kind: 'error' }), true);

  assert.equal(isTypeCompatible({ kind: 'string' }, { kind: 'number' }), false);
  assert.equal(isTypeCompatible({ kind: 'number' }, { kind: 'boolean' }), false);
  assert.equal(isTypeCompatible({ kind: 'boolean' }, { kind: 'string' }), false);
});

test('Fase 2: any conecta explicitamente com qualquer tipo', () => {
  assert.equal(isTypeCompatible({ kind: 'any' }, { kind: 'string' }), true);
  assert.equal(isTypeCompatible({ kind: 'any' }, { kind: 'number' }), true);
  assert.equal(isTypeCompatible({ kind: 'string' }, { kind: 'any' }), true);
  assert.equal(isTypeCompatible({ kind: 'object', name: 'User' }, { kind: 'any' }), true);
  assert.equal(isTypeCompatible({ kind: 'any' }, { kind: 'object', name: 'User' }), true);
});

test('Fase 2: object nominal respeita name quando fornecido', () => {
  const user: ValueType = { kind: 'object', name: 'User' };
  const sameUser: ValueType = { kind: 'object', name: 'User' };
  const product: ValueType = { kind: 'object', name: 'Product' };
  const genericObject: ValueType = { kind: 'object' };

  assert.equal(isTypeCompatible(user, sameUser), true);
  assert.equal(isTypeCompatible(user, product), false);
  assert.equal(isTypeCompatible(user, genericObject), true);
  assert.equal(isTypeCompatible(genericObject, user), false);
});

test('Fase 2: arrays verificam item recursivamente', () => {
  const strArray: ValueType = { kind: 'array', item: { kind: 'string' } };
  const numArray: ValueType = { kind: 'array', item: { kind: 'number' } };
  const userArray: ValueType = { kind: 'array', item: { kind: 'object', name: 'User' } };
  const prodArray: ValueType = { kind: 'array', item: { kind: 'object', name: 'Product' } };

  assert.equal(isTypeCompatible(strArray, strArray), true);
  assert.equal(isTypeCompatible(strArray, numArray), false);
  assert.equal(isTypeCompatible(userArray, prodArray), false);
  assert.equal(
    isTypeCompatible(userArray, { kind: 'array', item: { kind: 'object', name: 'User' } }),
    true,
  );
});

test('Fase 2: unions verificam membros', () => {
  const strOrNum: ValueType = {
    kind: 'union',
    members: [{ kind: 'string' }, { kind: 'number' }],
  };

  // Membro individual conecta em union destino
  assert.equal(isTypeCompatible({ kind: 'string' }, strOrNum), true);
  assert.equal(isTypeCompatible({ kind: 'number' }, strOrNum), true);
  assert.equal(isTypeCompatible({ kind: 'boolean' }, strOrNum), false);

  // Union origem conectando em tipo destino
  assert.equal(isTypeCompatible(strOrNum, { kind: 'string' }), false);

  // Union origem em union destino mais ampla
  const strOrNumOrBool: ValueType = {
    kind: 'union',
    members: [{ kind: 'string' }, { kind: 'number' }, { kind: 'boolean' }],
  };
  assert.equal(isTypeCompatible(strOrNum, strOrNumOrBool), true);
});

test('Fase 2: parseValueType e formatValueType mantêm equivalência bidirecional', () => {
  assert.equal(formatValueType(parseValueType('string')), 'string');
  assert.equal(formatValueType(parseValueType('number')), 'number');
  assert.equal(formatValueType(parseValueType('User')), 'User');
  assert.equal(formatValueType(parseValueType('string[]')), 'string[]');
  assert.equal(formatValueType(parseValueType('string | number')), 'string | number');
});

// ============================================================================
// 2. CRITÉRIO DE ACEITE: USER -> NUMBER REJEITADO COM MENSAGEM LOCALIZADA
// ============================================================================

test('Fase 2: User -> number é rejeitado com mensagem localizada nos dois blocos e portas', () => {
  const g: Graph = {
    version: 1,
    name: 'Type Mismatch Test',
    nodes: [
      {
        id: 'bloco_origem',
        position: { x: 0, y: 0 },
        data: {
          kind: 'auth',
          label: 'Bloco Autenticação',
          config: {},
          ports: [
            {
              id: 'user',
              name: 'user',
              direction: 'output',
              mode: 'data',
              cardinality: 'many',
              valueType: { kind: 'object', name: 'User' },
            },
          ],
        },
      },
      {
        id: 'bloco_destino',
        position: { x: 400, y: 0 },
        data: {
          kind: 'delay',
          label: 'Bloco Temporizador',
          config: {},
          ports: [
            {
              id: 'duration',
              name: 'duration',
              direction: 'input',
              mode: 'data',
              cardinality: 'one',
              valueType: { kind: 'number' },
            },
          ],
        },
      },
    ],
    edges: [],
  };

  const err = validateConnection(g, {
    source: 'bloco_origem',
    target: 'bloco_destino',
    sourceHandle: 'user',
    targetHandle: 'duration',
  });

  assert.ok(err, 'Deve retornar erro de validação');
  // Mensagem localizada contendo os dois blocos, as duas portas e os dois tipos
  assert.ok(err.includes('Bloco Autenticação'), 'Deve mencionar label do bloco origem');
  assert.ok(err.includes('Bloco Temporizador'), 'Deve mencionar label do bloco destino');
  assert.ok(err.includes('user'), 'Deve mencionar o nome da porta de saída');
  assert.ok(err.includes('duration'), 'Deve mencionar o nome da porta de entrada');
  assert.ok(err.includes('User'), 'Deve mencionar o tipo User');
  assert.ok(err.includes('number'), 'Deve mencionar o tipo number');
});

// ============================================================================
// 3. CARDINALIDADE: ONE VS MANY E FAN-OUT
// ============================================================================

test('Fase 2: porta com cardinality: one aceita 1 conexão e rejeita a segunda conexão', () => {
  const g: Graph = {
    version: 1,
    name: 'Cardinality One Test',
    nodes: [
      {
        id: 'input_a',
        position: { x: 0, y: 0 },
        data: {
          kind: 'input',
          label: 'Campo A',
          config: {},
          ports: [
            {
              id: 'val_unic',
              name: 'val_unic',
              direction: 'output',
              mode: 'data',
              cardinality: 'one',
              valueType: { kind: 'string' },
            },
          ],
        },
      },
      {
        id: 'fn_1',
        position: { x: 400, y: 0 },
        data: {
          kind: 'function',
          label: 'Função 1',
          config: {},
          ports: [
            {
              id: 'value',
              name: 'value',
              direction: 'input',
              mode: 'data',
              cardinality: 'one',
              valueType: { kind: 'string' },
            },
          ],
        },
      },
      {
        id: 'fn_2',
        position: { x: 400, y: 200 },
        data: {
          kind: 'function',
          label: 'Função 2',
          config: {},
          ports: [
            {
              id: 'value',
              name: 'value',
              direction: 'input',
              mode: 'data',
              cardinality: 'one',
              valueType: { kind: 'string' },
            },
          ],
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'input_a',
        target: 'fn_1',
        sourceHandle: 'val_unic',
        targetHandle: 'value',
      },
    ],
  };

  // A primeira conexão já consome a única saída permitida de input_a.val_unic
  const err = validateConnection(g, {
    source: 'input_a',
    target: 'fn_2',
    sourceHandle: 'val_unic',
    targetHandle: 'value',
  });

  assert.ok(err);
  assert.ok(err.includes('cardinalidade: one'));
  assert.ok(err.includes('Campo A'));
});

test('Fase 2: fan-out funciona apenas onde declarado (cardinality: many)', () => {
  const scr: Block = {
    id: 'tela_fanout',
    position: { x: -300, y: 0 },
    data: { kind: 'screen', label: 'Tela Fanout', config: {} },
  };

  const btn: Block = {
    id: 'btn_inicio',
    position: { x: 0, y: 0 },
    data: {
      kind: 'button',
      label: 'Botão Fanout',
      config: { screenId: 'tela_fanout' },
      ports: [
        {
          id: 'onClick',
          name: 'onClick',
          direction: 'output',
          mode: 'control',
          cardinality: 'many',
        },
      ],
    },
  };

  const fn1: Block = {
    id: 'fn_1',
    position: { x: 400, y: 0 },
    data: {
      kind: 'function',
      label: 'Consumidor 1',
      config: {},
      ports: [
        {
          id: 'execute',
          name: 'execute',
          direction: 'input',
          mode: 'control',
          cardinality: 'many',
        },
      ],
    },
  };

  const fn2: Block = {
    id: 'fn_2',
    position: { x: 400, y: 200 },
    data: {
      kind: 'function',
      label: 'Consumidor 2',
      config: {},
      ports: [
        {
          id: 'execute',
          name: 'execute',
          direction: 'input',
          mode: 'control',
          cardinality: 'many',
        },
      ],
    },
  };

  let g: Graph = {
    version: 1,
    name: 'Fanout Graph',
    nodes: [scr, btn, fn1, fn2],
    edges: [],
  };

  // Conecta consumidor 1
  g = connect(g, {
    source: btn.id,
    target: fn1.id,
    sourceHandle: 'onClick',
    targetHandle: 'execute',
  });
  assert.equal(g.edges.length, 1);

  // Conecta consumidor 2 (fan-out do mesmo onClick)
  g = connect(g, {
    source: btn.id,
    target: fn2.id,
    sourceHandle: 'onClick',
    targetHandle: 'execute',
  });
  assert.equal(g.edges.length, 2);
  assert.equal(validate(g).length, 0);
});

test('Fase 2: entrada data/one rejeita múltiplas fontes simultâneas', () => {
  const g: Graph = {
    version: 1,
    name: 'Data Input Single Source',
    nodes: [
      {
        id: 'campo_1',
        position: { x: 0, y: 0 },
        data: { kind: 'input', label: 'Campo 1', config: {} },
      },
      {
        id: 'campo_2',
        position: { x: 0, y: 150 },
        data: { kind: 'input', label: 'Campo 2', config: {} },
      },
      {
        id: 'consumidor',
        position: { x: 400, y: 0 },
        data: { kind: 'function', label: 'Consumidor', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'campo_1',
        target: 'consumidor',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
    ],
  };

  const err = validateConnection(g, {
    source: 'campo_2',
    target: 'consumidor',
    sourceHandle: 'value',
    targetHandle: 'value',
  });

  assert.ok(err);
  assert.ok(err.includes('cardinalidade: one'));
  assert.ok(err.includes('Consumidor'));
});

// ============================================================================
// 4. VALIDAÇÃO NÃO DEPENDE DE SUBSTRINGS DO ID DA PORTA
// ============================================================================

test('Fase 2: a validação não depende de substrings do ID da porta (onClick, listener, on, etc)', () => {
  const g: Graph = {
    version: 1,
    name: 'No String Heuristics',
    nodes: [
      {
        id: 'bloco_a',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Bloco A',
          config: {},
          ports: [
            // Porta de controle com nome totalmente arbitrário, sem prefixo "on" ou "click"
            {
              id: 'disparo_especial',
              name: 'disparo_especial',
              direction: 'output',
              mode: 'control',
              cardinality: 'many',
            },
            // Porta de dados cujo nome contém "listener" e "on" (mas é DADO)
            {
              id: 'online_listener_count',
              name: 'online_listener_count',
              direction: 'output',
              mode: 'data',
              cardinality: 'many',
              valueType: { kind: 'number' },
            },
          ],
        },
      },
      {
        id: 'bloco_b',
        position: { x: 400, y: 0 },
        data: {
          kind: 'function',
          label: 'Bloco B',
          config: {},
          ports: [
            // Entrada de controle com nome totalmente arbitrário, sem "listener", "execute" ou "handler"
            {
              id: 'ponto_de_entrada',
              name: 'ponto_de_entrada',
              direction: 'input',
              mode: 'control',
              cardinality: 'many',
            },
            // Entrada de dados para receber número
            {
              id: 'quantidade',
              name: 'quantidade',
              direction: 'input',
              mode: 'data',
              cardinality: 'one',
              valueType: { kind: 'number' },
            },
          ],
        },
      },
    ],
    edges: [],
  };

  // 1. Controle conecta com controle mesmo com nomes arbitrários
  const errControl = validateConnection(g, {
    source: 'bloco_a',
    target: 'bloco_b',
    sourceHandle: 'disparo_especial',
    targetHandle: 'ponto_de_entrada',
  });
  assert.equal(errControl, null);

  // 2. Dados conectam com dados mesmo que o nome do handle contenha "online_listener"
  const errData = validateConnection(g, {
    source: 'bloco_a',
    target: 'bloco_b',
    sourceHandle: 'online_listener_count',
    targetHandle: 'quantidade',
  });
  assert.equal(errData, null);

  // 3. Conectar dado "online_listener_count" (que contém listener) em ponto de controle é REJEITADO por modo!
  const errMismatch = validateConnection(g, {
    source: 'bloco_a',
    target: 'bloco_b',
    sourceHandle: 'online_listener_count',
    targetHandle: 'ponto_de_entrada',
  });
  assert.ok(errMismatch);
  assert.ok(errMismatch.includes('Incompatibilidade de modo'));
});

// ============================================================================
// 5. PORTAS PERSONALIZADAS EXIGEM TIPO QUANDO FOREM DE DADOS
// ============================================================================

test('Fase 2: portas personalizadas devem exigir mode, cardinality e tipo quando forem de dados', () => {
  const g: Graph = {
    version: 1,
    name: 'Custom Port Validation',
    nodes: [
      {
        id: 'fn_custom',
        position: { x: 0, y: 0 },
        data: { kind: 'function', label: 'Função Custom', config: {} },
      },
    ],
    edges: [],
  };

  // Tentar adicionar porta personalizada de dados sem tipo deve lançar erro
  assert.throws(
    () =>
      addPortToBlock(g, 'fn_custom', {
        id: 'dado_sem_tipo',
        name: 'dado_sem_tipo',
        direction: 'output',
        mode: 'data',
      }),
    /Portas de dados personalizadas devem especificar tipo de dado/,
  );

  // Com tipo de dado especificado, adiciona com sucesso
  const gOk = addPortToBlock(g, 'fn_custom', {
    id: 'dado_com_tipo',
    name: 'dado_com_tipo',
    direction: 'output',
    mode: 'data',
    type: 'string',
    cardinality: 'many',
  });
  const node = gOk.nodes.find((n: Block) => n.id === 'fn_custom')!;
  const port = getPortDefinition(node, 'dado_com_tipo');
  assert.ok(port);
  assert.equal(port.mode, 'data');
  assert.deepEqual(port.valueType, { kind: 'string' });
});

// ============================================================================
// 6. MIGRAÇÃO E COMPATIBILIDADE COM GRAFOS ANTIGOS (VERSION 1)
// ============================================================================

test('Fase 2: normalização e leitura de projetos antigos sem perda de compatibilidade', () => {
  const rawLegacyJson = JSON.stringify({
    version: 1,
    name: 'Legacy Project',
    nodes: [
      {
        id: 'tela_legada',
        position: { x: -200, y: 0 },
        data: {
          kind: 'screen',
          label: 'Tela Legada',
          config: {},
          ports: [{ id: 'onEnter', name: 'onEnter', direction: 'input', type: 'Event' }],
        },
      },
      {
        id: 'btn_legado',
        position: { x: 0, y: 0 },
        data: {
          kind: 'button',
          label: 'Botão Antigo',
          config: { screenId: 'tela_legada' },
          ports: [
            // Porta antiga sem mode, cardinality ou valueType estruturado
            { id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' },
            { id: 'value', name: 'value', direction: 'output', type: 'string' },
          ],
        },
      },
      {
        id: 'fn_legada',
        position: { x: 200, y: 0 },
        data: {
          kind: 'function',
          label: 'Função Antiga',
          config: {},
          ports: [{ id: 'execute', name: 'execute', direction: 'input', type: 'Event' }],
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_legado',
        target: 'fn_legada',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  });

  const parsed = parseGraph(rawLegacyJson);
  assert.equal(parsed.version, 1);
  const btn = parsed.nodes.find((n) => n.id === 'btn_legado')!;
  assert.ok(btn.data.ports);
  const onClick = btn.data.ports.find((p) => p.id === 'onClick')!;
  assert.equal(onClick.mode, 'control');
  assert.equal(onClick.cardinality, 'many');

  const valPort = btn.data.ports.find((p) => p.id === 'value')!;
  assert.equal(valPort.mode, 'data');
  assert.deepEqual(valPort.valueType, { kind: 'string' });

  // Validação do grafo migrado não deve ter erros
  assert.equal(validate(parsed).length, 0);
});

test('Fase 2: projeto demo continua abrindo e passando 100% na validação', () => {
  assert.equal(demo.version, 1);
  const errors = validate(demo);
  assert.deepEqual(errors, [], `O projeto demo deve ser 100% válido: ${errors.join(', ')}`);
});
