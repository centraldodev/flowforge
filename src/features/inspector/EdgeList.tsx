import { Code, CornerDownRight, X } from 'lucide-react';
import { catalog, getEdgeGeneratedCode, type Block, type Graph } from '../../engine';

type Props = {
  graph: Graph;
  block: Block;
  edges: Graph['edges'];
  onRemoveEdge: (id: string) => void;
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
};

/** Fios ligados ao bloco no canvas, exibindo código real gerado e argumentos de chamada. */
export function EdgeList({ graph, block, edges, onRemoveEdge, onUpdateEdgeCallArg }: Props) {
  return (
    <div className="active-edges-section">
      <div className="section-title">
        <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Code size={14} style={{ color: '#38bdf8' }} /> Conexões & Código Real
        </strong>
        <span className="badge-count">{edges.length}</span>
      </div>

      {edges.length === 0 ? (
        <p className="subtle" style={{ margin: '6px 0', fontSize: 11.5 }}>
          Nenhum bloco conectado a este no momento.
        </p>
      ) : (
        <div className="connections-card-list">
          {edges.map((e) => {
            const isSource = e.source === block.id;
            const otherId = isSource ? e.target : e.source;
            const otherNode = graph.nodes.find((n) => n.id === otherId);
            const otherLabel = otherNode?.data.label || otherId;
            const otherKind = otherNode?.data.kind;
            const otherDef = otherKind ? catalog[otherKind] : undefined;
            const edgeCode = getEdgeGeneratedCode(graph, block, e);
            const isNestedCondition = isSource && otherKind === 'condition';

            return (
              <div
                className={`connection-block-card ${isSource ? 'outgoing' : 'incoming'} ${
                  isNestedCondition ? 'nested-condition' : ''
                }`}
                key={e.id}
              >
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
                    title="Desconectar e remover código deste bloco"
                    aria-label={'Desconectar de ' + otherLabel}
                    onClick={() => onRemoveEdge(e.id)}
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="connection-card-ports">
                  <CornerDownRight size={12} className="port-arrow-icon" />
                  <span className="port-badge source">
                    {isSource ? 'saída' : 'origem'}: <code>{e.sourceHandle || 'padrão'}</code>
                  </span>
                  <span className="port-divider">➔</span>
                  <span className="port-badge target">
                    {isSource ? 'destino' : 'entrada'}: <code>{e.targetHandle || 'padrão'}</code>
                  </span>
                  {isNestedCondition && (
                    <span className="nested-if-badge" title="Condição aninhada dentro deste bloco">
                      If dentro de If
                    </span>
                  )}
                </div>

                {/* Código Real da Chamada / Conexão */}
                <div className="connection-code-snippet">
                  <div className="connection-code-header">
                    <span>
                      {isSource ? 'Código injetado no bloco:' : `Chamado por ${otherLabel}:`}
                    </span>
                    <span className="code-lang-tag">JS</span>
                  </div>
                  <pre className="connection-code-pre">
                    <code>{edgeCode}</code>
                  </pre>
                </div>

                {/* Edição de Argumento / Valor passado na conexão */}
                {isSource && onUpdateEdgeCallArg && (
                  <div className="connection-arg-wrap">
                    <span className="connection-arg-label" title="Valor ou expressão de argumento">
                      argumento:
                    </span>
                    <input
                      type="text"
                      className="connection-arg-input"
                      value={(e.data?.callArg as string) ?? ''}
                      placeholder={
                        isNestedCondition
                          ? 'ex: valor3'
                          : block.data.kind === 'condition'
                            ? e.sourceHandle === 'true'
                              ? 'ex: valor3'
                              : 'ex: "Texto personalizado"'
                            : 'ex: valor, payload, { id: 1 }'
                      }
                      onChange={(ev) => onUpdateEdgeCallArg(e.id, ev.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
