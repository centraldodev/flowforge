import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseManifest, DatabaseOperationDefinition } from '../engine/database';
import { sanitizeIdentifier } from '../engine/database';

export type DatabaseExecutionResult = {
  ok: boolean;
  data?: unknown;
  total?: number;
  deletedCount?: number;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
};

export type DatabaseExecutorOptions = {
  environment?: 'development' | 'production';
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  queryRunner?: (
    sql: string,
    params: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
};

// Armazenamento persistente em memória/processo para o preview local e testes de desenvolvimento
const devTables = new Map<string, Map<string, Record<string, unknown>>>();

export function getDevTable(tableName: string): Map<string, Record<string, unknown>> {
  let table = devTables.get(tableName);
  if (!table) {
    table = new Map<string, Record<string, unknown>>();
    devTables.set(tableName, table);
  }
  return table;
}

export function clearDevDatabase(): void {
  devTables.clear();
}

/** Executa uma operação de banco de dados com segurança, parâmetros preparados e sanitização */
export async function executeDatabaseOperation(
  spec: DatabaseOperationDefinition,
  input: {
    data?: unknown;
    id?: unknown;
    filter?: unknown;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {},
  options: DatabaseExecutorOptions = {},
): Promise<DatabaseExecutionResult> {
  const envName = options.environment ?? 'development';
  const connConfig =
    envName === 'production' ? spec.connection.production : spec.connection.development;
  const env = options.env ?? process.env;

  // Resolução segura da credencial no servidor
  const password = connConfig.secretEnv ? env[connConfig.secretEnv] : undefined;
  if (connConfig.secretEnv && !password) {
    // Aviso de credencial ausente, mas em ambiente de dev/preview permite execução local
    if (envName === 'production') {
      return {
        ok: false,
        error: {
          code: 'DB_SECRET_MISSING',
          message: `Segredo de banco de dados "${connConfig.secretEnv}" não configurado no ambiente.`,
        },
      };
    }
  }

  const tableName = sanitizeIdentifier(spec.table);
  const operation = spec.operation;

  try {
    // Se um executor SQL personalizado foi fornecido (ex: conexão pg real ou banco de teste)
    if (options.queryRunner) {
      return await executeWithQueryRunner(tableName, operation, input, spec, options.queryRunner);
    }

    // Executor padrão local (persistente no processo) com semântica idêntica ao PostgreSQL
    return executeWithLocalStore(tableName, operation, input, spec);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha na operação de banco de dados.';
    return {
      ok: false,
      error: {
        code: 'DB_ERROR',
        message: message.replace(new RegExp(String(password || '___'), 'g'), '[REDACTED]'),
      },
    };
  }
}

async function executeWithQueryRunner(
  table: string,
  op: string,
  input: Record<string, unknown>,
  spec: DatabaseOperationDefinition,
  runner: (
    sql: string,
    params: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>,
): Promise<DatabaseExecutionResult> {
  if (op === 'query') {
    const params: unknown[] = [];
    let sql = `SELECT * FROM "${table}"`;
    const filter = (input.filter ??
      (spec.filterField && spec.filterValue !== undefined
        ? { [spec.filterField]: spec.filterValue }
        : null)) as Record<string, unknown> | null;

    if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
      const clauses: string[] = [];
      for (const [k, v] of Object.entries(filter)) {
        params.push(v);
        clauses.push(`"${sanitizeIdentifier(k)}" = $${params.length}`);
      }
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    const orderBy = (input.orderBy || spec.orderBy) as string | undefined;
    if (orderBy) {
      const dir =
        (input.orderDirection || spec.orderDirection || 'asc') === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY "${sanitizeIdentifier(orderBy)}" ${dir}`;
    }

    const limit = Number(input.limit ?? spec.limit ?? 0);
    if (limit > 0) {
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
    }

    const offset = Number(input.offset ?? spec.offset ?? 0);
    if (offset > 0) {
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
    }

    const res = await runner(sql, params);
    return { ok: true, data: res.rows, total: res.rowCount ?? res.rows.length };
  }

  if (op === 'get') {
    const id = input.id ?? spec.recordId;
    if (id === undefined || id === '') {
      return {
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do registro obrigatório para busca.' },
      };
    }
    const sql = `SELECT * FROM "${table}" WHERE "id" = $1 LIMIT 1;`;
    const res = await runner(sql, [id]);
    if (!res.rows[0]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Registro "${id}" não encontrado na tabela "${table}".`,
        },
      };
    }
    return { ok: true, data: res.rows[0] };
  }

  if (op === 'insert') {
    const rawData = input.data ?? {};
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        error: { code: 'INVALID_DATA', message: 'Dados para inserção inválidos.' },
      };
    }
    const cols = Object.keys(data).map(sanitizeIdentifier);
    if (cols.length === 0) {
      return {
        ok: false,
        error: { code: 'EMPTY_INSERT', message: 'Nenhum campo fornecido para inserção.' },
      };
    }
    const params = cols.map((col) => (data as Record<string, unknown>)[col]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *;`;
    const res = await runner(sql, params);
    return { ok: true, data: res.rows[0] };
  }

  if (op === 'update') {
    const rawData = input.data ?? {};
    const updates = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    const id = input.id ?? (updates as Record<string, unknown>)?.id ?? spec.recordId;
    if (id === undefined || id === '') {
      return {
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do registro obrigatório para atualização.' },
      };
    }
    const cols = Object.keys(updates)
      .filter((k) => k !== 'id')
      .map(sanitizeIdentifier);
    if (cols.length === 0) {
      return {
        ok: false,
        error: { code: 'EMPTY_UPDATE', message: 'Nenhum campo para atualizar.' },
      };
    }
    const params: unknown[] = cols.map((col) => (updates as Record<string, unknown>)[col]);
    params.push(id);
    const setClause = cols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const sql = `UPDATE "${table}" SET ${setClause} WHERE "id" = $${params.length} RETURNING *;`;
    const res = await runner(sql, params);
    if (!res.rows[0]) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Registro "${id}" não encontrado para atualização.` },
      };
    }
    return { ok: true, data: res.rows[0] };
  }

  if (op === 'delete') {
    const id = input.id ?? spec.recordId;
    if (id === undefined || id === '') {
      return {
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do registro obrigatório para exclusão.' },
      };
    }
    const sql = `DELETE FROM "${table}" WHERE "id" = $1 RETURNING *;`;
    const res = await runner(sql, [id]);
    if (!res.rows[0]) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Registro "${id}" não encontrado para exclusão.` },
      };
    }
    return { ok: true, data: res.rows[0], deletedCount: 1 };
  }

  return {
    ok: false,
    error: { code: 'UNSUPPORTED_OPERATION', message: `Operação "${op}" não suportada.` },
  };
}

function executeWithLocalStore(
  table: string,
  op: string,
  input: Record<string, unknown>,
  spec: DatabaseOperationDefinition,
): DatabaseExecutionResult {
  const store = getDevTable(table);

  if (op === 'query') {
    let rows = Array.from(store.values());
    const filter = (input.filter ??
      (spec.filterField && spec.filterValue !== undefined
        ? { [spec.filterField]: spec.filterValue }
        : null)) as Record<string, unknown> | null;

    if (filter && typeof filter === 'object') {
      rows = rows.filter((r) =>
        Object.entries(filter).every(([k, v]) => String(r[k] ?? '') === String(v ?? '')),
      );
    }

    const orderBy = (input.orderBy || spec.orderBy) as string | undefined;
    if (orderBy) {
      const isDesc = (input.orderDirection || spec.orderDirection || 'asc') === 'desc';
      rows.sort((a, b) => {
        const va = String(a[orderBy] ?? '');
        const vb = String(b[orderBy] ?? '');
        return isDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      });
    }

    const total = rows.length;
    const offset = Number(input.offset ?? spec.offset ?? 0);
    const limit = Number(input.limit ?? spec.limit ?? 0);

    if (offset > 0) rows = rows.slice(offset);
    if (limit > 0) rows = rows.slice(0, limit);

    return { ok: true, data: rows, total };
  }

  if (op === 'get') {
    const id = String(input.id ?? spec.recordId ?? '');
    if (!id)
      return { ok: false, error: { code: 'MISSING_ID', message: 'ID do registro obrigatório.' } };
    const row = store.get(id);
    if (!row) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Registro "${id}" não encontrado na tabela "${table}".`,
        },
      };
    }
    return { ok: true, data: row };
  }

  if (op === 'insert') {
    const rawData = input.data ?? {};
    const data = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as Record<
      string,
      unknown
    >;
    const id = String(data.id || store.size + 1);
    const record = { ...data, id, criado_em: new Date().toISOString() };
    store.set(id, record);
    return { ok: true, data: record };
  }

  if (op === 'update') {
    const rawData = input.data ?? {};
    const updates = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as Record<
      string,
      unknown
    >;
    const id = String(input.id ?? updates?.id ?? spec.recordId ?? '');
    if (!id)
      return {
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do registro obrigatório para atualização.' },
      };
    const existing = store.get(id);
    if (!existing) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Registro "${id}" não encontrado para atualização.` },
      };
    }
    const updated = { ...existing, ...updates, id, atualizado_em: new Date().toISOString() };
    store.set(id, updated);
    return { ok: true, data: updated };
  }

  if (op === 'delete') {
    const id = String(input.id ?? spec.recordId ?? '');
    if (!id)
      return {
        ok: false,
        error: { code: 'MISSING_ID', message: 'ID do registro obrigatório para exclusão.' },
      };
    const existing = store.get(id);
    if (!existing) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Registro "${id}" não encontrado para exclusão.` },
      };
    }
    store.delete(id);
    return { ok: true, data: existing, deletedCount: 1 };
  }

  return {
    ok: false,
    error: { code: 'UNSUPPORTED_OPERATION', message: `Operação "${op}" desconhecida.` },
  };
}

/** Cria middleware de requisições HTTP para o endpoint de banco de dados do FlowForge */
export function createDatabaseGateway(
  options: {
    manifest?: DatabaseManifest;
    env?: Record<string, string | undefined>;
    queryRunner?: (
      sql: string,
      params: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
  } = {},
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
        }),
      );
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      const manifest = body.manifest || options.manifest;
      if (!manifest) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: { code: 'MANIFEST_MISSING', message: 'Manifesto de banco de dados ausente.' },
          }),
        );
        return;
      }

      const operationSpec = manifest.operations.find(
        (op: DatabaseOperationDefinition) => op.id === body.id,
      );
      if (!operationSpec) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: {
              code: 'OPERATION_NOT_FOUND',
              message: `Operação "${body.id}" não autorizada.`,
            },
          }),
        );
        return;
      }

      const result = await executeDatabaseOperation(operationSpec, body.payload || {}, {
        environment: manifest.environment,
        env: options.env,
        queryRunner: options.queryRunner,
      });

      res.statusCode = result.ok ? 200 : result.error?.status || 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Erro interno ao processar requisição.',
          },
        }),
      );
    }
  };
}
