import type { BlockDefinition, Kind } from './types';

const INTERFACE = '#8d9aff';
const LOGIC = '#f4bf70';
const DATA = '#7fc7ed';
const AUTH = '#b99bff';

// A ordem das chaves define a ordem da biblioteca de blocos (a tela é sempre exibida primeiro).
export const catalog: Record<Kind, BlockDefinition> = {
  screen: {
    name: 'Tela',
    category: 'Interface',
    description: 'Uma página do seu aplicativo',
    icon: '▣',
    color: INTERFACE,
    defaults: { title: 'Nova tela', routes: '[]' },
  },
  button: {
    name: 'Botão',
    category: 'Interface',
    description: 'Dispara um fluxo de ações',
    icon: '↗',
    color: INTERFACE,
    defaults: { screenId: '' },
  },
  input: {
    name: 'Campo de entrada',
    category: 'Interface',
    description: 'Texto, e-mail, senha ou número',
    icon: 'T',
    color: INTERFACE,
    defaults: { field: 'text', placeholder: 'Digite aqui', screenId: '', value: '' },
  },
  function: {
    name: 'Função',
    category: 'Lógica',
    description: 'Executa lógica, cálculo ou transformação',
    icon: 'ƒ',
    color: LOGIC,
    defaults: { code: 'return value;' },
  },
  condition: {
    name: 'Condição',
    category: 'Lógica',
    description: 'Escolha entre dois caminhos (true / false)',
    icon: '◇',
    color: LOGIC,
    defaults: { operator: 'truthy', compare: '' },
  },
  auth: {
    name: 'Autenticação',
    category: 'Lógica',
    description: 'Entrar ou criar uma conta simulada',
    icon: '⌘',
    color: AUTH,
    defaults: { provider: 'email', mode: 'login' },
  },
  navigate: {
    name: 'Navegação',
    category: 'Lógica',
    description: 'Abre outra tela do projeto',
    icon: '→',
    color: '#89d5ba',
    defaults: { target: '' },
  },
  database: {
    name: 'Banco de dados',
    category: 'Dados',
    description: 'Consultar ou inserir registros em memória',
    icon: '▤',
    color: DATA,
    defaults: { operation: 'query', table: 'users', mock: '[{"email":"demo@exemplo.com"}]' },
  },
  api: {
    name: 'Requisição API',
    category: 'Dados',
    description: 'Resposta fictícia configurável',
    icon: '↔',
    color: DATA,
    defaults: { method: 'GET', url: '/api/example', mock: '{"ok":true}' },
  },
};

export const categories = ['Interface', 'Lógica', 'Dados'] as const;

/** Blocos que pertencem a uma tela (têm `config.screenId`). */
export const interfaceKinds: Kind[] = ['input', 'button'];

/** Blocos que fornecem um valor diretamente, sem precisar ser executados. */
export const valueKinds: Kind[] = ['input'];

/** Blocos cuja integração é simulada. */
export const simulatedKinds: Kind[] = ['auth', 'api', 'database'];
