import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePostgresDDL,
  buildDatabaseMigrations,
  type EntityDefinition,
  type DatabaseManifest,
  customerOrdersProject,
} from '../src/engine';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 11: generatePostgresDDL com suporte a múltiplos esquemas e multi-tenancy', () => {
  // 1. Schema público padrão
  const entityPublic: EntityDefinition = {
    id: 'ent_users',
    name: 'usuarios',
    schema: 'public',
    fields: [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'nome', type: 'string', required: true },
    ],
  };
  const ddlPublic = generatePostgresDDL(entityPublic);
  assert.ok(ddlPublic.includes('CREATE TABLE IF NOT EXISTS "usuarios"'));
  assert.ok(!ddlPublic.includes('CREATE SCHEMA'));

  // 2. Schema customizado
  const entityCustom: EntityDefinition = {
    id: 'ent_tenants',
    name: 'pedidos',
    schema: 'tenant_acme',
    fields: [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'total', type: 'number', required: true },
    ],
  };
  const ddlCustom = generatePostgresDDL(entityCustom);
  assert.ok(ddlCustom.includes('CREATE SCHEMA IF NOT EXISTS "tenant_acme";'));
  assert.ok(ddlCustom.includes('CREATE TABLE IF NOT EXISTS "tenant_acme"."pedidos"'));

  // 3. Multi-Tenancy por Coluna
  const entityTenantCol: EntityDefinition = {
    id: 'ent_docs',
    name: 'documentos',
    schema: 'public',
    multiTenancy: 'column',
    tenantColumn: 'empresa_id',
    fields: [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'titulo', type: 'string', required: true },
    ],
  };
  const ddlTenant = generatePostgresDDL(entityTenantCol);
  assert.ok(ddlTenant.includes('"empresa_id" TEXT NOT NULL'));
  assert.ok(
    ddlTenant.includes(
      'CREATE INDEX IF NOT EXISTS "idx_documentos_empresa_id" ON "documentos" ("empresa_id");',
    ),
  );
});

test('Fase 11: buildDatabaseMigrations gera histórico sequencial e rastreador', () => {
  const manifest: DatabaseManifest = {
    environment: 'development',
    entities: [
      {
        id: 'ent_prod',
        name: 'produtos',
        schema: 'public',
        multiTenancy: 'column',
        tenantColumn: 'tenant_id',
        fields: [
          { name: 'id', type: 'string', primaryKey: true },
          { name: 'nome', type: 'string', required: true },
        ],
      },
    ],
    connections: [],
    operations: [],
  };

  const migrations = buildDatabaseMigrations(manifest);
  assert.equal(migrations.length, 3);

  // 001 - Tabela de migrações
  assert.equal(migrations[0].version, '001');
  assert.ok(migrations[0].sql.includes('_flowforge_migrations'));

  // 002 - Criação das entidades
  assert.equal(migrations[1].version, '002');
  assert.ok(migrations[1].sql.includes('CREATE TABLE IF NOT EXISTS "produtos"'));

  // 003 - Índices de multi-tenancy
  assert.equal(migrations[2].version, '003');
  assert.ok(migrations[2].sql.includes('idx_produtos_tenant_id'));
});

test('Fase 11: Exportação Modular emite Contratos de Banco, Migrator e Migrações Versionadas', () => {
  const plan = createTypeScriptPlan(customerOrdersProject);

  // 1. Contrato TypeScript central de banco
  const dbContract = plan.files.get('packages/contracts/src/database.ts');
  assert.ok(dbContract, 'packages/contracts/src/database.ts deve existir');
  assert.ok(dbContract.content.includes('export type MultiTenancyMode'));
  assert.ok(dbContract.content.includes('export interface MigrationRecord'));
  assert.ok(dbContract.content.includes('export interface TenantContext'));

  // 2. Módulo Migrator
  const migrator = plan.files.get('apps/api/src/database/migrator.mjs');
  assert.ok(migrator, 'migrator.mjs deve existir no backend');
  assert.ok(migrator.content.includes('export async function runMigrations'));
  assert.ok(migrator.content.includes('_flowforge_migrations'));

  // 3. Arquivos de migração versionados
  assert.ok(
    plan.files.has('apps/api/src/database/migrations/001_initial_migration_tracker.sql'),
    'Migração 001 deve ser emitida',
  );
  assert.ok(
    plan.files.has('apps/api/src/database/migrations/002_create_entities.sql'),
    'Migração 002 deve ser emitida',
  );

  // 4. Gateway de banco com suporte a x-tenant-id
  const gateway = plan.files.get('apps/api/src/database/gateway.mjs');
  assert.ok(gateway);
  assert.ok(gateway.content.includes('user?.orgId'));
  assert.ok(gateway.content.includes('UNAUTHORIZED_TENANT'));
});
