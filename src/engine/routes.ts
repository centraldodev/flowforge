import { isExecOutput, ports } from './ports';
import type { Block, Graph, ScreenRoute } from './types';

const WHEN: ScreenRoute['when'][] = ['true', 'false', 'always'];

/** Lê e valida as transições salvas em `config.routes` de uma tela. */
export function screenRoutes(screen: Block): ScreenRoute[] {
  const routes = JSON.parse(screen.data.config.routes || '[]');
  const valid =
    Array.isArray(routes) &&
    routes.every(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        typeof r.trigger === 'string' &&
        WHEN.includes(r.when) &&
        typeof r.target === 'string',
    );
  if (!valid) throw Error('Transições de tela inválidas');
  return routes;
}

/** Ações alcançáveis a partir dos botões de uma tela, seguindo as conexões de execução. */
export function reachableActions(g: Graph, screenId: string): Block[] {
  const visited = new Set<string>();
  const pending = g.nodes
    .filter((n) => n.data.kind === 'button' && n.data.config.screenId === screenId)
    .map((n) => n.id);

  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const e of g.edges) {
      if (e.source === id && isExecOutput(e.sourceHandle)) pending.push(e.target);
    }
  }

  return g.nodes.filter(
    (n) =>
      visited.has(n.id) &&
      n.data.kind !== 'screen' &&
      ports(n.data.kind).outputs.some((p) => isExecOutput(p)),
  );
}
