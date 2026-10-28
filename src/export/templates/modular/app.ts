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
import './styles/visual-design.css';
const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz não encontrado.');
createRoot(root).render(<App />);
`;
export const routesSource = `import { lazy, type ComponentType } from 'react';
import type { ScreenProps } from '../runtime/rendering/ScreenView';
import registry from './page-registry';
export const pages: Record<string, ComponentType<ScreenProps>> = Object.fromEntries(Object.entries(registry).map(([id, load]) => [id, lazy(load)]));
`;

export const darkModeAppSource = `import { Suspense, useState, useEffect } from 'react';
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
  const [theme, setTheme] = useState<'light' | 'system' | 'dark'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'system' | 'dark') || 'system';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    };
    apply();
    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);

  const Page = pages[screen || ''];

  async function action(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await program.dispatch(id, values);
      setScreen(result.screen);
      setStore({ ...result.store });
      setMessages(result.success ? result.messages : [...result.messages, result.error?.message || 'Falha na execução.']);
    } catch (failure) {
      setMessages([failure instanceof Error ? failure.message : 'Falha na execução.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main aria-busy={busy}>
      <div className="theme-switch-bar" role="radiogroup" aria-label="Tema">
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          onClick={() => setTheme('light')}
        >
          Claro
        </button>
        <button
          type="button"
          className={theme === 'system' ? 'active' : ''}
          onClick={() => setTheme('system')}
        >
          Sistema
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => setTheme('dark')}
        >
          Escuro
        </button>
      </div>
      <small>{appName}</small>
      <Suspense fallback={<p role="status">Carregando…</p>}>
        {Page ? (
          <Page
            values={values}
            store={store}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
            onAction={(id) => void action(id)}
          />
        ) : (
          <p>Nenhuma tela configurada.</p>
        )}
      </Suspense>
      {messages.map((message, index) => (
        <div className="message" role="status" key={index}>
          {message}
        </div>
      ))}
    </main>
  );
}
`;
