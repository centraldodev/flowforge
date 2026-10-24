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
    defaults: {
      provider: 'email',
      mode: 'login',
      clientId: 'google-oauth-flowforge.apps.googleusercontent.com',
      mockToken: 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE',
      googleEmail: 'google.teste@gmail.com',
      googleName: 'Google Teste',
    },
  },
  error: {
    name: 'Tratamento de Erro',
    category: 'Lógica',
    description: 'Captura falhas, exibe alertas e gerencia exceções',
    icon: '⚠️',
    color: '#f87171',
    defaults: { message: 'Ocorreu um erro no fluxo', type: 'toast' },
  },
  navigate: {
    name: 'Navegação',
    category: 'Lógica',
    description: 'Abre outra tela do projeto (legado: prefira conectar direto à tela)',
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
    defaults: {
      operation: 'query',
      table: 'usuarios',
      mock: JSON.stringify(
        [
          {
            id: 1,
            nome: 'Usuário Teste',
            email: 'demo@exemplo.com',
            senha: '123456',
            provider: 'email',
          },
          {
            id: 2,
            nome: 'Google Teste',
            email: 'google.teste@gmail.com',
            senha: 'google_oauth_pass',
            provider: 'google',
          },
        ],
        null,
        2,
      ),
    },
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

/** Tipos visíveis na biblioteca de blocos da barra lateral (telas agora são gerenciadas como abas). */
export const visibleKinds: Kind[] = [
  'button',
  'input',
  'function',
  'condition',
  'auth',
  'error',
  'database',
  'api',
];

/** Blocos que pertencem a uma tela (têm `config.screenId`). */
export const interfaceKinds: Kind[] = ['input', 'button'];

/** Blocos que fornecem um valor diretamente, sem precisar ser executados. */
export const valueKinds: Kind[] = ['input'];

/** Blocos cuja integração é simulada. */
export const simulatedKinds: Kind[] = ['auth', 'api', 'database'];
