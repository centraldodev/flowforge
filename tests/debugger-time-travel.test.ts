import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compile,
  createDefaultAdapters,
  createExecutionContext,
  interpret,
  MockDelayAdapter,
  VisualDebugger,
} from '../src/compiler';
import type { Block, Graph, Kind } from '../src/engine';

function makeBlock(
  id: string,
  kind: Kind,
  config: Record<string, string> = {},
  label?: string,
): Block {
  return {
    id,
    type: 'block',
    position: { x: 0, y: 0 },
    data: {
      kind,
      label: label || id,
      config,
    },
  };
}

function createTestGraph(): Graph {
  const scr = makeBlock('scr', 'screen');
  const btn = makeBlock('btn', 'button', { screenId: 'scr' });
  const del = makeBlock('del', 'delay', { duration: '10' });
  const not = makeBlock('not', 'notify', { message: 'Fluxo concluído com sucesso!' });

  return {
    version: 1,
    name: 'Debug Test Project',
    nodes: [scr, btn, del, not],
    edges: [
      { id: 'e1', source: 'btn', sourceHandle: 'onClick', target: 'del', targetHandle: 'execute' },
      { id: 'e2', source: 'del', sourceHandle: 'next', target: 'not', targetHandle: 'execute' },
    ],
  };
}

test('Fase 12: deve pausar a execução ao atingir um bloco com Breakpoint ativo', async () => {
  const graph = createTestGraph();
  const compilation = compile(graph, { references: true });
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const program = compilation.value;
  const vDebugger = new VisualDebugger(['del']);

  assert.equal(vDebugger.hasBreakpoint('del'), true);
  assert.equal(vDebugger.hasBreakpoint('not'), false);

  const context = createExecutionContext({
    inputs: {},
    store: {},
    adapters: { ...createDefaultAdapters(), delay: new MockDelayAdapter(true) },
    debugger: vDebugger,
  });

  vDebugger.startExecution(false);

  // Inicia a interpretação em background
  const runPromise = interpret(program, 'btn', context);

  // Aguarda microtasks para atingir o breakpoint em 'del'
  await new Promise((r) => setTimeout(r, 40));

  // Deve estar pausado em 'del'
  const state = vDebugger.getState();
  assert.equal(state.status, 'paused');
  assert.equal(state.currentBlockId, 'del');
  assert.ok(state.frames.length > 0);

  // Despausa e continua a execução até o final
  vDebugger.continue();

  const result = await runPromise;
  assert.equal(result.success, true);
  assert.equal(vDebugger.getState().status, 'completed');
});

test('Fase 12: deve permitir avanço passo a passo (Step Over)', async () => {
  const graph = createTestGraph();
  const compilation = compile(graph, { references: true });
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const program = compilation.value;
  const vDebugger = new VisualDebugger();

  const context = createExecutionContext({
    inputs: { user: 'tester' },
    store: { counter: 1 },
    adapters: { ...createDefaultAdapters(), delay: new MockDelayAdapter(true) },
    debugger: vDebugger,
  });

  // Inicia em modo passo a passo (stepMode = true)
  vDebugger.startExecution(true);
  const runPromise = interpret(program, 'btn', context);

  // Aguarda primeira pausa no bloco de entrada acionado ('btn')
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(vDebugger.getState().status, 'paused');
  const firstBlock = vDebugger.getState().currentBlockId;
  assert.equal(firstBlock, 'btn');

  // Avança 1 passo
  vDebugger.step();
  await new Promise((r) => setTimeout(r, 40));

  // Deve permanecer pausado no próximo bloco ('del')
  assert.equal(vDebugger.getState().status, 'paused');
  assert.equal(vDebugger.getState().currentBlockId, 'del');
  const secondFrame = vDebugger.getSelectedFrame();
  assert.ok(secondFrame);

  // Conclui execução
  vDebugger.continue();
  const result = await runPromise;
  assert.equal(result.success, true);
});

test('Fase 12: deve registrar frames imutáveis de Time-Travel e permitir inspeção retroativa de Store e Payloads', async () => {
  const graph = createTestGraph();
  const compilation = compile(graph, { references: true });
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const program = compilation.value;
  const vDebugger = new VisualDebugger();

  const context = createExecutionContext({
    inputs: { email: 'user@empresa.com' },
    store: { initialSession: 'active' },
    adapters: { ...createDefaultAdapters(), delay: new MockDelayAdapter(true) },
    debugger: vDebugger,
  });

  vDebugger.startExecution(false);
  const result = await interpret(program, 'btn', context);
  assert.equal(result.success, true);

  const state = vDebugger.getState();
  assert.ok(state.frames.length >= 2);

  // Frame 0 deve ter os dados iniciais preservados
  vDebugger.seekFrame(0);
  const initialFrame = vDebugger.getSelectedFrame();
  assert.ok(initialFrame);
  assert.equal(initialFrame?.inputs['email'], 'user@empresa.com');
  assert.equal(initialFrame?.store['initialSession'], 'active');

  // Último frame deve conter as saídas acumuladas
  vDebugger.seekFrame(state.frames.length - 1);
  const lastFrame = vDebugger.getSelectedFrame();
  assert.ok(lastFrame);
  assert.ok(lastFrame!.stepIndex > 0);
});

test('Fase 12: deve permitir interrupção graciosa via stop() durante a pausa', async () => {
  const graph = createTestGraph();
  const compilation = compile(graph, { references: true });
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const program = compilation.value;
  const vDebugger = new VisualDebugger(['del']);

  const context = createExecutionContext({
    inputs: {},
    store: {},
    adapters: { ...createDefaultAdapters(), delay: new MockDelayAdapter(true) },
    debugger: vDebugger,
  });

  vDebugger.startExecution(false);
  const runPromise = interpret(program, 'btn', context);

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(vDebugger.getState().status, 'paused');

  // Interrompe imediatamente durante a pausa
  vDebugger.stop();

  const result = await runPromise;
  assert.equal(result.success, false);
  assert.equal(vDebugger.getState().status, 'stopped');
});
