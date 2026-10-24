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
        const retryEdge = g.edges.find((e) => e.source === n.id && e.sourceHandle === 'retry');
        const hasRetryEdge = Boolean(
          retryEdge && (!retryEdge.target || result.trace.some((t) => t.id === retryEdge.target)),
        );

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
          let executableCode = code;
          const fnMatch = code.match(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
          if (fnMatch) {
            const declaredFnName = fnMatch[1];
            executableCode = `${code}\nreturn ${declaredFnName}(value, store, read);`;
          }
          const fn = new Function('value', 'store', 'read', executableCode);
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
        let email = String(read(n.id, 'email'));
        let password = String(read(n.id, 'password'));
        if (!email || !password) {
          const screenInputs = g.nodes.filter(
            (nodeItem) =>
              nodeItem.data.kind === 'input' &&
              nodeItem.data.config.screenId === n.data.config.screenId,
          );
          for (const inp of screenInputs) {
            if (!email && (inp.id.includes('email') || inp.data.config.field === 'email')) {
              email = String(inputValue(inp, values));
            }
            if (
              !password &&
              (inp.id.includes('senha') ||
                inp.id.includes('password') ||
                inp.data.config.field === 'password')
            ) {
              password = String(inputValue(inp, values));
            }
          }
        }
        if (c.provider === 'google') {
          const googleEmail = c.googleEmail || 'google.teste@gmail.com';
          const mockToken = c.mockToken || 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE';
          const googleUser = {
            id: 2,
            nome: c.googleName || 'Google Teste',
            email: googleEmail,
            provider: 'google',
            token: mockToken,
          };
          // Persiste e sincroniza com o banco de dados simulado
          const dbBlock = g.nodes.find((item) => item.data.kind === 'database');
          const dbTable = dbBlock?.data.config.table || 'usuarios';
          const dbRows = (store[dbTable] ??= JSON.parse(
            dbBlock?.data.config.mock || '[]',
          )) as Array<Record<string, unknown>>;
          const existing = Array.isArray(dbRows)
            ? dbRows.find((u) => u.email === googleEmail)
            : null;
          if (existing) {
            existing.token = mockToken;
            existing.provider = 'google';
            existing.nome ||= c.googleName || 'Google Teste';
          } else if (Array.isArray(dbRows)) {
            dbRows.push(googleUser);
          }
          store.__session = [googleUser];
          out = true;
          path = 'onSuccess';
          message = `Google OAuth: autenticado com token fictício e salvo no banco`;
          break;
        }

        if (c.provider !== 'email') {
          out = true;
          message = `${c.provider}: autenticação simulada`;
          store.__session = [{ provider: c.provider, email }];
          path = 'onSuccess';
          break;
        }

        // Provedor e-mail e senha: busca no banco de dados e na lista de demonstração
        const dbBlock = g.nodes.find((item) => item.data.kind === 'database');
        const dbTable = dbBlock?.data.config.table || 'usuarios';
        const dbRows = (store[dbTable] ??= JSON.parse(dbBlock?.data.config.mock || '[]')) as Array<
          Record<string, unknown>
        >;

        if (c.mode === 'register') {
          const exists = Array.isArray(dbRows) && dbRows.some((u) => u.email === email);
          if (!exists && email.includes('@') && password.length >= 6) {
            const newUser = {
              id: Array.isArray(dbRows) ? dbRows.length + 1 : 1,
              nome: email.split('@')[0],
              email,
              senha: password,
              provider: 'email',
            };
            if (Array.isArray(dbRows)) dbRows.push(newUser);
            store.__session = [newUser];
            out = true;
            path = 'onSuccess';
            message = `Conta criada e cadastrada no banco (${email})`;
          } else {
            delete store.__session;
            out = false;
            path = 'onError';
            message = exists
              ? 'E-mail já cadastrado no banco de dados'
              : 'Use e-mail válido e senha com 6 caracteres';
          }
        } else {
          // Modo login: procura no banco de dados
          const userInDb = Array.isArray(dbRows)
            ? dbRows.find(
                (u) => u.email === email && (u.senha === password || u.password === password),
              )
            : null;

          if (userInDb) {
            store.__session = [userInDb];
            out = true;
            path = 'onSuccess';
            message = `Acesso autorizado pelo banco: ${userInDb.nome || email}`;
          } else {
            const users = (store.__users ??= [{ ...DEMO_USER }]) as User[];
            const isDemoMatch = users.some((u) => u.email === email && u.password === password);
            if (isDemoMatch) {
              store.__session = [{ provider: 'email', email }];
              out = true;
              path = 'onSuccess';
              message = 'Acesso autorizado';
            } else {
              delete store.__session;
              out = false;
              path = 'onError';
              message = 'E-mail ou senha incorretos';
            }
          }
        }
        break;
      }
      case 'condition': {
        let value = read(n.id, 'value');
        if (value === undefined || value === '') {
          const inEdge = g.edges.find((e) => e.target === n.id && Object.hasOwn(outputs, e.source));
          if (inEdge && outputs[inEdge.source] !== undefined) {
            value = outputs[inEdge.source];
          }
        }
        if (value === undefined || value === '') {
          const screenInputs = g.nodes.filter(
            (nodeItem) =>
              nodeItem.data.kind === 'input' &&
              nodeItem.data.config.screenId === n.data.config.screenId,
          );
          if (screenInputs.length > 0) {
            value = screenInputs.every((inp) => Boolean(inputValue(inp, values)));
          }
        }
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
        if (c.operation === 'insert') {
          const payload = read(n.id, 'user') || read(n.id, 'data') || read(n.id, 'value', {});
          if (payload && typeof payload === 'object') {
            rows.push(payload);
          }
        }
        out = [...rows];
        path = 'onSuccess';
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
        r.trigger === n.id && (r.when === 'always' || (r.when === 'true' ? Boolean(out) : !out)),
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
