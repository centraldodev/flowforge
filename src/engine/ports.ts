import type { Kind } from './types';

export type Ports = { inputs: string[]; outputs: string[] };

/** Saídas que continuam o caminho de execução (as demais carregam dados). */
export const EXEC_OUTPUTS = ['next', 'true', 'false'];

export const isExecOutput = (handle?: string | null) => EXEC_OUTPUTS.includes(handle || '');

const VALUE: Ports = { inputs: [], outputs: ['value'] };
const NONE: Ports = { inputs: [], outputs: [] };
const ACTION_WITH_VALUE: Ports = { inputs: ['exec', 'value'], outputs: ['next', 'value'] };
const BRANCH: Ports = { inputs: ['exec', 'value'], outputs: ['true', 'false', 'value'] };

const table: Record<Kind, Ports> = {
  // Interface
  screen: { inputs: ['exec'], outputs: [] },
  input: VALUE,
  textarea: VALUE,
  select: VALUE,
  checkbox: VALUE,
  text: NONE,
  divider: NONE,
  button: { inputs: [], outputs: ['next', 'value'] },
  // Dados
  constant: VALUE,
  api: { inputs: ['exec', 'body'], outputs: ['next', 'value'] },
  database: { inputs: ['exec', 'value'], outputs: ['next', 'value'] },
  // Lógica
  variable: ACTION_WITH_VALUE,
  transform: ACTION_WITH_VALUE,
  notify: ACTION_WITH_VALUE,
  validation: BRANCH,
  condition: BRANCH,
  auth: { inputs: ['exec', 'email', 'password'], outputs: ['next', 'value'] },
  reset: { inputs: ['exec', 'email'], outputs: ['next', 'value'] },
  math: { inputs: ['exec', 'a', 'b'], outputs: ['next', 'value'] },
  navigate: { inputs: ['exec'], outputs: ['next', 'value'] },
  logout: { inputs: ['exec'], outputs: ['next', 'value'] },
  // Estrutura
  class: NONE,
};

export function ports(kind: Kind): Ports {
  return table[kind];
}
