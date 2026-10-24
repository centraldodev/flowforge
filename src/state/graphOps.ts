// Operações puras sobre o grafo. Recebem um Graph e devolvem um novo Graph, sem mutar o original.
import type { Connection } from '@xyflow/react';
import {
  catalog,
  ensureBlockPorts,
  generateBlockCode,
  isExecInput,
  isExecOutput,
  normalizeCustomPort,
  PORT_DEFINITIONS,
  syncGraphCode,
  validateConnection,
  type Block,
  type CustomPort,
  type FlowStage,
  type Graph,
  type Kind,
  type ScreenRoute,
} from '../engine';
import { getGraphFlows, GRID_SNAP_SIZE } from '../features/canvas/constants';

type Position = { x: number; y: number };

/** Alinha um valor escalar à grade magnética invisível. */
export const snapCoord = (val: number, step = GRID_SNAP_SIZE): number =>
  Math.round(val / step) * step;

export const emptyGraph = (name: string): Graph => ({ version: 1, name, nodes: [], edges: [] });

const mapNode = (g: Graph, id: string, fn: (n: Block) => Block): Graph => ({
  ...g,
  nodes: g.nodes.map((n) => (n.id === id ? fn(n) : n)),
});

export const updateConfig = (g: Graph, id: string, config: Record<string, string>): Graph => {
  const updated = mapNode(g, id, (n) => ({
    ...n,
    data: { ...n.data, config: { ...n.data.config, ...config } },
  }));
  if (!('code' in config)) {
    return syncGraphCode(updated, [id]);
  }
  return updated;
};

export const renameBlock = (g: Graph, id: string, label: string) =>
  mapNode(g, id, (n) => ({ ...n, data: { ...n.data, label } }));

export const addBlock = (g: Graph, block: Block): Graph => ({ ...g, nodes: [...g.nodes, block] });

export const removeBlock = (g: Graph, id: string): Graph => {
  const nextNodes = g.nodes.filter((n) => n.id !== id);
  const nextEdges = g.edges.filter((e) => e.source !== id && e.target !== id);
  return syncGraphCode({ ...g, nodes: nextNodes, edges: nextEdges });
};

export const removeEdge = (g: Graph, id: string): Graph => {
  const edge = g.edges.find((e) => e.id === id);
  const nextGraph: Graph = {
    ...g,
    edges: g.edges.filter((e) => e.id !== id),
  };
  return edge ? syncGraphCode(nextGraph, [edge.source, edge.target]) : nextGraph;
};

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
          const updatedRoutes = routes.map((r: ScreenRoute) => {
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

  return syncGraphCode({
    ...g,
    nodes: nextNodes,
    edges: nextEdges,
  });
}

/** Novo bloco com os valores padrão do catálogo e sem conexões por padrão. */
export function createBlock(kind: Kind, position: Position, screenId: string, g?: Graph): Block {
  const id = generateUniqueBlockId(g ?? emptyGraph(''), kind);
  const block: Block = {
    id,
    type: 'block',
    position: { x: snapCoord(position.x), y: snapCoord(position.y) },
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
  const tempGraph: Graph = g
    ? { ...g, nodes: [...g.nodes, block] }
    : { version: 1, name: '', nodes: [block], edges: [] };
  block.data.config.code = generateBlockCode(tempGraph, block);
  return block;
}

export function addPortToBlock(g: Graph, blockId: string, port: CustomPort): Graph {
  return mapNode(g, blockId, (b) => {
    const current = ensureBlockPorts(b);
    const normalized = normalizeCustomPort(port, b.data.kind);

    // Portas personalizadas devem exigir mode, cardinality e tipo quando forem de dados
    if (normalized.mode === 'data') {
      const hasType = port.type || port.valueType;
      const isCatalogPort = (PORT_DEFINITIONS[b.data.kind] || []).some(
        (p) => p.id === port.id && p.direction === port.direction,
      );
      if (!hasType && !isCatalogPort) {
        throw new Error('Portas de dados personalizadas devem especificar tipo de dado.');
      }
    }

    const fullPort: CustomPort = {
      ...port,
      mode: normalized.mode,
      cardinality: normalized.cardinality,
      valueType: normalized.valueType,
    };

    return {
      ...b,
      data: {
        ...b.data,
        ports: [...current, fullPort],
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
  clone.position.x = snapCoord(block.position.x + 60);
  clone.position.y = snapCoord(block.position.y + 60);
  clone.data.label += ' (cópia)';
  return clone;
}

/** Distâncias mínimas obrigatórias para evitar sobreposição entre blocos. */
export const MIN_BLOCK_DISTANCE_X = 380;
export const MIN_BLOCK_DISTANCE_Y = 160;

/** Procura, a partir de `base`, uma posição em grade que respeite a distância mínima e não sobreponha outro bloco. */
export function findFreePosition(g: Graph, base: Position, screenId?: string): Position {
  let position = {
    x: snapCoord(base.x),
    y: snapCoord(base.y),
  };
  const targetNodes = screenId
    ? g.nodes.filter((n) => n.data.kind !== 'screen' && n.data.config.screenId === screenId)
    : g.nodes;
  const overlaps = (p: Position) =>
    targetNodes.some(
      (n) =>
        Math.abs(n.position.x - p.x) < MIN_BLOCK_DISTANCE_X &&
        Math.abs(n.position.y - p.y) < MIN_BLOCK_DISTANCE_Y,
    );
  for (let attempt = 1; overlaps(position) && attempt <= 500; attempt++) {
    position = {
      x: snapCoord(base.x + (attempt % 3) * (MIN_BLOCK_DISTANCE_X + 20)),
      y: snapCoord(base.y + Math.floor(attempt / 3) * (MIN_BLOCK_DISTANCE_Y + 40)),
    };
  }
  return position;
}

/** Previne que um bloco movido fique em cima de outro, mantendo a distância mínima obrigatória e alinhando à grade. */
export function preventBlockCollision(
  nodes: Block[],
  activeId: string,
  minX = MIN_BLOCK_DISTANCE_X,
  minY = MIN_BLOCK_DISTANCE_Y,
): Block[] {
  const current = nodes.find((n) => n.id === activeId);
  if (!current) return nodes;

  const others = nodes.filter((n) => n.id !== activeId);
  const collidesWith = others.find(
    (n) =>
      Math.abs(n.position.x - current.position.x) < minX &&
      Math.abs(n.position.y - current.position.y) < minY,
  );

  if (!collidesWith) return nodes;

  // Afasta verticalmente para uma posição segura sem sobreposição
  const shiftY = current.position.y >= collidesWith.position.y ? minY + 40 : -(minY + 40);
  const safePos = {
    x: snapCoord(current.position.x),
    y: snapCoord(Math.max(40, collidesWith.position.y + shiftY)),
  };

  return nodes.map((n) => (n.id === activeId ? { ...n, position: safePos } : n));
}

/** Organiza automaticamente os blocos em colunas espaçadas por fases do fluxo com distâncias mínimas garantidas. */
export function organizeGraphByFlow(g: Graph, activeScreenId?: string): Graph {
  const allScreens = g.nodes.filter((n) => n.data.kind === 'screen');
  const targetScreen =
    activeScreenId && allScreens.some((s) => s.id === activeScreenId)
      ? activeScreenId
      : allScreens[0]?.id;

  const colX = {
    screen: 60,
    inputs: 440,
    validation: 860,
    database: 1280,
    auth: 1700,
    destination: 2140,
  };

  const colY: Record<keyof typeof colX, number> = {
    screen: 140,
    inputs: 80,
    validation: 80,
    database: 260,
    auth: 80,
    destination: 140,
  };

  const updatedNodes = g.nodes.map((n) => {
    if (n.data.kind === 'screen') {
      if (n.id === targetScreen) {
        return { ...n, position: { x: colX.screen, y: 140 } };
      }
      const y = colY.destination;
      colY.destination += 280;
      return { ...n, position: { x: colX.destination, y } };
    }

    if (
      allScreens.length > 1 &&
      n.data.config.screenId &&
      targetScreen &&
      n.data.config.screenId !== targetScreen
    ) {
      return n;
    }

    if (n.data.kind === 'input') {
      const y = colY.inputs;
      colY.inputs += 160;
      return { ...n, position: { x: colX.inputs, y } };
    }

    if (n.data.kind === 'button') {
      const y = Math.max(colY.inputs, 400);
      colY.inputs = y + 140;
      return { ...n, position: { x: colX.inputs, y } };
    }

    if (n.data.kind === 'function' || n.data.kind === 'condition') {
      const y = colY.validation;
      colY.validation += 220;
      return { ...n, position: { x: colX.validation, y } };
    }

    if (n.data.kind === 'database') {
      const y = colY.database;
      colY.database += 240;
      return { ...n, position: { x: colX.database, y } };
    }

    if (n.data.kind === 'auth' || n.data.kind === 'api') {
      const y = colY.auth;
      colY.auth += 220;
      return { ...n, position: { x: colX.auth, y } };
    }

    if (n.data.kind === 'error' || n.data.kind === 'navigate') {
      const y = Math.max(colY.destination, 480);
      colY.destination = y + 200;
      return { ...n, position: { x: colX.destination, y } };
    }

    return n;
  });

  return { ...g, nodes: updatedNodes };
}

/** Adiciona um novo fluxo/fase ao projeto. */
export function addFlowToGraph(g: Graph, name: string, color?: string): Graph {
  const currentFlows = getGraphFlows(g.flows);
  const id = 'flow_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const newFlow: FlowStage = {
    id,
    name: name.trim() || `Fluxo ${currentFlows.length + 1}`,
    color: color || '#818cf8',
  };
  return {
    ...g,
    flows: [...currentFlows, newFlow],
  };
}

/** Remove um fluxo/fase do projeto e desvincula os blocos que estavam atrelados a ele. */
export function removeFlowFromGraph(g: Graph, flowId: string): Graph {
  const currentFlows = getGraphFlows(g.flows);
  const nextFlows = currentFlows.filter((f) => f.id !== flowId);
  const nextNodes = g.nodes.map((n) => {
    if (n.data.config.flowId === flowId) {
      const nextConfig = { ...n.data.config };
      delete nextConfig.flowId;
      return { ...n, data: { ...n.data, config: nextConfig } };
    }
    return n;
  });
  return {
    ...g,
    flows: nextFlows,
    nodes: nextNodes,
  };
}

/** Mensagem de erro se a conexão for inválida; `null` se puder ser criada. */
export function connectionError(c: Connection, g?: Graph): string | null {
  if (!c.source || !c.target || c.source === c.target) return 'Escolha dois blocos diferentes.';
  if (g) {
    return validateConnection(g, c);
  }
  if (isExecOutput(c.sourceHandle) !== isExecInput(c.targetHandle))
    return 'Incompatibilidade de modo: conecte eventos (Lado A) a ouvintes de execução (Lado B) e dados a dados.';
  return null;
}

/**
 * Adiciona a conexão validando modo, tipo e cardinalidade.
 * Não substitui conexões silenciosamente: lança erro se a cardinalidade for excedida.
 */
export function connect(g: Graph, c: Connection): Graph {
  const err = validateConnection(g, c);
  if (err) {
    throw new Error(err);
  }
  const edgeId = (c as { id?: string }).id || crypto.randomUUID();
  const nextGraph: Graph = {
    ...g,
    edges: [...g.edges, { ...c, id: edgeId }],
  };
  return syncGraphCode(nextGraph, c.source && c.target ? [c.source, c.target] : undefined);
}

export const screensOf = (g: Graph) => g.nodes.filter((n) => n.data.kind === 'screen');
