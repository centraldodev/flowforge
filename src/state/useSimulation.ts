import { useRef, useState } from 'react';
import { compile, createExecutionContext, interpret } from '../compiler';
import type { Graph, Store, Trace } from '../engine';

/** Estado do playground: tela atual, valores digitados, registro de execução e memória simulada via IR. */
export function useSimulation(graph: Graph) {
  const [trace, setTrace] = useState<Trace[]>([]);
  const [screen, setScreen] = useState('login');
  const [values, setValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<string[]>([]);
  const store = useRef<Store>({});
  const [storeState, setStoreState] = useState<Store>({});

  async function execute(id: string): Promise<void> {
    try {
      const compilation = compile(graph);
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
      const context = createExecutionContext({
        inputs: values,
        store: store.current,
        screen,
      });

      const res = await interpret(program, id, context);
      setTrace(res.trace);
      setMessages(res.messages);
      setStoreState({ ...store.current });
      if (res.screen) setScreen(res.screen);
    } catch (e) {
      setTrace([{ id: 'error', label: 'Erro', message: String(e) }]);
      setMessages([String(e)]);
    }
  }

  /** Limpa execução, valores e memória. Se `startScreen` for informado, abre essa tela. */
  function reset(startScreen?: string) {
    if (startScreen !== undefined) setScreen(startScreen);
    setTrace([]);
    setMessages([]);
    setValues({});
    store.current = {};
    setStoreState({});
  }

  return {
    trace,
    clearTrace: () => setTrace([]),
    screen,
    setScreen,
    values,
    setValue: (id: string, value: string) => setValues((v) => ({ ...v, [id]: value })),
    store: storeState,
    messages,
    execute,
    reset,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
