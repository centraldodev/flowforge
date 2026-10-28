import type { Block, Graph } from './types';
import {
  sanitizeIdentifier,
  type EntityDefinition,
  type EntityField,
  type FieldType,
} from './database';

export type DatabaseDialect = 'postgres' | 'sqlite';

export type Cardinality = '0,1' | '1,1' | '0,N' | '1,N';

export type ConceptualAttribute = {
  id: string;
  name: string;
  type: FieldType;
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
};

export type ConceptualEntity = {
  id: string;
  name: string;
  label: string;
  x: number;
  y: number;
  attributes: ConceptualAttribute[];
};

export type ConceptualRelationship = {
  id: string;
  name: string;
  x: number;
  y: number;
  sourceEntityId: string;
  targetEntityId: string;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  attributes?: ConceptualAttribute[];
};

export type LogicalColumn = {
  name: string;
  type: FieldType;
  sqlType: string;
  primaryKey?: boolean;
  foreignKey?: {
    referencesTable: string;
    referencesColumn: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
};

export type LogicalTable = {
  id: string;
  name: string;
  label: string;
  x: number;
  y: number;
  isAssociative?: boolean;
  columns: LogicalColumn[];
};

export type DataModelDesign = {
  dialect: DatabaseDialect;
  sqliteFilePath?: string;
  entities: ConceptualEntity[];
  relationships: ConceptualRelationship[];
  logicalTables?: LogicalTable[];
  seededData?: Record<string, Record<string, unknown>[]>;
};

export function toSqlTableName(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return 'tabela';
  return /^[a-z_]/.test(cleaned) ? cleaned : `t_${cleaned}`;
}

export function mapFieldTypeToSql(type: FieldType, dialect: DatabaseDialect): string {
  if (dialect === 'sqlite') {
    switch (type) {
      case 'number':
        return 'REAL';
      case 'boolean':
        return 'INTEGER';
      case 'date':
        return 'TEXT';
      case 'json':
        return 'TEXT';
      default:
        return 'TEXT';
    }
  }
  switch (type) {
    case 'number':
      return 'NUMERIC';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'TIMESTAMPTZ';
    case 'json':
      return 'JSONB';
    default:
      return 'VARCHAR(255)';
  }
}

export function isManyCardinality(card: Cardinality): boolean {
  return card === '0,N' || card === '1,N';
}

export function isMandatoryCardinality(card: Cardinality): boolean {
  return card === '1,1' || card === '1,N';
}

/**
 * Converte automaticamente o Modelo Conceitual ( estilo brModelo ) em Modelo Lógico Relacional:
 * - Entidades viram Tabelas Relacionais com PK garantida.
 * - Relacionamentos 1:N propagam a PK do lado 1 como FK no lado N.
 * - Relacionamentos 1:1 propagam a PK como FK UNIQUE.
 * - Relacionamentos N:N geram automaticamente uma Tabela Associativa com chave composta/FKs.
 */
export function convertConceptualToLogical(model: DataModelDesign): LogicalTable[] {
  const dialect = model.dialect || 'postgres';
  const tablesMap = new Map<string, LogicalTable>();

  for (const entity of model.entities) {
    const tableName = toSqlTableName(entity.name || entity.label);
    const cols: LogicalColumn[] = [];
    const hasPk = entity.attributes.some((a) => a.isPrimaryKey);

    if (!hasPk) {
      cols.push({
        name: 'id',
        type: 'string',
        sqlType: dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(64)',
        primaryKey: true,
        required: true,
      });
    }

    for (const attr of entity.attributes) {
      const colName = toSqlTableName(attr.name);
      if (cols.some((c) => c.name === colName)) continue;
      cols.push({
        name: colName,
        type: attr.type,
        sqlType: mapFieldTypeToSql(attr.type, dialect),
        primaryKey: Boolean(attr.isPrimaryKey),
        required: Boolean(attr.isPrimaryKey || attr.isRequired),
        unique: Boolean(attr.isUnique),
        defaultValue: attr.defaultValue,
      });
    }

    tablesMap.set(entity.id, {
      id: entity.id,
      name: tableName,
      label: entity.label || entity.name,
      x: entity.x,
      y: entity.y,
      columns: cols,
    });
  }

  const associativeTables: LogicalTable[] = [];

  for (const rel of model.relationships) {
    const sourceTable = tablesMap.get(rel.sourceEntityId);
    const targetTable = tablesMap.get(rel.targetEntityId);
    if (!sourceTable || !targetTable) continue;

    const sourcePk = sourceTable.columns.find((c) => c.primaryKey) || sourceTable.columns[0];
    const targetPk = targetTable.columns.find((c) => c.primaryKey) || targetTable.columns[0];
    const sourceIsMany = isManyCardinality(rel.sourceCardinality);
    const targetIsMany = isManyCardinality(rel.targetCardinality);

    if (sourceIsMany && targetIsMany) {
      // N:N -> Cria tabela associativa
      const assocName = toSqlTableName(
        rel.name && rel.name.toLowerCase() !== 'possui' && rel.name.toLowerCase() !== 'relaciona'
          ? `${sourceTable.name}_${rel.name}_${targetTable.name}`
          : `${sourceTable.name}_${targetTable.name}`,
      );
      const fkSourceCol = `${sourceTable.name}_${sourcePk.name}`;
      const fkTargetCol = `${targetTable.name}_${targetPk.name}`;

      const assocColumns: LogicalColumn[] = [
        {
          name: 'id',
          type: 'string',
          sqlType: dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(64)',
          primaryKey: true,
          required: true,
        },
        {
          name: fkSourceCol,
          type: sourcePk.type,
          sqlType: sourcePk.sqlType,
          required: true,
          foreignKey: {
            referencesTable: sourceTable.name,
            referencesColumn: sourcePk.name,
            onDelete: 'CASCADE',
          },
        },
        {
          name: fkTargetCol,
          type: targetPk.type,
          sqlType: targetPk.sqlType,
          required: true,
          foreignKey: {
            referencesTable: targetTable.name,
            referencesColumn: targetPk.name,
            onDelete: 'CASCADE',
          },
        },
      ];

      for (const attr of rel.attributes || []) {
        const colName = toSqlTableName(attr.name);
        if (!assocColumns.some((c) => c.name === colName)) {
          assocColumns.push({
            name: colName,
            type: attr.type,
            sqlType: mapFieldTypeToSql(attr.type, dialect),
            required: Boolean(attr.isRequired),
          });
        }
      }

      associativeTables.push({
        id: `assoc_${rel.id}`,
        name: assocName,
        label: `${sourceTable.label} × ${targetTable.label}`,
        x: rel.x,
        y: rel.y,
        isAssociative: true,
        columns: assocColumns,
      });
    } else if (!sourceIsMany && targetIsMany) {
      // 1:N (source é 1, target é N) -> FK vai para targetTable
      const fkName = `${sourceTable.name}_${sourcePk.name}`;
      if (!targetTable.columns.some((c) => c.name === fkName)) {
        targetTable.columns.push({
          name: fkName,
          type: sourcePk.type,
          sqlType: sourcePk.sqlType,
          required: isMandatoryCardinality(rel.sourceCardinality),
          foreignKey: {
            referencesTable: sourceTable.name,
            referencesColumn: sourcePk.name,
            onDelete: 'CASCADE',
          },
        });
      }
    } else if (sourceIsMany && !targetIsMany) {
      // N:1 (source é N, target é 1) -> FK vai para sourceTable
      const fkName = `${targetTable.name}_${targetPk.name}`;
      if (!sourceTable.columns.some((c) => c.name === fkName)) {
        sourceTable.columns.push({
          name: fkName,
          type: targetPk.type,
          sqlType: targetPk.sqlType,
          required: isMandatoryCardinality(rel.targetCardinality),
          foreignKey: {
            referencesTable: targetTable.name,
            referencesColumn: targetPk.name,
            onDelete: 'CASCADE',
          },
        });
      }
    } else {
      // 1:1 -> FK única vai para targetTable
      const fkName = `${sourceTable.name}_${sourcePk.name}`;
      if (!targetTable.columns.some((c) => c.name === fkName)) {
        targetTable.columns.push({
          name: fkName,
          type: sourcePk.type,
          sqlType: sourcePk.sqlType,
          required: isMandatoryCardinality(rel.sourceCardinality),
          unique: true,
          foreignKey: {
            referencesTable: sourceTable.name,
            referencesColumn: sourcePk.name,
            onDelete: 'CASCADE',
          },
        });
      }
    }
  }

  return [...tablesMap.values(), ...associativeTables];
}

/**
 * Gera o script DDL SQL completo para PostgreSQL ou SQLite a partir do Modelo Lógico.
 */
export function generateDataModelSQL(
  model: DataModelDesign,
  dialectOverride?: DatabaseDialect,
): string {
  const dialect = dialectOverride || model.dialect || 'postgres';
  const tables = convertConceptualToLogical({ ...model, dialect });

  if (tables.length === 0) {
    return `-- Nenhuma entidade definida na modelagem de dados (${dialect.toUpperCase()}).`;
  }

  const lines: string[] = [
    `-- ============================================================================`,
    `-- Script SQL Gerado pelo FlowForge Data Modeler (brModelo Conceitual -> Lógico)`,
    `-- Banco de Dados: ${dialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL'}`,
    `-- Total de Tabelas: ${tables.length}`,
    `-- ============================================================================`,
    '',
  ];

  if (dialect === 'sqlite') {
    lines.push('PRAGMA foreign_keys = ON;', '');
  }

  for (const table of tables) {
    const safeTable = sanitizeIdentifier(table.name);
    const colLines: string[] = [];
    const fkConstraints: string[] = [];

    for (const col of table.columns) {
      const safeCol = sanitizeIdentifier(col.name);
      const parts: string[] = [`"${safeCol}"`, col.sqlType];

      if (col.primaryKey) {
        parts.push('PRIMARY KEY');
      } else {
        if (col.required) parts.push('NOT NULL');
        if (col.unique) parts.push('UNIQUE');
      }

      if (col.defaultValue !== undefined && col.defaultValue !== '') {
        if (col.type === 'number' && !Number.isNaN(Number(col.defaultValue))) {
          parts.push(`DEFAULT ${Number(col.defaultValue)}`);
        } else if (col.type === 'boolean') {
          const isTrue = col.defaultValue === 'true' || col.defaultValue === '1';
          parts.push(
            `DEFAULT ${dialect === 'sqlite' ? (isTrue ? 1 : 0) : isTrue ? 'TRUE' : 'FALSE'}`,
          );
        } else {
          parts.push(`DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`);
        }
      }

      if (col.foreignKey) {
        const refTable = sanitizeIdentifier(col.foreignKey.referencesTable);
        const refCol = sanitizeIdentifier(col.foreignKey.referencesColumn);
        const onDelete = col.foreignKey.onDelete || 'CASCADE';
        if (dialect === 'postgres') {
          parts.push(`REFERENCES "${refTable}"("${refCol}") ON DELETE ${onDelete}`);
        } else {
          fkConstraints.push(
            `FOREIGN KEY ("${safeCol}") REFERENCES "${refTable}"("${refCol}") ON DELETE ${onDelete}`,
          );
        }
      }

      colLines.push(`  ${parts.join(' ')}`);
    }

    for (const fk of fkConstraints) {
      colLines.push(`  ${fk}`);
    }

    lines.push(`-- Tabela: ${table.label} (${safeTable})`);
    lines.push(`CREATE TABLE IF NOT EXISTS "${safeTable}" (`);
    lines.push(colLines.join(',\n'));
    lines.push(`);`);

    // Índices automáticos para chaves estrangeiras
    for (const col of table.columns) {
      if (col.foreignKey) {
        const safeCol = sanitizeIdentifier(col.name);
        lines.push(
          `CREATE INDEX IF NOT EXISTS "idx_${safeTable}_${safeCol}" ON "${safeTable}" ("${safeCol}");`,
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Inicializa uma modelagem conceitual a partir dos blocos `entity` já existentes no grafo
 * caso `graph.dataModel` ainda não tenha sido criado.
 */
export function ensureDataModelFromGraph(graph: Graph): DataModelDesign {
  if (graph.dataModel && graph.dataModel.entities.length > 0) {
    return graph.dataModel;
  }

  const entityNodes = graph.nodes.filter((n) => n.data.kind === 'entity');
  const connNode = graph.nodes.find((n) => n.data.kind === 'postgresConnection');
  const dialect: DatabaseDialect =
    (connNode?.data.config.engine as DatabaseDialect) || graph.dataModel?.dialect || 'postgres';

  if (entityNodes.length === 0) {
    return (
      graph.dataModel || {
        dialect,
        sqliteFilePath: './data/flowforge.sqlite',
        entities: [],
        relationships: [],
      }
    );
  }

  const entities: ConceptualEntity[] = entityNodes.map((node, idx) => {
    const rawName = node.data.config.name || toSqlTableName(node.data.label);
    let parsedFields: EntityField[] = [];
    try {
      parsedFields = JSON.parse(node.data.config.fields || '[]');
    } catch {
      parsedFields = [];
    }
    if (!Array.isArray(parsedFields) || parsedFields.length === 0) {
      parsedFields = [
        { name: 'id', type: 'string', primaryKey: true, required: true },
        { name: 'titulo', type: 'string', required: true },
        { name: 'detalhe', type: 'string', required: false },
      ];
    }

    return {
      id: node.id,
      name: rawName,
      label: node.data.label || rawName,
      x: 120 + (idx % 3) * 380,
      y: 120 + Math.floor(idx / 3) * 260,
      attributes: parsedFields.map((f, fIdx) => ({
        id: `${node.id}_attr_${fIdx}`,
        name: f.name,
        type: f.type || 'string',
        isPrimaryKey: Boolean(f.primaryKey || f.name === 'id'),
        isRequired: Boolean(f.required || f.primaryKey),
        isUnique: Boolean(f.unique),
        defaultValue: f.defaultValue,
      })),
    };
  });

  // Detecta relacionamentos implícitos por colunas *_id
  const relationships: ConceptualRelationship[] = [];
  for (const ent of entities) {
    for (const attr of ent.attributes) {
      if (attr.name.endsWith('_id') && !attr.isPrimaryKey) {
        const prefix = attr.name.slice(0, -3);
        const target = entities.find(
          (other) =>
            other.id !== ent.id &&
            (other.name === prefix || other.name === `${prefix}s` || other.name === `${prefix}es`),
        );
        if (target) {
          relationships.push({
            id: `rel_${target.id}_${ent.id}`,
            name: 'possui',
            x: Math.round((target.x + ent.x) / 2),
            y: Math.round((target.y + ent.y) / 2),
            sourceEntityId: target.id,
            targetEntityId: ent.id,
            sourceCardinality: '1,1',
            targetCardinality: '0,N',
          });
        }
      }
    }
  }

  return {
    dialect,
    sqliteFilePath: graph.dataModel?.sqliteFilePath || './data/flowforge.sqlite',
    entities,
    relationships,
    seededData: graph.dataModel?.seededData || {},
  };
}

/**
 * Aplica a Modelagem de Dados de volta ao Grafo do Projeto:
 * - Cria ou atualiza o nó `postgresConnection` com o motor escolhido (`postgres` ou `sqlite`).
 * - Cria ou atualiza os nós `entity` para cada tabela lógica gerada (incluindo associativas N:N).
 * - Atualiza `graph.entities` e `graph.dataModel`.
 * - Opcionalmente gera blocos CRUD (`database`) conectados para novas tabelas.
 */
export function applyDataModelToGraph(
  graph: Graph,
  dataModel: DataModelDesign,
  options?: { generateCrudBlocksForTable?: string },
): Graph {
  const logicalTables = convertConceptualToLogical(dataModel);
  const updatedModel: DataModelDesign = {
    ...dataModel,
    logicalTables,
  };

  let nodes = [...graph.nodes];
  let edges = [...graph.edges];

  // 1. Garante nó de conexão de banco configurada com o dialeto (postgres ou sqlite)
  let connNode = nodes.find((n) => n.data.kind === 'postgresConnection');
  if (!connNode) {
    connNode = {
      id: 'conexao_banco',
      type: 'block',
      position: { x: 60, y: 80 },
      data: {
        kind: 'postgresConnection',
        label: dataModel.dialect === 'sqlite' ? 'Conexão SQLite Local' : 'Conexão PostgreSQL',
        config: {
          engine: dataModel.dialect,
          sqlitePath: dataModel.sqliteFilePath || './data/flowforge.sqlite',
          host: 'localhost',
          port: '5432',
          database: 'flowforge_app',
          schema: 'public',
          user: 'postgres',
          secretEnv: 'FLOWFORGE_SECRET_DB_PASSWORD',
          ssl: 'disable',
          timeoutMs: '5000',
          logicTemplateId: 'pg_conn_pool',
        },
      },
    };
    nodes.push(connNode);
  } else {
    nodes = nodes.map((n) =>
      n.id === connNode!.id
        ? {
            ...n,
            data: {
              ...n.data,
              label:
                dataModel.dialect === 'sqlite'
                  ? 'Conexão SQLite / Banco'
                  : n.data.label || 'Conexão PostgreSQL',
              config: {
                ...n.data.config,
                engine: dataModel.dialect,
                sqlitePath: dataModel.sqliteFilePath || './data/flowforge.sqlite',
              },
            },
          }
        : n,
    );
  }

  // 2. Sincroniza nós `entity` no grafo com as tabelas do modelo lógico
  const entityDefinitions: EntityDefinition[] = [];

  for (let i = 0; i < logicalTables.length; i++) {
    const tbl = logicalTables[i];
    const fields: EntityField[] = tbl.columns.map((c) => ({
      name: c.name,
      type: c.type,
      primaryKey: Boolean(c.primaryKey),
      required: Boolean(c.required),
      unique: Boolean(c.unique),
      defaultValue: c.defaultValue,
    }));

    entityDefinitions.push({
      id: tbl.id,
      name: tbl.name,
      schema: 'public',
      fields,
    });

    const existingEntityNode = nodes.find(
      (n) => n.data.kind === 'entity' && (n.id === tbl.id || n.data.config.name === tbl.name),
    );

    if (existingEntityNode) {
      nodes = nodes.map((n) =>
        n.id === existingEntityNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: `Entidade ${tbl.label}`,
                config: {
                  ...n.data.config,
                  name: tbl.name,
                  fields: JSON.stringify(fields),
                },
              },
            }
          : n,
      );
    } else {
      const newEntityNode: Block = {
        id: tbl.id.startsWith('ent_') || tbl.id.startsWith('assoc_') ? tbl.id : `ent_${tbl.name}`,
        type: 'block',
        position: { x: 60, y: 220 + i * 140 },
        data: {
          kind: 'entity',
          label: `Entidade ${tbl.label}`,
          config: {
            name: tbl.name,
            schema: 'public',
            multiTenancy: 'none',
            fields: JSON.stringify(fields),
          },
        },
      };
      nodes.push(newEntityNode);
    }
  }

  // 3. Se solicitado, cria blocos de operação de banco (CRUD) para a tabela escolhida
  if (options?.generateCrudBlocksForTable) {
    const targetTable = sanitizeIdentifier(options.generateCrudBlocksForTable);
    const screenNode = nodes.find((n) => n.data.kind === 'screen');
    const screenId = screenNode?.id || '';
    const ops: Array<{ op: 'query' | 'insert' | 'update' | 'delete'; label: string }> = [
      { op: 'query', label: `Listar ${targetTable}` },
      { op: 'insert', label: `Inserir em ${targetTable}` },
      { op: 'update', label: `Atualizar ${targetTable}` },
      { op: 'delete', label: `Excluir de ${targetTable}` },
    ];

    ops.forEach((item, idx) => {
      const blockId = `db_${item.op}_${targetTable}`;
      if (!nodes.some((n) => n.id === blockId)) {
        nodes.push({
          id: blockId,
          type: 'block',
          position: { x: 420 + idx * 280, y: 420 },
          data: {
            kind: 'database',
            label: item.label,
            config: {
              ...(screenId ? { screenId } : {}),
              mode: 'real',
              operation: item.op,
              table: targetTable,
              limit: '100',
              connectionId: connNode!.id,
              logicTemplateId: item.op === 'insert' ? 'db_insert_record' : 'db_query_records',
            },
          },
        });
        edges.push({
          id: `wire_conn_${blockId}`,
          source: connNode!.id,
          sourceHandle: 'connection',
          target: blockId,
          targetHandle: 'connection',
        });
      }
    });
  }

  return {
    ...graph,
    nodes,
    edges,
    entities: entityDefinitions,
    dataModel: updatedModel,
  };
}
