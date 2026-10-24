import { X } from 'lucide-react';
import type { Block, Graph } from '../../engine';

type Props = {
  graph: Graph;
  block: Block;
  edges: Graph['edges'];
  onRemoveEdge: (id: string) => void;
};

/** Fios ligados ao bloco no canvas, com opção de desconectar. */
export function EdgeList({ graph, block, edges, onRemoveEdge }: Props) {
  return (
    <div className="active-edges-section">
      <div className="section-title">
        <strong>Ligações no Canvas</strong>
        <span className="badge-count">{edges.length}</span>
      </div>

      {edges.length === 0 ? (
        <p className="subtle">Nenhum fio conectado a este bloco no momento.</p>
      ) : (
        edges.map((e) => {
          const isSource = e.source === block.id;
          const otherId = isSource ? e.target : e.source;
          const otherLabel = graph.nodes.find((n) => n.id === otherId)?.data.label || 'Bloco';

          return (
            <div className="connection-row" key={e.id}>
              <span>
                <strong>{otherLabel}</strong>
                <small>
                  {isSource ? 'saída' : 'entrada'}:{' '}
                  <code>{isSource ? e.sourceHandle : e.targetHandle}</code> →{' '}
                  <code>{isSource ? e.targetHandle : e.sourceHandle}</code>
                </small>
              </span>
              <button
                type="button"
                title="Desconectar fio"
                aria-label={'Desconectar de ' + otherLabel}
                onClick={() => onRemoveEdge(e.id)}
              >
                <X size={13} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
