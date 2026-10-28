import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Database,
  Diamond,
  FileCode2,
  Key,
  Layers,
  Link2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { FieldType, Graph } from '../../engine';
import {
  applyDataModelToGraph,
  convertConceptualToLogical,
  ensureDataModelFromGraph,
  generateDataModelSQL,
  toSqlTableName,
  type Cardinality,
  type ConceptualAttribute,
  type ConceptualEntity,
  type ConceptualRelationship,
  type DatabaseDialect,
  type DataModelDesign,
} from '../../engine/dataModeling';
import type { Simulation } from '../../state/useSimulation';

type Props = {
  graph: Graph;
  commit: (update: (graph: Graph) => Graph) => void;
  notify: (msg: string) => void;
  simulation: Simulation;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type SubMode = 'conceptual' | 'logical' | 'sql' | 'explorer';

const CARDINALITIES: Cardinality[] = ['1,1', '0,1', '1,N', '0,N'];
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'Texto (String)' },
  { value: 'number', label: 'Número (Numeric)' },
  { value: 'boolean', label: 'Booleano (True/False)' },
  { value: 'date', label: 'Data / Hora' },
  { value: 'json', label: 'JSON / Objeto' },
];

export function DataModelEditor({
  graph,
  commit,
  notify,
  simulation,
  undo,
  redo,
  canUndo,
  canRedo,
}: Props) {
  const [subMode, setSubMode] = useState<SubMode>('conceptual');
  const [model, setModel] = useState<DataModelDesign>(() => ensureDataModelFromGraph(graph));
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Dragging no canvas conceitual
  const [dragging, setDragging] = useState<{
    kind: 'entity' | 'rel';
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Estado do Explorador de Dados ao Vivo
  const [activeTable, setActiveTable] = useState<string>('');
  const [newRowDraft, setNewRowDraft] = useState<Record<string, string>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Sincroniza quando o projeto muda externamente (ex: novo projeto / undo)
  useEffect(() => {
    const next = ensureDataModelFromGraph(graph);
    setModel(next);
  }, [graph]);

  const logicalTables = useMemo(() => convertConceptualToLogical(model), [model]);
  const sqlScript = useMemo(() => generateDataModelSQL(model, model.dialect), [model]);

  useEffect(() => {
    if (logicalTables.length > 0 && !logicalTables.some((t) => t.name === activeTable)) {
      setActiveTable(logicalTables[0].name);
    }
  }, [logicalTables, activeTable]);

  const selectedEntity = useMemo(
    () => model.entities.find((e) => e.id === selectedEntityId) || null,
    [model.entities, selectedEntityId],
  );

  const selectedRel = useMemo(
    () => model.relationships.find((r) => r.id === selectedRelId) || null,
    [model.relationships, selectedRelId],
  );

  const updateModel = (updater: (prev: DataModelDesign) => DataModelDesign) => {
    setModel((prev) => {
      const updated = updater(prev);
      commit((g) => ({
        ...g,
        dataModel: updated,
      }));
      return updated;
    });
  };

  const handleSetDialect = (dialect: DatabaseDialect) => {
    updateModel((prev) => ({ ...prev, dialect }));
    notify(
      dialect === 'sqlite'
        ? 'Motor alterado para SQLite 3 (banco em arquivo local).'
        : 'Motor alterado para PostgreSQL (servidor relacional).',
    );
  };

  const handleAddEntity = () => {
    const index = model.entities.length + 1;
    const rawName = `entidade_${index}`;
    const newEntity: ConceptualEntity = {
      id: `ent_${Date.now()}`,
      name: rawName,
      label: `Entidade ${index}`,
      x: 120 + ((index - 1) % 3) * 340,
      y: 100 + Math.floor((index - 1) / 3) * 240,
      attributes: [
        {
          id: `attr_${Date.now()}_1`,
          name: 'id',
          type: 'string',
          isPrimaryKey: true,
          isRequired: true,
        },
        {
          id: `attr_${Date.now()}_2`,
          name: 'nome',
          type: 'string',
          isRequired: true,
        },
      ],
    };
    updateModel((prev) => ({
      ...prev,
      entities: [...prev.entities, newEntity],
    }));
    setSelectedEntityId(newEntity.id);
    setSelectedRelId(null);
  };

  const handleAddRelationship = () => {
    if (model.entities.length < 1) {
      notify('Crie pelo menos uma entidade antes de adicionar um relacionamento.');
      return;
    }
    const source = model.entities[0];
    const target = model.entities[1] || model.entities[0];
    const newRel: ConceptualRelationship = {
      id: `rel_${Date.now()}`,
      name: 'possui',
      x: Math.round((source.x + target.x) / 2),
      y: Math.round((source.y + target.y) / 2) + 40,
      sourceEntityId: source.id,
      targetEntityId: target.id,
      sourceCardinality: '1,1',
      targetCardinality: '0,N',
    };
    updateModel((prev) => ({
      ...prev,
      relationships: [...prev.relationships, newRel],
    }));
    setSelectedRelId(newRel.id);
    setSelectedEntityId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedEntityId) {
      updateModel((prev) => ({
        ...prev,
        entities: prev.entities.filter((e) => e.id !== selectedEntityId),
        relationships: prev.relationships.filter(
          (r) => r.sourceEntityId !== selectedEntityId && r.targetEntityId !== selectedEntityId,
        ),
      }));
      setSelectedEntityId(null);
    } else if (selectedRelId) {
      updateModel((prev) => ({
        ...prev,
        relationships: prev.relationships.filter((r) => r.id !== selectedRelId),
      }));
      setSelectedRelId(null);
    }
  };

  const handleApplyToBackend = (generateCrudForTable?: string) => {
    commit((g) =>
      applyDataModelToGraph(g, model, { generateCrudBlocksForTable: generateCrudForTable }),
    );
    // Sincroniza também com o servidor de desenvolvimento se disponível
    if (model.seededData && Object.keys(model.seededData).length > 0) {
      void fetch('/__flowforge/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directAction: 'query',
          dialect: model.dialect,
          seed: model.seededData,
        }),
      }).catch(() => {});
    }
    notify(
      generateCrudForTable
        ? `Banco (${model.dialect.toUpperCase()}) configurado e blocos CRUD gerados para "${generateCrudForTable}"!`
        : `Banco de dados (${model.dialect.toUpperCase()}) e entidades sincronizados com o Backend!`,
    );
  };

  // Drag handlers no canvas conceitual
  const handlePointerDownItem = (
    e: React.PointerEvent,
    kind: 'entity' | 'rel',
    id: string,
    origX: number,
    origY: number,
  ) => {
    e.stopPropagation();
    if (kind === 'entity') {
      setSelectedEntityId(id);
      setSelectedRelId(null);
    } else {
      setSelectedRelId(id);
      setSelectedEntityId(null);
    }
    setDragging({
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
    });
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    const nextX = Math.max(20, Math.round((dragging.origX + dx) / 10) * 10);
    const nextY = Math.max(20, Math.round((dragging.origY + dy) / 10) * 10);

    setModel((prev) => {
      if (dragging.kind === 'entity') {
        return {
          ...prev,
          entities: prev.entities.map((ent) =>
            ent.id === dragging.id ? { ...ent, x: nextX, y: nextY } : ent,
          ),
        };
      }
      return {
        ...prev,
        relationships: prev.relationships.map((rel) =>
          rel.id === dragging.id ? { ...rel, x: nextX, y: nextY } : rel,
        ),
      };
    });
  };

  const handlePointerUpCanvas = () => {
    if (!dragging) return;
    setDragging(null);
    commit((g) => ({ ...g, dataModel: model }));
  };

  // Manipulação de registros reais no Explorador de Dados (sincronizado com simulation.rawStoreRef + gateway)
  const currentTableDef = logicalTables.find((t) => t.name === activeTable) || logicalTables[0];

  const tableRows: Record<string, unknown>[] = useMemo(() => {
    if (!currentTableDef) return [];
    const fromSim = simulation.store[currentTableDef.name];
    if (Array.isArray(fromSim)) return fromSim as Record<string, unknown>[];
    const fromSeed = model.seededData?.[currentTableDef.name];
    if (Array.isArray(fromSeed)) return fromSeed;
    return [];
  }, [currentTableDef, simulation.store, model.seededData]);

  const persistTableRows = (tableName: string, nextRows: Record<string, unknown>[]) => {
    if (simulation.rawStoreRef?.current) {
      simulation.rawStoreRef.current[tableName] = nextRows;
      simulation.syncStoreState?.();
    }
    const nextSeeded = {
      ...(model.seededData || {}),
      [tableName]: nextRows,
    };
    updateModel((prev) => ({
      ...prev,
      seededData: nextSeeded,
    }));
    void fetch('/__flowforge/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directAction: 'query',
        dialect: model.dialect,
        seed: { [tableName]: nextRows },
      }),
    }).catch(() => {});
  };

  const handleSaveRow = () => {
    if (!currentTableDef) return;
    const pkCol = currentTableDef.columns.find((c) => c.primaryKey)?.name || 'id';
    const record: Record<string, unknown> = {};

    for (const col of currentTableDef.columns) {
      const rawVal = newRowDraft[col.name] ?? '';
      if (col.primaryKey && !rawVal) {
        record[col.name] = editingRowId || String(tableRows.length + 1);
      } else if (col.type === 'number') {
        record[col.name] = rawVal === '' ? 0 : Number(rawVal);
      } else if (col.type === 'boolean') {
        record[col.name] = rawVal === 'true' || rawVal === '1';
      } else {
        record[col.name] = rawVal;
      }
    }

    let nextRows: Record<string, unknown>[];
    if (editingRowId !== null) {
      nextRows = tableRows.map((r) =>
        String(r[pkCol]) === editingRowId ? { ...r, ...record } : r,
      );
      setEditingRowId(null);
      notify(`Registro "${editingRowId}" atualizado na tabela "${currentTableDef.name}".`);
    } else {
      nextRows = [...tableRows, record];
      notify(`Registro inserido na tabela "${currentTableDef.name}".`);
    }

    setNewRowDraft({});
    persistTableRows(currentTableDef.name, nextRows);
  };

  const handleEditRow = (row: Record<string, unknown>) => {
    if (!currentTableDef) return;
    const pkCol = currentTableDef.columns.find((c) => c.primaryKey)?.name || 'id';
    const draft: Record<string, string> = {};
    for (const col of currentTableDef.columns) {
      draft[col.name] = row[col.name] !== undefined ? String(row[col.name]) : '';
    }
    setNewRowDraft(draft);
    setEditingRowId(String(row[pkCol] ?? ''));
  };

  const handleDeleteRow = (rowId: string) => {
    if (!currentTableDef) return;
    const pkCol = currentTableDef.columns.find((c) => c.primaryKey)?.name || 'id';
    const nextRows = tableRows.filter((r) => String(r[pkCol]) !== rowId);
    persistTableRows(currentTableDef.name, nextRows);
    notify(`Registro "${rowId}" removido da tabela "${currentTableDef.name}".`);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
      notify('Script SQL copiado para a área de transferência!');
    } catch {
      notify('Não foi possível copiar automaticamente.');
    }
  };

  return (
    <div className="datamodel-workspace">
      {/* Barra Superior da Modelagem de Dados */}
      <div className="datamodel-toolbar">
        <div className="datamodel-toolbar-left">
          <div className="datamodel-tabs" role="tablist" aria-label="Níveis de Modelagem">
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'conceptual'}
              className={`datamodel-tab ${subMode === 'conceptual' ? 'active' : ''}`}
              onClick={() => setSubMode('conceptual')}
            >
              <Diamond size={14} />
              <span>1. Modelo Conceitual (DER)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'logical'}
              className={`datamodel-tab ${subMode === 'logical' ? 'active' : ''}`}
              onClick={() => setSubMode('logical')}
            >
              <Table2 size={14} />
              <span>2. Modelo Lógico (Tabelas)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'sql'}
              className={`datamodel-tab ${subMode === 'sql' ? 'active' : ''}`}
              onClick={() => setSubMode('sql')}
            >
              <FileCode2 size={14} />
              <span>3. Script SQL (DDL)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'explorer'}
              className={`datamodel-tab ${subMode === 'explorer' ? 'active' : ''}`}
              onClick={() => setSubMode('explorer')}
            >
              <Database size={14} />
              <span>4. Dados Reais (CRUD)</span>
            </button>
          </div>
        </div>

        <div className="datamodel-toolbar-center">
          <div className="datamodel-dialect-switch" role="group" aria-label="Motor do Banco">
            <span className="dialect-label">Motor SQL:</span>
            <button
              type="button"
              className={`dialect-btn ${model.dialect === 'postgres' ? 'active' : ''}`}
              onClick={() => handleSetDialect('postgres')}
            >
              <Server size={13} />
              <span>PostgreSQL</span>
            </button>
            <button
              type="button"
              className={`dialect-btn ${model.dialect === 'sqlite' ? 'active' : ''}`}
              onClick={() => handleSetDialect('sqlite')}
            >
              <Database size={13} />
              <span>SQLite</span>
            </button>
          </div>
        </div>

        <div className="datamodel-toolbar-right">
          <button
            type="button"
            className="secondary icon-only"
            onClick={undo}
            disabled={!canUndo}
            title="Desfazer"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="secondary icon-only"
            onClick={redo}
            disabled={!canRedo}
            title="Refazer"
          >
            <RotateCw size={15} />
          </button>
          <button
            type="button"
            className="primary sync-backend-btn"
            onClick={() => handleApplyToBackend()}
            title="Configura a conexão do banco e cria/atualiza as entidades no Backend"
          >
            <RefreshCw size={14} />
            <span>Sincronizar com Backend</span>
          </button>
        </div>
      </div>

      {/* Corpo Principal */}
      <div className="datamodel-body">
        {/* ABA 1: MODELO CONCEITUAL (Estilo brModelo) */}
        {subMode === 'conceptual' && (
          <>
            <div className="datamodel-palette">
              <span className="palette-title">FERRAMENTAS DER (brModelo)</span>
              <button type="button" className="palette-btn" onClick={handleAddEntity}>
                <Table2 size={16} />
                <div>
                  <strong>Nova Entidade</strong>
                  <small>Retângulo com atributos</small>
                </div>
              </button>
              <button type="button" className="palette-btn" onClick={handleAddRelationship}>
                <Diamond size={16} />
                <div>
                  <strong>Novo Relacionamento</strong>
                  <small>Losango com cardinalidade (1:N, N:N)</small>
                </div>
              </button>

              <div className="palette-divider" />
              <span className="palette-title">COMO FUNCIONA</span>
              <ul className="brmodelo-tips">
                <li>
                  <strong>Entidade:</strong> Representa um objeto do mundo real (ex: Cliente,
                  Produto).
                </li>
                <li>
                  <strong>Atributo Identificador (PK):</strong> Bolinha preenchida (●) que
                  identifica cada registro.
                </li>
                <li>
                  <strong>Relacionamento (Losango):</strong> Liga duas entidades com cardinalidades
                  <code>(1,1)</code>, <code>(0,N)</code>, etc.
                </li>
                <li>
                  <strong>Conversão Automática:</strong> Relacionamentos <code>1:N</code> criam
                  chaves estrangeiras (FK) e <code>N:N</code> criam tabelas associativas sozinhos!
                </li>
              </ul>
            </div>

            <div
              ref={canvasRef}
              className="datamodel-canvas"
              onPointerMove={handlePointerMoveCanvas}
              onPointerUp={handlePointerUpCanvas}
              onPointerDown={() => {
                setSelectedEntityId(null);
                setSelectedRelId(null);
              }}
            >
              {/* Camada SVG para linhas e cardinalidades estilo brModelo */}
              <svg className="datamodel-svg-layer">
                {model.relationships.map((rel) => {
                  const source = model.entities.find((e) => e.id === rel.sourceEntityId);
                  const target = model.entities.find((e) => e.id === rel.targetEntityId);
                  if (!source || !target) return null;

                  const sx = source.x + 110;
                  const sy = source.y + 45;
                  const rx = rel.x + 70;
                  const ry = rel.y + 36;
                  const tx = target.x + 110;
                  const ty = target.y + 45;

                  const midSourceX = Math.round((sx + rx) / 2);
                  const midSourceY = Math.round((sy + ry) / 2);
                  const midTargetX = Math.round((tx + rx) / 2);
                  const midTargetY = Math.round((ty + ry) / 2);

                  return (
                    <g key={rel.id}>
                      <line x1={sx} y1={sy} x2={rx} y2={ry} className="der-connector-line" />
                      <line x1={rx} y1={ry} x2={tx} y2={ty} className="der-connector-line" />
                      <rect
                        x={midSourceX - 20}
                        y={midSourceY - 11}
                        width={40}
                        height={20}
                        rx={5}
                        className="der-cardinality-bg"
                      />
                      <text
                        x={midSourceX}
                        y={midSourceY + 3}
                        textAnchor="middle"
                        className="der-cardinality-text"
                      >
                        ({rel.sourceCardinality})
                      </text>

                      <rect
                        x={midTargetX - 20}
                        y={midTargetY - 11}
                        width={40}
                        height={20}
                        rx={5}
                        className="der-cardinality-bg"
                      />
                      <text
                        x={midTargetX}
                        y={midTargetY + 3}
                        textAnchor="middle"
                        className="der-cardinality-text"
                      >
                        ({rel.targetCardinality})
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Nós de Entidades (Retângulos com pinos de atributos estilo brModelo) */}
              {model.entities.map((ent) => {
                const isSelected = ent.id === selectedEntityId;
                return (
                  <div
                    key={ent.id}
                    style={{ left: ent.x, top: ent.y }}
                    className={`der-entity-node ${isSelected ? 'selected' : ''}`}
                    onPointerDown={(e) => handlePointerDownItem(e, 'entity', ent.id, ent.x, ent.y)}
                  >
                    <div className="der-entity-box">
                      <span className="der-entity-kind">ENTIDADE</span>
                      <strong>{ent.label || ent.name}</strong>
                      <small>{ent.name}</small>
                    </div>
                    <div className="der-attributes-list">
                      {ent.attributes.map((attr) => (
                        <div key={attr.id} className="der-attribute-pin">
                          <span className="der-pin-stem" />
                          <span
                            className={`der-pin-circle ${attr.isPrimaryKey ? 'pk' : ''}`}
                            title={
                              attr.isPrimaryKey ? 'Atributo Identificador (PK)' : 'Atributo Comum'
                            }
                          />
                          <span className="der-attr-name">
                            {attr.name}
                            {attr.isPrimaryKey && <em> (PK)</em>}
                          </span>
                          <span className="der-attr-type">{attr.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Nós de Relacionamento (Losangos estilo brModelo) */}
              {model.relationships.map((rel) => {
                const isSelected = rel.id === selectedRelId;
                return (
                  <div
                    key={rel.id}
                    style={{ left: rel.x, top: rel.y }}
                    className={`der-relationship-node ${isSelected ? 'selected' : ''}`}
                    onPointerDown={(e) => handlePointerDownItem(e, 'rel', rel.id, rel.x, rel.y)}
                  >
                    <div className="der-diamond-shape">
                      <span>{rel.name || 'possui'}</span>
                    </div>
                  </div>
                );
              })}

              {model.entities.length === 0 && (
                <div className="datamodel-empty-hint">
                  <Sparkles size={28} />
                  <h3>Modelagem Conceitual (Estilo brModelo)</h3>
                  <p>
                    Clique em <strong>Nova Entidade</strong> à esquerda para desenhar suas tabelas
                    conceituais e depois ligue-as com <strong>Novo Relacionamento</strong>.
                  </p>
                  <button type="button" className="primary" onClick={handleAddEntity}>
                    <Plus size={15} /> Criar Primeira Entidade
                  </button>
                </div>
              )}
            </div>

            {/* Inspetor Lateral Direito do Modelo Conceitual */}
            <aside className="datamodel-inspector">
              {selectedEntity ? (
                <div className="dm-inspector-content">
                  <div className="dm-inspector-header">
                    <div>
                      <span className="eyebrow">ENTIDADE CONCEITUAL</span>
                      <h3>{selectedEntity.label}</h3>
                    </div>
                    <button
                      type="button"
                      className="secondary danger icon-only"
                      onClick={handleDeleteSelected}
                      title="Excluir Entidade"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <label className="field">
                    Nome de exibição (Conceitual)
                    <input
                      value={selectedEntity.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        updateModel((prev) => ({
                          ...prev,
                          entities: prev.entities.map((item) =>
                            item.id === selectedEntity.id
                              ? { ...item, label, name: toSqlTableName(label) }
                              : item,
                          ),
                        }));
                      }}
                    />
                  </label>

                  <label className="field">
                    Nome físico da tabela (SQL)
                    <input
                      value={selectedEntity.name}
                      onChange={(e) => {
                        const name = toSqlTableName(e.target.value);
                        updateModel((prev) => ({
                          ...prev,
                          entities: prev.entities.map((item) =>
                            item.id === selectedEntity.id ? { ...item, name } : item,
                          ),
                        }));
                      }}
                    />
                  </label>

                  <div className="dm-section-header">
                    <span>ATRIBUTOS ({selectedEntity.attributes.length})</span>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => {
                        const newAttr: ConceptualAttribute = {
                          id: `attr_${Date.now()}`,
                          name: `campo_${selectedEntity.attributes.length + 1}`,
                          type: 'string',
                          isRequired: false,
                        };
                        updateModel((prev) => ({
                          ...prev,
                          entities: prev.entities.map((item) =>
                            item.id === selectedEntity.id
                              ? { ...item, attributes: [...item.attributes, newAttr] }
                              : item,
                          ),
                        }));
                      }}
                    >
                      <Plus size={13} /> Atributo
                    </button>
                  </div>

                  <div className="dm-attributes-editor">
                    {selectedEntity.attributes.map((attr) => (
                      <div key={attr.id} className="dm-attr-card">
                        <div className="dm-attr-row">
                          <input
                            value={attr.name}
                            placeholder="nome_campo"
                            onChange={(e) => {
                              const name = toSqlTableName(e.target.value);
                              updateModel((prev) => ({
                                ...prev,
                                entities: prev.entities.map((item) =>
                                  item.id === selectedEntity.id
                                    ? {
                                        ...item,
                                        attributes: item.attributes.map((a) =>
                                          a.id === attr.id ? { ...a, name } : a,
                                        ),
                                      }
                                    : item,
                                ),
                              }));
                            }}
                          />
                          <select
                            value={attr.type}
                            onChange={(e) => {
                              const type = e.target.value as FieldType;
                              updateModel((prev) => ({
                                ...prev,
                                entities: prev.entities.map((item) =>
                                  item.id === selectedEntity.id
                                    ? {
                                        ...item,
                                        attributes: item.attributes.map((a) =>
                                          a.id === attr.id ? { ...a, type } : a,
                                        ),
                                      }
                                    : item,
                                ),
                              }));
                            }}
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="icon-delete-btn"
                            onClick={() => {
                              updateModel((prev) => ({
                                ...prev,
                                entities: prev.entities.map((item) =>
                                  item.id === selectedEntity.id
                                    ? {
                                        ...item,
                                        attributes: item.attributes.filter((a) => a.id !== attr.id),
                                      }
                                    : item,
                                ),
                              }));
                            }}
                            title="Remover atributo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="dm-attr-flags">
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(attr.isPrimaryKey)}
                              onChange={(e) => {
                                const isPrimaryKey = e.target.checked;
                                updateModel((prev) => ({
                                  ...prev,
                                  entities: prev.entities.map((item) =>
                                    item.id === selectedEntity.id
                                      ? {
                                          ...item,
                                          attributes: item.attributes.map((a) =>
                                            a.id === attr.id
                                              ? {
                                                  ...a,
                                                  isPrimaryKey,
                                                  isRequired: isPrimaryKey || a.isRequired,
                                                }
                                              : a,
                                          ),
                                        }
                                      : item,
                                  ),
                                }));
                              }}
                            />
                            <span>PK (Identificador ●)</span>
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(attr.isRequired)}
                              onChange={(e) => {
                                const isRequired = e.target.checked;
                                updateModel((prev) => ({
                                  ...prev,
                                  entities: prev.entities.map((item) =>
                                    item.id === selectedEntity.id
                                      ? {
                                          ...item,
                                          attributes: item.attributes.map((a) =>
                                            a.id === attr.id ? { ...a, isRequired } : a,
                                          ),
                                        }
                                      : item,
                                  ),
                                }));
                              }}
                            />
                            <span>Obrigatório</span>
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(attr.isUnique)}
                              onChange={(e) => {
                                const isUnique = e.target.checked;
                                updateModel((prev) => ({
                                  ...prev,
                                  entities: prev.entities.map((item) =>
                                    item.id === selectedEntity.id
                                      ? {
                                          ...item,
                                          attributes: item.attributes.map((a) =>
                                            a.id === attr.id ? { ...a, isUnique } : a,
                                          ),
                                        }
                                      : item,
                                  ),
                                }));
                              }}
                            />
                            <span>Único</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="secondary wide"
                    style={{ marginTop: 12 }}
                    onClick={() => handleApplyToBackend(selectedEntity.name)}
                  >
                    <Wand2 size={14} />
                    <span>Gerar Blocos CRUD no Backend</span>
                  </button>
                </div>
              ) : selectedRel ? (
                <div className="dm-inspector-content">
                  <div className="dm-inspector-header">
                    <div>
                      <span className="eyebrow">RELACIONAMENTO (LOSANGO)</span>
                      <h3>{selectedRel.name}</h3>
                    </div>
                    <button
                      type="button"
                      className="secondary danger icon-only"
                      onClick={handleDeleteSelected}
                      title="Excluir Relacionamento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <label className="field">
                    Verbo / Nome do Relacionamento
                    <input
                      value={selectedRel.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        updateModel((prev) => ({
                          ...prev,
                          relationships: prev.relationships.map((r) =>
                            r.id === selectedRel.id ? { ...r, name } : r,
                          ),
                        }));
                      }}
                    />
                  </label>

                  <label className="field">
                    Entidade Origem (Lado A)
                    <select
                      value={selectedRel.sourceEntityId}
                      onChange={(e) => {
                        const sourceEntityId = e.target.value;
                        updateModel((prev) => ({
                          ...prev,
                          relationships: prev.relationships.map((r) =>
                            r.id === selectedRel.id ? { ...r, sourceEntityId } : r,
                          ),
                        }));
                      }}
                    >
                      {model.entities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.label} ({ent.name})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    Cardinalidade Lado A
                    <select
                      value={selectedRel.sourceCardinality}
                      onChange={(e) => {
                        const sourceCardinality = e.target.value as Cardinality;
                        updateModel((prev) => ({
                          ...prev,
                          relationships: prev.relationships.map((r) =>
                            r.id === selectedRel.id ? { ...r, sourceCardinality } : r,
                          ),
                        }));
                      }}
                    >
                      {CARDINALITIES.map((c) => (
                        <option key={c} value={c}>
                          ({c})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    Entidade Destino (Lado B)
                    <select
                      value={selectedRel.targetEntityId}
                      onChange={(e) => {
                        const targetEntityId = e.target.value;
                        updateModel((prev) => ({
                          ...prev,
                          relationships: prev.relationships.map((r) =>
                            r.id === selectedRel.id ? { ...r, targetEntityId } : r,
                          ),
                        }));
                      }}
                    >
                      {model.entities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.label} ({ent.name})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    Cardinalidade Lado B
                    <select
                      value={selectedRel.targetCardinality}
                      onChange={(e) => {
                        const targetCardinality = e.target.value as Cardinality;
                        updateModel((prev) => ({
                          ...prev,
                          relationships: prev.relationships.map((r) =>
                            r.id === selectedRel.id ? { ...r, targetCardinality } : r,
                          ),
                        }));
                      }}
                    >
                      {CARDINALITIES.map((c) => (
                        <option key={c} value={c}>
                          ({c})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="dm-rel-summary-box">
                    <strong>Regra de Conversão Lógica:</strong>
                    <p>
                      {selectedRel.sourceCardinality.endsWith('N') &&
                      selectedRel.targetCardinality.endsWith('N')
                        ? 'Relacionamento N:N — Criará automaticamente uma Tabela Associativa com duas Chaves Estrangeiras (FK).'
                        : selectedRel.targetCardinality.endsWith('N')
                          ? 'Relacionamento 1:N — A chave primária (PK) da Origem será adicionada como Chave Estrangeira (FK) na tabela Destino.'
                          : selectedRel.sourceCardinality.endsWith('N')
                            ? 'Relacionamento N:1 — A chave primária (PK) do Destino será adicionada como Chave Estrangeira (FK) na tabela Origem.'
                            : 'Relacionamento 1:1 — Adicionará uma Chave Estrangeira Única (FK UNIQUE) na tabela Destino.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="dm-inspector-empty">
                  <Layers size={24} />
                  <h4>Propriedades da Modelagem</h4>
                  <p>
                    Clique em uma <strong>Entidade</strong> ou <strong>Relacionamento</strong> no
                    diagrama para editar seus atributos, chaves primárias (PK) e cardinalidades.
                  </p>
                  {model.dialect === 'sqlite' && (
                    <label className="field" style={{ marginTop: 14, width: '100%' }}>
                      Arquivo do Banco SQLite
                      <input
                        value={model.sqliteFilePath || './data/flowforge.sqlite'}
                        onChange={(e) =>
                          updateModel((prev) => ({ ...prev, sqliteFilePath: e.target.value }))
                        }
                      />
                    </label>
                  )}
                </div>
              )}
            </aside>
          </>
        )}

        {/* ABA 2: MODELO LÓGICO (Tabelas Relacionais com PK e FK geradas) */}
        {subMode === 'logical' && (
          <div className="datamodel-logical-view">
            <div className="logical-header-banner">
              <div>
                <h3>
                  {' '}
                  Esquema Lógico Relacional (
                  {model.dialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL'})
                </h3>
                <p>
                  Gerado automaticamente a partir do Modelo Conceitual. Chaves primárias (PK),
                  chaves estrangeiras (FK) e tabelas associativas N:N já estão resolvidas.
                </p>
              </div>
              <button type="button" className="primary" onClick={() => setSubMode('sql')}>
                <Code2 size={15} /> Ver Comandos SQL
              </button>
            </div>

            <div className="logical-tables-grid">
              {logicalTables.map((table) => (
                <div
                  key={table.id}
                  className={`logical-table-card ${table.isAssociative ? 'associative' : ''}`}
                >
                  <div className="logical-table-header">
                    <div className="logical-table-title">
                      <Table2 size={15} />
                      <strong>{table.name}</strong>
                    </div>
                    <span className="logical-badge">
                      {table.isAssociative ? ' Associativa (N:N)' : 'Tabela Base'}
                    </span>
                  </div>
                  <div className="logical-columns-list">
                    {table.columns.map((col) => (
                      <div key={col.name} className="logical-col-row">
                        <div className="logical-col-left">
                          {col.primaryKey && (
                            <span className="col-badge pk" title="Primary Key">
                              <Key size={10} /> PK
                            </span>
                          )}
                          {col.foreignKey && (
                            <span
                              className="col-badge fk"
                              title={`Foreign Key -> ${col.foreignKey.referencesTable}.${col.foreignKey.referencesColumn}`}
                            >
                              <Link2 size={10} /> FK
                            </span>
                          )}
                          <span className="logical-col-name">{col.name}</span>
                        </div>
                        <div className="logical-col-right">
                          <code>{col.sqlType}</code>
                          {col.required && <span className="nn-tag">NOT NULL</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="logical-table-footer">
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => handleApplyToBackend(table.name)}
                    >
                      <Wand2 size={13} /> Criar Blocos CRUD no Fluxo
                    </button>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => {
                        setActiveTable(table.name);
                        setSubMode('explorer');
                      }}
                    >
                      <Play size={13} /> Manipular Dados
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: SCRIPT SQL (DDL para PostgreSQL e SQLite) */}
        {subMode === 'sql' && (
          <div className="datamodel-sql-view">
            <div className="sql-view-header">
              <div>
                <h3>Comandos SQL DDL ({model.dialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL'})</h3>
                <p>
                  Estes comandos são executados automaticamente nas migrações do servidor exportado
                  e configuram o banco de dados do projeto.
                </p>
              </div>
              <div className="sql-view-actions">
                <button type="button" className="secondary" onClick={handleCopySql}>
                  {copiedSql ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
                <button type="button" className="primary" onClick={() => handleApplyToBackend()}>
                  <RefreshCw size={15} />
                  <span>Aplicar ao Banco do Projeto</span>
                </button>
              </div>
            </div>
            <pre className="sql-code-preview">
              <code>{sqlScript}</code>
            </pre>
          </div>
        )}

        {/* ABA 4: EXPLORADOR DE DADOS REAIS (Manipulação CRUD direta integrada ao Backend) */}
        {subMode === 'explorer' && (
          <div className="datamodel-explorer-view">
            <aside className="explorer-sidebar">
              <span className="palette-title">
                TABELAS DO BANCO ({model.dialect.toUpperCase()})
              </span>
              {logicalTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`explorer-table-btn ${t.name === currentTableDef?.name ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTable(t.name);
                    setEditingRowId(null);
                    setNewRowDraft({});
                  }}
                >
                  <Table2 size={15} />
                  <span>{t.name}</span>
                  <small>
                    {(Array.isArray(simulation.store[t.name])
                      ? (simulation.store[t.name] as unknown[]).length
                      : model.seededData?.[t.name]?.length) || 0}
                  </small>
                </button>
              ))}
            </aside>

            <div className="explorer-main">
              {currentTableDef ? (
                <>
                  <div className="explorer-header">
                    <div>
                      <h3>
                        Tabela: <code>{currentTableDef.name}</code>
                      </h3>
                      <p>
                        Os registros inseridos ou editados aqui ficam ativos imediatamente no banco
                        para todos os blocos de Backend e telas de Interface.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleApplyToBackend(currentTableDef.name)}
                    >
                      <Wand2 size={14} /> Gerar Blocos CRUD no Backend
                    </button>
                  </div>

                  {/* Formulário rápido de Inserção / Edição na tabela */}
                  <div className="explorer-insert-bar">
                    {currentTableDef.columns.map((col) => (
                      <label key={col.name} className="explorer-input-cell">
                        <span>
                          {col.name} {col.primaryKey ? '(PK)' : col.foreignKey ? '(FK)' : ''}
                        </span>
                        <input
                          placeholder={col.sqlType}
                          value={newRowDraft[col.name] ?? ''}
                          onChange={(e) =>
                            setNewRowDraft((prev) => ({ ...prev, [col.name]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                    <div className="explorer-insert-actions">
                      <button type="button" className="primary" onClick={handleSaveRow}>
                        <Plus size={14} />
                        <span>{editingRowId ? 'Atualizar' : 'Inserir Registro'}</span>
                      </button>
                      {editingRowId && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setEditingRowId(null);
                            setNewRowDraft({});
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grade de Registros */}
                  <div className="explorer-data-table-wrap">
                    <table className="explorer-data-table">
                      <thead>
                        <tr>
                          {currentTableDef.columns.map((col) => (
                            <th key={col.name}>
                              {col.name} <small>({col.sqlType})</small>
                            </th>
                          ))}
                          <th style={{ width: 120 }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={currentTableDef.columns.length + 1}
                              className="explorer-empty-row"
                            >
                              Nenhum registro cadastrado nesta tabela. Insira um registro acima ou
                              execute um fluxo de <code>INSERT</code> no Backend.
                            </td>
                          </tr>
                        ) : (
                          tableRows.map((row, idx) => {
                            const pkCol =
                              currentTableDef.columns.find((c) => c.primaryKey)?.name || 'id';
                            const rowId = String(row[pkCol] ?? idx + 1);
                            return (
                              <tr key={rowId}>
                                {currentTableDef.columns.map((col) => (
                                  <td key={col.name}>
                                    {typeof row[col.name] === 'object'
                                      ? JSON.stringify(row[col.name])
                                      : String(row[col.name] ?? '')}
                                  </td>
                                ))}
                                <td className="explorer-row-actions">
                                  <button
                                    type="button"
                                    className="secondary small"
                                    onClick={() => handleEditRow(row)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary danger small"
                                    onClick={() => handleDeleteRow(rowId)}
                                  >
                                    Excluir
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="datamodel-empty-hint">
                  <Database size={28} />
                  <p>Crie uma entidade no Modelo Conceitual para manipular seus dados.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
