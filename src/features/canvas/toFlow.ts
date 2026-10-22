import type { Edge } from '@xyflow/react';
import { isExecOutput, screenRoutes, type Graph, type Trace } from '../../engine';
import type { FlowNode } from './BlockNode';

const EXEC_COLOR = '#818cf8';
const DATA_COLOR = '#38bdf8';
const SUCCESS_COLOR = '#22c55e';
const ERROR_COLOR = '#ef4444';
const ROUTE_COLOR = '#8ecfb4';

export function toFlowNodes(g: Graph, selected: string | null): FlowNode[] {
  return g.nodes.map((n) => ({ ...n, type: 'block' as const, selected: n.id === selected }));
}

/** Conexões do grafo com identificação visual de eventos (onClick, onSuccess, onError, true, false, dados). */
export function toFlowEdges(g: Graph, trace: Trace[]): Edge[] {
  const edges: Edge[] = g.edges.map((e) => {
    let stroke = isExecOutput(e.sourceHandle) ? EXEC_COLOR : DATA_COLOR;
    let label: string | undefined = undefined;
    let labelStyle: Record<string, unknown> | undefined = undefined;
    let labelBgStyle: Record<string, unknown> | undefined = undefined;

    const sHandle = e.sourceHandle || '';
    const tHandle = e.targetHandle || '';

    if (sHandle === 'onSuccess') {
      stroke = SUCCESS_COLOR;
      label = 'onSuccess';
      labelStyle = { fill: '#4ade80', fontWeight: 600, fontSize: 10 };
      labelBgStyle = { fill: '#14532d', fillOpacity: 0.9, rx: 6, ry: 6 };
    } else if (sHandle === 'onError') {
      stroke = ERROR_COLOR;
      label = 'onError';
      labelStyle = { fill: '#f87171', fontWeight: 600, fontSize: 10 };
      labelBgStyle = { fill: '#7f1d1d', fillOpacity: 0.9, rx: 6, ry: 6 };
    } else if (sHandle === 'onClick' && tHandle === 'trigger') {
      label = 'onClick → trigger';
      labelStyle = { fill: '#a5b4fc', fontWeight: 500, fontSize: 10 };
      labelBgStyle = { fill: '#1e1b4b', fillOpacity: 0.85, rx: 6, ry: 6 };
    } else if (sHandle === 'true') {
      stroke = SUCCESS_COLOR;
      label = 'true';
      labelStyle = { fill: '#4ade80', fontWeight: 600, fontSize: 10 };
      labelBgStyle = { fill: '#14532d', fillOpacity: 0.9, rx: 6, ry: 6 };
    } else if (sHandle === 'false') {
      stroke = ERROR_COLOR;
      label = 'false';
      labelStyle = { fill: '#f87171', fontWeight: 600, fontSize: 10 };
      labelBgStyle = { fill: '#7f1d1d', fillOpacity: 0.9, rx: 6, ry: 6 };
    } else if (sHandle === 'onComplete') {
      stroke = SUCCESS_COLOR;
    }

    return {
      ...e,
      type: 'smoothstep',
      animated: trace.some((t) => t.id === e.source),
      style: { stroke, strokeWidth: 1.8 },
      label,
      labelStyle,
      labelBgStyle,
      labelBgPadding: [6, 4] as [number, number],
    };
  });

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
