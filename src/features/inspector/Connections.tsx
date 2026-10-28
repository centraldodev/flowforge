import type { Connection } from '@xyflow/react';
import type { Block, CustomPort, Graph, ScreenRoute } from '../../engine';
import { EdgeList } from './EdgeList';

type Props = {
  graph: Graph;
  chosen: Block | undefined;
  onUpdateRoutes?: (routes: ScreenRoute[]) => void;
  onRemoveEdge?: (id: string) => void;
  onAddPort?: (port: CustomPort) => void;
  onRemovePort?: (portId: string) => void;
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
  onConnect?: (c: Connection & { data?: { callArg?: string } }) => void;
};

/** Visualizador enxuto das conexões feitas no bloco (somente de onde sai e onde chega). */
export function Connections({ graph, chosen, onRemoveEdge }: Props) {
  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);

  return (
    <div className="connections-manager">
      <EdgeList graph={graph} block={chosen} edges={blockEdges} onRemoveEdge={onRemoveEdge} />
    </div>
  );
}
