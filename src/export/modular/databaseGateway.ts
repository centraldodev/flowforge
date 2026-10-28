/** Gera o gateway PostgreSQL. O manifesto só contém operações reais. */
export function databaseGatewaySource(hasAuth: boolean): string {
  const imports = hasAuth
    ? "import { authorizeRequest } from '../policies/index.mjs';\nimport { verifySession } from '../auth/gateway.mjs';"
    : '';
  return (
    String.raw`import manifest from './manifest.mjs';
import { runMigrations } from './migrator.mjs';
` +
    imports +
    String.raw`
const configuredAuth = ` +
    String(hasAuth) +
    String.raw`;
const pools = new Map();
const migrationRuns = new WeakMap();
const ident = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw Object.assign(new Error('Identificador de banco inválido.'), { status: 400 });
  return '"' + value + '"';
};
const reply = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
async function getPool(spec, env, options) {
  if (options.pool) return options.pool;
  const environment = env.FLOWFORGE_ENV || manifest.environment || 'development';
  if (!['development', 'production'].includes(environment)) throw Object.assign(new Error('Ambiente de banco inválido.'), { status: 503 });
  const config = spec.connection?.[environment];
  const secret = config && env[config.secretEnv];
  if (!config || !secret) throw Object.assign(new Error('Credencial PostgreSQL não configurada para esta conexão e ambiente.'), { status: 503, code: 'DATABASE_NOT_CONFIGURED' });
  const key = spec.connection.id + ':' + environment;
  if (!pools.has(key)) {
    const { Pool } = await import('pg');
    const connection = /^postgres(?:ql)?:\/\//i.test(secret)
      ? { connectionString: secret }
      : { host: config.host, port: config.port, database: config.database, user: config.user, password: secret };
    pools.set(key, new Pool({ ...connection, connectionTimeoutMillis: config.timeoutMs, ssl: config.ssl === 'require' ? { rejectUnauthorized: true } : undefined }));
  }
  return pools.get(key);
}
async function migrate(pool) {
  let pending = migrationRuns.get(pool);
  if (!pending) { pending = runMigrations(pool); migrationRuns.set(pool, pending); }
  try { await pending; } catch (error) { migrationRuns.delete(pool); throw error; }
}
export function createDatabaseGateway(options = {}) {
  const env = options.env || process.env;
  const checkPolicy = configuredAuth ? authorizeRequest : options.authorizeRequest;
  const sessionFor = configuredAuth ? verifySession : options.verifySession;
  return async (req, res) => {
    if (req.method !== 'POST') return reply(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
    let client;
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 1048576) throw Object.assign(new Error('Corpo muito grande.'), { status: 413 }); }
      const body = JSON.parse(raw);
      const spec = manifest.operations.find((operation) => operation.id === body.id);
      if (!spec) return reply(res, 404, { ok: false, error: { code: 'OPERATION_NOT_FOUND' } });
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || body.token || '';
      const session = typeof sessionFor === 'function' ? await sessionFor(token) : null;
      const user = session?.user || null;
      if (configuredAuth && !user) return reply(res, 401, { ok: false, error: { code: 'UNAUTHORIZED' } });
      const tenantId = user?.orgId || user?.tenantId || null;
      if (spec.multiTenancy === 'column' && !tenantId) return reply(res, 401, { ok: false, error: { code: 'UNAUTHORIZED_TENANT' } });
      const pool = await getPool(spec, env, options);
      await migrate(pool);
      const entity = manifest.entities.find((item) => item.name === spec.table && (item.schema || 'public') === (spec.schema || 'public'));
      if (!entity) throw Object.assign(new Error('Entidade não configurada para a operação.'), { status: 400 });
      const fields = new Set(entity.fields.map((field) => field.name));
      const primary = entity.fields.find((field) => field.primaryKey)?.name || 'id';
      fields.add(primary);
      if (spec.multiTenancy === 'column') fields.add(spec.tenantColumn || 'tenant_id');
      const column = (field) => { if (!fields.has(field)) throw Object.assign(new Error('Campo não declarado na entidade.'), { status: 400 }); return ident(field); };
      const table = ident(spec.schema || 'public') + '.' + ident(spec.table);
      const input = body.payload || {};
      let data = input.data ?? {};
      if (typeof data === 'string') data = JSON.parse(data);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('Dados inválidos.'), { status: 400 });
      const id = input.id ?? data[primary] ?? spec.recordId;
      client = await pool.connect();
      await client.query('BEGIN');
      let existing = null;
      if (['get', 'update', 'delete'].includes(spec.operation)) {
        if (id === undefined || id === '') throw Object.assign(new Error('ID obrigatório.'), { status: 400 });
        const result = await client.query('SELECT * FROM ' + table + ' WHERE ' + column(primary) + ' = $1 FOR UPDATE', [id]);
        existing = result.rows[0] || null;
        if (!existing) { await client.query('ROLLBACK'); return reply(res, 404, { ok: false, error: { code: 'NOT_FOUND' } }); }
        if (spec.multiTenancy === 'column' && String(existing[spec.tenantColumn || 'tenant_id']) !== String(tenantId)) { await client.query('ROLLBACK'); return reply(res, 403, { ok: false, error: { code: 'FORBIDDEN' } }); }
      }
      const permits = (record) => typeof checkPolicy !== 'function' || checkPolicy({ user, target: spec.table, action: spec.operation, record }).allowed;
      if (spec.operation !== 'query' && !permits(existing || data)) { await client.query('ROLLBACK'); return reply(res, 403, { ok: false, error: { code: 'FORBIDDEN' } }); }
      if (existing) {
        const protectedFields = new Set(['ownerId', 'orgId', spec.tenantColumn || 'tenant_id']);
        for (const policy of manifest.policies || []) for (const condition of policy.conditions || []) if (['isOwner', 'sameOrg'].includes(condition.operator)) protectedFields.add(condition.value || (condition.operator === 'isOwner' ? 'ownerId' : 'orgId'));
        if ([...protectedFields].some((key) => Object.hasOwn(data, key) && String(data[key]) !== String(existing[key]))) { await client.query('ROLLBACK'); return reply(res, 403, { ok: false, error: { code: 'PROTECTED_FIELD' } }); }
      }
      let result;
      if (spec.operation === 'query') {
        const filter = input.filter && typeof input.filter === 'object' ? input.filter : {};
        const params = []; const clauses = [];
        for (const [key, value] of Object.entries(filter)) { params.push(value); clauses.push(column(key) + ' = $' + params.length); }
        if (tenantId && spec.multiTenancy === 'column') { params.push(tenantId); clauses.push(column(spec.tenantColumn || 'tenant_id') + ' = $' + params.length); }
        const order = input.orderBy ? ' ORDER BY ' + column(input.orderBy) + (input.orderDirection === 'desc' ? ' DESC' : ' ASC') : '';
        const rows = (await client.query('SELECT * FROM ' + table + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') + order, params)).rows.filter(permits);
        const offset = Math.max(0, Number(input.offset) || 0), limit = Math.max(0, Number(input.limit) || 0);
        result = { ok: true, data: limit ? rows.slice(offset, offset + limit) : rows.slice(offset), total: rows.length };
      } else if (spec.operation === 'get') result = { ok: true, data: existing };
      else if (spec.operation === 'insert') {
        if (tenantId && spec.multiTenancy === 'column') data[spec.tenantColumn || 'tenant_id'] = tenantId;
        const keys = Object.keys(data); if (!keys.length) throw Object.assign(new Error('Dados obrigatórios.'), { status: 400 });
        const sql = 'INSERT INTO ' + table + ' (' + keys.map(column).join(', ') + ') VALUES (' + keys.map((_, i) => '$' + (i + 1)).join(', ') + ') RETURNING *';
        result = { ok: true, data: (await client.query(sql, keys.map((key) => data[key]))).rows[0] };
      } else if (spec.operation === 'update') {
        const keys = Object.keys(data).filter((key) => key !== primary); if (!keys.length) throw Object.assign(new Error('Nenhum campo para atualizar.'), { status: 400 });
        const sql = 'UPDATE ' + table + ' SET ' + keys.map((key, i) => column(key) + ' = $' + (i + 1)).join(', ') + ' WHERE ' + column(primary) + ' = $' + (keys.length + 1) + ' RETURNING *';
        result = { ok: true, data: (await client.query(sql, [...keys.map((key) => data[key]), id])).rows[0] };
      } else if (spec.operation === 'delete') {
        const rows = (await client.query('DELETE FROM ' + table + ' WHERE ' + column(primary) + ' = $1 RETURNING *', [id])).rows;
        result = { ok: true, data: rows[0], deletedCount: rows.length };
      } else throw Object.assign(new Error('Operação não suportada.'), { status: 400 });
      await client.query('COMMIT');
      return reply(res, 200, result);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      const status = error.status || 500;
      return reply(res, status, { ok: false, error: { code: error.code || 'DATABASE_ERROR', message: status < 500 ? error.message : 'Falha na operação de banco de dados.' } });
    } finally { client?.release(); }
  };
}
`
  );
}
