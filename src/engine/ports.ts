import type {
  Block,
  CustomPort,
  Graph,
  Kind,
  PortCardinality,
  PortDefinition,
  PortMode,
  ValueType,
} from './types';

export type Ports = { inputs: string[]; outputs: string[] };

/** Saídas que continuam o caminho de execução (as demais carregam dados). */
export const EXEC_OUTPUTS = [
  'onClick',
  'click',
  'then',
  'next',
  'true',
  'false',
  'valid',
  'invalid',
  'default',
  'case1',
  'case2',
  'case3',
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
  'each',
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
  next: 'Event',
  valid: 'Event',
  invalid: 'Event',
  default: 'Event',
  case1: 'Event',
  case2: 'Event',
  case3: 'Event',
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
  key: 'string',
  stored: 'any',
  duration: 'number',
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

/** Converte representação textual de tipo em ValueType estruturado */
export function parseValueType(typeStr?: string): ValueType {
  const s = (typeStr || '').trim();
  if (!s || s === 'any') return { kind: 'any' };
  if (s === 'string') return { kind: 'string' };
  if (s === 'number') return { kind: 'number' };
  if (s === 'boolean') return { kind: 'boolean' };
  if (s === 'null') return { kind: 'null' };
  if (s.toLowerCase() === 'error') return { kind: 'error' };
  if (s === 'object') return { kind: 'object' };
  if (s.endsWith('[]')) {
    return { kind: 'array', item: parseValueType(s.slice(0, -2)) };
  }
  if (s.includes('|')) {
    const members = s.split('|').map((part) => parseValueType(part.trim()));
    return { kind: 'union', members };
  }
  if (s === 'Event') return { kind: 'any' };
  // Tipo objeto nominal (ex: 'User', 'Product')
  return { kind: 'object', name: s };
}

/** Formata ValueType para exibição legível na interface e em mensagens de diagnóstico */
export function formatValueType(vt?: ValueType): string {
  if (!vt) return 'any';
  switch (vt.kind) {
    case 'any':
      return 'any';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'error':
      return 'error';
    case 'object':
      return vt.name ? vt.name : 'object';
    case 'array':
      return `${formatValueType(vt.item)}[]`;
    case 'union':
      return vt.members.map(formatValueType).join(' | ');
  }
}

/** Verifica compatibilidade formal de tipos entre origem e destino */
export function isTypeCompatible(source?: ValueType, target?: ValueType): boolean {
  if (!source || !target) return true;
  if (target.kind === 'any' || source.kind === 'any') return true;

  if (source.kind === 'union') {
    return source.members.every((m) => isTypeCompatible(m, target));
  }
  if (target.kind === 'union') {
    return target.members.some((m) => isTypeCompatible(source, m));
  }

  if (source.kind !== target.kind) return false;

  if (source.kind === 'object' && target.kind === 'object') {
    if (target.name) {
      return source.name === target.name;
    }
    return true;
  }

  if (source.kind === 'array' && target.kind === 'array') {
    return isTypeCompatible(source.item, target.item);
  }

  return true;
}

/** Catálogo formal de portas para todos os 15 Kinds do FlowForge */
export const PORT_DEFINITIONS: Record<Kind, PortDefinition[]> = {
  screen: [
    { id: 'onEnter', name: 'onEnter', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'user',
      name: 'user',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'object', name: 'User' },
    },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'routes', name: 'routes', direction: 'output', mode: 'control', cardinality: 'many' },
  ],
  button: [
    {
      id: 'disabled',
      name: 'disabled',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'boolean' },
    },
    { id: 'onClick', name: 'onClick', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
  ],
  input: [
    {
      id: 'disabled',
      name: 'disabled',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'boolean' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    { id: 'onChange', name: 'onChange', direction: 'output', mode: 'control', cardinality: 'many' },
  ],
  function: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'message',
      name: 'message',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'onDismiss',
      name: 'onDismiss',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  condition: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'true', name: 'true', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'false', name: 'false', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  validator: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'valid', name: 'valid', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'invalid', name: 'invalid', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'error',
      name: 'error',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
  ],
  switch: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'case1', name: 'case1', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'case2', name: 'case2', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'case3', name: 'case3', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'default', name: 'default', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  delay: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'duration',
      name: 'duration',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onComplete',
      name: 'onComplete',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  auth: [
    {
      id: 'connection',
      name: 'Provedor de Identidade',
      direction: 'input',
      mode: 'resource',
      cardinality: 'one',
    },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'email',
      name: 'email',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'password',
      name: 'password',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'token',
      name: 'token',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'user',
      name: 'user',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'object', name: 'User' },
    },
    {
      id: 'session',
      name: 'session',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'object', name: 'Session' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  error: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'msg',
      name: 'msg',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'retry', name: 'retry', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'msg',
      name: 'msg',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
  ],
  notify: [
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'message',
      name: 'message',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onDismiss',
      name: 'onDismiss',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
  ],
  navigate: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'route',
      name: 'route',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'onComplete',
      name: 'onComplete',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
  ],
  state: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'key',
      name: 'key',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'stored',
      name: 'stored',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  database: [
    {
      id: 'connection',
      name: 'Conexão PostgreSQL',
      direction: 'input',
      mode: 'resource',
      cardinality: 'one',
    },
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'data',
      name: 'data',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'user',
      name: 'user',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'object', name: 'User' },
    },
    {
      id: 'id',
      name: 'id',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'filter',
      name: 'filter',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'limit',
      name: 'limit',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    {
      id: 'offset',
      name: 'offset',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'data',
      name: 'data',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'total',
      name: 'total',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'number' },
    },
    {
      id: 'deletedCount',
      name: 'deletedCount',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'number' },
    },
  ],
  api: [
    {
      id: 'connection',
      name: 'Conexão HTTP',
      direction: 'input',
      mode: 'resource',
      cardinality: 'one',
      required: true,
    },
    {
      id: 'query',
      name: 'Parâmetros',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'object' },
    },
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'body',
      name: 'body',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'response',
      name: 'response',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  constant: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  math: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'a',
      name: 'a',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    {
      id: 'b',
      name: 'b',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'number' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'number' },
    },
  ],
  httpConnection: [
    {
      id: 'connection',
      name: 'Conexão HTTP',
      direction: 'output',
      mode: 'resource',
      cardinality: 'many',
    },
  ],
  postgresConnection: [
    {
      id: 'connection',
      name: 'Conexão PostgreSQL',
      direction: 'output',
      mode: 'resource',
      cardinality: 'many',
    },
  ],
  entity: [
    {
      id: 'schema',
      name: 'Esquema de Dados',
      direction: 'output',
      mode: 'resource',
      cardinality: 'many',
    },
  ],
  identityProvider: [
    {
      id: 'connection',
      name: 'Provedor de Identidade',
      direction: 'output',
      mode: 'resource',
      cardinality: 'many',
    },
  ],
  policy: [
    {
      id: 'policy',
      name: 'Política de Acesso',
      direction: 'output',
      mode: 'resource',
      cardinality: 'many',
    },
  ],
  text: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'arg',
      name: 'arg',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
  ],
  compare: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'left',
      name: 'left',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'right',
      name: 'right',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'true', name: 'true', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'false', name: 'false', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'boolean' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'boolean' },
    },
  ],
  boolean: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'a',
      name: 'a',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'boolean' },
    },
    {
      id: 'b',
      name: 'b',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'boolean' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'boolean' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'boolean' },
    },
  ],
  object: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'data',
      name: 'data',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'object',
      name: 'object',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'object' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'object' },
    },
  ],
  array: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'item',
      name: 'item',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'array',
      name: 'array',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'array', item: { kind: 'any' } },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'array', item: { kind: 'any' } },
    },
  ],
  subflow: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'input',
      name: 'input',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'onError', name: 'onError', direction: 'output', mode: 'error', cardinality: 'many' },
    {
      id: 'output',
      name: 'output',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  storage: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'upload', name: 'upload', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'file',
      name: 'file',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'path',
      name: 'path',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'onError', name: 'onError', direction: 'output', mode: 'error', cardinality: 'many' },
    {
      id: 'fileUrl',
      name: 'fileUrl',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  email: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'send', name: 'send', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'to',
      name: 'to',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'subject',
      name: 'subject',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'body',
      name: 'body',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'onError', name: 'onError', direction: 'output', mode: 'error', cardinality: 'many' },
    {
      id: 'messageId',
      name: 'messageId',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  webhook: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onEvent', name: 'onEvent', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onError', name: 'onError', direction: 'output', mode: 'error', cardinality: 'many' },
    {
      id: 'payload',
      name: 'payload',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  task: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onTick', name: 'onTick', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onError', name: 'onError', direction: 'output', mode: 'error', cardinality: 'many' },
    {
      id: 'payload',
      name: 'payload',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  payment: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'amount',
      name: 'amount',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'number' },
    },
    {
      id: 'currency',
      name: 'currency',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'customer',
      name: 'customer',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'description',
      name: 'description',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'metadata',
      name: 'metadata',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onSuccess',
      name: 'onSuccess',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'checkoutUrl',
      name: 'checkoutUrl',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'sessionId',
      name: 'sessionId',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'paymentId',
      name: 'paymentId',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'status',
      name: 'status',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'qrCode',
      name: 'qrCode',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  realtime: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'listenerClick',
      name: 'listenerClick',
      direction: 'input',
      mode: 'control',
      cardinality: 'many',
    },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'channel',
      name: 'channel',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'event',
      name: 'event',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'string' },
    },
    {
      id: 'data',
      name: 'data',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onEvent', name: 'onEvent', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onMessage',
      name: 'onMessage',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'payload',
      name: 'payload',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'channel',
      name: 'channel',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'event',
      name: 'event',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'clientId',
      name: 'clientId',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'string' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  loop: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'items',
      name: 'items',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'each', name: 'each', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'next', name: 'next', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onComplete',
      name: 'onComplete',
      direction: 'output',
      mode: 'control',
      cardinality: 'many',
    },
    {
      id: 'item',
      name: 'item',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
  form: [
    { id: 'execute', name: 'execute', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'trigger', name: 'trigger', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'listener', name: 'listener', direction: 'input', mode: 'control', cardinality: 'many' },
    { id: 'exec', name: 'exec', direction: 'input', mode: 'control', cardinality: 'many' },
    {
      id: 'value',
      name: 'value',
      direction: 'input',
      mode: 'data',
      cardinality: 'one',
      valueType: { kind: 'any' },
    },
    { id: 'valid', name: 'valid', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'invalid', name: 'invalid', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'onClick', name: 'onClick', direction: 'output', mode: 'control', cardinality: 'many' },
    { id: 'then', name: 'then', direction: 'output', mode: 'control', cardinality: 'many' },
    {
      id: 'onError',
      name: 'onError',
      direction: 'output',
      mode: 'error',
      cardinality: 'many',
      valueType: { kind: 'error' },
    },
    {
      id: 'data',
      name: 'data',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'object' },
    },
    {
      id: 'result',
      name: 'result',
      direction: 'output',
      mode: 'data',
      cardinality: 'many',
      valueType: { kind: 'any' },
    },
  ],
};

const table: Record<Kind, Ports> = Object.fromEntries(
  (Object.keys(PORT_DEFINITIONS) as Kind[]).map((k) => [
    k,
    {
      inputs: PORT_DEFINITIONS[k]
        .filter(
          (p) =>
            p.direction === 'input' &&
            (k !== 'database' ||
              !['id', 'filter', 'limit', 'offset', 'connection'].includes(p.id)) &&
            (k !== 'auth' || p.id !== 'connection'),
        )
        .map((p) => p.id),
      outputs: PORT_DEFINITIONS[k]
        .filter(
          (p) =>
            p.direction === 'output' &&
            (k !== 'screen' || p.id !== 'routes') &&
            (k !== 'database' || !['total', 'deletedCount'].includes(p.id)) &&
            (k !== 'auth' || p.id !== 'session'),
        )
        .map((p) => p.id),
    },
  ]),
) as Record<Kind, Ports>;

export function ports(kind: Kind): Ports {
  return table[kind];
}

/** Normaliza um CustomPort legado ou parcial em uma definição formal completa */
export function normalizeCustomPort(port: CustomPort, blockKind?: Kind): PortDefinition {
  let mode: PortMode | undefined = port.mode;
  let cardinality: PortCardinality | undefined = port.cardinality;
  let valueType: ValueType | undefined = port.valueType;

  // Busca correspondência no catálogo padrão
  if (blockKind && PORT_DEFINITIONS[blockKind]) {
    const catalogPort = PORT_DEFINITIONS[blockKind].find(
      (p) => p.id === port.id && p.direction === port.direction,
    );
    if (catalogPort) {
      mode = mode || catalogPort.mode;
      cardinality = cardinality || catalogPort.cardinality;
      valueType = valueType || catalogPort.valueType;
    }
  }

  // Inferência semântica baseada no tipo textual legado ou características
  if (!mode) {
    const typeStr = port.type || DEFAULT_PORT_TYPES[port.id];
    if (typeStr === 'Event') {
      mode = 'control';
      cardinality = cardinality || 'many';
    } else if (typeStr === 'Error' || port.id === 'onError') {
      mode = 'error';
      cardinality = cardinality || 'many';
      valueType = valueType || { kind: 'error' };
    } else if (typeStr) {
      mode = 'data';
      cardinality = cardinality || (port.direction === 'input' ? 'one' : 'many');
      valueType = valueType || parseValueType(typeStr);
    } else if (isExecInput(port.id) || isExecOutput(port.id)) {
      mode = 'control';
      cardinality = cardinality || 'many';
    } else {
      mode = 'data';
      cardinality = cardinality || (port.direction === 'input' ? 'one' : 'many');
      valueType = valueType || { kind: 'any' };
    }
  }

  if (mode === 'data' && !valueType) {
    valueType = parseValueType(port.type || DEFAULT_PORT_TYPES[port.id] || 'any');
  }

  if (!cardinality) {
    cardinality = port.direction === 'input' && mode === 'data' ? 'one' : 'many';
  }

  return {
    id: port.id,
    name: port.name || port.id,
    direction: port.direction,
    mode,
    cardinality,
    valueType,
    required: port.required,
  };
}

/** Obtém a lista de definições formais de portas de um bloco */
export function getBlockPortDefinitions(block: Block): PortDefinition[] {
  if (block.data.ports !== undefined && block.data.ports.length > 0) {
    return block.data.ports.map((p) => normalizeCustomPort(p, block.data.kind));
  }
  return PORT_DEFINITIONS[block.data.kind] || [];
}

/** Localiza a definição formal de uma porta em um bloco ou Kind */
export function getPortDefinition(
  blockOrKind: Block | Kind,
  portId: string,
  direction?: 'input' | 'output',
): PortDefinition | undefined {
  if (typeof blockOrKind === 'string') {
    const defs = PORT_DEFINITIONS[blockOrKind] || [];
    return defs.find((p) => p.id === portId && (!direction || p.direction === direction));
  }
  if (blockOrKind.data.ports !== undefined && blockOrKind.data.ports.length > 0) {
    const found = blockOrKind.data.ports.find(
      (p) => p.id === portId && (!direction || p.direction === direction),
    );
    if (found) {
      return normalizeCustomPort(found, blockOrKind.data.kind);
    }
  }
  const catalogDefs = PORT_DEFINITIONS[blockOrKind.data.kind] || [];
  return catalogDefs.find((p) => p.id === portId && (!direction || p.direction === direction));
}

/** Normaliza todas as portas salvas no bloco para garantir formato semântico completo */
export function normalizeBlockPorts(block: Block): Block {
  if (block.data.ports === undefined) return block;
  return {
    ...block,
    data: {
      ...block.data,
      ports: block.data.ports.map((p) => {
        const norm = normalizeCustomPort(p, block.data.kind);
        return {
          ...p,
          mode: norm.mode,
          cardinality: norm.cardinality,
          valueType: norm.valueType,
          type: p.type || formatValueType(norm.valueType),
        };
      }),
    },
  };
}

/** Normaliza todos os blocos e portas de um grafo ao carregar de persistência */
export function normalizeGraph(graph: Graph): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      normalizeBlockPorts({
        ...node,
        data: { ...node.data, contractVersion: node.data.contractVersion ?? 1 },
      }),
    ),
  };
}

export const isExecInput = (handle?: string | null, block?: Block): boolean => {
  if (block && handle) {
    const def = getPortDefinition(block, handle, 'input');
    if (def) return def.mode === 'control' || def.mode === 'error';
  }
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

export const isExecOutput = (handle?: string | null, block?: Block): boolean => {
  if (block && handle) {
    const def = getPortDefinition(block, handle, 'output');
    if (def) return def.mode === 'control' || def.mode === 'error';
  }
  const h = (handle || '').toLowerCase();
  if (KNOWN_EXEC_INPUTS.has(h)) return false;
  return (
    EXEC_OUTPUTS.some((p) => p.toLowerCase() === h) ||
    h.startsWith('on') ||
    h.endsWith('click') ||
    h.startsWith('case') ||
    h === 'true' ||
    h === 'false' ||
    h === 'valid' ||
    h === 'invalid' ||
    h === 'default' ||
    h === 'then'
  );
};

/** Validação formal de conexão: direção, modo, tipo e cardinalidade sem heurísticas de nome */
export function validateConnection(
  g: Graph,
  c: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    id?: string;
  },
): string | null {
  if (!c.source || !c.target || c.source === c.target) {
    return 'Escolha dois blocos diferentes.';
  }

  const sourceNode = g.nodes.find((n) => n.id === c.source);
  const targetNode = g.nodes.find((n) => n.id === c.target);
  if (!sourceNode || !targetNode) {
    return 'Conexão com bloco inexistente.';
  }

  const sourceHandle = c.sourceHandle || '';
  const targetHandle = c.targetHandle || '';

  const sourcePort =
    getPortDefinition(sourceNode, sourceHandle, 'output') ||
    getPortDefinition(sourceNode, sourceHandle) ||
    (sourceNode.data.kind === 'screen' && sourceHandle === 'routes'
      ? {
          id: 'routes',
          name: 'routes',
          direction: 'output' as const,
          mode: 'control' as const,
          cardinality: 'many' as const,
        }
      : undefined);

  const targetPort =
    getPortDefinition(targetNode, targetHandle, 'input') ||
    getPortDefinition(targetNode, targetHandle);

  if (!sourcePort || !targetPort) {
    return 'Porta de conexão inválida.';
  }

  // 1. Direção
  if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') {
    return `Direção inválida: conecte uma saída (OUT) a uma entrada (IN). Bloco "${sourceNode.data.label}" (${sourcePort.name}) -> Bloco "${targetNode.data.label}" (${targetPort.name}).`;
  }

  // 2. Modo
  const modeValid =
    sourcePort.mode === targetPort.mode ||
    (sourcePort.mode === 'error' && (targetPort.mode === 'control' || targetPort.mode === 'error'));

  if (!modeValid) {
    const sMode =
      sourcePort.mode === 'control'
        ? 'controle/evento'
        : sourcePort.mode === 'error'
          ? 'erro'
          : 'dados';
    const tMode =
      targetPort.mode === 'control'
        ? 'controle/evento'
        : targetPort.mode === 'error'
          ? 'erro'
          : 'dados';
    return `Incompatibilidade de modo: porta de ${sMode} "${sourcePort.name}" (${sourceNode.data.label}) não pode conectar à porta de ${tMode} "${targetPort.name}" (${targetNode.data.label}). Conecte eventos (Lado A) a ouvintes de execução (Lado B) e dados a dados.`;
  }

  // 3. Tipo (quando ambas forem de dados)
  if (sourcePort.mode === 'data' && targetPort.mode === 'data') {
    if (!isTypeCompatible(sourcePort.valueType, targetPort.valueType)) {
      const sType = formatValueType(sourcePort.valueType);
      const tType = formatValueType(targetPort.valueType);
      return `Tipo incompatível: Bloco "${sourceNode.data.label}" (porta "${sourcePort.name}") do tipo ${sType} é incompatível com Bloco "${targetNode.data.label}" (porta "${targetPort.name}") do tipo ${tType}.`;
    }
  }

  // 4. Cardinalidade
  const existingEdges = g.edges.filter((e) => !c.id || e.id !== c.id);

  if (sourcePort.cardinality === 'one') {
    const outCount = existingEdges.filter(
      (e) => e.source === c.source && (e.sourceHandle || '') === sourceHandle,
    ).length;
    if (outCount >= 1) {
      return `Limite de cardinalidade excedido: a saída "${sourcePort.name}" do bloco "${sourceNode.data.label}" aceita apenas 1 conexão (cardinalidade: one).`;
    }
  }

  if (targetPort.cardinality === 'one') {
    const inCount = existingEdges.filter(
      (e) => e.target === c.target && (e.targetHandle || '') === targetHandle,
    ).length;
    if (inCount >= 1) {
      return `Limite de cardinalidade excedido: a entrada "${targetPort.name}" do bloco "${targetNode.data.label}" aceita apenas 1 conexão de origem (cardinalidade: one).`;
    }
  }

  return null;
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
    return block.data.ports.map((p) => {
      const norm = normalizeCustomPort(p, block.data.kind);
      return {
        ...p,
        mode: norm.mode,
        cardinality: norm.cardinality,
        valueType: norm.valueType,
        type: p.type || formatValueType(norm.valueType),
      };
    });
  }
  const defs = PORT_DEFINITIONS[block.data.kind] || [];
  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    direction: d.direction,
    mode: d.mode,
    cardinality: d.cardinality,
    valueType: d.valueType,
    type: formatValueType(d.valueType),
    required: d.required,
  }));
}
