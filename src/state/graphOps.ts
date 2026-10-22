// Operações puras sobre o grafo. Recebem um Graph e devolvem um novo Graph, sem mutar o original.
import type { Connection } from '@xyflow/react';
import {
  catalog,
  interfaceKinds,
  isExecOutput,
  type Block,
  type Graph,
  type Kind,
} from '../engine';

type Position = { x: number; y: number };

export const emptyGraph = (name: string): Graph => ({ version: 1, name, nodes: [], edges: [] });

const mapNode = (g: Graph, id: string, fn: (n: Block) => Block): Graph => ({
  ...g,
  nodes: g.nodes.map((n) => (n.id === id ? fn(n) : n)),
});

export const updateConfig = (g: Graph, id: string, config: Record<string, string>) =>
  mapNode(g, id, (n) => ({ ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }));

export const renameBlock = (g: Graph, id: string, label: string) =>
  mapNode(g, id, (n) => ({ ...n, data: { ...n.data, label } }));

export const addBlock = (g: Graph, block: Block): Graph => ({ ...g, nodes: [...g.nodes, block] });

export const removeBlock = (g: Graph, id: string): Graph => ({
  ...g,
  nodes: g.nodes.filter((n) => n.id !== id),
  edges: g.edges.filter((e) => e.source !== id && e.target !== id),
});

export const removeEdge = (g: Graph, id: string): Graph => ({
  ...g,
  edges: g.edges.filter((e) => e.id !== id),
});

/** Remove conexões cujas pontas não existem mais. */
export const pruneEdges = (g: Graph): Graph => ({
  ...g,
  edges: g.edges.filter(
    (e) => g.nodes.some((n) => n.id === e.source) && g.nodes.some((n) => n.id === e.target),
  ),
});

/** Novo bloco com os valores padrão do catálogo, já vinculado à tela informada quando aplicável. */
export function createBlock(kind: Kind, position: Position, screenId: string): Block {
  return {
    id: crypto.randomUUID(),
    type: 'block',
    position,
    data: {
      kind,
      label: catalog[kind].name,
      config: {
        ...catalog[kind].defaults,
        ...(interfaceKinds.includes(kind) ? { screenId } : {}),
        ...(kind === 'navigate' ? { target: screenId } : {}),
      },
    },
  };
}

export function duplicateBlock(block: Block): Block {
  const clone = structuredClone(block);
  clone.id = crypto.randomUUID();
  clone.position.x += 60;
  clone.position.y += 70;
  clone.data.label += ' (cópia)';
  return clone;
}

/** Procura, a partir de `base`, uma posição em grade que não sobreponha outro bloco. */
export function findFreePosition(g: Graph, base: Position): Position {
  let position = { ...base };
  const overlaps = (p: Position) =>
    g.nodes.some((n) => Math.abs(n.position.x - p.x) < 250 && Math.abs(n.position.y - p.y) < 220);
  for (let attempt = 1; overlaps(position) && attempt <= 500; attempt++) {
    position = { x: base.x + (attempt % 3) * 270, y: base.y + Math.floor(attempt / 3) * 230 };
  }
  return position;
}

/** Mensagem de erro se a conexão for inválida; `null` se puder ser criada. */
export function connectionError(c: Connection): string | null {
  if (!c.source || !c.target || c.source === c.target) return 'Escolha dois blocos diferentes.';
  if (isExecOutput(c.sourceHandle) !== (c.targetHandle === 'exec'))
    return 'Conecte saídas de dados a entradas de dados, e ações a executar.';
  return null;
}

/**
 * Adiciona a conexão substituindo a anterior: cada saída de execução tem um único destino
 * e cada entrada de dados tem uma única origem.
 */
export function connect(g: Graph, c: Connection): Graph {
  const exec = isExecOutput(c.sourceHandle);
  const replaced = (e: Graph['edges'][number]) =>
    exec
      ? e.source === c.source && e.sourceHandle === c.sourceHandle
      : e.target === c.target && e.targetHandle === c.targetHandle;
  return {
    ...g,
    edges: [...g.edges.filter((e) => !replaced(e)), { ...c, id: crypto.randomUUID() }],
  };
}

export const screensOf = (g: Graph) => g.nodes.filter((n) => n.data.kind === 'screen');
