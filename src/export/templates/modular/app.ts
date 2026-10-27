export const appSource = `import { Suspense, useState } from 'react';
import { createProgram } from '../runtime/program';
import { pages } from './routes';
import { appName } from '../runtime/config';
const program = createProgram();
export function App() {
  const [screen, setScreen] = useState(program.getScreen());
  const [values, setValues] = useState<Record<string, string>>({});
  const [store, setStore] = useState(program.getState());
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const Page = pages[screen || ''];
  async function action(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await program.dispatch(id, values);
      setScreen(result.screen); setStore({ ...result.store });
      setMessages(result.success ? result.messages : [...result.messages, result.error?.message || 'Falha na execução.']);
    } catch (failure) { setMessages([failure instanceof Error ? failure.message : 'Falha na execução.']); }
    finally { setBusy(false); }
  }
  return <main aria-busy={busy}>
    <small>{appName}</small>
    <Suspense fallback={<p role="status">Carregando…</p>}>
      {Page ? <Page values={values} store={store} onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))} onAction={(id) => void action(id)} /> : <p>Nenhuma tela configurada.</p>}
    </Suspense>
    {messages.map((message, index) => <div className="message" role="status" key={index}>{message}</div>)}
  </main>;
}
`;
export const mainSource = `import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz não encontrado.');
createRoot(root).render(<App />);
`;
export const routesSource = `import { lazy, type ComponentType } from 'react';
import type { ScreenProps } from '../runtime/rendering/ScreenView';
import registry from './page-registry';
export const pages: Record<string, ComponentType<ScreenProps>> = Object.fromEntries(Object.entries(registry).map(([id, load]) => [id, lazy(load)]));
`;
