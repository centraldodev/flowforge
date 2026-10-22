import type { Block, CustomPort, Kind } from './types';

export type Ports = { inputs: string[]; outputs: string[] };

/** Saídas que continuam o caminho de execução (as demais carregam dados). */
export const EXEC_OUTPUTS = [
  'onClick',
  'click',
  'then',
  'next',
  'true',
  'false',
  'onSuccess',
  'onError',
  'success',
  'error',
  'onChange',
  'onOpen',
  'routes',
];

/** Entradas de eventos / ouvintes de execução (Lado B - Event Listeners / Handlers) */
export const EXEC_INPUTS = [
  'listener',
  'listenerClick',
  'handler',
  'handle',
  'call',
  'trigger',
  'exec',
  'onTrigger',
];

export const isExecOutput = (handle?: string | null): boolean => {
  const h = (handle || '').toLowerCase();
  return (
    EXEC_OUTPUTS.some((p) => p.toLowerCase() === h) ||
    h.startsWith('on') ||
    h.endsWith('click') ||
    h === 'true' ||
    h === 'false' ||
    h === 'then'
  );
};

export const isExecInput = (handle?: string | null): boolean => {
  const h = (handle || '').toLowerCase();
  return (
    EXEC_INPUTS.some((p) => p.toLowerCase() === h) ||
    h.includes('listener') ||
    h.includes('handler') ||
    h.includes('trigger') ||
    h === 'call' ||
    h === 'exec'
  );
};

const table: Record<Kind, Ports> = {
  // Interface
  screen: { inputs: ['listener', 'exec'], outputs: [] },
  button: { inputs: [], outputs: ['onClick', 'next', 'value'] },
  input: { inputs: [], outputs: ['value', 'onChange'] },
  // Lógica
  function: {
    inputs: ['listener', 'listenerClick', 'exec', 'value'],
    outputs: ['then', 'next', 'result', 'value'],
  },
  condition: {
    inputs: ['listener', 'listenerClick', 'exec', 'value'],
    outputs: ['true', 'false', 'value'],
  },
  auth: {
    inputs: ['listener', 'listenerClick', 'exec', 'email', 'password'],
    outputs: ['onSuccess', 'then', 'next', 'onError', 'user', 'value'],
  },
  navigate: { inputs: ['listener', 'listenerClick', 'exec'], outputs: ['then', 'next', 'value'] },
  // Dados
  database: {
    inputs: ['listener', 'listenerClick', 'exec', 'value'],
    outputs: ['onSuccess', 'then', 'next', 'onError', 'data', 'value'],
  },
  api: {
    inputs: ['listener', 'listenerClick', 'exec', 'body'],
    outputs: ['onSuccess', 'then', 'next', 'onError', 'response', 'value'],
  },
};

export function ports(kind: Kind): Ports {
  return table[kind];
}

/** Retorna as portas efetivas de um bloco (customizadas pelo usuário ou padrão por tipo). */
export function getBlockPorts(block: Block): Ports {
  if (block.data.ports !== undefined) {
    return {
      inputs: block.data.ports.filter((p) => p.direction === 'input').map((p) => p.id),
      outputs: block.data.ports.filter((p) => p.direction === 'output').map((p) => p.id),
    };
  }
  const def = ports(block.data.kind);
  return {
    inputs: [...def.inputs],
    outputs: [...def.outputs, ...(block.data.kind === 'screen' ? ['routes'] : [])],
  };
}

/** Retorna a lista de portas configuradas ou inicializa a partir do padrão se indefinido. */
export function ensureBlockPorts(block: Block): CustomPort[] {
  if (block.data.ports !== undefined) {
    return block.data.ports;
  }
  const def = ports(block.data.kind);
  const result: CustomPort[] = [];
  for (const p of def.inputs) {
    result.push({ id: p, name: p, direction: 'input' });
  }
  for (const p of def.outputs) {
    result.push({ id: p, name: p, direction: 'output' });
  }
  if (block.data.kind === 'screen') {
    result.push({ id: 'routes', name: 'routes', direction: 'output' });
  }
  return result;
}
