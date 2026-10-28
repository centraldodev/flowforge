import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ChevronDown,
  Copy,
  Database,
  FolderKanban,
  GitBranch,
  Globe,
  SlidersHorizontal,
  Trash2,
  Wand2,
  Workflow,
} from 'lucide-react';
import type { Connection } from '@xyflow/react';
import { PropertyField, type FieldDefinition } from '../../components/PropertyField';
import {
  catalog,
  inferBlockLogicTemplate,
  type Block,
  type Graph,
  type Kind,
  type LogicRecommendation,
} from '../../engine';
import { BlockIdEditor } from './BlockIdEditor';
import { BlockLogicBuilder } from './BlockLogicBuilder';
import { DatabaseManager } from './DatabaseManager';
import { EdgeList } from './EdgeList';
import { HttpRequestTools } from './HttpRequestTools';
import { LogicCatalogEditor } from './LogicCatalogEditor';

type Props = {
  chosen: Block | undefined;
  graph?: Graph;
  nameField: FieldDefinition | undefined;
  configFields: FieldDefinition[];
  connections?: ReactNode;
  onChangeConfig?: (config: Record<string, string>) => void;
  onDeleteConfigKey?: (key: string) => void;
  onRenameId?: (newId: string) => boolean | void;
  onDuplicate: () => void;
  onDelete: () => void;
  onConnect?: (c: Connection & { data?: { callArg?: string } }) => void;
  onRemoveEdge?: (id: string) => void;
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
  onCreateAndBindBlock?: (
    targetKind: Kind,
    options: {
      slotKey?: string;
      sourceHandle?: string;
      targetHandle?: string;
      defaultConfig?: Record<string, string>;
      defaultArg?: string;
    },
  ) => void;
  onApplyRecommendation?: (rec: LogicRecommendation) => void;
  /** Aba inicial ou filtro opcional quando aberto pelo flyout */
  initialSection?: 'all' | 'properties' | 'code' | 'connections';
};

export function InspectorPanel({
  chosen,
  graph,
  nameField,
  configFields,
  connections,
  onChangeConfig,
  onRenameId,
  onDuplicate,
  onDelete,
  onRemoveEdge,
  onCreateAndBindBlock,
  onApplyRecommendation,
  initialSection = 'all',
}: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    params: true,
    connections: true,
  });

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Arestas conectadas a este bloco
  const blockEdges = useMemo(() => {
    if (!graph || !chosen) return [];
    return graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);
  }, [graph, chosen]);

  // Chaves já editadas na Lógica Pré-Montada ativa (evita duplicar os mesmos campos logo abaixo)
  const activeSlotKeys = useMemo(() => {
    if (!chosen) return new Set<string>();
    const tmpl = inferBlockLogicTemplate(chosen);
    return new Set(tmpl ? tmpl.variables.map((v) => v.key) : []);
  }, [chosen]);

  // Separa os campos de organização (tela / fluxo), parâmetros extras e código legado
  const { contextFields, paramFields } = useMemo(() => {
    const context: FieldDefinition[] = [];
    const params: FieldDefinition[] = [];
    for (const f of configFields) {
      if (f.id === 'code') continue; // O código já tem o BlockCodeEditor dedicado
      if (f.id === 'screenId' || f.id === 'flowId') {
        context.push(f);
      } else if (!activeSlotKeys.has(f.id)) {
        params.push(f);
      }
    }
    return { contextFields: context, paramFields: params };
  }, [configFields, activeSlotKeys]);

  if (!chosen) {
    return (
      <div className="inspector">
        <div className="empty">
          <Workflow size={28} />
          <h3>Nenhum bloco selecionado</h3>
          <p>Selecione um bloco no canvas para configurar propriedades, código e conexões.</p>
        </div>
      </div>
    );
  }

  const def = catalog[chosen.data.kind];
  const kind = chosen.data.kind;
  const showIdentityAndProps = initialSection === 'all' || initialSection === 'properties';
  const showConnectionsSection = initialSection === 'all' || initialSection === 'connections';

  return (
    <div className="inspector">
      <div className="inspector-content">
        {/* 1. Cabeçalho Compacto do Bloco */}
        <div className="selected-kind">
          <span
            className="selected-kind-icon"
            style={{ '--kind-color': def.color } as CSSProperties}
          >
            <span className="material-symbols-outlined">{def.icon}</span>
          </span>
          <div className="selected-kind-info">
            <div className="kind-header-top">
              <small>{def.category}</small>
              <span className="block-id-badge" title={'ID: ' + chosen.id}>
                #{chosen.id}
              </span>
            </div>
            <h2>{chosen.data.label || def.name}</h2>
          </div>
          <div className="selected-kind-actions">
            <button
              type="button"
              className="kind-icon-action"
              title="Duplicar bloco"
              aria-label="Duplicar bloco"
              onClick={onDuplicate}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="kind-icon-action danger"
              title="Excluir bloco"
              aria-label="Excluir bloco"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* 2. Cartão de Identidade & Organização */}
        {showIdentityAndProps && (
          <section className="inspector-card">
            <button
              type="button"
              className="inspector-card-header"
              onClick={() => toggleSection('identity')}
              aria-expanded={!collapsedSections.identity}
            >
              <div className="inspector-card-title">
                <FolderKanban size={13} className="card-icon" />
                <span>Identidade</span>
              </div>
              <ChevronDown
                size={14}
                className={`card-chevron ${collapsedSections.identity ? 'is-collapsed' : ''}`}
              />
            </button>

            {!collapsedSections.identity && (
              <div className="inspector-card-body">
                <div className="inspector-identity-grid">
                  {nameField && (
                    <label className="inspector-field">
                      <span className="inspector-field-label">Título do Bloco</span>
                      <input
                        type="text"
                        className="inspector-input"
                        value={nameField.value}
                        placeholder={def.name}
                        onChange={(e) => nameField.onChange(e.target.value)}
                      />
                    </label>
                  )}

                  {graph && onRenameId && (
                    <BlockIdEditor chosen={chosen} graph={graph} onRename={onRenameId} />
                  )}
                </div>

                {contextFields.length > 0 && (
                  <div className="inspector-fields-grid cols-2">
                    {contextFields.map((field) => (
                      <PropertyField key={field.id} {...field} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 2.5. Cartão de Funções & Lógicas Pré-Montadas (Geração Guiada de Código e Conexões) */}
        {showIdentityAndProps && graph && onChangeConfig && (
          <section className="inspector-card logic-builder-card">
            <button
              type="button"
              className="inspector-card-header"
              onClick={() => toggleSection('logicBuilder')}
              aria-expanded={!collapsedSections.logicBuilder}
            >
              <div className="inspector-card-title">
                <Wand2 size={13} className="card-icon" />
                <span>Lógica & Código</span>
              </div>
              <ChevronDown
                size={14}
                className={`card-chevron ${collapsedSections.logicBuilder ? 'is-collapsed' : ''}`}
              />
            </button>

            {!collapsedSections.logicBuilder && (
              <div className="inspector-card-body">
                <BlockLogicBuilder
                  block={chosen}
                  graph={graph}
                  onChangeConfig={onChangeConfig}
                  onCreateAndBindBlock={onCreateAndBindBlock}
                  onApplyRecommendation={onApplyRecommendation}
                />
              </div>
            )}
          </section>
        )}

        {/* 3. Cartão de Propriedades & Parâmetros do Bloco */}
        {showIdentityAndProps && paramFields.length > 0 && (
          <section className="inspector-card">
            <button
              type="button"
              className="inspector-card-header"
              onClick={() => toggleSection('params')}
              aria-expanded={!collapsedSections.params}
            >
              <div className="inspector-card-title">
                <SlidersHorizontal size={13} className="card-icon" />
                <span>Mais Opções</span>
                <span className="inspector-card-badge">{paramFields.length}</span>
              </div>
              <ChevronDown
                size={14}
                className={`card-chevron ${collapsedSections.params ? 'is-collapsed' : ''}`}
              />
            </button>

            {!collapsedSections.params && (
              <div className="inspector-card-body">
                <div className="inspector-fields-grid">
                  {paramFields.map((field) => {
                    const isWide =
                      field.area ||
                      field.entries ||
                      field.label.length > 28 ||
                      field.value.length > 32;
                    return (
                      <div
                        key={field.id}
                        className={`inspector-field-cell ${isWide ? 'span-full' : ''}`}
                      >
                        <PropertyField {...field} />
                      </div>
                    );
                  })}
                </div>

                {onChangeConfig && (kind === 'condition' || kind === 'validator') && (
                  <div className="inspector-tool-subbox">
                    <LogicCatalogEditor block={chosen} onChange={onChangeConfig} />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Ferramentas Especiais de Banco de Dados ou HTTP */}
        {showIdentityAndProps &&
          graph &&
          onChangeConfig &&
          (kind === 'database' || kind === 'auth') &&
          chosen.data.config.mode !== 'real' &&
          chosen.data.config.execution !== 'real' && (
            <section className="inspector-card">
              <button
                type="button"
                className="inspector-card-header"
                onClick={() => toggleSection('db')}
                aria-expanded={!collapsedSections.db}
              >
                <div className="inspector-card-title">
                  <Database size={13} className="card-icon" />
                  <span>Dados de Demonstração</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`card-chevron ${collapsedSections.db ? 'is-collapsed' : ''}`}
                />
              </button>
              {!collapsedSections.db && (
                <div className="inspector-card-body">
                  <DatabaseManager block={chosen} onChange={onChangeConfig} />
                </div>
              )}
            </section>
          )}

        {showIdentityAndProps &&
          graph &&
          onChangeConfig &&
          (kind === 'api' || kind === 'httpConnection') && (
            <section className="inspector-card">
              <button
                type="button"
                className="inspector-card-header"
                onClick={() => toggleSection('http')}
                aria-expanded={!collapsedSections.http}
              >
                <div className="inspector-card-title">
                  <Globe size={13} className="card-icon" />
                  <span>Teste & Credenciais HTTP</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`card-chevron ${collapsedSections.http ? 'is-collapsed' : ''}`}
                />
              </button>
              {!collapsedSections.http && (
                <div className="inspector-card-body">
                  <HttpRequestTools block={chosen} graph={graph} onChangeConfig={onChangeConfig} />
                </div>
              )}
            </section>
          )}

        {/* 4. Cartão de Conexões Feitas */}
        {showConnectionsSection && (
          <section className="inspector-card">
            <button
              type="button"
              className="inspector-card-header"
              onClick={() => toggleSection('connections')}
              aria-expanded={!collapsedSections.connections}
            >
              <div className="inspector-card-title">
                <GitBranch size={13} className="card-icon" />
                <span>Conexões Feitas</span>
                <span className="inspector-card-badge">{blockEdges.length}</span>
              </div>
              <ChevronDown
                size={14}
                className={`card-chevron ${collapsedSections.connections ? 'is-collapsed' : ''}`}
              />
            </button>

            {!collapsedSections.connections && (
              <div className="inspector-card-body">
                {connections ? (
                  connections
                ) : graph ? (
                  <EdgeList
                    graph={graph}
                    block={chosen}
                    edges={blockEdges}
                    onRemoveEdge={onRemoveEdge}
                  />
                ) : null}
              </div>
            )}
          </section>
        )}

        {/* 6. Ações Finais */}
        <div className="block-actions">
          <button type="button" className="secondary" onClick={onDuplicate}>
            <Copy size={14} /> Duplicar Bloco
          </button>
          <button type="button" className="danger" title="Excluir bloco" onClick={onDelete}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
