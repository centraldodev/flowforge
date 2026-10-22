import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { run, parseGraph, type Store } from './engine';
import { ScreenFields } from './ScreenFields';
import './style.css';
import graph from './graph.json';

const g = parseGraph(JSON.stringify(graph));

function App() {
  const [screen, setScreen] = useState(g.nodes.find((n) => n.data.kind === 'screen')?.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [log, setLog] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const store = useRef<Store>({});
  const page = g.nodes.find((n) => n.id === screen);

  function action(id: string) {
    try {
      const r = run(g, id, values, store.current, screen);
      if (r.screen) setScreen(r.screen);
      setMessages(r.messages);
      setLog(r.trace.map((t) => t.label + ': ' + t.message).join('\n'));
    } catch (e) {
      setLog(String(e));
    }
  }

  return (
    <main>
      <small>PROTÓTIPO · Integrações simuladas</small>
      <h1>{page?.data.config.title || page?.data.label || 'Adicione uma tela'}</h1>
      <ScreenFields
        graph={g}
        screen={screen}
        values={values}
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
