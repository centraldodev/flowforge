import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compile,
  createExecutionContext,
  interpret,
  VisualDebugger,
  type DebugFrame,
  type DebuggerState,
} from '../compiler';
import type { Graph, Store, Trace } from '../engine';
import { createDefaultAdapters } from '../compiler/interpreter/adapters';
import { GatewayApiAdapter } from '../compiler/interpreter/httpAdapter';

/**
 * Estado da simulação e playground com suporte a Depuração Visual, Breakpoints e Time-Travel.
 */
export function useSimulation(graph: Graph) {
  const [trace, setTrace] = useState<Trace[]>([]);
  const [screen, setScreen] = useState('login');
  const [values, setValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<string[]>([]);
  const store = useRef<Store>({});
  const [storeState, setStoreState] = useState<Store>({});

  const debuggerRef = useRef<VisualDebugger>(new VisualDebugger());
  const [debuggerState, setDebuggerState] = useState<DebuggerState>(() =>
    debuggerRef.current.getState(),
  );

  useEffect(() => {
    const unsub = debuggerRef.current.subscribe((state) => {
      setDebuggerState(state);
    });
    return unsub;
  }, []);

  const executeInternal = useCallback(
    async (id: string, isStepMode = false): Promise<void> => {
      try {
        const compilation = compile(graph, { references: true });
        if (!compilation.ok) {
          const errorMessages = compilation.diagnostics.map((d) => d.message);
          setMessages(errorMessages);
          setTrace(
            compilation.diagnostics.map((d) => ({
              id: d.nodeId || 'error',
              label: d.code,
              message: d.message,
            })),
          );
          return;
        }

        const program = compilation.value;
        const vDebugger = debuggerRef.current;
        vDebugger.startExecution(isStepMode);

        const context = createExecutionContext({
          inputs: values,
          store: store.current,
          screen,
          adapters: { ...createDefaultAdapters(), api: new GatewayApiAdapter(graph) },
          debugger: vDebugger,
        });

        const res = await interpret(program, id, context);
        setTrace(res.trace);
        setMessages(
          res.success
            ? res.messages
            : [...res.messages, res.error?.message || 'Falha na execução.'],
        );
        setStoreState({ ...store.current });
        if (res.screen) setScreen(res.screen);
      } catch (e) {
        setTrace([{ id: 'error', label: 'Erro', message: String(e) }]);
        setMessages([String(e)]);
        debuggerRef.current.failExecution(e);
      }
    },
    [graph, screen, values],
  );

  const execute = useCallback(
    async (id: string): Promise<void> => {
      return executeInternal(id, false);
    },
    [executeInternal],
  );

  const debugStart = useCallback(
    async (id: string, isStepMode = true): Promise<void> => {
      return executeInternal(id, isStepMode);
    },
    [executeInternal],
  );

  const toggleBreakpoint = useCallback((blockId: string) => {
    return debuggerRef.current.toggleBreakpoint(blockId);
  }, []);

  const hasBreakpoint = useCallback((blockId: string) => {
    return debuggerRef.current.hasBreakpoint(blockId);
  }, []);

  const debugStep = useCallback(() => {
    debuggerRef.current.step();
  }, []);

  const debugContinue = useCallback(() => {
    debuggerRef.current.continue();
  }, []);

  const debugPause = useCallback(() => {
    debuggerRef.current.pause();
  }, []);

  const debugStop = useCallback(() => {
    debuggerRef.current.stop();
  }, []);

  const debugSeekFrame = useCallback((index: number | null) => {
    debuggerRef.current.seekFrame(index);
  }, []);

  /** Frame atualmente inspecionado no time-travel ou durante a pausa */
  const activeFrame: DebugFrame | null =
    debuggerState.selectedFrameIndex !== null &&
    debuggerState.frames[debuggerState.selectedFrameIndex]
      ? debuggerState.frames[debuggerState.selectedFrameIndex]
      : debuggerState.frames.length > 0
        ? debuggerState.frames[debuggerState.frames.length - 1]
        : null;

  /** Limpa execução, valores e memória. Se `startScreen` for informado, abre essa tela. */
  const reset = useCallback((startScreen?: string) => {
    if (startScreen !== undefined) setScreen(startScreen);
    setTrace([]);
    setMessages([]);
    setValues({});
    store.current = {};
    setStoreState({});
    debuggerRef.current.reset();
  }, []);

  return {
    trace,
    clearTrace: () => setTrace([]),
    screen,
    setScreen,
    values,
    setValue: (id: string, value: string) => setValues((v) => ({ ...v, [id]: value })),
    store: activeFrame ? (activeFrame.store as Store) : storeState,
    messages,
    execute,
    reset,
    // Recursos do Visual Debugger & Time Travel
    debuggerState,
    activeFrame,
    debugStart,
    debugStep,
    debugContinue,
    debugPause,
    debugStop,
    debugSeekFrame,
    toggleBreakpoint,
    hasBreakpoint,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
