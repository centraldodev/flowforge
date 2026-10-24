import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demo,
  run,
  syncGraphCode,
  executeProjectCode,
  getBlocksForScreen,
  generateScreenCode,
  generateAllScreensCode,
  type Graph,
} from '../src/engine';

test('getBlocksForScreen separa blocos por tela corretamente', () => {
  const loginBlocks = getBlocksForScreen(demo, 'login');
  const homeBlocks = getBlocksForScreen(demo, 'home');

  assert.ok(loginBlocks.some((b) => b.id === 'login'));
  assert.ok(loginBlocks.some((b) => b.id === 'email'));
  assert.ok(loginBlocks.some((b) => b.id === 'btn_entrar'));
  assert.ok(!loginBlocks.some((b) => b.id === 'home'));
  assert.ok(!loginBlocks.some((b) => b.id === 'msg_boas_vindas'));

  assert.ok(homeBlocks.some((b) => b.id === 'home'));
  assert.ok(homeBlocks.some((b) => b.id === 'boas_vindas'));
  assert.ok(!homeBlocks.some((b) => b.id === 'login'));
  assert.ok(!homeBlocks.some((b) => b.id === 'email'));
});

test('generateScreenCode gera arquivo único de código JS funcional para a tela', async () => {
  const screenJs = generateScreenCode(demo, 'login');

  assert.ok(screenJs.includes('(login.js)'));
  assert.ok(screenJs.includes('export const SCREEN_ID = "login";'));
  assert.ok(screenJs.includes('export function createScreenRunner'));

  // Testar sintaxe convertendo exports para escopo de função
  const executable = screenJs
    .replace(/export const SCREEN_ID =/g, 'const SCREEN_ID =')
    .replace(/export const SCREEN_NAME =/g, 'const SCREEN_NAME =')
    .replace(/export function createScreenRunner/g, 'function createScreenRunner')
    .replace(/export const createLoginRunner =/g, 'const createLoginRunner =');

  let factory!: {
    SCREEN_ID: string;
    createScreenRunner: (inputs?: Record<string, unknown>) => {
      execute: (blockId: string) => Promise<unknown>;
      getScreen: () => string;
    };
  };
  assert.doesNotThrow(() => {
    factory = new Function(
      `${executable}; return { SCREEN_ID, createScreenRunner };`,
    )() as typeof factory;
  }, 'Código da tela login deve ser JavaScript sintaticamente válido');

  assert.equal(factory.SCREEN_ID, 'login');
  const runner = factory.createScreenRunner({
    email: 'demo@exemplo.com',
    senha: '123456',
  });

  await runner.execute('btn_entrar');
  assert.equal(runner.getScreen(), 'home');
});

test('generateAllScreensCode gera arquivo único de código para cada tela cadastrada', () => {
  const screensCode = generateAllScreensCode(demo);
  const screenKeys = Object.keys(screensCode);

  assert.ok(screenKeys.includes('login'));
  assert.ok(screenKeys.includes('home'));

  for (const screenId of screenKeys) {
    const code = screensCode[screenId];
    assert.ok(code.length > 50, `Código da tela ${screenId} não deve estar vazio`);
    assert.ok(code.includes(`(${screenId}.js)`));
    assert.ok(code.includes('createScreenRunner'));
  }
});

test('bloco notify: exibe notificação visual de sucesso, continua fluxo e gera código funcional', async () => {
  const g: Graph = {
    version: 1,
    name: 'Projeto com Notificação',
    nodes: [
      {
        id: 'tela_perfil',
        position: { x: 40, y: 40 },
        data: { kind: 'screen', label: 'Meu Perfil', config: {} },
      },
      {
        id: 'btn_salvar',
        position: { x: 440, y: 100 },
        data: { kind: 'button', label: 'Salvar Alterações', config: { screenId: 'tela_perfil' } },
      },
      {
        id: 'alerta_sucesso',
        position: { x: 860, y: 100 },
        data: {
          kind: 'notify',
          label: 'Aviso de Sucesso',
          config: {
            screenId: 'tela_perfil',
            type: 'success',
            message: 'Perfil atualizado com sucesso!',
            duration: '4000',
          },
        },
      },
      {
        id: 'ir_para_dashboard',
        position: { x: 1280, y: 100 },
        data: {
          kind: 'navigate',
          label: 'Ir para Dashboard',
          config: { screenId: 'tela_perfil', target: 'dashboard' },
        },
      },
      {
        id: 'dashboard',
        position: { x: 1700, y: 100 },
        data: { kind: 'screen', label: 'Dashboard', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_salvar',
        target: 'alerta_sucesso',
        sourceHandle: 'onClick',
        targetHandle: 'trigger',
      },
      {
        id: 'e2',
        source: 'alerta_sucesso',
        target: 'ir_para_dashboard',
        sourceHandle: 'next',
        targetHandle: 'listener',
      },
    ],
  };

  // 1. Simulação via run()
  const simResult = run(g, 'btn_salvar');
  assert.equal(simResult.screen, 'dashboard');
  assert.ok(simResult.messages.some((m) => m.includes('[SUCCESS] Perfil atualizado com sucesso!')));
  assert.ok(
    simResult.trace.some((t) => t.message.includes('Notificação [SUCCESS]: Perfil atualizado')),
  );

  // 2. Execução JavaScript real via executeProjectCode()
  const synced = syncGraphCode(g);
  const execResult = await executeProjectCode(synced, 'btn_salvar');
  assert.equal(execResult.screen, 'dashboard');
  assert.equal(execResult.notifications.length, 1);
  assert.equal(execResult.notifications[0].type, 'success');
  assert.equal(execResult.notifications[0].message, 'Perfil atualizado com sucesso!');
  assert.equal(execResult.notifications[0].duration, 4000);

  // 3. Código gerado autônomo da tela (tela_perfil.js)
  const screenJs = generateScreenCode(synced, 'tela_perfil');
  assert.ok(screenJs.includes('function alerta_sucesso('));
  assert.ok(screenJs.includes("type = 'success'"));
  assert.ok(screenJs.includes('Perfil atualizado com sucesso!'));
  assert.ok(screenJs.includes('return ir_para_dashboard('));
});

test('bloco state: salva, lê e altera variáveis no store na simulação e no código JS real', async () => {
  const g: Graph = {
    version: 1,
    name: 'State Test',
    nodes: [
      {
        id: 'checkout',
        position: { x: 0, y: 100 },
        data: { kind: 'screen', label: 'Checkout', config: {} },
      },
      {
        id: 'btn_aplicar_cupom',
        position: { x: 400, y: 100 },
        data: { kind: 'button', label: 'Aplicar Cupom', config: { screenId: 'checkout' } },
      },
      {
        id: 'guardar_cupom',
        position: { x: 840, y: 100 },
        data: {
          kind: 'state',
          label: 'Salvar Cupom no Estado',
          config: {
            screenId: 'checkout',
            operation: 'set',
            key: 'cupom_desconto',
            value: 'PROMO10',
          },
        },
      },
      {
        id: 'notif_cupom',
        position: { x: 1280, y: 100 },
        data: {
          kind: 'notify',
          label: 'Notificação do Cupom',
          config: {
            screenId: 'checkout',
            type: 'success',
            message: 'Cupom aplicado!',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_aplicar_cupom',
        target: 'guardar_cupom',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'guardar_cupom',
        target: 'notif_cupom',
        sourceHandle: 'next',
        targetHandle: 'trigger',
      },
    ],
  };

  // 1. Simulação via run()
  const simResult = run(g, 'btn_aplicar_cupom');
  assert.ok(simResult.trace.some((t) => t.id === 'guardar_cupom'));
  assert.ok(simResult.messages.some((m) => m.includes('Cupom aplicado!')));

  // 2. Execução JavaScript real via executeProjectCode()
  const synced = syncGraphCode(g);
  const execResult = await executeProjectCode(synced, 'btn_aplicar_cupom');
  assert.equal(execResult.store['cupom_desconto'], 'PROMO10');
  assert.equal(execResult.notifications.length, 1);
  assert.equal(execResult.notifications[0].message, 'Cupom aplicado!');

  // 3. Código gerado para a tela
  const screenJs = generateScreenCode(synced, 'checkout');
  assert.ok(screenJs.includes("const key = 'cupom_desconto'"));
  assert.ok(screenJs.includes("const op = 'set'"));
  assert.ok(screenJs.includes('setVar(key, val)'));
  assert.ok(screenJs.includes('return notif_cupom('));
});

test('bloco validator: valida formato/regras e ramifica para valid ou invalid no fluxo e código gerado', async () => {
  const g: Graph = {
    version: 1,
    name: 'Validator Test',
    nodes: [
      {
        id: 'form_screen',
        position: { x: 0, y: 100 },
        data: { kind: 'screen', label: 'Formulário', config: {} },
      },
      {
        id: 'campo_email',
        position: { x: 400, y: 100 },
        data: {
          kind: 'input',
          label: 'E-mail',
          config: { field: 'email', value: 'usuario@teste.com', screenId: 'form_screen' },
        },
      },
      {
        id: 'btn_validar',
        position: { x: 400, y: 260 },
        data: { kind: 'button', label: 'Validar E-mail', config: { screenId: 'form_screen' } },
      },
      {
        id: 'valida_email',
        position: { x: 840, y: 200 },
        data: {
          kind: 'validator',
          label: 'Validador de E-mail',
          config: {
            screenId: 'form_screen',
            rule: 'email',
            message: 'E-mail fornecido é inválido!',
          },
        },
      },
      {
        id: 'notif_valido',
        position: { x: 1280, y: 120 },
        data: {
          kind: 'notify',
          label: 'Sucesso',
          config: { screenId: 'form_screen', type: 'success', message: 'E-mail válido!' },
        },
      },
      {
        id: 'notif_invalido',
        position: { x: 1280, y: 280 },
        data: {
          kind: 'notify',
          label: 'Erro',
          config: { screenId: 'form_screen', type: 'error', message: 'E-mail inválido!' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_validar',
        target: 'valida_email',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'campo_email',
        target: 'valida_email',
        sourceHandle: 'value',
        targetHandle: 'value',
      },
      {
        id: 'e3',
        source: 'valida_email',
        target: 'notif_valido',
        sourceHandle: 'valid',
        targetHandle: 'trigger',
      },
      {
        id: 'e4',
        source: 'valida_email',
        target: 'notif_invalido',
        sourceHandle: 'invalid',
        targetHandle: 'trigger',
      },
    ],
  };

  // 1. Caso Válido (usuario@teste.com)
  const simValid = run(g, 'btn_validar');
  assert.ok(simValid.messages.some((m) => m.includes('E-mail válido!')));

  const synced = syncGraphCode(g);
  const execValid = await executeProjectCode(synced, 'btn_validar', {
    campo_email: 'usuario@teste.com',
  });
  assert.equal(execValid.notifications[0].type, 'success');
  assert.equal(execValid.notifications[0].message, 'E-mail válido!');

  // 2. Caso Inválido (sem formato de e-mail)
  const simInvalid = run(g, 'btn_validar', { campo_email: 'texto_invalido' });
  assert.ok(simInvalid.messages.some((m) => m.includes('E-mail inválido!')));

  const execInvalid = await executeProjectCode(synced, 'btn_validar', {
    campo_email: 'texto_invalido',
  });
  assert.equal(execInvalid.notifications[0].type, 'error');
  assert.equal(execInvalid.notifications[0].message, 'E-mail inválido!');

  // 3. Código gerado da tela
  const screenJs = generateScreenCode(synced, 'form_screen');
  assert.ok(screenJs.includes("validate(value, 'email'"));
  assert.ok(screenJs.includes('if (validation.valid)'));
  assert.ok(screenJs.includes('return notif_valido('));
  assert.ok(screenJs.includes('return notif_invalido('));
});

test('bloco switch: avalia múltiplos casos e roteia o fluxo para o branch correspondente', async () => {
  const g: Graph = {
    version: 1,
    name: 'Switch Test',
    nodes: [
      {
        id: 'tela_role',
        position: { x: 0, y: 100 },
        data: { kind: 'screen', label: 'Seleção de Perfil', config: {} },
      },
      {
        id: 'btn_rotear',
        position: { x: 400, y: 100 },
        data: { kind: 'button', label: 'Entrar no Sistema', config: { screenId: 'tela_role' } },
      },
      {
        id: 'roteador',
        position: { x: 840, y: 100 },
        data: {
          kind: 'switch',
          label: 'Roteador de Acesso',
          config: {
            screenId: 'tela_role',
            cases: 'admin, cliente',
            value: 'admin',
          },
        },
      },
      {
        id: 'tela_admin',
        position: { x: 1280, y: 0 },
        data: { kind: 'screen', label: 'Painel Admin', config: {} },
      },
      {
        id: 'tela_cliente',
        position: { x: 1280, y: 140 },
        data: { kind: 'screen', label: 'Área do Cliente', config: {} },
      },
      {
        id: 'tela_padrao',
        position: { x: 1280, y: 280 },
        data: { kind: 'screen', label: 'Página Padrão', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_rotear',
        target: 'roteador',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'roteador',
        target: 'tela_admin',
        sourceHandle: 'case1',
        targetHandle: 'onEnter',
      },
      {
        id: 'e3',
        source: 'roteador',
        target: 'tela_cliente',
        sourceHandle: 'case2',
        targetHandle: 'onEnter',
      },
      {
        id: 'e4',
        source: 'roteador',
        target: 'tela_padrao',
        sourceHandle: 'default',
        targetHandle: 'onEnter',
      },
    ],
  };

  // 1. Simulação com admin -> deve ir para tela_admin
  const simAdmin = run(g, 'btn_rotear');
  assert.equal(simAdmin.screen, 'tela_admin');

  // 2. Simulação com cliente -> deve ir para tela_cliente
  const gCliente: Graph = {
    ...g,
    nodes: g.nodes.map((n) =>
      n.id === 'roteador'
        ? { ...n, data: { ...n.data, config: { ...n.data.config, value: 'cliente' } } }
        : n,
    ),
  };
  const simCliente = run(gCliente, 'btn_rotear');
  assert.equal(simCliente.screen, 'tela_cliente');

  // 3. Execução JS real com valor default -> deve ir para tela_padrao
  const gDefault: Graph = {
    ...g,
    nodes: g.nodes.map((n) =>
      n.id === 'roteador'
        ? { ...n, data: { ...n.data, config: { ...n.data.config, value: 'visitante' } } }
        : n,
    ),
  };
  const synced = syncGraphCode(gDefault);
  const execDefault = await executeProjectCode(synced, 'btn_rotear');
  assert.equal(execDefault.screen, 'tela_padrao');

  // 4. Código gerado contém estrutura condicional do switch
  const screenJs = generateScreenCode(synced, 'tela_role');
  assert.ok(screenJs.includes('value).toLowerCase() === "admin"'));
  assert.ok(screenJs.includes('return tela_admin('));
  assert.ok(screenJs.includes('return tela_padrao('));
});

test('bloco delay: aguarda intervalo de tempo configurado antes de prosseguir', async () => {
  const g: Graph = {
    version: 1,
    name: 'Delay Test',
    nodes: [
      {
        id: 'splash',
        position: { x: 0, y: 100 },
        data: { kind: 'screen', label: 'Splash Screen', config: {} },
      },
      {
        id: 'btn_splash',
        position: { x: 400, y: 100 },
        data: { kind: 'button', label: 'Carregar App', config: { screenId: 'splash' } },
      },
      {
        id: 'timer_splash',
        position: { x: 840, y: 100 },
        data: {
          kind: 'delay',
          label: 'Aguardar Carregamento',
          config: { screenId: 'splash', duration: '15' },
        },
      },
      {
        id: 'home_screen',
        position: { x: 1280, y: 100 },
        data: { kind: 'screen', label: 'Tela Inicial', config: {} },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_splash',
        target: 'timer_splash',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'timer_splash',
        target: 'home_screen',
        sourceHandle: 'next',
        targetHandle: 'onEnter',
      },
    ],
  };

  // 1. Simulação via run()
  const simResult = run(g, 'btn_splash');
  assert.equal(simResult.screen, 'home_screen');
  assert.ok(simResult.trace.some((t) => t.message.includes('Timer de 15ms')));

  // 2. Execução JavaScript real via executeProjectCode()
  const synced = syncGraphCode(g);
  const startTime = Date.now();
  const execResult = await executeProjectCode(synced, 'btn_splash');
  const elapsed = Date.now() - startTime;
  assert.equal(execResult.screen, 'home_screen');
  assert.ok(elapsed >= 10, `Tempo decorrido (${elapsed}ms) deve ser de pelo menos 10ms`);

  // 3. Código gerado da tela
  const screenJs = generateScreenCode(synced, 'splash');
  assert.ok(screenJs.includes('async function timer_splash('));
  assert.ok(screenJs.includes('await sleep(15)'));
  assert.ok(screenJs.includes('return home_screen('));
});
