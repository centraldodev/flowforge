import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import type { Graph } from '../src/engine/types';
import {
  compile,
  interpret,
  createExecutionContext,
  generateProgramCode,
  generatePythonProgram,
} from '../src/compiler';
import { addPythonProject } from '../src/export/python';

function runPy(pySource: string, payload: unknown) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-py-vis-'));
  const progPath = path.join(tmpDir, 'program.py');
  try {
    fs.writeFileSync(progPath, pySource, 'utf-8');
    const res = spawnSync('python3', [progPath], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      timeout: 10000,
    });
    if (res.status !== 0) {
      throw new Error(`Python execution error (${res.status}): ${res.stderr}`);
    }
    return JSON.parse(res.stdout.trim());
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

interface DispatchResult {
  success: boolean;
  screen?: string;
  outputs: Record<string, unknown>;
  store: Record<string, unknown>;
  messages: string[];
}

function runJs(jsSource: string) {
  const factory = new Function(`
    ${jsSource.replace(/export class/g, 'class').replace(/export function/g, 'function')}
    return { FlowForgeProgram, createProgram, createRuntimeContext };
  `);
  const { createProgram } = factory() as {
    createProgram: (options?: unknown) => {
      dispatch: (eventId: string, inputs?: Record<string, unknown>) => Promise<DispatchResult>;
    };
  };
  return createProgram({ fastDelay: true });
}

test('Fase 7: Bloco constant produz valores tipados sem código JavaScript', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Constant Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Botão', config: { screenId: 'scr' } },
      },
      {
        id: 'c_str',
        position: { x: 0, y: 0 },
        data: {
          kind: 'constant',
          label: 'Texto',
          config: { valueType: 'string', value: 'FlowForge Portável' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn',
        target: 'c_str',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  // 1. IR Interpreter
  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.variables.value, 'FlowForge Portável');

  // 2. JS Backend
  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.outputs.value, 'FlowForge Portável');

  // 3. Python Backend
  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.outputs.value, 'FlowForge Portável');
});

test('Fase 7: Bloco math executa cálculos cross-language', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Math Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Calcular', config: { screenId: 'scr' } },
      },
      {
        id: 'calc',
        position: { x: 0, y: 0 },
        data: { kind: 'math', label: 'Soma', config: { operation: 'add', a: '15', b: '27' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'calc', sourceHandle: 'onClick', targetHandle: 'execute' },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.variables.result, 42);

  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.outputs.result, 42);

  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.outputs.result, 42);
});

test('Fase 7: Bloco text executa transformações de texto portáveis', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Text Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Upper', config: { screenId: 'scr' } },
      },
      {
        id: 'txt',
        position: { x: 0, y: 0 },
        data: {
          kind: 'text',
          label: 'Maiúsculas',
          config: { operation: 'upper', value: 'flowforge' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'txt', sourceHandle: 'onClick', targetHandle: 'execute' },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.variables.result, 'FLOWFORGE');

  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.outputs.result, 'FLOWFORGE');

  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.outputs.result, 'FLOWFORGE');
});

test('Fase 7: Bloco compare ramifica fluxos para caminhos true e false', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Compare Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'scr_ok',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela Sucesso', config: {} },
      },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Validar Maior', config: { screenId: 'scr' } },
      },
      {
        id: 'cmp',
        position: { x: 0, y: 0 },
        data: {
          kind: 'compare',
          label: 'Comparar',
          config: { operator: 'gt', left: '100', right: '50' },
        },
      },
      {
        id: 'nav',
        position: { x: 0, y: 0 },
        data: { kind: 'navigate', label: 'Ir para Ok', config: { target: 'scr_ok' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'cmp', sourceHandle: 'onClick', targetHandle: 'execute' },
      { id: 'e2', source: 'cmp', target: 'nav', sourceHandle: 'true', targetHandle: 'execute' },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.screen, 'scr_ok');

  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.screen, 'scr_ok');

  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.screen, 'scr_ok');
});

test('Fase 7: Bloco boolean avalia operações lógicas and, or, not', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Boolean Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Testar Not', config: { screenId: 'scr' } },
      },
      {
        id: 'b_not',
        position: { x: 0, y: 0 },
        data: { kind: 'boolean', label: 'Inverter', config: { operation: 'not', a: 'false' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn',
        target: 'b_not',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.variables.result, true);

  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.outputs.result, true);

  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.outputs.result, true);
});

test('Fase 7: Bloco function com JavaScript textual emite aviso de incompatibilidade multi-linguagem', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Textual Function Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Clique', config: { screenId: 'scr' } },
      },
      {
        id: 'fn_legada',
        position: { x: 0, y: 0 },
        data: {
          kind: 'function',
          label: 'Função Legada',
          config: { code: 'return Math.max(a, b);' },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn',
        target: 'fn_legada',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  const nonPortableDiag = comp.diagnostics.find(
    (d) => d.code === 'FUNCTION_TEXTUAL_JS_NOT_PORTABLE',
  );
  assert.ok(nonPortableDiag, 'Deve emitir diagnóstico FUNCTION_TEXTUAL_JS_NOT_PORTABLE');
  assert.equal(nonPortableDiag.severity, 'warning');

  // Exportação Python deve incluir aviso claro no ZIP
  const zip = new JSZip();
  addPythonProject(zip, graph);
  assert.ok(zip.file('DIAGNOSTIC_WARNING.txt'), 'Deve gerar arquivo de diagnóstico no zip');
  const warningText = await zip.file('DIAGNOSTIC_WARNING.txt')!.async('string');
  assert.ok(warningText.includes('INCOMPATIBLE_PYTHON_EXPORT'));
});

test('Fase 7: Fluxo composto de transformação visual (constant + math + text) funciona sem código', async () => {
  const graph: Graph = {
    version: 1,
    name: 'Pipeline Test',
    nodes: [
      { id: 'scr', position: { x: 0, y: 0 }, data: { kind: 'screen', label: 'Tela', config: {} } },
      {
        id: 'btn',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Iniciar Pipeline', config: { screenId: 'scr' } },
      },
      {
        id: 'c1',
        position: { x: 0, y: 0 },
        data: {
          kind: 'constant',
          label: 'Valor Base',
          config: { valueType: 'number', value: '10' },
        },
      },
      {
        id: 'm1',
        position: { x: 0, y: 0 },
        data: {
          kind: 'math',
          label: 'Multiplica por 5',
          config: { operation: 'mul', a: '10', b: '5' },
        },
      },
      {
        id: 't1',
        position: { x: 0, y: 0 },
        data: {
          kind: 'text',
          label: 'Texto',
          config: { operation: 'concat', value: 'Total: ', arg: '50' },
        },
      },
      {
        id: 'st',
        position: { x: 0, y: 0 },
        data: { kind: 'state', label: 'Salvar Resultado', config: { key: 'relatorio' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'btn', target: 'c1', sourceHandle: 'onClick', targetHandle: 'execute' },
      { id: 'e2', source: 'c1', target: 'm1', sourceHandle: 'then', targetHandle: 'execute' },
      { id: 'e3', source: 'm1', target: 't1', sourceHandle: 'then', targetHandle: 'execute' },
      { id: 'e4', source: 't1', target: 'st', sourceHandle: 'then', targetHandle: 'execute' },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  // 1. IR Interpreter
  const ctxIR = createExecutionContext({ screen: 'scr' });
  await interpret(comp.value, 'btn', ctxIR);
  assert.equal(ctxIR.store.relatorio, 'Total: 50');

  // 2. JS Backend
  const jsSource = generateProgramCode(comp.value);
  const jsRunner = runJs(jsSource);
  const jsRes = await jsRunner.dispatch('btn');
  assert.equal(jsRes.store.relatorio, 'Total: 50');

  // 3. Python Backend
  const pySource = generatePythonProgram(comp.value);
  const pyRes = runPy(pySource, { eventId: 'btn' });
  assert.equal(pyRes.store.relatorio, 'Total: 50');
});
