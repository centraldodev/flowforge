import { GitBranch, X } from 'lucide-react';
import { catalog, type Block, type Graph } from '../../engine';

type Props = {
  graph: Graph;
  block: Block;
  edges: Graph['edges'];
  onRemoveEdge?: (id: string) => void;
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
};

/** Visualização direta e limpa das conexões feitas: somente de onde sai e onde chega. */
export function EdgeList({ graph, block, edges, onRemoveEdge }: Props) {
  if (edges.length === 0) {
    return (
      <div className="inspector-empty-state">
        <GitBranch size={15} />
        <span>Nenhuma conexão feita neste bloco.</span>
      </div>
    );
  }

  return (
    <div className="connections-card-list">
      {edges.map((e) => {
        const sourceNode = graph.nodes.find((n) => n.id === e.source);
        const targetNode = graph.nodes.find((n) => n.id === e.target);

        const sourceDef = sourceNode ? catalog[sourceNode.data.kind] : undefined;
        const targetDef = targetNode ? catalog[targetNode.data.kind] : undefined;

        const sourceLabel = sourceNode?.data.label || e.source;
        const targetLabel = targetNode?.data.label || e.target;

        const isCurrentSource = e.source === block.id;

        return (
          <div className="connection-simple-row" key={e.id}>
            <div className="connection-simple-flow">
              {/* De onde sai (Origem) */}
              <div className={`connection-simple-node ${isCurrentSource ? 'is-current' : ''}`}>
                {sourceDef && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 15, color: sourceDef.color }}
                  >
                    {sourceDef.icon}
                  </span>
                )}
                <div className="connection-simple-node-text">
                  <strong>{sourceLabel}</strong>
                  <code>.{e.sourceHandle || 'out'}</code>
                </div>
              </div>

              <span className="connection-simple-arrow">➔</span>

              {/* Onde chega (Destino) */}
              <div className={`connection-simple-node ${!isCurrentSource ? 'is-current' : ''}`}>
                {targetDef && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 15, color: targetDef.color }}
                  >
                    {targetDef.icon}
                  </span>
                )}
                <div className="connection-simple-node-text">
                  <strong>{targetLabel}</strong>
                  <code>.{e.targetHandle || 'in'}</code>
                </div>
              </div>
            </div>

            {onRemoveEdge && (
              <button
                type="button"
                className="connection-remove-btn"
                title="Remover conexão"
                aria-label="Remover conexão"
                onClick={() => onRemoveEdge(e.id)}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
