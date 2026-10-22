import { X } from 'lucide-react';
import type { Block, Graph, ScreenRoute } from '../../engine';
import { ScreenTransitions } from './ScreenTransitions';

type Props = {
  graph: Graph;
  chosen: Block | undefined;
  onUpdateRoutes: (routes: ScreenRoute[]) => void;
  onRemoveEdge: (id: string) => void;
};

export function Connections({ graph, chosen, onUpdateRoutes, onRemoveEdge }: Props) {
  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  if (chosen.data.kind === 'screen') {
    return <ScreenTransitions graph={graph} screen={chosen} onChange={onUpdateRoutes} />;
  }

  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);

  if (blockEdges.length === 0) {
    return (
      <p className="subtle">Este bloco ainda não tem conexões. Conecte suas portas no canvas.</p>
    );
  }

  return (
    <>
      {blockEdges.map((e) => {
        const otherId = e.source === chosen.id ? e.target : e.source;
        const otherNode = graph.nodes.find((n) => n.id === otherId);
        const otherLabel = otherNode?.data.label || 'Bloco';

        return (
          <div className="connection-row" key={e.id}>
            <span>
              {otherLabel}
              <small>
                {e.sourceHandle} → {e.targetHandle}
              </small>
            </span>
            <button
              title="Remover conexão"
              aria-label={'Remover conexão com ' + otherLabel}
              onClick={() => onRemoveEdge(e.id)}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </>
  );
}
