import type { Graph } from '../../engine/types';
import {
  buildDatabaseManifest,
  buildDatabaseMigrations,
  generatePostgresDDL,
  sanitizeIdentifier,
} from '../../engine/database';
import { ArtifactPlan, identity, json } from './artifacts';

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function emitDatabase(plan: ArtifactPlan, graph: Graph): boolean {
  const manifest = buildDatabaseManifest(graph);
  if (!manifest.operations.length && !manifest.entities.length && !manifest.connections.length) {
    return false;
  }

  const root = 'apps/api/src/';

  // 1. Contratos de Tipos em packages/contracts/src/database.ts
  plan.text(
    'packages/contracts/src/database.ts',
    `// Contratos de tipos para Banco de Dados, Multi-Tenancy e Migrações
export type MultiTenancyMode = 'none' | 'column' | 'schema';

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
}

export interface TenantContext {
  tenantId: string;
  schema?: string;
}

export interface DatabaseQueryOptions {
  filter?: Record<string, unknown>;
  tenantId?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
`,
    'contract',
  );

  // 2. Contratos de Entidades em packages/contracts/src/entities/
  for (const entity of manifest.entities) {
    const typeName = toPascalCase(entity.name);
    const typeProps = entity.fields.map((f) => {
      let tsType = 'string';
      if (f.type === 'number') tsType = 'number';
      else if (f.type === 'boolean') tsType = 'boolean';
      else if (f.type === 'date') tsType = 'Date | string';
      else if (f.type === 'json') tsType = 'Record<string, unknown>';
      const opt = f.required || f.primaryKey ? '' : '?';
      return `  "${f.name}"${opt}: ${tsType};`;
    });

    if (entity.multiTenancy === 'column') {
      const col = entity.tenantColumn || 'tenant_id';
      if (!entity.fields.some((f) => f.name === col)) {
        typeProps.push(`  "${col}": string;`);
      }
    }

    if (typeProps.length === 0) {
      typeProps.push('  "id": string;', '  "criado_em"?: string;');
    }

    plan.text(
      `packages/contracts/src/entities/${identity(entity.id)}.ts`,
      `export interface ${typeName} {\n${typeProps.join('\n')}\n}\n`,
      'contract',
      [entity.id],
    );
  }

  // 3. DDLs e Migrações Versionadas em apps/api/src/database/migrations/
  for (const entity of manifest.entities) {
    const ddl = generatePostgresDDL(entity);
    plan.text(`${root}database/schema/${identity(entity.id)}.sql`, ddl + '\n', 'database-schema', [
      entity.id,
    ]);
  }

  const migrations = buildDatabaseMigrations(manifest);
  for (const m of migrations) {
    plan.text(`${root}database/migrations/${m.filename}`, m.sql + '\n', 'database-migration');
  }

  const allInitSql = manifest.entities.map((e) => generatePostgresDDL(e)).join('\n\n');
  plan.text(
    `${root}database/migrations/001_init.sql`,
    `-- Migração inicial unificada\n\n${allInitSql}\n`,
    'database-migration',
  );

  // 4. Módulo Migrator em apps/api/src/database/migrator.mjs
  const migratorCode = `import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export async function runMigrations(pool) {
  if (!pool) return { ok: true, applied: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(\`
      CREATE TABLE IF NOT EXISTS _flowforge_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    \`);
    const { rows: appliedRows } = await client.query('SELECT version FROM _flowforge_migrations;');
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    const newlyApplied = [];
    for (const file of files) {
      const version = file.split('_')[0];
      if (!appliedVersions.has(version)) {
        const sql = await readFile(join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        await client.query(
          'INSERT INTO _flowforge_migrations (version, name) VALUES ($1, $2);',
          [version, file]
        );
        newlyApplied.push(file);
      }
    }
    await client.query('COMMIT');
    return { ok: true, applied: newlyApplied };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
`;
  plan.text(`${root}database/migrator.mjs`, migratorCode, 'database-migrator');

  // 5. Repositórios por módulo de domínio em apps/api/src/modules/
  const tables = [...new Set(manifest.operations.map((op) => op.table))];
  const repoDeps: string[] = [];

  for (const table of tables) {
    const safeTable = sanitizeIdentifier(table);
    const repoPath = `${root}modules/${safeTable}/repository.mjs`;
    repoDeps.push(repoPath);

    const repoCode = `// Repositório de dados com queries parametrizadas para a tabela "${safeTable}"
export class ${toPascalCase(safeTable)}Repository {
  constructor(pool) {
    this.pool = pool;
  }

  async query({ filter, tenantId, limit, offset, orderBy, orderDirection } = {}) {
    let sql = 'SELECT * FROM "${safeTable}"';
    const params = [];
    const clauses = [];
    if (tenantId) {
      params.push(tenantId);
      clauses.push(\`"tenant_id" = $\${params.length}\`);
    }
    if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
      for (const [k, v] of Object.entries(filter)) {
        params.push(v);
        clauses.push(\`"\${k}" = $\${params.length}\`);
      }
    }
    if (clauses.length > 0) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }
    if (orderBy) {
      const dir = (orderDirection || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      sql += \` ORDER BY "\${orderBy}" \${dir}\`;
    }
    if (limit > 0) {
      params.push(limit);
      sql += \` LIMIT $\${params.length}\`;
    }
    if (offset > 0) {
      params.push(offset);
      sql += \` OFFSET $\${params.length}\`;
    }
    return this.pool ? (await this.pool.query(sql, params)).rows : [];
  }

  async get(id, tenantId) {
    let sql = 'SELECT * FROM "${safeTable}" WHERE "id" = $1';
    const params = [id];
    if (tenantId) {
      params.push(tenantId);
      sql += ' AND "tenant_id" = $2';
    }
    sql += ' LIMIT 1;';
    const rows = this.pool ? (await this.pool.query(sql, params)).rows : [];
    return rows[0] || null;
  }

  async insert(data, tenantId) {
    const payload = tenantId ? { ...data, tenant_id: tenantId } : data;
    const keys = Object.keys(payload).filter(Boolean);
    const placeholders = keys.map((_, i) => \`$\${i + 1}\`).join(', ');
    const sql = \`INSERT INTO "${safeTable}" (\${keys.map((k) => \`"\${k}"\`).join(', ')}) VALUES (\${placeholders}) RETURNING *;\`;
    const params = keys.map((k) => payload[k]);
    const rows = this.pool ? (await this.pool.query(sql, params)).rows : [];
    return rows[0] || payload;
  }

  async update(id, data, tenantId) {
    const keys = Object.keys(data).filter((k) => k !== 'id' && k !== 'tenant_id');
    const params = keys.map((k) => data[k]);
    params.push(id);
    let whereClause = \`"id" = $\${params.length}\`;
    if (tenantId) {
      params.push(tenantId);
      whereClause += \` AND "tenant_id" = $\${params.length}\`;
    }
    const setClause = keys.map((k, i) => \`"\${k}" = $\${i + 1}\`).join(', ');
    const sql = \`UPDATE "${safeTable}" SET \${setClause} WHERE \${whereClause} RETURNING *;\`;
    const rows = this.pool ? (await this.pool.query(sql, params)).rows : [];
    return rows[0] || null;
  }

  async delete(id, tenantId) {
    let sql = 'DELETE FROM "${safeTable}" WHERE "id" = $1';
    const params = [id];
    if (tenantId) {
      params.push(tenantId);
      sql += ' AND "tenant_id" = $2';
    }
    sql += ' RETURNING *;';
    const rows = this.pool ? (await this.pool.query(sql, params)).rows : [];
    return rows[0] || null;
  }
}
`;
    plan.text(repoPath, repoCode, 'repository', [], []);
  }

  // 6. Manifesto de Banco e Gateway com Multi-Tenancy em apps/api/src/database/
  plan.text(
    `${root}database/manifest.mjs`,
    `export default ${json(manifest)};\n`,
    'database-manifest',
    manifest.operations.map((op) => op.id),
  );

  const gatewayDeps = [`${root}database/manifest.mjs`, `${root}database/migrator.mjs`, ...repoDeps];
  plan.text(
    `${root}database/gateway.mjs`,
    `import manifest from './manifest.mjs';

export function createDatabaseGateway(options = {}) {
  const store = new Map();

  return async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }));
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      const spec = manifest.operations.find((op) => op.id === body.id);
      if (!spec) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'OPERATION_NOT_FOUND', message: 'Operação não configurada.' } }));
        return;
      }

      const tenantId =
        req.headers['x-tenant-id'] ||
        body.tenantId ||
        (body.context && body.context.tenantId) ||
        null;

      if (spec.multiTenancy === 'column' && !tenantId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: { code: 'TENANT_REQUIRED', message: 'Identificador do tenant (x-tenant-id) é obrigatório.' } }));
        return;
      }

      const tableStore = store.get(spec.table) || new Map();
      store.set(spec.table, tableStore);

      const op = spec.operation;
      const input = body.payload || {};
      const tenantCol = spec.tenantColumn || 'tenant_id';

      if (op === 'query') {
        let rows = Array.from(tableStore.values());
        if (spec.multiTenancy === 'column' && tenantId) {
          rows = rows.filter((r) => String(r[tenantCol] ?? '') === String(tenantId));
        }
        if (input.filter && typeof input.filter === 'object') {
          rows = rows.filter((r) => Object.entries(input.filter).every(([k, v]) => String(r[k] ?? '') === String(v ?? '')));
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: rows, total: rows.length }));
        return;
      }

      if (op === 'get') {
        const id = String(input.id || spec.recordId || '');
        const row = tableStore.get(id);
        if (!row) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' } }));
          return;
        }
        if (spec.multiTenancy === 'column' && tenantId) {
          if (row[tenantCol] && String(row[tenantCol]) !== String(tenantId)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: { code: 'TENANT_FORBIDDEN', message: 'Acesso negado: registro pertence a outro tenant.' } }));
            return;
          }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: row }));
        return;
      }

      if (op === 'insert') {
        const raw = input.data || {};
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const id = String(data.id || (tableStore.size + 1));
        const record = { ...data, id, criado_em: new Date().toISOString() };
        if (spec.multiTenancy === 'column' && tenantId) {
          record[tenantCol] = tenantId;
        }
        tableStore.set(id, record);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: record }));
        return;
      }

      if (op === 'update') {
        const raw = input.data || {};
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const id = String(input.id || data.id || spec.recordId || '');
        const existing = tableStore.get(id);
        if (!existing) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' } }));
          return;
        }
        if (spec.multiTenancy === 'column' && tenantId) {
          if (existing[tenantCol] && String(existing[tenantCol]) !== String(tenantId)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: { code: 'TENANT_FORBIDDEN', message: 'Acesso negado: registro pertence a outro tenant.' } }));
            return;
          }
        }
        const updated = { ...existing, ...data, id, atualizado_em: new Date().toISOString() };
        tableStore.set(id, updated);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: updated }));
        return;
      }

      if (op === 'delete') {
        const id = String(input.id || spec.recordId || '');
        const existing = tableStore.get(id);
        if (!existing) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' } }));
          return;
        }
        if (spec.multiTenancy === 'column' && tenantId) {
          if (existing[tenantCol] && String(existing[tenantCol]) !== String(tenantId)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: { code: 'TENANT_FORBIDDEN', message: 'Acesso negado: registro pertence a outro tenant.' } }));
            return;
          }
        }
        tableStore.delete(id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: existing, deletedCount: 1 }));
        return;
      }

      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'UNSUPPORTED_OP', message: 'Operação não suportada.' } }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }));
    }
  };
}
`,
    'database-gateway',
    [],
    gatewayDeps,
  );

  return true;
}
