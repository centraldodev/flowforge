import { catalog } from './catalog';
import { normalizeGraph } from './ports';
import { screenRoutes } from './routes';
import type { Graph, Kind } from './types';

const MAX_NODES = 500;
const MAX_EDGES = 2000;

/** Converte texto JSON em Graph, rejeitando estruturas inválidas. */
export function parseGraph(text: string): Graph {
  const g = JSON.parse(text);
  if (
    g.version !== 1 ||
    typeof g.name !== 'string' ||
    !Array.isArray(g.nodes) ||
    !Array.isArray(g.edges) ||
    g.nodes.length > MAX_NODES ||
    g.edges.length > MAX_EDGES
  )
    throw Error('Formato de projeto inválido');

  for (const n of g.nodes) {
    const valid =
      typeof n.id === 'string' &&
      n.data &&
      catalog[n.data.kind as Kind] &&
      typeof n.data.label === 'string' &&
      (n.data.contractVersion === undefined ||
        (Number.isInteger(n.data.contractVersion) && n.data.contractVersion > 0)) &&
      n.data.config &&
      typeof n.data.config === 'object' &&
      Object.values(n.data.config).every((v) => typeof v === 'string') &&
      Number.isFinite(n.position?.x) &&
      Number.isFinite(n.position?.y);
    if (!valid) throw Error('Bloco inválido');
    if (n.data.kind === 'screen') screenRoutes(n);
  }

  for (const e of g.edges) {
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string')
      throw Error('Conexão inválida');
  }
  return normalizeGraph(g);
}
