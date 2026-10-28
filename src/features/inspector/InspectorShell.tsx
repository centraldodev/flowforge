import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  GitBranch,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Trash2,
  X,
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
  children: ReactNode;
  fields?: FieldDefinition[];
  chosen?: Block;
  graph?: Graph;
  nameField?: FieldDefinition;
  onRenameId?: (newId: string) => boolean | void;
  connections?: ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeConfig?: (config: Record<string, string>) => void;
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
};

export function InspectorShell(p: Props) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'properties' | 'connections'>('properties');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
  }

  function show(tab: 'properties' | 'connections', trigger?: HTMLButtonElement) {
    cancel();
    if (trigger) lastTrigger.current = trigger;
    setActive('flyout');
    setActiveTab(tab);
  }

  function closeSoon() {
    cancel();
    timer.current = setTimeout(() => setActive(null), 250);
  }

  useEffect(() => () => cancel(), []);
  useEffect(() => {
    setActive(null);
  }, [p.chosen?.id]);

  // Permite abrir o modal de propriedades diretamente ao dar duplo clique ou clicar no botão do bloco no canvas
  useEffect(() => {
    const handleOpenRequest = () => {
      cancel();
      setActive('flyout');
      setActiveTab('properties');
    };
    window.addEventListener('flowforge:open-block-properties', handleOpenRequest);
    return () => {
      window.removeEventListener('flowforge:open-block-properties', handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActive(null);
        lastTrigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if ((e.target as Element).closest('.selector-popup')) return;
      if (!root.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [active]);

  const def = p.chosen ? catalog[p.chosen.data.kind] : undefined;

  const blockEdges = useMemo(() => {
    if (!p.graph || !p.chosen) return [];
    return p.graph.edges.filter((e) => e.source === p.chosen!.id || e.target === p.chosen!.id);
  }, [p.graph, p.chosen]);

  const activeSlotKeys = useMemo(() => {
    if (!p.chosen) return new Set<string>();
    const tmpl = inferBlockLogicTemplate(p.chosen);
    return new Set(tmpl ? tmpl.variables.map((v) => v.key) : []);
  }, [p.chosen]);

  const { contextFields, paramFields } = useMemo(() => {
    const context: FieldDefinition[] = [];
    const params: FieldDefinition[] = [];
    for (const f of p.fields || []) {
      if (f.id === 'code') continue;
      if (f.id === 'screenId' || f.id === 'flowId') {
        context.push(f);
      } else if (!activeSlotKeys.has(f.id)) {
        params.push(f);
      }
    }
    return { contextFields: context, paramFields: params };
  }, [p.fields, activeSlotKeys]);

  return (
    <aside
      ref={root}
      className={'inspector-shell ' + (expanded ? 'expanded' : 'collapsed')}
      aria-label="Painel direito"
    >
      {expanded ? (
        <>
          <div className="inspector-heading">
            <button
              title="Recolher painel direito"
              aria-label="Recolher painel direito"
              aria-expanded="true"
              onClick={() => {
                setExpanded(false);
                setActive(null);
              }}
            >
              <PanelRightClose size={18} />
            </button>
            <span>Propriedades</span>
          </div>
          <div className="inspector-body">{p.children}</div>
        </>
      ) : (
        <nav className="inspector-rail" aria-label="Propriedades do bloco">
          <button
            title="Expandir painel direito"
            aria-label="Expandir painel direito"
            aria-expanded="false"
            onClick={() => {
              setExpanded(true);
              setActive(null);
            }}
          >
            <PanelRightOpen size={18} />
          </button>

          {p.chosen && def ? (
            <>
              <span className="inspector-rail-separator" />

              {/* 1. Modal de Propriedades do Bloco */}
              <div
                className="rail-item-wrapper"
                onMouseEnter={(e) =>
                  show('properties', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title={`Propriedades (${def.name || p.chosen.id})`}
                  aria-label={`Propriedades (${def.name || p.chosen.id})`}
                  aria-expanded={active === 'flyout' && activeTab === 'properties'}
                  aria-haspopup="dialog"
                  className={active === 'flyout' && activeTab === 'properties' ? 'active' : ''}
                  onClick={(e) => show('properties', e.currentTarget)}
                >
                  <SlidersHorizontal size={19} />
                </button>
              </div>

              {/* 2. Modal Separado de Conexões Feitas */}
              <div
                className="connections-trigger"
                onMouseEnter={(e) =>
                  show('connections', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title={`Conexões Feitas (${blockEdges.length})`}
                  aria-label={`Conexões Feitas (${blockEdges.length})`}
                  aria-expanded={active === 'flyout' && activeTab === 'connections'}
                  aria-haspopup="dialog"
                  className={active === 'flyout' && activeTab === 'connections' ? 'active' : ''}
                  onClick={(e) => show('connections', e.currentTarget)}
                >
                  <GitBranch size={20} />
                </button>
              </div>

              <div className="inspector-rail-bottom">
                <button title="Duplicar bloco" aria-label="Duplicar bloco" onClick={p.onDuplicate}>
                  <Copy size={18} />
                </button>
                <button title="Excluir bloco" aria-label="Excluir bloco" onClick={p.onDelete}>
                  <Trash2 size={18} />
                </button>
              </div>
            </>
          ) : (
            <button title="Selecione um bloco" aria-label="Selecione um bloco" disabled>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: '#6b7280' }}
              >
                widgets
              </span>
            </button>
          )}
        </nav>
      )}

      {/* Flyout Modal (Propriedades OU Conexões Feitas em modal separado) */}
      {!expanded && active && p.chosen && def && (
        <div
          className="inspector-flyout"
          role="dialog"
          aria-label={
            activeTab === 'connections'
              ? `Conexões feitas de ${def.name}`
              : `Propriedades de ${def.name}`
          }
          onMouseEnter={cancel}
          onMouseLeave={closeSoon}
        >
          {/* Cabeçalho do Flyout */}
          <div className="inspector-flyout-header">
            <div className="inspector-flyout-info">
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 20,
                  color: def.color || '#38bdf8',
                }}
              >
                {activeTab === 'connections' ? 'account_tree' : def.icon || 'tune'}
              </span>
              <div className="inspector-flyout-titles">
                <div className="inspector-flyout-sub">
                  <span>
                    {activeTab === 'connections'
                      ? `Conexões Feitas (${blockEdges.length})`
                      : def.category}
                  </span>
                  <span className="block-id-badge">#{p.chosen.id}</span>
                </div>
                <h3 className="inspector-flyout-title">{p.chosen.data.label || def.name}</h3>
              </div>
            </div>

            <button
              type="button"
              className="inspector-flyout-close"
              title="Fechar (Esc)"
              aria-label="Fechar"
              onClick={() => setActive(null)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo do Modal (Propriedades ou Lista de Conexões Feitas) */}
          <div className="inspector-flyout-body">
            {activeTab === 'properties' ? (
              // Modal exclusivo de Propriedades do Bloco
              <div className="inspector-card">
                <div className="inspector-card-body">
                  <div className="inspector-identity-grid">
                    {p.nameField && (
                      <label className="inspector-field">
                        <span className="inspector-field-label">Título do Bloco</span>
                        <input
                          type="text"
                          className="inspector-input"
                          value={p.nameField.value}
                          placeholder={def.name}
                          onChange={(e) => p.nameField?.onChange(e.target.value)}
                        />
                      </label>
                    )}

                    {p.graph && p.onRenameId && (
                      <BlockIdEditor chosen={p.chosen} graph={p.graph} onRename={p.onRenameId} />
                    )}
                  </div>

                  {contextFields.length > 0 && (
                    <div className="inspector-fields-grid cols-2">
                      {contextFields.map((field) => (
                        <PropertyField key={field.id} {...field} />
                      ))}
                    </div>
                  )}

                  {p.graph && p.onChangeConfig && (
                    <>
                      <div className="inspector-subdivider">Lógica & Código</div>
                      <BlockLogicBuilder
                        block={p.chosen}
                        graph={p.graph}
                        onChangeConfig={p.onChangeConfig}
                        onCreateAndBindBlock={p.onCreateAndBindBlock}
                        onApplyRecommendation={p.onApplyRecommendation}
                      />
                    </>
                  )}

                  {paramFields.length > 0 && (
                    <details className="inspector-more-options">
                      <summary className="inspector-more-summary">
                        Mais opções ({paramFields.length})
                      </summary>
                      <div className="inspector-fields-grid" style={{ marginTop: 8 }}>
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
                    </details>
                  )}

                  {p.onChangeConfig &&
                    (p.chosen.data.kind === 'condition' || p.chosen.data.kind === 'validator') && (
                      <div className="inspector-tool-subbox">
                        <LogicCatalogEditor block={p.chosen} onChange={p.onChangeConfig} />
                      </div>
                    )}

                  {p.graph &&
                    p.onChangeConfig &&
                    (p.chosen.data.kind === 'database' || p.chosen.data.kind === 'auth') &&
                    p.chosen.data.config.mode !== 'real' &&
                    p.chosen.data.config.execution !== 'real' && (
                      <DatabaseManager block={p.chosen} onChange={p.onChangeConfig} />
                    )}

                  {p.graph &&
                    p.onChangeConfig &&
                    (p.chosen.data.kind === 'api' || p.chosen.data.kind === 'httpConnection') && (
                      <HttpRequestTools
                        block={p.chosen}
                        graph={p.graph}
                        onChangeConfig={p.onChangeConfig}
                      />
                    )}
                </div>
              </div>
            ) : (
              // Modal separado da Lista de Conexões Feitas (apenas visualização de onde sai e onde chega)
              <div className="inspector-card">
                <div className="inspector-card-body">
                  {p.connections ? (
                    p.connections
                  ) : p.graph ? (
                    <EdgeList
                      graph={p.graph}
                      block={p.chosen}
                      edges={blockEdges}
                      onRemoveEdge={p.onRemoveEdge}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
