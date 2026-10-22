// Operações puras sobre o grafo. Recebem um Graph e devolvem um novo Graph, sem mutar o original.
import type { Connection } from '@xyflow/react';
import {
  catalog,
  ensureBlockPorts,
  interfaceKinds,
  isExecInput,
  isExecOutput,
  type Block,
  type CustomPort,
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

export type IdValidationResult = {
  valid: boolean;
  error?: string;
};

/** Valida se um novo ID de bloco é válido para linguagens de programação e único no grafo. */
export function validateBlockId(
  g: Graph,
  currentId: string,
  candidate: string,
): IdValidationResult {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return { valid: false, error: 'O ID não pode ser vazio.' };
  }
  if (trimmed === currentId) {
    return { valid: true };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'O ID não pode conter espaços.' };
  }
  if (!/^[a-zA-Z_]/.test(trimmed)) {
    return {
      valid: false,
      error: 'O ID deve começar com uma letra ou _ (não use números no início).',
    };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Use apenas letras, números, _ ou - (sem caracteres especiais).',
    };
  }
  const duplicate = g.nodes.find(
    (n) => n.id.toLowerCase() === trimmed.toLowerCase() && n.id !== currentId,
  );
  if (duplicate) {
    return {
      valid: false,
      error: `O ID "${trimmed}" já está em uso por outro bloco no projeto.`,
    };
  }
  return { valid: true };
}

/** Gera um ID legível e único baseado no tipo do bloco (ex: function_1, auth_1, screen_1). */
export function generateUniqueBlockId(g: Graph, kind: Kind): string {
  const prefix = kind;
  let counter = 1;
  const existing = new Set(g.nodes.map((n) => n.id.toLowerCase()));
  while (existing.has(`${prefix}_${counter}`.toLowerCase())) {
    counter++;
  }
  return `${prefix}_${counter}`;
}

/** Renomeia o ID de um bloco e propaga a alteração atomicamente em conexões, rotas e telas. */
export function renameBlockId(g: Graph, oldId: string, newId: string): Graph {
  const trimmed = newId.trim();
  if (!trimmed || trimmed === oldId) return g;
  if (g.nodes.some((n) => n.id.toLowerCase() === trimmed.toLowerCase() && n.id !== oldId)) {
    return g;
  }

  const targetNode = g.nodes.find((n) => n.id === oldId);
  if (!targetNode) return g;

  const isScreen = targetNode.data.kind === 'screen';

  const nextNodes = g.nodes.map((n) => {
    if (n.id === oldId) {
      return {
        ...n,
        id: trimmed,
        data: {
          ...n.data,
          label: n.data.label === oldId ? trimmed : n.data.label,
        },
      };
    }

    let nextConfig = n.data.config;
    let configChanged = false;

    if (isScreen) {
      if (nextConfig.screenId === oldId) {
        nextConfig = { ...nextConfig, screenId: trimmed };
        configChanged = true;
      }
      if (nextConfig.target === oldId) {
        nextConfig = { ...nextConfig, target: trimmed };
        configChanged = true;
      }
    }

    if (n.data.kind === 'navigate' && nextConfig.target === oldId) {
      nextConfig = { ...nextConfig, target: trimmed };
      configChanged = true;
    }

    if (n.data.kind === 'screen' && nextConfig.routes) {
      try {
        const routes = JSON.parse(nextConfig.routes);
        if (Array.isArray(routes)) {
          let routesChanged = false;
          const updatedRoutes = routes.map((r: any) => {
            let tr = r.trigger;
            let tg = r.target;
            let itemChanged = false;
            if (tr === oldId) {
              tr = trimmed;
              itemChanged = true;
            }
            if (tg === oldId) {
              tg = trimmed;
              itemChanged = true;
            }
            if (itemChanged) {
              routesChanged = true;
              return { ...r, trigger: tr, target: tg };
            }
            return r;
          });
          if (routesChanged) {
            nextConfig = { ...nextConfig, routes: JSON.stringify(updatedRoutes) };
            configChanged = true;
          }
        }
      } catch {
        // ignora se JSON corrompido
      }
    }

    return configChanged ? { ...n, data: { ...n.data, config: nextConfig } } : n;
  });

  const nextEdges = g.edges.map((e) => {
    if (e.source === oldId || e.target === oldId) {
      return {
        ...e,
        source: e.source === oldId ? trimmed : e.source,
        target: e.target === oldId ? trimmed : e.target,
      };
    }
    return e;
  });

  return {
    ...g,
    nodes: nextNodes,
    edges: nextEdges,
  };
}

/** Novo bloco com os valores padrão do catálogo e sem conexões por padrão. */
export function createBlock(kind: Kind, position: Position, screenId: string, g?: Graph): Block {
  const id = g ? generateUniqueBlockId(g, kind) : generateUniqueBlockId({ nodes: [] } as any, kind);
  return {
    id,
    type: 'block',
    position,
    data: {
      kind,
      label: catalog[kind].name,
      config: {
        ...catalog[kind].defaults,
        ...(kind !== 'screen' && screenId ? { screenId } : {}),
        ...(kind === 'navigate' ? { target: screenId } : {}),
      },
      ports: [],
    },
  };
}

export function addPortToBlock(g: Graph, blockId: string, port: CustomPort): Graph {
  return mapNode(g, blockId, (b) => {
    const current = ensureBlockPorts(b);
    return {
      ...b,
      data: {
        ...b.data,
        ports: [...current, port],
      },
    };
  });
}

export function removePortFromBlock(g: Graph, blockId: string, portId: string): Graph {
  const node = g.nodes.find((n) => n.id === blockId);
  if (!node) return g;
  const current = ensureBlockPorts(node);
  const nextPorts = current.filter((p) => p.id !== portId);

  return {
    ...g,
    nodes: g.nodes.map((n) =>
      n.id === blockId
        ? {
            ...n,
            data: {
              ...n.data,
              ports: nextPorts,
            },
          }
        : n,
    ),
    edges: g.edges.filter(
      (e) =>
        !(e.source === blockId && e.sourceHandle === portId) &&
        !(e.target === blockId && e.targetHandle === portId),
    ),
  };
}

export function duplicateBlock(block: Block, g?: Graph): Block {
  const clone = structuredClone(block);
  let candidate = `${block.id}_copy`;
  if (g) {
    const existing = new Set(g.nodes.map((n) => n.id.toLowerCase()));
    let counter = 1;
    while (existing.has(candidate.toLowerCase())) {
      counter++;
      candidate = `${block.id}_copy_${counter}`;
    }
  } else {
    candidate = `${block.id}_copy_${crypto.randomUUID().slice(0, 4)}`;
  }
  clone.id = candidate;
  clone.position.x += 60;
  clone.position.y += 70;
  clone.data.label += ' (cópia)';
  return clone;
}

/** Procura, a partir de `base`, uma posição em grade que não sobreponha outro bloco da mesma tela. */
export function findFreePosition(g: Graph, base: Position, screenId?: string): Position {
  let position = { ...base };
  const targetNodes = screenId
    ? g.nodes.filter((n) => n.data.kind !== 'screen' && n.data.config.screenId === screenId)
    : g.nodes;
  const overlaps = (p: Position) =>
    targetNodes.some((n) => Math.abs(n.position.x - p.x) < 250 && Math.abs(n.position.y - p.y) < 220);
  for (let attempt = 1; overlaps(position) && attempt <= 500; attempt++) {
    position = { x: base.x + (attempt % 3) * 270, y: base.y + Math.floor(attempt / 3) * 230 };
  }
  return position;
}

/** Mensagem de erro se a conexão for inválida; `null` se puder ser criada. */
export function connectionError(c: Connection): string | null {
  if (!c.source || !c.target || c.source === c.target) return 'Escolha dois blocos diferentes.';
  if (isExecOutput(c.sourceHandle) !== isExecInput(c.targetHandle))
    return 'Conecte eventos (Lado A: onClick, then, onSuccess) a ouvintes de execução (Lado B: listener, listenerClick, handler), e dados a entradas de dados.';
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
