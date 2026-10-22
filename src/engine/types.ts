export type Kind =
  | 'screen'
  | 'button'
  | 'input'
  | 'function'
  | 'condition'
  | 'auth'
  | 'database'
  | 'api'
  | 'error'
  | 'navigate';

export type CustomPort = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  type?: string;
  value?: string;
};

export type BlockData = {
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
};

export type Graph = {
  version: 1;
  name: string;
  nodes: Block[];
  edges: Link[];
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
export type Store = Record<string, unknown[]>;

export type BlockDefinition = {
  name: string;
  category: Category;
  description: string;
  icon: string;
  color: string;
  defaults: Record<string, string>;
};

export type Category = 'Interface' | 'Lógica' | 'Dados';
