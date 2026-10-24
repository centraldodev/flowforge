import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import type { Block, Graph } from '../src/engine/types';
import {
  evaluateBinding,
  evaluateListItems,
  evaluateScreenState,
  isComponentVisible,
  migrateAllScreens,
  migrateScreenToUI,
  resolvePath,
  validateAllScreensForPlatform,
  validateUIForPlatform,
  type EvaluationScope,
  type ScreenUI,
  type UIComponent,
} from '../src/compiler/ui';
import { ScreenFields } from '../src/features/preview/ScreenFields';
import { addPythonProject } from '../src/export/python';

test('Fase 8: migrateScreenToUI migra telas legadas para uma coluna simples e flexível', () => {
  const screenBlock: Block = {
    id: 'tela_login',
    type: 'custom',
    position: { x: 100, y: 200 },
    data: {
      kind: 'screen',
      label: 'Login',
      config: { title: 'Acesse sua conta' },
    },
  };

  const inputBlock: Block = {
    id: 'campo_email',
    type: 'custom',
    position: { x: 100, y: 300 },
    data: {
      kind: 'input',
      label: 'E-mail corporativo',
      config: {
        screenId: 'tela_login',
        field: 'email',
        placeholder: 'nome@empresa.com',
      },
    },
  };

  const buttonBlock: Block = {
    id: 'btn_entrar',
    type: 'custom',
    position: { x: 100, y: 400 },
    data: {
      kind: 'button',
      label: 'Entrar',
      config: {
        screenId: 'tela_login',
      },
    },
  };

  const graph: Graph = {
    version: 1,
    name: 'App Teste',
    nodes: [screenBlock, inputBlock, buttonBlock],
    edges: [],
  };

  const screenUI = migrateScreenToUI(screenBlock, graph);

  assert.equal(screenUI.screenId, 'tela_login');
  assert.equal(screenUI.title, 'Acesse sua conta');
  assert.equal(screenUI.root.type, 'container');

  if (screenUI.root.type === 'container') {
    assert.equal(screenUI.root.layout?.type, 'flex');
    assert.equal(screenUI.root.layout?.direction, 'column');
    assert.equal(screenUI.root.children.length, 2);

    const emailComp = screenUI.root.children[0];
    assert.equal(emailComp.type, 'input');
    if (emailComp.type === 'input') {
      assert.equal(emailComp.inputType, 'email');
      assert.equal(emailComp.label, 'E-mail corporativo');
      assert.equal(emailComp.placeholder, 'nome@empresa.com');
    }

    const btnComp = screenUI.root.children[1];
    assert.equal(btnComp.type, 'button');
    if (btnComp.type === 'button') {
      assert.equal(btnComp.label, 'Entrar');
      assert.equal(btnComp.actionEvent, 'btn_entrar');
    }
  }
});

test('Fase 8: layout não depende das coordenadas (x, y) do canvas', () => {
  const createGraphAt = (x: number, y: number): Graph => ({
    version: 1,
    name: 'Layout Independente',
    nodes: [
      {
        id: 'scr1',
        type: 'custom',
        position: { x, y },
        data: { kind: 'screen', label: 'Tela', config: { title: 'Home' } },
      },
      {
        id: 'txt1',
        type: 'custom',
        position: { x: x + 500, y: y - 1000 },
        data: {
          kind: 'text',
          label: 'Boas-vindas',
          config: { screenId: 'scr1', text: 'Olá Mundo', style: 'heading' },
        },
      },
      {
        id: 'btn1',
        type: 'custom',
        position: { x: -9999, y: 8888 },
        data: {
          kind: 'button',
          label: 'Avançar',
          config: { screenId: 'scr1' },
        },
      },
    ],
    edges: [],
  });

  const g1 = createGraphAt(0, 0);
  const g2 = createGraphAt(5000, -3200);

  const ui1 = migrateScreenToUI(g1.nodes[0], g1);
  const ui2 = migrateScreenToUI(g2.nodes[0], g2);

  // Ambas as árvores de UI devem ter a mesma estrutura, sem qualquer campo x ou y
  assert.deepEqual(ui1, ui2);
});

test('Fase 8: avaliação de bindings tipados (literal, path, binary)', () => {
  const scope: EvaluationScope = {
    store: {
      user: {
        name: 'Maria Silva',
        age: 30,
        isAdmin: true,
      },
      items: [10, 20, 30],
    },
    inputs: {
      query: 'notebook',
    },
    variables: {
      counter: 5,
    },
  };

  // 1. Literal
  assert.equal(evaluateBinding({ kind: 'literal', value: 42 }, scope), 42);

  // 2. Dotted path resolution
  assert.equal(resolvePath(scope, 'store.user.name'), 'Maria Silva');
  assert.equal(resolvePath(scope, 'user.name'), 'Maria Silva');
  assert.equal(resolvePath(scope, 'inputs.query'), 'notebook');
  assert.equal(resolvePath(scope, 'variables.counter'), 5);

  // 3. Binary operations
  assert.equal(
    evaluateBinding(
      {
        kind: 'binary',
        op: 'eq',
        left: { kind: 'path', path: 'user.name' },
        right: { kind: 'literal', value: 'Maria Silva' },
      },
      scope,
    ),
    true,
  );

  assert.equal(
    evaluateBinding(
      {
        kind: 'binary',
        op: 'gt',
        left: { kind: 'path', path: 'user.age' },
        right: { kind: 'literal', value: 18 },
      },
      scope,
    ),
    true,
  );

  assert.equal(
    evaluateBinding(
      {
        kind: 'binary',
        op: 'truthy',
        left: { kind: 'path', path: 'user.isAdmin' },
      },
      scope,
    ),
    true,
  );
});

test('Fase 8: repeater/list com binding de itens do store e estado empty', () => {
  const listComponent: Extract<UIComponent, { type: 'list' }> = {
    id: 'lista_produtos',
    type: 'list',
    itemsPath: 'store.produtos',
    itemVarName: 'produto',
    template: {
      id: 'template_card',
      type: 'container',
      layout: { type: 'flex', direction: 'row', gap: 8 },
      children: [
        {
          id: 'prod_titulo',
          type: 'text',
          content: { kind: 'path', path: 'produto.titulo' },
          style: 'heading',
        },
        {
          id: 'prod_preco',
          type: 'text',
          content: { kind: 'path', path: 'produto.preco' },
          style: 'body',
        },
      ],
    },
    emptyState: {
      id: 'aviso_vazio',
      type: 'text',
      content: 'Nenhum produto cadastrado.',
      style: 'caption',
    },
  };

  // Caso 1: Store preenchido
  const scopeFilled: EvaluationScope = {
    store: {
      produtos: [
        { id: 1, titulo: 'Teclado Mecânico', preco: 'R$ 250' },
        { id: 2, titulo: 'Mouse Gamer', preco: 'R$ 120' },
      ],
    },
    inputs: {},
  };

  const items = evaluateListItems(listComponent, scopeFilled);
  assert.equal(items.length, 2);
  assert.equal((items[0] as { titulo: string }).titulo, 'Teclado Mecânico');

  // Caso 2: Store vazio
  const scopeEmpty: EvaluationScope = {
    store: { produtos: [] },
    inputs: {},
  };
  const emptyItems = evaluateListItems(listComponent, scopeEmpty);
  assert.equal(emptyItems.length, 0);
});

test('Fase 8: visibilidade condicional e estados de tela (loading, empty, error)', () => {
  const conditionalBtn: UIComponent = {
    id: 'btn_admin',
    type: 'button',
    label: 'Painel Admin',
    actionEvent: 'open_admin',
    visible: {
      kind: 'binary',
      op: 'eq',
      left: { kind: 'path', path: 'store.role' },
      right: { kind: 'literal', value: 'admin' },
    },
  };

  const scopeUser: EvaluationScope = {
    store: { role: 'user' },
    inputs: {},
  };
  const scopeAdmin: EvaluationScope = {
    store: { role: 'admin' },
    inputs: {},
  };

  assert.equal(isComponentVisible(conditionalBtn, scopeUser), false);
  assert.equal(isComponentVisible(conditionalBtn, scopeAdmin), true);

  // Estados de tela
  const screenUI: ScreenUI = {
    screenId: 'dashboard',
    title: 'Painel',
    root: {
      id: 'root',
      type: 'container',
      children: [],
    },
    states: {
      loading: { id: 's_load', type: 'text', content: 'Carregando dados...' },
      error: { id: 's_err', type: 'text', content: 'Falha de conexão.' },
      empty: { id: 's_emp', type: 'text', content: 'Nenhum dado encontrado.' },
    },
    stateBinding: {
      loading: { kind: 'path', path: 'store.isLoading' },
      error: { kind: 'path', path: 'store.hasError' },
      empty: { kind: 'path', path: 'store.isEmpty' },
    },
  };

  assert.equal(
    evaluateScreenState(screenUI, { store: { isLoading: true }, inputs: {} }),
    'loading',
  );
  assert.equal(evaluateScreenState(screenUI, { store: { hasError: true }, inputs: {} }), 'error');
  assert.equal(evaluateScreenState(screenUI, { store: { isEmpty: true }, inputs: {} }), 'empty');
  assert.equal(evaluateScreenState(screenUI, { store: {}, inputs: {} }), 'ready');
});

test('Fase 8: ScreenFields renderiza componentes declarativos avançados e acessibilidade', () => {
  const screenUI: ScreenUI = {
    screenId: 'form_screen',
    title: 'Formulário Completo',
    root: {
      id: 'form_root',
      type: 'container',
      layout: { type: 'grid', columns: 2, gap: 16 },
      accessibility: { role: 'form', ariaLabel: 'Formulário de cadastro' },
      children: [
        {
          id: 'f_nome',
          type: 'input',
          inputType: 'text',
          label: 'Nome completo',
          placeholder: 'Seu nome',
          accessibility: { ariaLabel: 'Digite seu nome completo' },
        },
        {
          id: 'f_bio',
          type: 'textarea',
          label: 'Biografia',
          rows: 4,
        },
        {
          id: 'f_cargo',
          type: 'select',
          label: 'Cargo',
          options: [
            { label: 'Engenheiro', value: 'eng' },
            { label: 'Designer', value: 'des' },
          ],
        },
        {
          id: 'f_termos',
          type: 'checkbox',
          label: 'Aceito os termos',
          defaultChecked: true,
        },
        {
          id: 'f_genero',
          type: 'radio',
          name: 'genero',
          label: 'Gênero',
          options: [
            { label: 'Feminino', value: 'F' },
            { label: 'Masculino', value: 'M' },
          ],
        },
        {
          id: 'f_avatar',
          type: 'image',
          src: 'https://cdn.exemplo.com/avatar.png',
          alt: 'Avatar do usuário',
          width: 80,
          height: 80,
        },
        {
          id: 'f_salvar',
          type: 'button',
          label: 'Salvar alterações',
          actionEvent: 'salvar_dados',
          variant: 'primary',
          accessibility: { role: 'button', ariaLabel: 'Salvar alterações do formulário' },
        },
      ],
    },
  };

  const dummyGraph: Graph = {
    version: 1,
    name: 'Form Graph',
    nodes: [
      {
        id: 'form_screen',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          kind: 'screen',
          label: 'Form',
          config: { title: 'Formulário', screenUI: JSON.stringify(screenUI) },
        },
      },
    ],
    edges: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: dummyGraph,
      screen: 'form_screen',
      screenUI,
      values: {},
      store: {},
      onChange: () => {},
      onAction: () => {},
    }),
  );

  // Valida que todos os componentes e atributos de acessibilidade foram renderizados
  assert.ok(html.includes('grid-template-columns:repeat(2, minmax(0, 1fr))'));
  assert.ok(html.includes('aria-label="Formulário de cadastro"'));
  assert.ok(html.includes('Nome completo'));
  assert.ok(html.includes('Biografia'));
  assert.ok(html.includes('Engenheiro'));
  assert.ok(html.includes('Aceito os termos'));
  assert.ok(html.includes('Salvar alterações'));
  assert.ok(html.includes('alt="Avatar do usuário"'));
});

test('Fase 8: diagnósticos de limitações de plataforma para Tkinter emitidos sem omissão', async () => {
  const screenWithLimitations: ScreenUI = {
    screenId: 'tela_avancada',
    title: 'Dashboard',
    root: {
      id: 'box_flex',
      type: 'container',
      layout: { type: 'flex', direction: 'row', wrap: true }, // Tkinter pack não faz wrap
      children: [
        {
          id: 'img_remota',
          type: 'image',
          src: 'https://site.com/foto.jpg', // Tkinter não faz download http nativo
          alt: 'Foto remota',
        },
        {
          id: 'modal_dialog',
          type: 'modal',
          title: 'Aviso',
          children: [{ id: 'txt_mod', type: 'text', content: 'Texto do modal' }],
        },
      ],
    },
  };

  const diagnostics = validateUIForPlatform(screenWithLimitations, 'tkinter');

  // Deve detectar as limitações conhecidas do Tkinter
  assert.ok(diagnostics.some((d) => d.code === 'TKINTER_FLEX_WRAP_UNSUPPORTED'));
  assert.ok(diagnostics.some((d) => d.code === 'TKINTER_REMOTE_IMAGE_UNSUPPORTED'));
  assert.ok(diagnostics.some((d) => d.code === 'TKINTER_MODAL_TOPLEVEL_FALLBACK'));

  // Testar se addPythonProject inclui essas advertências em DIAGNOSTIC_WARNING.txt
  const graph: Graph = {
    version: 1,
    name: 'App Limitacoes',
    nodes: [
      {
        id: 'tela_avancada',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          kind: 'screen',
          label: 'Dashboard',
          config: { screenUI: JSON.stringify(screenWithLimitations) },
        },
      },
    ],
    edges: [],
  };

  const zip = new JSZip();
  addPythonProject(zip, graph);

  const warningContent = await zip.file('DIAGNOSTIC_WARNING.txt')?.async('string');
  assert.ok(warningContent, 'DIAGNOSTIC_WARNING.txt deve ser gerado no ZIP');
  assert.ok(warningContent.includes('TKINTER_PLATFORM_LIMITATIONS'));
  assert.ok(warningContent.includes('TKINTER_FLEX_WRAP_UNSUPPORTED'));
  assert.ok(warningContent.includes('TKINTER_REMOTE_IMAGE_UNSUPPORTED'));

  // Testar migrateAllScreens e validateAllScreensForPlatform
  const allScreens = migrateAllScreens(graph);
  assert.ok(allScreens['tela_avancada']);
  const allDiags = validateAllScreensForPlatform(allScreens, 'tkinter');
  assert.ok(allDiags.length >= 3);
});
