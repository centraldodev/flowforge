export type Kind =
  | 'screen'
  | 'button'
  | 'input'
  | 'function'
  | 'condition'
  | 'auth'
  | 'database'
  | 'api'
  | 'httpConnection'
  | 'postgresConnection'
  | 'entity'
  | 'identityProvider'
  | 'policy'
  | 'error'
  | 'navigate'
  | 'notify'
  | 'state'
  | 'validator'
  | 'switch'
  | 'delay'
  | 'constant'
  | 'math'
  | 'text'
  | 'compare'
  | 'boolean'
  | 'object'
  | 'array'
  | 'subflow'
  | 'storage'
  | 'email'
  | 'webhook'
  | 'task'
  | 'payment'
  | 'realtime'
  | 'loop'
  | 'form';

export type PortMode = 'control' | 'data' | 'error' | 'resource';
export type PortCardinality = 'one' | 'many';

export type ValueType =
  | { kind: 'any' }
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'error' }
  | { kind: 'object'; name?: string }
  | { kind: 'array'; item: ValueType }
  | { kind: 'union'; members: ValueType[] };

export type PortDefinition = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  mode: PortMode;
  valueType?: ValueType;
  cardinality: PortCardinality;
  required?: boolean;
};

export type CustomPort = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  mode?: PortMode;
  cardinality?: PortCardinality;
  valueType?: ValueType;
  type?: string;
  value?: string;
  required?: boolean;
};

export type BlockData = {
  /** Ausente em projetos legados equivale à versão 1. */
  contractVersion?: number;
  kind: Kind;
  label: string;
  config: Record<string, string>;
  ports?: CustomPort[];
};

export type Block = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: BlockData;
};

export type Link = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    callArg?: string;
    customCode?: string;
  };
};

export type FlowStage = {
  id: string;
  name: string;
  color?: string;
};

export type Graph = {
  visualDesign?: import('./visualDesign').VisualDesign;
  httpEnvironment?: 'development' | 'production';
  darkModeEnabled?: boolean;
  version: 1;
  name: string;
  nodes: Block[];
  edges: Link[];
  flows?: FlowStage[];
  tests?: import('./testScenarios').TestScenario[];
  entities?: import('./database').EntityDefinition[];
  auth?: import('./auth').IdentityProviderConfig;
  databasePolicy?: { multitenancy?: unknown };
};

export type ScreenRoute = {
  id: string;
  trigger: string;
  when: 'true' | 'false' | 'always';
  target: string;
};

export type Trace = { id: string; label: string; message: string };

export type Result = {
  trace: Trace[];
  messages: string[];
  screen?: string;
  outputs: Record<string, unknown>;
};

/** Memória da simulação: tabelas, variáveis, usuários e sessão. */
export type Store = Record<string, unknown>;

export type BlockDefinition = {
  name: string;
  category: Category;
  description: string;
  icon: string;
  color: string;
  defaults: Record<string, string>;
};

export type Category = 'Interface' | 'Lógica' | 'Dados';
