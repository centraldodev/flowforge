export type Kind =
  | 'screen'
  | 'input'
  | 'button'
  | 'auth'
  | 'condition'
  | 'api'
  | 'database'
  | 'math'
  | 'class'
  | 'reset'
  | 'navigate'
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'divider'
  | 'constant'
  | 'variable'
  | 'validation'
  | 'transform'
  | 'notify'
  | 'logout';

export type CustomPort = {
  id: string;
  name: string;
  direction: 'input' | 'output';
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

export type Category = 'Interface' | 'Lógica' | 'Dados' | 'Estrutura';
