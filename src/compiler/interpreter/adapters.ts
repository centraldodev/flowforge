import type {
  AuthAdapter,
  DatabaseAdapter,
  DelayAdapter,
  ExecutionAdapters,
  ExecutionContext,
  LegacyFunctionAdapter,
} from './types';
import { GatewayApiAdapter } from './httpAdapter';
import { GatewayDatabaseAdapter } from './databaseAdapter';
import { GatewayAuthAdapter } from './authAdapter';
import { ModularSubflowAdapter } from './subflowAdapter';
import {
  GatewayStorageAdapter,
  GatewayEmailAdapter,
  GatewayWebhookAdapter,
  GatewayTaskAdapter,
} from './integrationsAdapter';
import { GatewayPaymentAdapter, GatewayRealtimeAdapter } from './paymentsRealtimeAdapter';
import { PLAYGROUND_ACCOUNT } from '../../engine/playgroundCredentials';

const DEMO_USER = {
  email: PLAYGROUND_ACCOUNT.email,
  password: PLAYGROUND_ACCOUNT.password,
  nome: PLAYGROUND_ACCOUNT.name,
};

/** Adaptador mock de autenticação determinístico e isolado (sem acesso externo) */
export class MockAuthAdapter implements AuthAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    let email = String(payload.email || '');
    let password = String(payload.password || '');

    // Fallback para inputs caso a chamada venha com valores vazios
    if (!email) {
      const emailKey = Object.keys(context.inputs).find((k) => k.toLowerCase().includes('email'));
      if (emailKey) email = String(context.inputs[emailKey] ?? '');
    }
    if (!password) {
      const passKey = Object.keys(context.inputs).find(
        (k) => k.toLowerCase().includes('senha') || k.toLowerCase().includes('password'),
      );
      if (passKey) password = String(context.inputs[passKey] ?? '');
    }

    const dbTable = 'usuarios';
    const dbRows = (context.store[dbTable] ??= [
      { id: 1, ...DEMO_USER, senha: DEMO_USER.password, provider: 'email' },
    ]) as Array<Record<string, unknown>>;

    if (action === 'google') {
      const googleEmail = 'google.teste@gmail.com';
      const mockToken = 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE';
      const googleUser = {
        id: 2,
        nome: 'Google Teste',
        email: googleEmail,
        provider: 'google',
        token: mockToken,
      };

      const existing = dbRows.find((u) => u.email === googleEmail);
      if (existing) {
        existing.token = mockToken;
        existing.provider = 'google';
      } else {
        dbRows.push(googleUser);
      }
      context.store.__session = [googleUser];
      return googleUser;
    }

    if (action === 'register') {
      const exists = dbRows.some((u) => u.email === email);
      if (exists) {
        delete context.store.__session;
        throw new Error('E-mail já cadastrado no banco de dados');
      }
      if (!email.includes('@') || password.length < 6) {
        delete context.store.__session;
        throw new Error('Use e-mail válido e senha com 6 caracteres');
      }

      const newUser = {
        id: dbRows.length + 1,
        nome: email.split('@')[0],
        email,
        senha: password,
        provider: 'email',
      };
      dbRows.push(newUser);
      context.store.__session = [newUser];
      return newUser;
    }

    // Modo login padrão
    const userInDb = dbRows.find(
      (u) => u.email === email && (u.senha === password || u.password === password),
    );

    if (userInDb) {
      context.store.__session = [userInDb];
      return userInDb;
    }

    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      context.store.__session = [DEMO_USER];
      return DEMO_USER;
    }

    delete context.store.__session;
    throw new Error('E-mail ou senha incorretos');
  }
}

/** Adaptador mock de banco de dados em memória determinístico com CRUD completo */
export class MockDatabaseAdapter implements DatabaseAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const table = String(payload.table || 'itens');
    const rows = (context.store[table] ??= []) as Array<Record<string, unknown>>;

    if (rows.length === 0 && payload.mock) {
      if (typeof payload.mock === 'string') {
        try {
          const parsed = JSON.parse(payload.mock);
          if (Array.isArray(parsed)) {
            rows.push(...parsed);
          }
        } catch {
          // Fallback
        }
      } else if (Array.isArray(payload.mock)) {
        rows.push(...(payload.mock as Array<Record<string, unknown>>));
      }
    }

    const op = String(payload.operation || action || 'query').toLowerCase();

    // 1. INSERT
    if (op === 'insert') {
      let rawData = payload.data ?? payload.user ?? payload.value;
      if (typeof rawData === 'string' && rawData.trim().startsWith('{')) {
        try {
          rawData = JSON.parse(rawData);
        } catch {
          // mantém valor
        }
      }
      const record: Record<string, unknown> =
        rawData && typeof rawData === 'object' && !Array.isArray(rawData)
          ? { ...(rawData as Record<string, unknown>) }
          : { value: rawData };

      if (record.id === undefined || record.id === null || record.id === '') {
        const maxId = rows.reduce((max, r) => {
          const num = Number(r.id);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        record.id = maxId + 1;
      }

      rows.push(record);
      context.variables['value'] = record;
      context.outputs['value'] = record;
      return record;
    }

    // 2. GET
    if (op === 'get') {
      const targetId =
        payload.id !== undefined && payload.id !== ''
          ? payload.id
          : payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>).id
            : undefined;

      let found: Record<string, unknown> | undefined;
      if (targetId !== undefined) {
        found = rows.find((r) => r.id === targetId || String(r.id) === String(targetId));
      } else if (payload.filter && typeof payload.filter === 'object') {
        const filterObj = payload.filter as Record<string, unknown>;
        found = rows.find((r) =>
          Object.entries(filterObj).every(([k, v]) => r[k] === v || String(r[k]) === String(v)),
        );
      }

      if (!found) {
        throw new Error(`Registro com ID "${targetId}" não encontrado na tabela "${table}".`);
      }

      context.variables['value'] = found;
      context.outputs['value'] = found;
      return found;
    }

    // 3. UPDATE
    if (op === 'update') {
      let rawUpdates = payload.data ?? payload.value;
      if (typeof rawUpdates === 'string' && rawUpdates.trim().startsWith('{')) {
        try {
          rawUpdates = JSON.parse(rawUpdates);
        } catch {
          // Mantém formato original
        }
      }
      const updates =
        rawUpdates && typeof rawUpdates === 'object' && !Array.isArray(rawUpdates)
          ? (rawUpdates as Record<string, unknown>)
          : {};

      const targetId = payload.id !== undefined && payload.id !== '' ? payload.id : updates.id;

      const idx = rows.findIndex((r) => r.id === targetId || String(r.id) === String(targetId));

      if (idx === -1) {
        throw new Error(
          `Registro com ID "${targetId}" não encontrado para atualização na tabela "${table}".`,
        );
      }

      const updated = {
        ...rows[idx],
        ...updates,
        id: rows[idx].id,
      };
      rows[idx] = updated;

      context.variables['value'] = updated;
      context.outputs['value'] = updated;
      return updated;
    }

    // 4. DELETE
    if (op === 'delete') {
      const targetId =
        payload.id !== undefined && payload.id !== ''
          ? payload.id
          : payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>).id
            : undefined;

      const idx = rows.findIndex((r) => r.id === targetId || String(r.id) === String(targetId));

      if (idx === -1) {
        throw new Error(
          `Registro com ID "${targetId}" não encontrado para exclusão na tabela "${table}".`,
        );
      }

      const [deleted] = rows.splice(idx, 1);
      const res = { success: true, id: targetId, deletedCount: 1, item: deleted };
      context.variables['value'] = res;
      context.outputs['value'] = res;
      context.variables['deletedCount'] = 1;
      context.outputs['deletedCount'] = 1;
      return res;
    }

    // 5. QUERY
    let filtered = [...rows];

    if (payload.filter) {
      if (Array.isArray(payload.filter)) {
        for (const f of payload.filter as Array<{
          field: string;
          op?: string;
          value: unknown;
        }>) {
          filtered = filtered.filter((r) => {
            const val = r[f.field];
            switch (f.op) {
              case 'eq':
                return val === f.value || String(val) === String(f.value);
              case 'neq':
                return val !== f.value && String(val) !== String(f.value);
              case 'gt':
                return (Number(val) || 0) > (Number(f.value) || 0);
              case 'gte':
                return (Number(val) || 0) >= (Number(f.value) || 0);
              case 'lt':
                return (Number(val) || 0) < (Number(f.value) || 0);
              case 'lte':
                return (Number(val) || 0) <= (Number(f.value) || 0);
              case 'contains':
                return String(val ?? '')
                  .toLowerCase()
                  .includes(String(f.value ?? '').toLowerCase());
              default:
                return val === f.value || String(val) === String(f.value);
            }
          });
        }
      } else if (typeof payload.filter === 'object') {
        const filterObj = payload.filter as Record<string, unknown>;
        filtered = filtered.filter((r) =>
          Object.entries(filterObj).every(([k, v]) => {
            if (v === undefined || v === null || v === '') return true;
            return r[k] === v || String(r[k] ?? '').toLowerCase() === String(v).toLowerCase();
          }),
        );
      }
    }

    if (payload.orderBy && typeof payload.orderBy === 'string') {
      const orderField = payload.orderBy;
      const desc = payload.orderDirection === 'desc';
      filtered.sort((a, b) => {
        const va = a[orderField] ?? '';
        const vb = b[orderField] ?? '';
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return desc ? nb - na : na - nb;
        }
        return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
      });
    }

    const total = filtered.length;
    const offset = Number(payload.offset) || 0;
    const limit = Number(payload.limit) || 0;

    let paged = filtered;
    if (limit > 0) {
      paged = filtered.slice(offset, offset + limit);
    } else if (offset > 0) {
      paged = filtered.slice(offset);
    }

    context.variables['total'] = total;
    context.outputs['total'] = total;
    context.variables['value'] = paged;
    context.outputs['value'] = paged;

    return paged;
  }
}

export { MockApiAdapter } from './mockApiAdapter';

/** Adaptador de Delay injetável com suporte a cancelamento imediato e modo rápido */
export class MockDelayAdapter implements DelayAdapter {
  constructor(private fast: boolean = true) {}

  async execute(durationMs: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Operação cancelada antes do delay.');
    }

    // No modo rápido para testes, cede a microtask sem travar o loop de eventos
    if (this.fast || durationMs <= 0) {
      await Promise.resolve();
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, durationMs);

      const onAbort = () => {
        cleanup();
        reject(new Error('Execução cancelada durante delay.'));
      };

      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      signal?.addEventListener('abort', onAbort);
    });
  }
}

/** Adaptador isolado para blocos com código JavaScript textual legado */
export class SafeLegacyFunctionAdapter implements LegacyFunctionAdapter {
  async execute(operation: string, args: unknown[], context: ExecutionContext): Promise<unknown> {
    // Para blocos de função padrão sem código customizado complexo
    const inputVal = args[0] ?? context.variables['value'] ?? '';
    return inputVal;
  }
}

export function createDefaultAdapters(options?: { fastDelay?: boolean }): ExecutionAdapters {
  return {
    auth: new GatewayAuthAdapter(),
    api: new GatewayApiAdapter(),
    database: new GatewayDatabaseAdapter(),
    delay: new MockDelayAdapter(options?.fastDelay ?? true),
    legacyFunction: new SafeLegacyFunctionAdapter(),
    subflow: new ModularSubflowAdapter(),
    storage: new GatewayStorageAdapter(),
    email: new GatewayEmailAdapter(),
    webhook: new GatewayWebhookAdapter(),
    task: new GatewayTaskAdapter(),
    payment: new GatewayPaymentAdapter(),
    realtime: new GatewayRealtimeAdapter(),
  };
}

export function createExecutionContext(init?: Partial<ExecutionContext>): ExecutionContext {
  return {
    inputs: init?.inputs ? { ...init.inputs } : {},
    store: init?.store ?? {},
    variables: init?.variables ? { ...init.variables } : {},
    screen: init?.screen,
    outputs: init?.outputs ? { ...init.outputs } : {},
    notifications: init?.notifications ? [...init.notifications] : [],
    logs: init?.logs ? [...init.logs] : [],
    trace: init?.trace ? [...init.trace] : [],
    stepCount: init?.stepCount ?? 0,
    maxSteps: init?.maxSteps ?? 100,
    signal: init?.signal,
    adapters: init?.adapters ?? createDefaultAdapters(),
    debugger: init?.debugger,
    onEvent: init?.onEvent,
  };
}
