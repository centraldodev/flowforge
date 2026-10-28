import type { Block, Graph } from './types';
import { convertConceptualToLogical } from './dataModeling';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json';

export type MultiTenancyMode = 'none' | 'column' | 'schema';

export type EntityField = {
  name: string;
  type: FieldType;
  required?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string;
};

export type EntityDefinition = {
  id: string;
  name: string;
  schema?: string;
  multiTenancy?: MultiTenancyMode;
  tenantColumn?: string;
  fields: EntityField[];
};

export type DatabaseEngine = 'postgres' | 'sqlite';

export type PostgresConnectionConfig = {
  engine?: DatabaseEngine;
  sqlitePath?: string;
  host: string;
  port: number;
  database: string;
  schema: string;
  user: string;
  secretEnv: string;
  ssl: 'disable' | 'require' | 'prefer';
  timeoutMs: number;
  multiTenancy?: MultiTenancyMode;
  tenantColumn?: string;
};

export type PostgresConnectionDefinition = {
  id: string;
  engine?: DatabaseEngine;
  sqlitePath?: string;
  development: PostgresConnectionConfig;
  production: PostgresConnectionConfig;
};

export type DatabaseOperationDefinition = {
  id: string;
  operation: 'query' | 'get' | 'insert' | 'update' | 'delete';
  table: string;
  schema?: string;
  multiTenancy?: MultiTenancyMode;
  tenantColumn?: string;
  filterField?: string;
  filterValue?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  recordId?: string;
  connection: PostgresConnectionDefinition;
};

export type DatabaseManifest = {
  environment: 'development' | 'production';
  dialect?: DatabaseEngine;
  sqlitePath?: string;
  entities: EntityDefinition[];
  connections: PostgresConnectionDefinition[];
  operations: DatabaseOperationDefinition[];
};

export function parseEntityFields(value = '[]'): EntityField[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is EntityField =>
        Boolean(f) &&
        typeof f === 'object' &&
        typeof f.name === 'string' &&
        /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.name) &&
        ['string', 'number', 'boolean', 'date', 'json'].includes(f.type),
    );
  } catch {
    return [];
  }
}

export function postgresConnectionFor(graph: Graph, databaseBlockId: string): Block | undefined {
  const wire = graph.edges.find(
    (edge) => edge.target === databaseBlockId && edge.targetHandle === 'connection',
  );
  if (wire) {
    const node = graph.nodes.find(
      (n) => n.id === wire.source && n.data.kind === 'postgresConnection',
    );
    if (node) return node;
  }
  const directId = graph.nodes.find((n) => n.id === databaseBlockId)?.data.config.connectionId;
  if (directId) {
    return graph.nodes.find((n) => n.id === directId && n.data.kind === 'postgresConnection');
  }
  return undefined;
}

export function parseConnectionConfig(block: Block): PostgresConnectionDefinition {
  const c = block.data.config;
  const engine: DatabaseEngine = c.engine === 'sqlite' ? 'sqlite' : 'postgres';
  const sqlitePath = c.sqlitePath || './data/flowforge.sqlite';
  const parsePort = (p: string | undefined, fallback: number) => {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 && n <= 65535 ? n : fallback;
  };
  const parseTimeout = (t: string | undefined, fallback: number) => {
    const n = Number(t);
    return Number.isFinite(n) && n >= 100 && n <= 120000 ? n : fallback;
  };

  return {
    id: block.id,
    engine,
    sqlitePath,
    development: {
      engine,
      sqlitePath,
      host: c.host || 'localhost',
      port: parsePort(c.port, 5432),
      database: c.database || 'postgres',
      schema: c.schema || 'public',
      user: c.user || 'postgres',
      secretEnv: c.secretEnv || 'FLOWFORGE_SECRET_DB_PASSWORD',
      ssl: (c.ssl as 'disable' | 'require' | 'prefer') || 'disable',
      timeoutMs: parseTimeout(c.timeoutMs, 5000),
      multiTenancy: (c.multiTenancy as MultiTenancyMode) || 'none',
      tenantColumn: c.tenantColumn || 'tenant_id',
    },
    production: {
      engine,
      sqlitePath,
      host: c.productionHost || c.host || 'localhost',
      port: parsePort(c.productionPort || c.port, 5432),
      database: c.productionDatabase || c.database || 'postgres',
      schema: c.productionSchema || c.schema || 'public',
      user: c.productionUser || c.user || 'postgres',
      secretEnv: c.productionSecretEnv || c.secretEnv || 'FLOWFORGE_SECRET_DB_PASSWORD_PROD',
      ssl: (c.productionSsl as 'disable' | 'require' | 'prefer') || 'require',
      timeoutMs: parseTimeout(c.productionTimeoutMs || c.timeoutMs, 5000),
      multiTenancy:
        (c.productionMultiTenancy as MultiTenancyMode) ||
        (c.multiTenancy as MultiTenancyMode) ||
        'none',
      tenantColumn: c.tenantColumn || 'tenant_id',
    },
  };
}

export function buildDatabaseManifest(graph: Graph): DatabaseManifest {
  const nodeEntities: EntityDefinition[] = graph.nodes
    .filter((n) => n.data.kind === 'entity')
    .map((node) => ({
      id: node.id,
      name: node.data.config.name || node.data.label || 'tabela',
      schema: node.data.config.schema || 'public',
      multiTenancy: (node.data.config.multiTenancy as MultiTenancyMode) || 'none',
      tenantColumn: node.data.config.tenantColumn || 'tenant_id',
      fields: parseEntityFields(node.data.config.fields),
    }));

  const entityMap = new Map<string, EntityDefinition>();
  for (const ent of nodeEntities) {
    entityMap.set(ent.name, ent);
  }

  // Inclui também as tabelas geradas pela Modelagem de Dados (Conceitual -> Lógico)
  if (graph.dataModel && graph.dataModel.entities.length > 0) {
    const logicalTables = convertConceptualToLogical(graph.dataModel);
    for (const tbl of logicalTables) {
      const existing = entityMap.get(tbl.name);
      const modeledFields: EntityField[] = tbl.columns.map((c) => ({
        name: c.name,
        type: c.type,
        primaryKey: Boolean(c.primaryKey),
        required: Boolean(c.required),
        unique: Boolean(c.unique),
        defaultValue: c.defaultValue,
      }));
      if (existing) {
        // Mescla campos da modelagem que ainda não estavam no nó entity
        const mergedFields = [...existing.fields];
        for (const mf of modeledFields) {
          if (!mergedFields.some((f) => f.name === mf.name)) {
            mergedFields.push(mf);
          }
        }
        entityMap.set(tbl.name, { ...existing, fields: mergedFields });
      } else {
        entityMap.set(tbl.name, {
          id: tbl.id,
          name: tbl.name,
          schema: 'public',
          multiTenancy: 'none',
          tenantColumn: 'tenant_id',
          fields: modeledFields,
        });
      }
    }
  }

  const entities = [...entityMap.values()];

  const connections = graph.nodes
    .filter((n) => n.data.kind === 'postgresConnection')
    .map(parseConnectionConfig);

  const operations: DatabaseOperationDefinition[] = graph.nodes
    .filter((n) => n.data.kind === 'database' && n.data.config.mode === 'real')
    .map((node) => {
      const connNode = postgresConnectionFor(graph, node.id);
      if (!connNode) {
        throw new Error(
          `Conecte uma Conexão PostgreSQL à operação de banco de dados "${node.data.label}".`,
        );
      }
      const c = node.data.config;
      return {
        id: node.id,
        operation: (c.operation as DatabaseOperationDefinition['operation']) || 'query',
        table: c.table || 'itens',
        schema: c.schema || 'public',
        multiTenancy: (c.multiTenancy as MultiTenancyMode) || 'none',
        tenantColumn: c.tenantColumn || 'tenant_id',
        filterField: c.filterField || undefined,
        filterValue: c.filterValue || undefined,
        limit: c.limit ? Number(c.limit) : undefined,
        offset: c.offset ? Number(c.offset) : undefined,
        orderBy: c.orderBy || undefined,
        orderDirection: (c.orderDirection as 'asc' | 'desc') || 'asc',
        recordId: c.recordId || undefined,
        connection: parseConnectionConfig(connNode),
      };
    });

  const dialect: DatabaseEngine =
    graph.dataModel?.dialect ||
    connections.find((c) => c.engine === 'sqlite')?.engine ||
    'postgres';
  const sqlitePath =
    graph.dataModel?.sqliteFilePath ||
    connections.find((c) => c.sqlitePath)?.sqlitePath ||
    './data/flowforge.sqlite';

  return {
    environment: (graph.httpEnvironment as 'development' | 'production') ?? 'development',
    dialect,
    sqlitePath,
    entities,
    connections,
    operations,
  };
}

export function databaseConfigurationIssues(
  graph: Graph,
  environment?: 'development' | 'production',
): { blockId: string; message: string }[] {
  const issues: { blockId: string; message: string }[] = [];
  const env = environment ?? graph.httpEnvironment ?? 'development';

  for (const node of graph.nodes) {
    if (node.data.kind === 'postgresConnection') {
      const c = node.data.config;
      if (c.engine !== 'sqlite') {
        const host = env === 'production' ? c.productionHost || c.host : c.host;
        if (!host) {
          issues.push({
            blockId: node.id,
            message: `Conexão PostgreSQL "${node.data.label}": informe o host para o ambiente ${env}.`,
          });
        }
        const secret = env === 'production' ? c.productionSecretEnv || c.secretEnv : c.secretEnv;
        if (secret && !secret.startsWith('FLOWFORGE_SECRET_')) {
          issues.push({
            blockId: node.id,
            message: `Conexão PostgreSQL "${node.data.label}": o nome do segredo de senha deve iniciar com "FLOWFORGE_SECRET_".`,
          });
        }
      }
    }

    if (node.data.kind === 'database' && node.data.config.mode === 'real') {
      const conn = postgresConnectionFor(graph, node.id);
      if (!conn) {
        issues.push({
          blockId: node.id,
          message: `Operação de Banco "${node.data.label}": conecte a uma Conexão PostgreSQL ou selecione uma no painel.`,
        });
      }
      const table = node.data.config.table;
      if (!table || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        issues.push({
          blockId: node.id,
          message: `Operação de Banco "${node.data.label}": informe um nome de tabela válido (letras, números e sublinhado).`,
        });
      }
    }

    if (node.data.kind === 'entity') {
      const name = node.data.config.name;
      if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        issues.push({
          blockId: node.id,
          message: `Entidade "${node.data.label}": informe um nome de tabela válido.`,
        });
      }
    }
  }

  return issues;
}

export interface MigrationPlan {
  version: string;
  filename: string;
  name: string;
  sql: string;
}

/** Gera instrução DDL compatível com SQLite 3 para criar a tabela */
export function generateSqliteDDL(entity: EntityDefinition): string {
  const tableName = sanitizeIdentifier(entity.name);
  const columnDefs: string[] = [];
  const fields = [...entity.fields];

  if (entity.multiTenancy === 'column') {
    const tenantCol = sanitizeIdentifier(entity.tenantColumn || 'tenant_id');
    if (!fields.some((f) => f.name === tenantCol)) {
      fields.push({ name: tenantCol, type: 'string', required: true });
    }
  }

  for (const field of fields) {
    const colName = sanitizeIdentifier(field.name);
    let sqlType = 'TEXT';
    switch (field.type) {
      case 'number':
        sqlType = 'REAL';
        break;
      case 'boolean':
        sqlType = 'INTEGER';
        break;
      default:
        sqlType = 'TEXT';
    }

    const parts = [`"${colName}"`, sqlType];
    if (field.primaryKey) parts.push('PRIMARY KEY');
    else if (field.required) parts.push('NOT NULL');
    if (field.unique && !field.primaryKey) parts.push('UNIQUE');
    if (field.defaultValue !== undefined && field.defaultValue !== '') {
      parts.push(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`);
    }
    columnDefs.push(parts.join(' '));
  }

  if (columnDefs.length === 0) {
    columnDefs.push('"id" TEXT PRIMARY KEY', '"criado_em" TEXT DEFAULT CURRENT_TIMESTAMP');
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n);`;
}

/** Gera instrução DDL compatível com PostgreSQL para criar a tabela com suporte a schema e multi-tenancy */
export function generatePostgresDDL(
  entity: EntityDefinition,
  options?: { schema?: string; multiTenancy?: MultiTenancyMode; tenantColumn?: string },
): string {
  const schema = sanitizeIdentifier(options?.schema || entity.schema || 'public');
  const tableName = sanitizeIdentifier(entity.name);
  const fullTableName = schema === 'public' ? `"${tableName}"` : `"${schema}"."${tableName}"`;
  const tenancy = options?.multiTenancy || entity.multiTenancy || 'none';
  const tenantCol = sanitizeIdentifier(options?.tenantColumn || entity.tenantColumn || 'tenant_id');

  const columnDefs: string[] = [];
  const fields = [...entity.fields];

  if (tenancy === 'column' && !fields.some((f) => f.name === tenantCol)) {
    fields.push({ name: tenantCol, type: 'string', required: true });
  }

  for (const field of fields) {
    const colName = sanitizeIdentifier(field.name);
    let sqlType = 'TEXT';
    switch (field.type) {
      case 'number':
        sqlType = 'NUMERIC';
        break;
      case 'boolean':
        sqlType = 'BOOLEAN';
        break;
      case 'date':
        sqlType = 'TIMESTAMPTZ';
        break;
      case 'json':
        sqlType = 'JSONB';
        break;
      default:
        sqlType = 'TEXT';
    }

    const parts = [`"${colName}"`, sqlType];
    if (field.primaryKey) parts.push('PRIMARY KEY');
    else if (field.required) parts.push('NOT NULL');
    if (field.unique && !field.primaryKey) parts.push('UNIQUE');
    if (field.defaultValue !== undefined && field.defaultValue !== '') {
      parts.push(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`);
    }
    columnDefs.push(parts.join(' '));
  }

  if (columnDefs.length === 0) {
    columnDefs.push('"id" TEXT PRIMARY KEY', '"criado_em" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
  }

  const statements: string[] = [];
  if (schema !== 'public') {
    statements.push(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
  }
  statements.push(
    `CREATE TABLE IF NOT EXISTS ${fullTableName} (\n  ${columnDefs.join(',\n  ')}\n);`,
  );

  if (tenancy === 'column') {
    statements.push(
      `CREATE INDEX IF NOT EXISTS "idx_${tableName}_${tenantCol}" ON ${fullTableName} ("${tenantCol}");`,
    );
  }

  return statements.join('\n\n');
}

/** Gera o conjunto sequencial de migrações SQL versionadas do FlowForge */
export function buildDatabaseMigrations(manifest: DatabaseManifest): MigrationPlan[] {
  const migrations: MigrationPlan[] = [];
  const isSqlite = manifest.dialect === 'sqlite';

  // Migração 001: Tabela de controle de versão de migrações do FlowForge
  migrations.push({
    version: '001',
    filename: '001_initial_migration_tracker.sql',
    name: 'initial_migration_tracker',
    sql: `-- Controle de versão de migrações automáticas do FlowForge
CREATE TABLE IF NOT EXISTS _flowforge_migrations (
  version VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at ${isSqlite ? 'TEXT' : 'TIMESTAMPTZ'} NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
  });

  // Migração 002: Criação de esquemas e entidades com DDLs
  const entityStatements: string[] = [];
  for (const entity of manifest.entities) {
    entityStatements.push(isSqlite ? generateSqliteDDL(entity) : generatePostgresDDL(entity));
  }
  if (entityStatements.length > 0) {
    migrations.push({
      version: '002',
      filename: '002_create_entities.sql',
      name: 'create_entities',
      sql: `-- Criação de esquemas e entidades de domínio\n\n${entityStatements.join('\n\n')}`,
    });
  }

  // Migração 003: Índices adicionais e integridade
  const indexStatements: string[] = [];
  for (const entity of manifest.entities) {
    const schema = sanitizeIdentifier(entity.schema || 'public');
    const table = sanitizeIdentifier(entity.name);
    const target = schema === 'public' ? `"${table}"` : `"${schema}"."${table}"`;
    if (entity.multiTenancy === 'column') {
      const col = sanitizeIdentifier(entity.tenantColumn || 'tenant_id');
      indexStatements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${table}_${col}" ON ${target} ("${col}");`,
      );
    }
  }

  if (indexStatements.length > 0) {
    migrations.push({
      version: '003',
      filename: '003_multitenancy_and_indexes.sql',
      name: 'multitenancy_and_indexes',
      sql: `-- Índices de isolamento por tenant e performance\n\n${indexStatements.join('\n')}`,
    });
  }

  return migrations;
}

export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identificador SQL inválido: "${name}".`);
  }
  return name;
}
