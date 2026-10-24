import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Graph } from '../src/engine/types';
import {
  compile,
  createExecutionContext,
  generateProgramCode,
  generatePythonProgram,
  interpret,
} from '../src/compiler';

test('Fase 9 Lote 1: Database CRUD - Insert gera ID automático e persiste no store', async () => {
  const graph: Graph = {
    version: 1,
    name: 'DB Insert Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_criar',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Criar Item', config: { screenId: 'scr' } },
      },
      {
        id: 'db_insert',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Inserir Tarefa',
          config: {
            operation: 'insert',
            table: 'tarefas',
            data: JSON.stringify({ titulo: 'Estudar compiladores', feita: false }),
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_criar',
        target: 'db_insert',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  const context = createExecutionContext({ store: {} });
  const res = await interpret(comp.value, 'btn_criar', context);

  assert.equal(res.success, true);
  const tarefas = context.store['tarefas'] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(tarefas));
  assert.equal(tarefas.length, 1);
  assert.equal(tarefas[0].id, 1);
  assert.equal(tarefas[0].titulo, 'Estudar compiladores');
  assert.equal(tarefas[0].feita, false);
});

test('Fase 9 Lote 1: Database CRUD - Get busca registro por ID e trata inexistente via onError', async () => {
  const graph: Graph = {
    version: 1,
    name: 'DB Get Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_buscar',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Buscar', config: { screenId: 'scr' } },
      },
      {
        id: 'db_get',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Obter Produto',
          config: {
            operation: 'get',
            table: 'produtos',
            recordId: '10',
          },
        },
      },
      {
        id: 'alerta_erro',
        type: 'custom',
        position: { x: 400, y: 100 },
        data: {
          kind: 'error',
          label: 'Captura Erro',
          config: { message: 'Item não localizado' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_buscar',
        target: 'db_get',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'db_get',
        target: 'alerta_erro',
        sourceHandle: 'onError',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  // Caso 1: ID existe
  const ctxSucesso = createExecutionContext({
    store: {
      produtos: [{ id: 10, nome: 'Monitor 4K', preco: 1800 }],
    },
  });
  const resSucesso = await interpret(comp.value, 'btn_buscar', ctxSucesso);
  assert.equal(resSucesso.success, true);
  assert.equal((ctxSucesso.variables['value'] as Record<string, unknown>)?.nome, 'Monitor 4K');

  // Caso 2: ID não existe -> onError captura
  const ctxErro = createExecutionContext({
    store: { produtos: [] },
  });
  const resErro = await interpret(comp.value, 'btn_buscar', ctxErro);
  assert.ok(resErro.notifications.some((n) => n.message === 'Item não localizado'));
});

test('Fase 9 Lote 1: Database CRUD - Update atualiza registro existente', async () => {
  const graph: Graph = {
    version: 1,
    name: 'DB Update Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_atualizar',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Atualizar', config: { screenId: 'scr' } },
      },
      {
        id: 'db_update',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Atualizar Produto',
          config: {
            operation: 'update',
            table: 'produtos',
            recordId: '1',
            data: JSON.stringify({ preco: 2200, emEstoque: true }),
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_atualizar',
        target: 'db_update',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  const context = createExecutionContext({
    store: {
      produtos: [{ id: 1, nome: 'Notebook', preco: 2500, emEstoque: false }],
    },
  });

  const res = await interpret(comp.value, 'btn_atualizar', context);
  assert.equal(res.success, true);

  const produtos = context.store['produtos'] as Array<Record<string, unknown>>;
  assert.equal(produtos[0].preco, 2200);
  assert.equal(produtos[0].emEstoque, true);
  assert.equal(produtos[0].nome, 'Notebook');
  assert.equal(produtos[0].id, 1);
});

test('Fase 9 Lote 1: Database CRUD - Delete remove registro do store', async () => {
  const graph: Graph = {
    version: 1,
    name: 'DB Delete Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_excluir',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Excluir', config: { screenId: 'scr' } },
      },
      {
        id: 'db_delete',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Excluir Registro',
          config: {
            operation: 'delete',
            table: 'usuarios',
            recordId: '2',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_excluir',
        target: 'db_delete',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  const context = createExecutionContext({
    store: {
      usuarios: [
        { id: 1, nome: 'Ana' },
        { id: 2, nome: 'Bruno' },
        { id: 3, nome: 'Carla' },
      ],
    },
  });

  const res = await interpret(comp.value, 'btn_excluir', context);
  assert.equal(res.success, true);

  const usuarios = context.store['usuarios'] as Array<Record<string, unknown>>;
  assert.equal(usuarios.length, 2);
  assert.equal(
    usuarios.find((u) => u.id === 2),
    undefined,
  );
  assert.equal(context.outputs['deletedCount'], 1);
});

test('Fase 9 Lote 1: Database CRUD - Query com filtro, ordenação e paginação', async () => {
  const graph: Graph = {
    version: 1,
    name: 'DB Query Paged Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_filtrar',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Filtrar', config: { screenId: 'scr' } },
      },
      {
        id: 'db_query',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Filtrar Eletrônicos',
          config: {
            operation: 'query',
            table: 'produtos',
            filterField: 'categoria',
            filterValue: 'eletronicos',
            orderBy: 'preco',
            orderDirection: 'asc',
            limit: '2',
            offset: '1',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_filtrar',
        target: 'db_query',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  const context = createExecutionContext({
    store: {
      produtos: [
        { id: 1, nome: 'Mouse', categoria: 'eletronicos', preco: 50 },
        { id: 2, nome: 'Teclado', categoria: 'eletronicos', preco: 150 },
        { id: 3, nome: 'Headset', categoria: 'eletronicos', preco: 250 },
        { id: 4, nome: 'Monitor', categoria: 'eletronicos', preco: 800 },
        { id: 5, nome: 'Mesa', categoria: 'moveis', preco: 600 },
      ],
    },
  });

  const res = await interpret(comp.value, 'btn_filtrar', context);
  assert.equal(res.success, true);

  assert.equal(context.outputs['total'], 4);

  const page = context.outputs['value'] as Array<Record<string, unknown>>;
  assert.equal(page.length, 2);
  assert.equal(page[0].nome, 'Teclado');
  assert.equal(page[1].nome, 'Headset');
});

test('Fase 9 Lote 1: Paridade Dourada Cross-Language (Interpreter vs JS vs Python) para CRUD', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Golden CRUD Parity',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela', config: {} },
      },
      {
        id: 'btn_start',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Executar CRUD', config: { screenId: 'scr' } },
      },
      {
        id: 'db_insert',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: {
          kind: 'database',
          label: 'Inserir Pedido',
          config: {
            operation: 'insert',
            table: 'pedidos',
            data: JSON.stringify({ item: 'Fone Bluetooth', valor: 99 }),
          },
        },
      },
      {
        id: 'db_query',
        type: 'custom',
        position: { x: 400, y: 0 },
        data: {
          kind: 'database',
          label: 'Consultar Pedidos',
          config: {
            operation: 'query',
            table: 'pedidos',
            limit: '10',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn_start',
        target: 'db_insert',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
      {
        id: 'e2',
        source: 'db_insert',
        target: 'db_query',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  // 1. Execução no Interpretador da IR
  const ctxIR = createExecutionContext({ store: {} });
  const resIR = await interpret(comp.value, 'btn_start', ctxIR);
  assert.equal(resIR.success, true);

  // 2. Execução no JavaScript gerado
  const jsCode = generateProgramCode(comp.value);
  const factory = new Function(`
    ${jsCode.replace(/export class/g, 'class').replace(/export function/g, 'function')}
    return { FlowForgeProgram, createProgram, createRuntimeContext };
  `);
  const { createProgram } = factory() as {
    createProgram: () => {
      dispatch: (id: string, inputs?: Record<string, unknown>) => Promise<{ success: boolean }>;
      getState: () => Record<string, unknown>;
    };
  };
  const prog = createProgram();
  const resJS = await prog.dispatch('btn_start', {});
  assert.equal(resJS.success, true);
  const jsStore = prog.getState();

  // 3. Execução no Python gerado
  const pyCode = generatePythonProgram(comp.value);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-crud-py-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'program.py'), pyCode, 'utf-8');
    const runnerScript = `
import asyncio
import json
from program import create_program

async def run():
    p = create_program()
    res = await p.dispatch("btn_start", {})
    state = p.get_state()
    print(json.dumps({
        "success": res.get("success"),
        "pedidos_count": len(state.get("pedidos", [])),
        "primeiro_item": state.get("pedidos", [])[0].get("item") if state.get("pedidos") else None,
        "primeiro_id": state.get("pedidos", [])[0].get("id") if state.get("pedidos") else None
    }))

asyncio.run(run())
`;
    fs.writeFileSync(path.join(tmpDir, 'runner.py'), runnerScript, 'utf-8');

    const pyRun = spawnSync('python3', ['runner.py'], {
      cwd: tmpDir,
      encoding: 'utf-8',
    });

    assert.equal(pyRun.status, 0, `Python error: ${pyRun.stderr}`);
    const pyOutput = JSON.parse(pyRun.stdout.trim());

    // Comparações de paridade cross-language
    assert.equal(pyOutput.success, true);
    assert.equal(pyOutput.pedidos_count, 1);
    assert.equal(pyOutput.primeiro_item, 'Fone Bluetooth');
    assert.equal(pyOutput.primeiro_id, 1);

    // Compara com JS e IR
    const irPedidos = ctxIR.store['pedidos'] as Array<Record<string, unknown>>;
    const jsPedidos = jsStore['pedidos'] as Array<Record<string, unknown>>;

    assert.equal(irPedidos.length, 1);
    assert.equal(jsPedidos.length, 1);
    assert.equal(irPedidos[0].item, 'Fone Bluetooth');
    assert.equal(jsPedidos[0].item, 'Fone Bluetooth');
    assert.equal(irPedidos[0].id, 1);
    assert.equal(jsPedidos[0].id, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
