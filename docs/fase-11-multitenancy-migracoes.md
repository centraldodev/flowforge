# Fase 11: Múltiplos Esquemas, Multi-Tenancy e Migrações SQL Versionadas

## Objetivo

Fornecer suporte nativo e visual para arquiteturas **Multi-Tenant**, múltiplos esquemas PostgreSQL (`schemas`) e controle formal de versão de banco de dados por migrações incrementais numeradas (`_flowforge_migrations`).

---

## 1. Modos de Multi-Tenancy

O FlowForge suporta três modalidades de isolamento de dados:

| Modo | Descrição | Implementação SQL / Runtime |
|---|---|---|
| `none` | **Mono-Tenant**: Tabelas compartilhadas sem partição lógica de tenant. | Tabelas no schema configurado sem restrição de tenant. |
| `column` | **Isolamento por Coluna (`tenant_id`)**: Todas as linhas possuem uma coluna identificadora de tenant com índice automático. | Coluna `tenant_id TEXT NOT NULL` gerada no DDL + `CREATE INDEX idx_<table>_tenant_id`. O Gateway injeta filtros automáticos e valida acesso via `x-tenant-id`. |
| `schema` | **Isolamento por Esquema PostgreSQL**: Cada tenant possui seu próprio schema isolado (`CREATE SCHEMA IF NOT EXISTS "tenant_..."`). | Resolução dinâmica do `search_path` ou qualificação completa de tabelas (`"schema"."tabela"`). |

---

## 2. Versionamento de Migrações SQL

Para garantir integridade do banco de dados ao longo do ciclo de vida da aplicação em desenvolvimento e produção, a exportação modular gera migrações sequenciais em `apps/api/src/database/migrations/`:

1. **`001_initial_migration_tracker.sql`**:
   - Cria a tabela de controle de auditoria de migrações:
   ```sql
   CREATE TABLE IF NOT EXISTS _flowforge_migrations (
     version VARCHAR(255) PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **`002_create_entities.sql`**:
   - Instruções DDL para todos os esquemas e tabelas de domínio definidos no FlowForge.

3. **`003_multitenancy_and_indexes.sql`**:
   - Criação de índices para isolamento de tenants (`idx_<table>_<tenant_column>`) e chaves estrangeiras.

4. **`001_init.sql`**:
   - Script consolidado mantido para compatibilidade com ferramentas de bootstrapping direto.

---

## 3. Módulo Migrator (`apps/api/src/database/migrator.mjs`)

Módulo transacional (`BEGIN ... COMMIT / ROLLBACK`) responsável por:
- Conectar ao pool PostgreSQL.
- Verificar quais versões já foram aplicadas na tabela `_flowforge_migrations`.
- Ler os arquivos SQL em ordem lexicográfica e aplicar de forma atômica apenas as migrações pendentes.
- Registrar a versão e timestamp da migração executada.

---

## 4. Gateway de Banco com Isolamento de Tenants (`apps/api/src/database/gateway.mjs`)

- **Extração de Tenant**: Lê o identificador do tenant a partir do cabeçalho HTTP `x-tenant-id` ou do corpo da requisição (`body.tenantId` / `body.context.tenantId`).
- **Validação Estrita**: Caso a entidade exija isolamento por coluna (`multiTenancy === 'column'`) e o cabeçalho não seja fornecido, a operação é rejeitada com status `400 TENANT_REQUIRED`.
- **Prevenção de Acesso Cruzado**: Operações de leitura (`get`), alteração (`update`) e exclusão (`delete`) validam se o registro pertence ao tenant solicitante. Tentativas de acesso não autorizado retornam status `403 TENANT_FORBIDDEN`.

---

## 5. Contratos Compartilhados (`packages/contracts/src/database.ts`)

Exporta tipos TypeScript para frontend e backend:
- `MultiTenancyMode`: `'none' | 'column' | 'schema'`
- `MigrationRecord`: `{ version, name, applied_at }`
- `TenantContext`: `{ tenantId, schema? }`
- `DatabaseQueryOptions`: `{ filter, tenantId, limit, offset, orderBy, orderDirection }`
