import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  evaluateTableItems,
  type ScreenUI,
  type UIComponent,
  type EvaluationScope,
} from '../src/compiler/ui';
import { ScreenFields } from '../src/features/preview/ScreenFields';
import type { Graph } from '../src/engine/types';
import { ArtifactPlan } from '../src/export/modular/artifacts';
import { emitPages } from '../src/export/modular/pages';

const emptyGraph: Graph = {
  version: 1,
  name: 'App Interface Test',
  nodes: [],
  edges: [],
};

test('Fase 4: evaluateTableItems resolve dados a partir do store ou scope', () => {
  const tableComp: Extract<UIComponent, { type: 'table' }> = {
    id: 'tbl_pedidos',
    type: 'table',
    itemsPath: 'store.pedidos',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'total', label: 'Total' },
    ],
  };

  const scope: EvaluationScope = {
    store: {
      pedidos: [
        { id: 101, cliente: 'Ana', total: 250 },
        { id: 102, cliente: 'Bruno', total: 420 },
      ],
    },
    inputs: {},
  };

  const items = evaluateTableItems(tableComp, scope) as Record<string, unknown>[];
  assert.equal(items.length, 2);
  assert.equal(items[0].cliente, 'Ana');
  assert.equal(items[1].total, 420);
});

test('Fase 4: ScreenFields renderiza tabela de dados com colunas, paginação e ações por linha', () => {
  const screenUI: ScreenUI = {
    screenId: 'screen_clientes',
    title: 'Lista de Clientes',
    root: {
      id: 'table_clientes',
      type: 'table',
      itemsPath: 'store.clientes',
      columns: [
        { key: 'nome', label: 'Nome Completo' },
        { key: 'email', label: 'E-mail' },
        { key: 'cidade', label: 'Cidade' },
      ],
      actions: [
        { label: 'Editar', actionEvent: 'btn_editar_cliente', variant: 'secondary' },
        { label: 'Excluir', actionEvent: 'btn_excluir_cliente', variant: 'danger' },
      ],
      pageSize: 2,
    },
  };

  const store = {
    clientes: [
      { id: 1, nome: 'Maria Santos', email: 'maria@empresa.com', cidade: 'São Paulo' },
      { id: 2, nome: 'João Ferreira', email: 'joao@empresa.com', cidade: 'Rio de Janeiro' },
      { id: 3, nome: 'Carla Dias', email: 'carla@empresa.com', cidade: 'Curitiba' },
    ],
  };

  const actionsCalled: string[] = [];
  const changedValues: Record<string, string> = {};

  const html = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: {},
      store,
      onChange: (k, v) => {
        changedValues[k] = v;
      },
      onAction: (act) => {
        actionsCalled.push(act);
      },
    }),
  );

  // Validação do cabeçalho da tabela
  assert.match(html, /Nome Completo/);
  assert.match(html, /E-mail/);
  assert.match(html, /Cidade/);
  assert.match(html, /Ações/);

  // Validação dos dados paginados (pageSize = 2)
  assert.match(html, /Maria Santos/);
  assert.match(html, /João Ferreira/);
  // Carla Dias é o 3º item e deve ficar na próxima página
  assert.doesNotMatch(html, /Carla Dias/);
  assert.match(html, /Mostrando 2 de 3 registros/);

  // Botões de ação configurados
  assert.match(html, /Editar/);
  assert.match(html, /Excluir/);
});

test('Fase 4: ScreenFields renderiza estado empty customizado na tabela quando sem registros', () => {
  const screenUI: ScreenUI = {
    screenId: 'screen_vazia',
    title: 'Produtos',
    root: {
      id: 'table_produtos',
      type: 'table',
      itemsPath: 'store.produtos',
      columns: [{ key: 'nome', label: 'Produto' }],
      emptyState: {
        id: 'msg_vazia',
        type: 'text',
        content: 'Nenhum produto cadastrado no estoque.',
        style: 'caption',
      },
    },
  };

  const html = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: {},
      store: { produtos: [] },
      onChange: () => {},
      onAction: () => {},
    }),
  );

  assert.match(html, /Nenhum produto cadastrado no estoque\./);
});

test('Fase 4: ScreenFields renderiza formulário com campos e botão de submit', () => {
  const screenUI: ScreenUI = {
    screenId: 'screen_form',
    title: 'Novo Cadastro',
    root: {
      id: 'form_cadastro',
      type: 'form',
      submitLabel: 'Salvar Registro',
      submitEvent: 'btn_salvar',
      children: [
        {
          id: 'campo_nome',
          type: 'input',
          label: 'Nome do Usuário',
          placeholder: 'Ex: Lucas',
        },
        {
          id: 'campo_perfil',
          type: 'select',
          label: 'Perfil de Acesso',
          options: [
            { label: 'Administrador', value: 'admin' },
            { label: 'Padrão', value: 'user' },
          ],
        },
      ],
    },
  };

  const html = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: { campo_nome: 'Lucas Silva', campo_perfil: 'admin' },
      store: {},
      onChange: () => {},
      onAction: () => {},
    }),
  );

  assert.match(html, /<form/);
  assert.match(html, /Nome do Usuário/);
  assert.match(html, /Lucas Silva/);
  assert.match(html, /Perfil de Acesso/);
  assert.match(html, /Salvar Registro/);
});

test('Fase 4: ScreenFields renderiza estados visuais de loading e error da tela', () => {
  const screenUI: ScreenUI = {
    screenId: 'screen_feedback',
    title: 'Painel com Feedback',
    root: {
      id: 'txt_pronto',
      type: 'text',
      content: 'Dados Carregados',
    },
    states: {
      loading: {
        id: 'loading_spinner',
        type: 'text',
        content: 'Carregando informações do servidor…',
        style: 'caption',
      },
      error: {
        id: 'msg_falha',
        type: 'text',
        content: 'Erro ao conectar ao banco de dados.',
        style: 'heading',
      },
    },
    stateBinding: {
      loading: { kind: 'path', path: 'store.isLoading' },
      error: { kind: 'path', path: 'store.hasError' },
    },
  };

  // 1. Estado Loading ativo
  const htmlLoading = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: {},
      store: { isLoading: true },
      onChange: () => {},
      onAction: () => {},
    }),
  );
  assert.match(htmlLoading, /Carregando informações do servidor…/);
  assert.doesNotMatch(htmlLoading, /Dados Carregados/);

  // 2. Estado Error ativo
  const htmlError = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: {},
      store: { isLoading: false, hasError: true },
      onChange: () => {},
      onAction: () => {},
    }),
  );
  assert.match(htmlError, /Erro ao conectar ao banco de dados\./);
  assert.doesNotMatch(htmlError, /Dados Carregados/);

  // 3. Estado Ready (normal)
  const htmlReady = renderToStaticMarkup(
    React.createElement(ScreenFields, {
      graph: emptyGraph,
      screenUI,
      values: {},
      store: { isLoading: false, hasError: false },
      onChange: () => {},
      onAction: () => {},
    }),
  );
  assert.match(htmlReady, /Dados Carregados/);
});

test('Fase 4: exportação modular inclui contratos e suporte a tabelas e formulários na web exportada', () => {
  const plan = new ArtifactPlan();
  const graph: Graph = {
    version: 1,
    name: 'App CRUD Exportado',
    nodes: [
      {
        id: 'screen_1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'Dashboard',
          kind: 'screen',
          config: {
            title: 'Painel Geral',
            screenUI: JSON.stringify({
              title: 'Painel Geral',
              root: {
                id: 'tbl_geral',
                type: 'table',
                itemsPath: 'store.itens',
                columns: [{ key: 'id', label: 'Código' }],
              },
            }),
          },
        },
      },
    ],
    edges: [],
  };

  emitPages(plan, graph);

  // Verifica se os arquivos modulares da web foram gerados
  assert.ok(plan.files.has('packages/contracts/src/ui.ts'));
  assert.ok(plan.files.has('apps/web/src/runtime/rendering/layout.tsx'));
  assert.ok(
    [...plan.files.keys()].some(
      (k) => k.startsWith('apps/web/src/pages/') && k.endsWith('/Page.tsx'),
    ),
  );

  // Confirma que o contrato de UI contém 'table' e 'form'
  const uiContract = plan.files.get('packages/contracts/src/ui.ts')!;
  assert.ok(uiContract.content.includes("type: 'table'"));
  assert.ok(uiContract.content.includes("type: 'form'"));

  // Confirma que layout.tsx renderiza tabelas e formulários
  const layoutRenderer = plan.files.get('apps/web/src/runtime/rendering/layout.tsx')!;
  assert.ok(layoutRenderer.content.includes("case 'table':"));
  assert.ok(layoutRenderer.content.includes("case 'form':"));
});
