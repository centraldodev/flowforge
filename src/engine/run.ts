// Interpretador compartilhado pelo editor e pelo projeto TypeScript exportado.
import { valueKinds } from './catalog';
import { screenRoutes } from './routes';
import type { Block, Graph, Result, Store } from './types';

const MAX_STEPS = 100;
const DEMO_USER = { email: 'demo@exemplo.com', password: '123456' };

/** Verifica se o valor é um objeto de erro com `message` textual. */
function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string' &&
    (value as { message: string }).message !== ''
  );
}

type User = { email: string; password: string };

/** Valor atual de um bloco de dados (campo digitado ou valor configurado). */
export function inputValue(n: Block, values: Record<string, string>): unknown {
  return values[n.id] ?? n.data.config.value ?? '';
}

type Step = { out: unknown; path: string; message: string };

export function run(
  g: Graph,
  start: string,
  values: Record<string, string> = {},
  store: Store = {},
  initialScreen?: string,
): Result {
  const result: Result = { trace: [], messages: [], outputs: {} };
  const outputs = result.outputs;
  const node = (id: string) => g.nodes.find((n) => n.id === id);

  /** Lê o valor conectado a uma porta de entrada; prefere origens já executadas. */
  const read = (id: string, port: string, fallback?: unknown) => {
    const defaultVal = fallback !== undefined ? fallback : (values[port] ?? '');
    const aliases =
      port === 'value'
        ? ['value', 'result', 'response', 'data', 'user']
        : port === 'result' || port === 'response' || port === 'data' || port === 'user'
          ? [port, 'value']
          : [port];

    const edges = g.edges.filter(
      (e) => e.target === id && (e.targetHandle === port || aliases.includes(e.targetHandle || '')),
    );
    const e = edges.find((e) => Object.hasOwn(outputs, e.source)) || edges[0];
    if (!e) return defaultVal;
    const n = node(e.source);
    if (n && valueKinds.includes(n.data.kind)) {
      return inputValue(n, values);
    }
    const rawOutput = outputs[e.source];
    if (
      rawOutput &&
      typeof rawOutput === 'object' &&
      e.sourceHandle &&
      e.sourceHandle in (rawOutput as Record<string, unknown>)
    ) {
      return (rawOutput as Record<string, unknown>)[e.sourceHandle];
    }
    return rawOutput ?? defaultVal;
  };

  function execute(n: Block): Step {
    const c = n.data.config;
    let out: unknown = true;
    let path = 'then';
    let message = 'Executado';

    switch (n.data.kind) {
      case 'screen':
        result.screen = n.id;
        message = 'Navegando para ' + (n.data.label || n.id);
        break;
      case 'error': {
        const errorInput = read(n.id, 'error', '');
        const messageInput = read(n.id, 'msg', '') || read(n.id, 'message', '');
        const msg = String(
          messageInput ||
            (hasMessage(errorInput) ? errorInput.message : errorInput) ||
            c.message ||
            'Erro detectado no fluxo',
        );
        out = { error: true, msg, message: msg, type: c.type || 'toast' };

        const retriesKey = `__retries_${n.id}`;
        const retryCount = Number(store[retriesKey]?.[0] || 0);
        const maxRetries = Number(c.maxRetries || 1);
        const hasRetryEdge = g.edges.some((e) => e.source === n.id && e.sourceHandle === 'retry');

        if (hasRetryEdge && retryCount < maxRetries) {
          store[retriesKey] = [retryCount + 1];
          path = 'retry';
          message = `Alerta de erro: "${msg}" (Tentativa ${retryCount + 1}/${maxRetries} de re-execução via retry)`;
        } else if (hasRetryEdge && retryCount >= maxRetries) {
          path = '';
          message = `Alerta de erro: "${msg}" (Erro persistiu após re-execução. Finalizando fluxo com falha.)`;
        } else {
          path = 'onDismiss';
          message = `Alerta de erro: "${msg}"`;
        }
        break;
      }
      case 'input':
        out = inputValue(n, values);
        message = `Valor: "${out}"`;
        break;
      case 'button':
        path = 'onClick';
        message = 'Evento onClick disparado';
        break;
      case 'function': {
        const inputVal = read(n.id, 'value', '');
        const code = c.code || 'return value;';
        try {
          const fn = new Function('value', 'store', 'read', code);
          out = fn(inputVal, store, (port: string, fallback?: unknown) =>
            read(n.id, port, fallback),
          );
        } catch {
          out = inputVal;
        }
        message = 'Função executada';
        break;
      }
      case 'auth': {
        const email = String(read(n.id, 'email'));
        const password = String(read(n.id, 'password'));
        if (c.provider !== 'email') {
          out = true;
          message = `${c.provider}: autenticação simulada`;
        } else {
          const users = (store.__users ??= [{ ...DEMO_USER }]) as User[];
          if (c.mode === 'register') {
            out =
              email.includes('@') && password.length >= 6 && !users.some((u) => u.email === email);
            if (out) users.push({ email, password });
            message = out ? 'Conta simulada criada' : 'Use e-mail novo e senha com 6 caracteres';
          } else {
            out = users.some((u) => u.email === email && u.password === password);
            message = out ? 'Acesso simulado autorizado' : 'E-mail ou senha inválidos';
          }
        }
        if (out) {
          store.__session = [{ provider: c.provider, email: read(n.id, 'email') }];
          path = 'onSuccess';
        } else {
          delete store.__session;
          path = 'onError';
        }
        break;
      }
      case 'condition': {
        const value = read(n.id, 'value');
        out =
          c.operator === 'equals'
            ? String(value) === c.compare
            : c.operator === 'gt'
              ? Number(value) > Number(c.compare)
              : Boolean(value);
        path = out ? 'true' : 'false';
        message = out ? 'Caminho verdadeiro' : 'Caminho falso';
        break;
      }
      case 'api':
        out = JSON.parse(c.mock || '{"ok":true}');
        message = `${c.method} ${c.url} · resposta simulada`;
        break;
      case 'database': {
        const rows = (store[c.table] ??= JSON.parse(c.mock || '[]'));
        if (!Array.isArray(rows)) throw Error('Banco: use um array JSON');
        if (c.operation === 'insert') rows.push(read(n.id, 'value', {}));
        out = [...rows];
        message = `${c.table}: ${rows.length} registro(s) em memória`;
        break;
      }
      case 'navigate': {
        const targetScreen = c.target || String(read(n.id, 'route', ''));
        const cleanTarget = targetScreen.replace(/^\//, '');
        const destNode = node(c.target) || node(cleanTarget) || node(targetScreen);
        if (destNode && destNode.data.kind === 'screen') {
          result.screen = destNode.id;
        } else if (c.target) {
          result.screen = c.target;
        }
        path = 'onComplete';
        message = 'Navegando para ' + (destNode?.data.label || c.target || cleanTarget);
        break;
      }
    }
    return { out, path, message };
  }

  const origin = node(initialScreen || node(start)?.data.config.screenId || '');
  const routes = origin?.data.kind === 'screen' ? screenRoutes(origin) : [];

  let current: string | undefined = start;
  let steps = 0;
  while (current && steps++ < MAX_STEPS) {
    const n = node(current);
    if (!n) throw Error('Bloco não encontrado: ' + current);

    const { out, path, message } = execute(n);
    outputs[n.id] = out;
    result.trace.push({ id: n.id, label: n.data.label, message });

    // Uma transição de tela atendida tem prioridade sobre o próximo fio e encerra a execução.
    const route = routes.find(
      (r) =>
        r.trigger === n.id &&
        (r.when === 'always' || (r.when === 'true' ? out === true : out === false)),
    );
    if (route) {
      const target = node(route.target);
      if (target?.data.kind !== 'screen') throw Error('Tela de destino da transição não existe');
      result.screen = target.id;
      result.trace.push({
        id: target.id,
        label: target.data.label,
        message: `Transição de ${origin!.data.label}: ${n.data.label} → ${target.data.label}`,
      });
      return result;
    }

    let nextEdge = g.edges.find((e) => e.source === n.id && e.sourceHandle === path);
    if (!nextEdge) {
      if (path === 'onClick') {
        nextEdge = g.edges.find(
          (e) => e.source === n.id && (e.sourceHandle === 'click' || e.sourceHandle === 'next'),
        );
      } else if (path === 'then') {
        nextEdge = g.edges.find((e) => e.source === n.id && e.sourceHandle === 'next');
      } else if (path === 'true') {
        nextEdge = g.edges.find((e) => e.source === n.id && e.sourceHandle === 'then');
      } else if (path === 'false') {
        nextEdge = g.edges.find((e) => e.source === n.id && e.sourceHandle === 'else');
      } else if (path === 'onSuccess') {
        nextEdge = g.edges.find(
          (e) =>
            e.source === n.id &&
            (e.sourceHandle === 'success' ||
              e.sourceHandle === 'then' ||
              e.sourceHandle === 'next'),
        );
      } else if (path === 'onError') {
        nextEdge = g.edges.find(
          (e) => e.source === n.id && (e.sourceHandle === 'error' || e.sourceHandle === 'false'),
        );
      } else if (path === 'onComplete') {
        nextEdge = g.edges.find(
          (e) => e.source === n.id && (e.sourceHandle === 'then' || e.sourceHandle === 'next'),
        );
      } else if (path === 'onDismiss') {
        nextEdge = g.edges.find(
          (e) => e.source === n.id && (e.sourceHandle === 'then' || e.sourceHandle === 'next'),
        );
      }
    }
    current = nextEdge?.target;
  }

  if (current) throw Error('Fluxo interrompido: limite de 100 passos (possível ciclo).');
  return result;
}
