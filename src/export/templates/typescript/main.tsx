import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createProgram } from './program';
import { ScreenFields } from './ScreenFields';
import './style.css';
import graph from './graph.json';
import type { Graph } from './engine/types';

const g = graph as unknown as Graph;
const program = createProgram();

function App() {
  const [screen, setScreen] = useState(
    program.getScreen() || g.nodes.find((n) => n.data.kind === 'screen')?.id,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [store, setStore] = useState<Record<string, unknown>>(program.getState() || {});
  const [log, setLog] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const page = g.nodes.find((n) => n.id === screen);

  async function action(id: string) {
    try {
      const r = await program.dispatch(id, values);
      if (r.screen) setScreen(r.screen);
      setMessages(r.messages);
      setStore({ ...program.getState() });
      setLog(
        r.trace
          .map((t: { label: string; message: string }) => `${t.label}: ${t.message}`)
          .join('\n'),
      );
    } catch (e) {
      setLog(String(e));
    }
  }

  return (
    <main>
      <small>PROTÓTIPO · Executado a partir da ProgramIR</small>
      <h1>{page?.data.config.title || page?.data.label || 'Adicione uma tela'}</h1>
      <ScreenFields
        graph={g}
        screen={screen}
        values={values}
        store={store}
        onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onAction={action}
      />
      {messages.map((m, i) => (
        <div className="message" role="status" key={i}>
          {m}
        </div>
      ))}
      <pre>{log}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
