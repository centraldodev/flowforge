import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDataModelToGraph,
  convertConceptualToLogical,
  ensureDataModelFromGraph,
  generateDataModelSQL,
  type DataModelDesign,
} from '../src/engine/dataModeling';
import { createTypeScriptPlan } from '../src/export/typescript';
import { customerOrdersProject } from '../src/engine/referenceProjects';

test('Modelagem de Dados: converte Modelo Conceitual (1:N e N:N) em Modelo Lógico com FKs e Tabela Associativa', () => {
  const model: DataModelDesign = {
    dialect: 'postgres',
    entities: [
      {
        id: 'ent_clientes',
        name: 'clientes',
        label: 'Clientes',
        x: 100,
        y: 100,
        attributes: [
          { id: 'a1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'a2', name: 'nome', type: 'string', isRequired: true },
        ],
      },
      {
        id: 'ent_pedidos',
        name: 'pedidos',
        label: 'Pedidos',
        x: 450,
        y: 100,
        attributes: [
          { id: 'b1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'b2', name: 'valor_total', type: 'number', isRequired: true },
        ],
      },
      {
        id: 'ent_produtos',
        name: 'produtos',
        label: 'Produtos',
        x: 800,
        y: 100,
        attributes: [
          { id: 'c1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'c2', name: 'titulo', type: 'string', isRequired: true },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_1n',
        name: 'realiza',
        x: 270,
        y: 100,
        sourceEntityId: 'ent_clientes',
        targetEntityId: 'ent_pedidos',
        sourceCardinality: '1,1',
        targetCardinality: '0,N',
      },
      {
        id: 'rel_nn',
        name: 'itens',
        x: 620,
        y: 100,
        sourceEntityId: 'ent_pedidos',
        targetEntityId: 'ent_produtos',
        sourceCardinality: '1,N',
        targetCardinality: '0,N',
      },
    ],
  };

  const logical = convertConceptualToLogical(model);
  // 3 tabelas base + 1 tabela associativa gerada pelo relacionamento N:N
  assert.equal(logical.length, 4);

  const pedidosTable = logical.find((t) => t.name === 'pedidos')!;
  const fkCliente = pedidosTable.columns.find((c) => c.name === 'clientes_id');
  assert.ok(fkCliente, 'Tabela pedidos deve receber a FK clientes_id do relacionamento 1:N');
  assert.equal(fkCliente.foreignKey?.referencesTable, 'clientes');

  const assocTable = logical.find((t) => t.isAssociative)!;
  assert.ok(assocTable, 'Relacionamento N:N deve gerar tabela associativa');
  assert.ok(assocTable.columns.some((c) => c.name === 'pedidos_id' && c.foreignKey));
  assert.ok(assocTable.columns.some((c) => c.name === 'produtos_id' && c.foreignKey));
});

test('Modelagem de Dados: gera scripts SQL DDL distintos e válidos para PostgreSQL e SQLite', () => {
  const model = ensureDataModelFromGraph(customerOrdersProject);

  const pgSql = generateDataModelSQL(model, 'postgres');
  assert.ok(pgSql.includes('Banco de Dados: PostgreSQL'));
  assert.ok(pgSql.includes('CREATE TABLE IF NOT EXISTS "clientes"'));
  assert.ok(pgSql.includes('REFERENCES "clientes"("id")'));

  const sqliteSql = generateDataModelSQL(model, 'sqlite');
  assert.ok(sqliteSql.includes('Banco de Dados: SQLite 3'));
  assert.ok(sqliteSql.includes('PRAGMA foreign_keys = ON;'));
  assert.ok(sqliteSql.includes('FOREIGN KEY ("clientes_id") REFERENCES "clientes"("id")'));
});

test('Modelagem de Dados: sincroniza com o Backend, cria blocos CRUD e exporta nos dois motores (Postgres e SQLite)', () => {
  const baseModel = ensureDataModelFromGraph(customerOrdersProject);
  const sqliteModel: DataModelDesign = {
    ...baseModel,
    dialect: 'sqlite',
    sqliteFilePath: './data/test_app.sqlite',
  };

  const updatedGraph = applyDataModelToGraph(customerOrdersProject, sqliteModel, {
    generateCrudBlocksForTable: 'clientes',
  });

  // Verifica que o nó de conexão foi atualizado para SQLite e blocos CRUD foram gerados
  const connNode = updatedGraph.nodes.find((n) => n.data.kind === 'postgresConnection')!;
  assert.equal(connNode.data.config.engine, 'sqlite');
  assert.ok(updatedGraph.nodes.some((n) => n.id === 'db_query_clientes'));
  assert.ok(updatedGraph.nodes.some((n) => n.id === 'db_insert_clientes'));

  // Verifica que a exportação do monorepo inclui os schemas SQLite e Postgres e o gateway suporta node:sqlite
  const plan = createTypeScriptPlan(updatedGraph);
  assert.ok(plan.files.has('apps/api/src/database/schema/schema.postgres.sql'));
  assert.ok(plan.files.has('apps/api/src/database/schema/schema.sqlite.sql'));
  const gatewayCode = plan.files.get('apps/api/src/database/gateway.mjs')!.content;
  assert.ok(gatewayCode.includes('node:sqlite'));
});
