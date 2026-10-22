import type { Edge } from '@xyflow/react';
import { isExecOutput, screenRoutes, type Graph, type Trace } from '../../engine';
import type { FlowNode } from './BlockNode';

const EXEC_COLOR = '#ac9eff';
const DATA_COLOR = '#5e9eaf';
const ROUTE_COLOR = '#8ecfb4';

export function toFlowNodes(g: Graph, selected: string | null): FlowNode[] {
  return g.nodes.map((n) => ({ ...n, type: 'block' as const, selected: n.id === selected }));
}

/** Conexões do grafo + linhas tracejadas (somente leitura) das transições entre telas. */
export function toFlowEdges(g: Graph, trace: Trace[]): Edge[] {
  const edges: Edge[] = g.edges.map((e) => ({
    ...e,
    type: 'smoothstep',
    animated: trace.some((t) => t.id === e.source),
    style: { stroke: isExecOutput(e.sourceHandle) ? EXEC_COLOR : DATA_COLOR, strokeWidth: 1.7 },
    label: e.sourceHandle === 'true' ? 'true' : e.sourceHandle === 'false' ? 'false' : undefined,
  }));

  for (const page of g.nodes.filter((n) => n.data.kind === 'screen')) {
    for (const route of screenRoutes(page)) {
      if (!g.nodes.some((n) => n.id === route.target)) continue;
      const trigger = g.nodes.find((n) => n.id === route.trigger)?.data.label || 'Evento';
      edges.push({
        id: 'route:' + page.id + ':' + route.id,
        source: page.id,
        target: route.target,
        sourceHandle: 'routes',
        targetHandle: 'exec',
        type: 'smoothstep',
        deletable: false,
        selectable: false,
        style: { stroke: ROUTE_COLOR, strokeWidth: 2, strokeDasharray: '5 5' },
        label: trigger + ' · ' + (route.when === 'always' ? 'always' : route.when),
      });
    }
  }
  return edges;
}
