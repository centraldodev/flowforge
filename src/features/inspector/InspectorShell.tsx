import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Code,
  Copy,
  GitBranch,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  X,
} from 'lucide-react';
import type { Connection } from '@xyflow/react';
import type { FieldDefinition } from '../../components/PropertyField';
import { catalog, getEdgeGeneratedCode, type Block, type Graph } from '../../engine';
import { BlockCodeEditor } from './BlockCodeEditor';
import { BlockIdEditor } from './BlockIdEditor';

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
};

export function InspectorShell(p: Props) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'connections' | 'all'>('code');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
  }

  function show(tab: 'code' | 'connections' | 'all', trigger?: HTMLButtonElement) {
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
            <span>Propriedades & Código</span>
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

              {/* Botão de Código Backend do Bloco */}
              <div
                className="rail-item-wrapper"
                onMouseEnter={(e) =>
                  show('code', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title={`Código Backend (${def.name || p.chosen.id})`}
                  aria-label={`Código Backend (${def.name || p.chosen.id})`}
                  aria-expanded={active === 'flyout' && activeTab === 'code'}
                  aria-haspopup="dialog"
                  className={active === 'flyout' && activeTab === 'code' ? 'active' : ''}
                  onClick={(e) => show('code', e.currentTarget)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 20,
                      color: def.color || '#38bdf8',
                    }}
                  >
                    {def.icon || 'code'}
                  </span>
                </button>
              </div>

              {/* Botão de Conexões Feitas */}
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

              {/* Botão de Painel Completo */}
              <div
                className="rail-item-wrapper"
                onMouseEnter={(e) =>
                  show('all', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title={`Painel Completo (${def.name})`}
                  aria-label={`Painel Completo (${def.name})`}
                  aria-expanded={active === 'flyout' && activeTab === 'all'}
                  aria-haspopup="dialog"
                  className={active === 'flyout' && activeTab === 'all' ? 'active' : ''}
                  onClick={(e) => show('all', e.currentTarget)}
                >
                  <Layers size={19} />
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

      {/* Flyout Modal quando o menu direito está recolhido / oculto */}
      {!expanded && active && p.chosen && def && (
        <div
          className="inspector-flyout"
          role="dialog"
          aria-label={`Código e conexões de ${def.name}`}
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
                {def.icon || 'code'}
              </span>
              <div className="inspector-flyout-titles">
                <div className="inspector-flyout-sub">
                  <span>{def.category}</span>
                  <span className="block-id-badge">#{p.chosen.id}</span>
                </div>
                <h3 className="inspector-flyout-title">{def.name}</h3>
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

          {/* Abas Rápidas no Topo do Modal */}
          <div className="inspector-flyout-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'code'}
              className={`inspector-flyout-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <Code size={13} />
              <span>Código Backend</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'connections'}
              className={`inspector-flyout-tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              <GitBranch size={13} />
              <span>Conexões ({blockEdges.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`inspector-flyout-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Layers size={13} />
              <span>Completo</span>
            </button>
          </div>

          {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
          <div className="inspector-flyout-body">
            {activeTab === 'all' ? (
              // Modo Completo: renderiza o InspectorPanel
              p.children
            ) : activeTab === 'code' ? (
              // Modo Código: Título, ID, Editor com valores editáveis e templates, e Ações
              <>
                {p.nameField && (
                  <div className="block-label-bar">
                    <span className="label-title">Título:</span>
                    <input
                      type="text"
                      className="block-label-input"
                      value={p.nameField.value}
                      placeholder={def.name}
                      onChange={(e) => p.nameField?.onChange(e.target.value)}
                    />
                  </div>
                )}

                {p.graph && p.onRenameId && (
                  <BlockIdEditor chosen={p.chosen} graph={p.graph} onRename={p.onRenameId} />
                )}

                <div className="form-separator">CÓDIGO DO BLOCO (BACKEND)</div>

                {p.graph && p.onChangeConfig && (
                  <BlockCodeEditor
                    block={p.chosen}
                    graph={p.graph}
                    onChangeConfig={p.onChangeConfig}
                    onConnect={p.onConnect}
                    onRemoveEdge={p.onRemoveEdge}
                    onUpdateEdgeCallArg={p.onUpdateEdgeCallArg}
                  />
                )}

                <div className="block-actions" style={{ marginTop: 14 }}>
                  <button type="button" className="secondary" onClick={p.onDuplicate}>
                    <Copy size={14} /> Duplicar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    title="Excluir bloco"
                    onClick={p.onDelete}
                  >
                    <Trash2 size={15} /> Excluir
                  </button>
                </div>
              </>
            ) : (
              // Modo Conexões Feitas: Lista de conexões ativas com código gerado e desconexão
              <>
                <div className="form-separator">CONEXÕES FEITAS</div>

                <div className="inspector-active-connections">
                  {blockEdges.length === 0 ? (
                    <p className="subtle" style={{ margin: '6px 0', fontSize: 11 }}>
                      Nenhuma conexão feita neste bloco ainda. Conecte pelo dropdown no código ou
                      arraste o cabo no canvas.
                    </p>
                  ) : (
                    <div className="connections-card-list">
                      {blockEdges.map((e) => {
                        const isSource = e.source === p.chosen!.id;
                        const otherId = isSource ? e.target : e.source;
                        const otherNode = p.graph?.nodes.find((n) => n.id === otherId);
                        const otherLabel = otherNode?.data.label || otherId;
                        const otherKind = otherNode?.data.kind;
                        const otherDef = otherKind ? catalog[otherKind] : undefined;
                        const edgeCode = p.graph ? getEdgeGeneratedCode(p.graph, p.chosen!, e) : '';
                        const isNestedCondition = isSource && otherKind === 'condition';

                        return (
                          <div className="connection-block-card" key={e.id}>
                            <div className="connection-card-header">
                              <div className="connection-card-title">
                                {otherDef && (
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: 15, color: otherDef.color }}
                                  >
                                    {otherDef.icon}
                                  </span>
                                )}
                                <span className="other-node-label">{otherLabel}</span>
                                <span className="other-node-id">#{otherId}</span>
                              </div>
                              <button
                                type="button"
                                className="connection-remove-btn"
                                title="Desconectar fio"
                                onClick={() => p.onRemoveEdge?.(e.id)}
                              >
                                <X size={13} />
                              </button>
                            </div>

                            <div className="connection-card-ports">
                              <span className="port-badge">
                                {isSource ? 'saída' : 'origem'}:{' '}
                                <code>{e.sourceHandle || 'padrão'}</code>
                              </span>
                              <span className="port-divider">➔</span>
                              <span className="port-badge">
                                {isSource ? 'destino' : 'entrada'}:{' '}
                                <code>{e.targetHandle || 'padrão'}</code>
                              </span>
                              {isNestedCondition && (
                                <span className="nested-if-badge">If dentro de If</span>
                              )}
                            </div>

                            <div className="connection-code-snippet">
                              <pre className="connection-code-pre">
                                <code>{edgeCode}</code>
                              </pre>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="block-actions" style={{ marginTop: 14 }}>
                  <button type="button" className="secondary" onClick={p.onDuplicate}>
                    <Copy size={14} /> Duplicar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    title="Excluir bloco"
                    onClick={p.onDelete}
                  >
                    <Trash2 size={15} /> Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
