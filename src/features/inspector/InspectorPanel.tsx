import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Copy, Trash2, Workflow, X } from 'lucide-react';
import type { Connection } from '@xyflow/react';
import type { FieldDefinition } from '../../components/PropertyField';
import { catalog, getEdgeGeneratedCode, type Block, type Graph } from '../../engine';
import { BlockCodeEditor } from './BlockCodeEditor';
import { BlockIdEditor } from './BlockIdEditor';

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
};

export function InspectorPanel({
  chosen,
  graph,
  nameField,
  onChangeConfig,
  onRenameId,
  onDuplicate,
  onDelete,
  onConnect,
  onRemoveEdge,
  onUpdateEdgeCallArg,
}: Props) {
  // Arestas conectadas a este bloco
  const blockEdges = useMemo(() => {
    if (!graph || !chosen) return [];
    return graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);
  }, [graph, chosen]);

  if (!chosen) {
    return (
      <div className="inspector">
        <div className="empty">
          <Workflow size={28} />
          <h3>Nenhum bloco selecionado</h3>
          <p>Selecione um bloco no canvas para editar o código e conexões.</p>
        </div>
      </div>
    );
  }

  const def = catalog[chosen.data.kind];

  return (
    <div className="inspector">
      <div className="inspector-content">
        {/* 1. Cabeçalho de Tipo e Identidade */}
        <div className="selected-kind">
          <span style={{ '--kind-color': def.color } as CSSProperties}>
            <span className="material-symbols-outlined">{def.icon}</span>
          </span>
          <div>
            <div className="kind-header-top">
              <small>{def.category}</small>
              <span className="block-id-badge" title={'ID: ' + chosen.id}>
                #{chosen.id}
              </span>
            </div>
            <h2>{def.name}</h2>
          </div>
        </div>

        {/* Editor de Nome / Rótulo e ID */}
        {nameField && (
          <div className="block-label-bar">
            <span className="label-title">Título:</span>
            <input
              type="text"
              className="block-label-input"
              value={nameField.value}
              placeholder={def.name}
              onChange={(e) => nameField.onChange(e.target.value)}
            />
          </div>
        )}

        {graph && onRenameId && (
          <BlockIdEditor chosen={chosen} graph={graph} onRename={onRenameId} />
        )}

        {/* 2. Código do Bloco (Backend) com Valores Editáveis e Dropdown de Conexão */}
        <div className="form-separator">CÓDIGO DO BLOCO (BACKEND)</div>

        {graph && onChangeConfig && (
          <BlockCodeEditor
            block={chosen}
            graph={graph}
            onChangeConfig={onChangeConfig}
            onConnect={onConnect}
            onRemoveEdge={onRemoveEdge}
            onUpdateEdgeCallArg={onUpdateEdgeCallArg}
          />
        )}

        {/* 3. Conexões Feitas (Ligações no Canvas) */}
        <div className="form-separator" style={{ marginTop: 16 }}>
          CONEXÕES FEITAS
        </div>

        <div className="inspector-active-connections">
          {blockEdges.length === 0 ? (
            <p className="subtle" style={{ margin: '6px 0', fontSize: 11 }}>
              Nenhuma conexão feita neste bloco ainda. Conecte pelo dropdown no código acima ou
              arraste o cabo no canvas.
            </p>
          ) : (
            <div className="connections-card-list">
              {blockEdges.map((e) => {
                const isSource = e.source === chosen.id;
                const otherId = isSource ? e.target : e.source;
                const otherNode = graph?.nodes.find((n) => n.id === otherId);
                const otherLabel = otherNode?.data.label || otherId;
                const otherKind = otherNode?.data.kind;
                const otherDef = otherKind ? catalog[otherKind] : undefined;
                const edgeCode = graph ? getEdgeGeneratedCode(graph, chosen, e) : '';
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
                        onClick={() => onRemoveEdge?.(e.id)}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="connection-card-ports">
                      <span className="port-badge">
                        {isSource ? 'saída' : 'origem'}: <code>{e.sourceHandle || 'padrão'}</code>
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

        {/* 4. Ações Finais: Duplicar e Excluir */}
        <div className="block-actions" style={{ marginTop: 18 }}>
          <button type="button" className="secondary" onClick={onDuplicate}>
            <Copy size={14} /> Duplicar
          </button>
          <button type="button" className="danger" title="Excluir bloco" onClick={onDelete}>
            <Trash2 size={15} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
