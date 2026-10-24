import type { FlowStage } from '../../engine';

/** Viewport inicial do canvas e ao resetar/abrir projetos. */
export const DEFAULT_VIEWPORT = { x: 30, y: 70, zoom: 0.72 };

/** Distâncias mínimas obrigatórias para evitar sobreposição entre blocos. */
export const MIN_BLOCK_DISTANCE_X = 400;
export const MIN_BLOCK_DISTANCE_Y = 160;

/** Tamanho do passo da grade invisível para alinhamento magnético dos blocos. */
export const GRID_SNAP_SIZE = 20;

/** Fluxos padrão do projeto (sem emojis). */
export const DEFAULT_FLOWS: FlowStage[] = [
  { id: 'screen', name: 'Tela de Entrada', color: '#6366f1' },
  { id: 'inputs', name: 'Inputs & Ações', color: '#38bdf8' },
  { id: 'validation', name: 'Validações', color: '#fbbf24' },
  { id: 'database', name: 'Banco de Dados', color: '#10b981' },
  { id: 'auth', name: 'Autenticação & OAuth', color: '#f43f5e' },
  { id: 'destination', name: 'Destino & Erros', color: '#a855f7' },
];

/** Retorna os fluxos definidos no grafo ou os fluxos padrão se ainda não configurados. */
export function getGraphFlows(flows?: FlowStage[]): FlowStage[] {
  return flows && flows.length > 0 ? flows : DEFAULT_FLOWS;
}

/** Identifica o fluxo correspondente a um bloco (considerando vínculo explícito ou deduzido pelo tipo). */
export function resolveBlockFlow(
  flows: FlowStage[],
  kind: string,
  id?: string,
  explicitFlowId?: string,
): { index: number; flow: FlowStage } {
  if (explicitFlowId) {
    const foundIndex = flows.findIndex((f) => f.id === explicitFlowId);
    if (foundIndex !== -1) {
      return { index: foundIndex + 1, flow: flows[foundIndex] };
    }
  }

  // Fallback inteligente baseado no tipo do bloco
  let targetId = 'inputs';
  if (kind === 'screen') targetId = 'screen';
  else if (kind === 'input' || kind === 'button') targetId = 'inputs';
  else if (
    kind === 'function' ||
    kind === 'condition' ||
    kind === 'validator' ||
    kind === 'switch' ||
    id?.includes('valida') ||
    id?.includes('checa')
  ) {
    targetId = 'validation';
  } else if (kind === 'database' || kind === 'state') {
    targetId = 'database';
  } else if (kind === 'auth' || kind === 'api') {
    targetId = 'auth';
  } else if (kind === 'error' || kind === 'navigate' || kind === 'notify' || kind === 'delay') {
    targetId = 'destination';
  }

  const idx = flows.findIndex((f) => f.id === targetId);
  if (idx !== -1) {
    return { index: idx + 1, flow: flows[idx] };
  }

  return { index: 1, flow: flows[0] || DEFAULT_FLOWS[0] };
}
