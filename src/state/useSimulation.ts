import { useRef, useState } from 'react';
import { run, type Graph, type Store, type Trace } from '../engine';

/** Estado do playground: tela atual, valores digitados, registro de execução e memória simulada. */
export function useSimulation(graph: Graph) {
  const [trace, setTrace] = useState<Trace[]>([]);
  const [screen, setScreen] = useState('login');
  const [values, setValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<string[]>([]);
  const store = useRef<Store>({});

  function execute(id: string) {
    try {
      const r = run(graph, id, values, store.current, screen);
      setTrace(r.trace);
      setMessages(r.messages);
      if (r.screen) setScreen(r.screen);
    } catch (e) {
      setTrace([{ id: 'error', label: 'Erro', message: String(e) }]);
    }
  }

  /** Limpa execução, valores e memória. Se `startScreen` for informado, abre essa tela. */
  function reset(startScreen?: string) {
    if (startScreen !== undefined) setScreen(startScreen);
    setTrace([]);
    setMessages([]);
    setValues({});
    store.current = {};
  }

  return {
    trace,
    clearTrace: () => setTrace([]),
    screen,
    setScreen,
    values,
    setValue: (id: string, value: string) => setValues((v) => ({ ...v, [id]: value })),
    messages,
    execute,
    reset,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
