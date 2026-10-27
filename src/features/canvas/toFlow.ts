import type { Edge } from '@xyflow/react';
import { isExecOutput, screenRoutes, type Block, type Graph, type Trace } from '../../engine';
import type { FlowNode } from './BlockNode';
import type { DebugFrame } from '../../compiler';
import { resolveBlockFlow, type FlowStage } from './constants';

const EXEC_COLOR = '#818cf8';
const DATA_COLOR = '#38bdf8';
const SUCCESS_COLOR = '#22c55e';
const ERROR_COLOR = '#ef4444';
const ROUTE_COLOR = '#8ecfb4';

export type DebugNodeOptions = {
  breakpoints?: string[];
  currentBlockId?: string | null;
  status?: string;
  onToggleBreakpoint?: (id: string) => void;
  activeFrame?: DebugFrame | null;
};

/**
 * Retorna os nós visíveis para a aba de tela ativa.
 * A própria tela ativa é gerenciada pelas abas superiores (não renderizada como bloco na área do canvas).
 * Telas de destino conectadas aparecem no topo como abas receptoras de conexão.
 */
export function toFlowNodes(
  g: Graph,
  selected: string | null,
  activeScreenId?: string,
  debugOptions?: DebugNodeOptions,
  selectedEdgeInfo?: { source: string; target: string } | null,
): FlowNode[] {
  const allScreens = g.nodes.filter((n) => n.data.kind === 'screen');
  const currentScreenId =
    activeScreenId && allScreens.some((s) => s.id === activeScreenId)
      ? activeScreenId
      : allScreens[0]?.id;

  const buildNodeData = (n: Block) => {
    const hasBreakpoint = Boolean(debugOptions?.breakpoints?.includes(n.id));
    const isPausedHere = debugOptions?.status === 'paused' && debugOptions?.currentBlockId === n.id;
    const isExecuting = debugOptions?.status === 'running' && debugOptions?.currentBlockId === n.id;
    const debugPayload =
      debugOptions?.activeFrame?.blockId === n.id
        ? {
            inputs: debugOptions.activeFrame.inputs,
            outputs: debugOptions.activeFrame.outputs,
          }
        : undefined;

    const isConnectionSource = selectedEdgeInfo?.source === n.id;
    const isConnectionTarget = selectedEdgeInfo?.target === n.id;
    const isConnectionDimmed = Boolean(
      selectedEdgeInfo && !isConnectionSource && !isConnectionTarget,
    );
    const connectionRole = isConnectionSource
      ? ('source' as const)
      : isConnectionTarget
        ? ('target' as const)
        : null;

    return {
      ...n.data,
      flows: g.flows,
      hasBreakpoint,
      isPausedHere,
      isExecuting,
      onToggleBreakpoint: debugOptions?.onToggleBreakpoint,
      connectionRole,
      isConnectionDimmed,
      debugPayload,
    };
  };

  if (!currentScreenId) {
    return g.nodes.map((n) => ({
      ...n,
      data: buildNodeData(n),
      type: 'block' as const,
      selected: n.id === selected,
    }));
  }

  // 1. Identifica blocos que pertencem a esta aba/tela (inclui a tela de origem como início do fluxo)
  const activeBlockIds = new Set<string>();
  for (const n of g.nodes) {
    if (n.data.kind === 'httpConnection') {
      activeBlockIds.add(n.id);
      continue;
    }
    if (n.id === currentScreenId) {
      activeBlockIds.add(n.id);
      continue;
    }
    if (n.data.kind === 'screen') continue;
    if (n.data.config.screenId === currentScreenId) {
      activeBlockIds.add(n.id);
    }
  }

  // Propaga para blocos de lógica conectados sem tela explicitada
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const e of g.edges) {
      if (activeBlockIds.has(e.source)) {
        const target = g.nodes.find((n) => n.id === e.target);
        if (
          target &&
          target.data.kind !== 'screen' &&
          !target.data.config.screenId &&
          !activeBlockIds.has(e.target)
        ) {
          activeBlockIds.add(e.target);
          expanded = true;
        }
      }
      if (activeBlockIds.has(e.target)) {
        const source = g.nodes.find((n) => n.id === e.source);
        if (
          source &&
          source.data.kind !== 'screen' &&
          !source.data.config.screenId &&
          !activeBlockIds.has(e.source)
        ) {
          activeBlockIds.add(e.source);
          expanded = true;
        }
      }
    }
  }

  // 2. Telas de destino (outras telas do projeto disponíveis para receber conexões no topo)
  const targetScreenIds = new Set<string>();
  for (const s of allScreens) {
    if (s.id !== currentScreenId) {
      targetScreenIds.add(s.id);
    }
  }

  // Monta nós visíveis (blocos da tela ativa + abas de telas de destino)
  const visibleNodes = g.nodes.filter((n) => activeBlockIds.has(n.id) || targetScreenIds.has(n.id));

  return visibleNodes.map((n) => ({
    ...n,
    data: buildNodeData(n),
    type: 'block' as const,
    selected: n.id === selected,
  }));
}

/**
 * Filtra nós visíveis e gera o conjunto de IDs de nós para exibição de um fluxo específico.
 * Se activeFlowId for nulo, todos os nós recebidos permanecem visíveis.
 */
export function filterFlowElements(
  nodes: FlowNode[],
  graph: Graph,
  flows: FlowStage[],
  activeFlowId: string | null,
): { nodes: FlowNode[]; visibleNodeIds: Set<string> } {
  if (!activeFlowId) {
    return {
      nodes,
      visibleNodeIds: new Set(nodes.map((n) => n.id)),
    };
  }

  const filteredNodes = nodes.filter((n) => {
    const block = graph.nodes.find((bn) => bn.id === n.id);
    if (!block) return false;
    const { flow } = resolveBlockFlow(flows, block.data.kind, block.id, block.data.config?.flowId);
    return flow.id === activeFlowId;
  });

  return {
    nodes: filteredNodes,
    visibleNodeIds: new Set(filteredNodes.map((n) => n.id)),
  };
}

/** Conexões do grafo com identificação visual de eventos (onClick, onSuccess, onError, true, false, dados). */
export function toFlowEdges(
  g: Graph,
  trace: Trace[],
  visibleNodeIds?: Set<string>,
  activeFrame?: DebugFrame | null,
  selectedEdgeId?: string | null,
): Edge[] {
  const edgesList = visibleNodeIds
    ? g.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
    : g.edges;

  const hasSelection = Boolean(selectedEdgeId);

  const edges: Edge[] = edgesList.map((e) => {
    let stroke = isExecOutput(e.sourceHandle) ? EXEC_COLOR : DATA_COLOR;
    let label: string | undefined = undefined;
    let labelStyle: Record<string, unknown> | undefined = undefined;
    let labelBgStyle: Record<string, unknown> | undefined = undefined;

    const sHandle = e.sourceHandle || '';
    const tHandle = e.targetHandle || '';

    if (sHandle === 'connection' && tHandle === 'connection') {
      stroke = '#eab308';
      label = 'Conexão HTTP';
    } else if (sHandle === 'onSuccess') {
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

    const isConnectedToActiveBlock =
      activeFrame && (e.source === activeFrame.blockId || e.target === activeFrame.blockId);
    if (isConnectedToActiveBlock) {
      stroke = '#38bdf8';
    }

    const isSelected = e.id === selectedEdgeId;

    if (hasSelection) {
      if (isSelected) {
        if (!label) {
          const srcNode = g.nodes.find((n) => n.id === e.source);
          const tgtNode = g.nodes.find((n) => n.id === e.target);
          const srcName = srcNode?.data.label || srcNode?.data.kind || e.sourceHandle || 'Origem';
          const tgtName = tgtNode?.data.label || tgtNode?.data.kind || e.targetHandle || 'Destino';
          label = `${srcName} ➔ ${tgtName}`;
        }
        labelStyle = {
          fill: '#ffffff',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.02em',
        };
        labelBgStyle = {
          fill: '#0f172a',
          stroke: stroke,
          strokeWidth: 2,
          fillOpacity: 0.98,
          rx: 8,
          ry: 8,
        };

        return {
          ...e,
          type: 'smoothstep',
          animated: true,
          selected: true,
          zIndex: 1000,
          className: 'selected-edge-highlight',
          style: {
            stroke,
            strokeWidth: 4,
            opacity: 1,
            filter: `drop-shadow(0 0 6px ${stroke}) drop-shadow(0 0 2px ${stroke})`,
          },
          label,
          labelStyle,
          labelBgStyle,
          labelBgPadding: [8, 5] as [number, number],
        };
      } else {
        // Demais linhas ficam cinzas claras/apagadas
        return {
          ...e,
          type: 'smoothstep',
          animated: false,
          selected: false,
          zIndex: 0,
          className: 'selected-edge-dimmed',
          style: {
            stroke: '#64748b',
            strokeWidth: 1.4,
            opacity: 0.22,
          },
          label: undefined,
        };
      }
    }

    return {
      ...e,
      type: 'smoothstep',
      animated: trace.some((t) => t.id === e.source) || Boolean(isConnectedToActiveBlock),
      style: {
        stroke,
        strokeWidth: isConnectedToActiveBlock ? 2.6 : 1.8,
        filter: isConnectedToActiveBlock ? 'drop-shadow(0 0 4px #38bdf8)' : undefined,
      },
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
      const edgeId = 'route:' + page.id + ':' + route.id;
      const isRouteSelected = edgeId === selectedEdgeId;

      if (hasSelection) {
        if (isRouteSelected) {
          edges.push({
            id: edgeId,
            source: page.id,
            target: route.target,
            sourceHandle: 'routes',
            targetHandle: 'exec',
            type: 'smoothstep',
            deletable: false,
            selectable: true,
            selected: true,
            zIndex: 1000,
            className: 'selected-edge-highlight',
            animated: true,
            style: {
              stroke: ROUTE_COLOR,
              strokeWidth: 4,
              strokeDasharray: '6 4',
              opacity: 1,
              filter: `drop-shadow(0 0 6px ${ROUTE_COLOR}) drop-shadow(0 0 2px ${ROUTE_COLOR})`,
            },
            label: trigger + ' · ' + (route.when === 'always' ? 'always' : route.when),
            labelStyle: { fill: '#ffffff', fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: '#0f172a', stroke: ROUTE_COLOR, strokeWidth: 2, rx: 8, ry: 8 },
          });
        } else {
          edges.push({
            id: edgeId,
            source: page.id,
            target: route.target,
            sourceHandle: 'routes',
            targetHandle: 'exec',
            type: 'smoothstep',
            deletable: false,
            selectable: true,
            selected: false,
            zIndex: 0,
            className: 'selected-edge-dimmed',
            style: { stroke: '#64748b', strokeWidth: 1.4, strokeDasharray: '5 5', opacity: 0.22 },
            label: undefined,
          });
        }
      } else {
        edges.push({
          id: edgeId,
          source: page.id,
          target: route.target,
          sourceHandle: 'routes',
          targetHandle: 'exec',
          type: 'smoothstep',
          deletable: false,
          selectable: true,
          style: { stroke: ROUTE_COLOR, strokeWidth: 2, strokeDasharray: '5 5' },
          label: trigger + ' · ' + (route.when === 'always' ? 'always' : route.when),
        });
      }
    }
  }

  // Se houver linha selecionada, coloca ela no final do array para renderizar no topo do SVG
  if (selectedEdgeId) {
    const selectedIdx = edges.findIndex((e) => e.id === selectedEdgeId);
    if (selectedIdx !== -1) {
      const [selectedEdge] = edges.splice(selectedIdx, 1);
      edges.push(selectedEdge);
    }
  }

  return edges;
}
