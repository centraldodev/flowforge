import type { Graph, Block, Link } from '../engine/types';
import { normalizeCustomPort } from '../engine/ports';

/** Normaliza um nó garantindo propriedades mínimas e portas semânticas estruturadas */
export function normalizeNode(node: Block): Block {
  const ports =
    node.data.ports !== undefined
      ? node.data.ports.map((p) => {
          const norm = normalizeCustomPort(p, node.data.kind);
          return {
            ...p,
            mode: norm.mode,
            cardinality: norm.cardinality,
            valueType: norm.valueType,
            type: p.type || norm.valueType?.kind,
          };
        })
      : undefined;

  return {
    ...node,
    data: {
      ...node.data,
      contractVersion: node.data.contractVersion ?? 1,
      label: (node.data.label || node.id).trim(),
      config: { ...node.data.config },
      ports,
    },
  };
}

/** Normaliza conexões garantindo handles válidos */
export function normalizeEdge(edge: Link): Link {
  return {
    ...edge,
    sourceHandle: edge.sourceHandle || null,
    targetHandle: edge.targetHandle || null,
  };
}

/** Normaliza integralmente o Graph antes das etapas de análise e lowering */
export function normalizeGraph(graph: Graph): Graph {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const validEdges = graph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(normalizeEdge);

  return {
    ...graph,
    nodes: graph.nodes.map(normalizeNode),
    edges: validEdges,
  };
}
