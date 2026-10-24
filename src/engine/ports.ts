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
  'onComplete',
  'onDismiss',
  'retry',
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
  'execute',
  'onEnter',
  'onTrigger',
];

const KNOWN_EXEC_INPUTS = new Set([
  'listener',
  'listenerclick',
  'handler',
  'handle',
  'call',
  'trigger',
  'exec',
  'execute',
  'onenter',
  'ontrigger',
]);

export const isExecInput = (handle?: string | null): boolean => {
  const h = (handle || '').toLowerCase();
  return (
    EXEC_INPUTS.some((p) => p.toLowerCase() === h) ||
    KNOWN_EXEC_INPUTS.has(h) ||
    h.includes('listener') ||
    h.includes('handler') ||
    h.includes('trigger') ||
    h === 'call' ||
    h === 'exec' ||
    h === 'execute' ||
    h === 'onenter'
  );
};

export const isExecOutput = (handle?: string | null): boolean => {
  const h = (handle || '').toLowerCase();
  if (KNOWN_EXEC_INPUTS.has(h)) return false;
  return (
    EXEC_OUTPUTS.some((p) => p.toLowerCase() === h) ||
    h.startsWith('on') ||
    h.endsWith('click') ||
    h === 'true' ||
    h === 'false' ||
    h === 'then'
  );
};

export const DEFAULT_PORT_TYPES: Record<string, string> = {
  // Events / Triggers
  onClick: 'Event',
  click: 'Event',
  trigger: 'Event',
  onSuccess: 'Event',
  onError: 'Error',
  onComplete: 'Event',
  onDismiss: 'Event',
  onEnter: 'Event',
  onChange: 'Event',
  onOpen: 'Event',
  then: 'Event',
  execute: 'Event',
  exec: 'Event',
  listener: 'Event',
  listenerClick: 'Event',
  retry: 'Event',
  true: 'Event',
  false: 'Event',
  // Data
  email: 'string',
  password: 'string',
  disabled: 'boolean',
  user: 'User',
  message: 'string',
  msg: 'string',
  error: 'Error',
  route: 'string',
  value: 'string',
  data: 'object',
  response: 'object',
  body: 'object',
  result: 'any',
  token: 'string',
};

export function getPortType(portId: string, customType?: string): string {
  if (customType) return customType;
  return DEFAULT_PORT_TYPES[portId] || '';
}

const table: Record<Kind, Ports> = {
  // Interface
  screen: { inputs: ['onEnter', 'user', 'listener', 'exec'], outputs: [] },
  button: { inputs: ['disabled'], outputs: ['onClick', 'next', 'value'] },
  input: { inputs: ['disabled'], outputs: ['value', 'onChange'] },
  // Lógica
  function: {
    inputs: ['execute', 'message', 'listener', 'listenerClick', 'exec', 'value'],
    outputs: ['onDismiss', 'then', 'next', 'result', 'value'],
  },
  condition: {
    inputs: ['execute', 'listener', 'listenerClick', 'exec', 'value'],
    outputs: ['true', 'false', 'value'],
  },
  auth: {
    inputs: ['trigger', 'email', 'password', 'token', 'listener', 'listenerClick', 'exec'],
    outputs: ['onSuccess', 'onError', 'user', 'then', 'next', 'value'],
  },
  error: {
    inputs: ['execute', 'msg'],
    outputs: ['retry', 'msg'],
  },
  navigate: {
    inputs: ['execute', 'route', 'listener', 'listenerClick', 'exec'],
    outputs: ['onComplete', 'then', 'next', 'value'],
  },
  // Dados
  database: {
    inputs: ['execute', 'listener', 'listenerClick', 'exec', 'value', 'data', 'user'],
    outputs: ['onSuccess', 'onError', 'data', 'then', 'next', 'value'],
  },
  api: {
    inputs: ['execute', 'body', 'listener', 'listenerClick', 'exec'],
    outputs: ['onSuccess', 'onError', 'response', 'then', 'next', 'value'],
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
    result.push({ id: p, name: p, direction: 'input', type: getPortType(p) });
  }
  for (const p of def.outputs) {
    result.push({ id: p, name: p, direction: 'output', type: getPortType(p) });
  }
  if (block.data.kind === 'screen') {
    result.push({ id: 'routes', name: 'routes', direction: 'output' });
  }
  return result;
}
