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
  notify: {
    name: 'Notificação',
    category: 'Lógica',
    description: 'Exibe alerta visual ou mensagem toast (sucesso, aviso, info, erro)',
    icon: '🔔',
    color: '#34d399',
    defaults: {
      type: 'success',
      message: 'Operação realizada com sucesso!',
      duration: '3000',
      screenId: '',
    },
  },
  state: {
    name: 'Estado / Store',
    category: 'Dados',
    description: 'Armazena, lê, alterna ou remove variáveis em memória',
    icon: '🗄️',
    color: '#818cf8',
    defaults: {
      operation: 'set',
      key: 'variavel',
      value: '',
      screenId: '',
    },
  },
  validator: {
    name: 'Validador',
    category: 'Lógica',
    description: 'Valida dados com regras (obrigatório, e-mail, tamanho, número)',
    icon: '✓',
    color: '#fbbf24',
    defaults: {
      rule: 'required',
      param: '',
      message: 'Campo obrigatório ou formato inválido',
      screenId: '',
    },
  },
  switch: {
    name: 'Alternador / Switch',
    category: 'Lógica',
    description: 'Roteia o fluxo para múltiplos caminhos com base no valor avaliado',
    icon: '⑂',
    color: '#f472b6',
    defaults: {
      cases: 'opcao1, opcao2',
      defaultCase: 'default',
      screenId: '',
    },
  },
  delay: {
    name: 'Atraso / Timer',
    category: 'Lógica',
    description: 'Aguarda um intervalo de tempo em milissegundos antes de prosseguir',
    icon: '⏱️',
    color: '#38bdf8',
    defaults: {
      duration: '1000',
      screenId: '',
    },
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
    description:
      'Operações CRUD completas (query, get, insert, update, delete) com paginação e filtros',
    icon: '▤',
    color: DATA,
    defaults: {
      operation: 'query',
      table: 'usuarios',
      filterField: '',
      filterValue: '',
      limit: '10',
      offset: '0',
      orderBy: '',
      orderDirection: 'asc',
      recordId: '',
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
  constant: {
    name: 'Constante / Literal',
    category: 'Dados',
    description: 'Valor fixo tipado (texto, número, booleano ou json)',
    icon: '🔤',
    color: '#a78bfa',
    defaults: { valueType: 'string', value: '' },
  },
  math: {
    name: 'Operação Matemática',
    category: 'Lógica',
    description: 'Cálculos matemáticos (soma, subtração, multiplicação, divisão)',
    icon: '➕',
    color: '#fb923c',
    defaults: { operation: 'add', a: '0', b: '0' },
  },
  text: {
    name: 'Operação de Texto',
    category: 'Lógica',
    description: 'Transformação de texto (maiusc., minusc., aparar, juntar)',
    icon: '✂️',
    color: '#34d399',
    defaults: { operation: 'concat', value: '', arg: '' },
  },
  compare: {
    name: 'Comparação',
    category: 'Lógica',
    description: 'Compara dois valores e ramifica o fluxo',
    icon: '⚖️',
    color: '#f4bf70',
    defaults: { operator: 'eq', left: '', right: '' },
  },
  boolean: {
    name: 'Lógica Booleana',
    category: 'Lógica',
    description: 'Operações lógicas E (AND), OU (OR) e NÃO (NOT)',
    icon: '☯',
    color: '#f472b6',
    defaults: { operation: 'and', a: 'false', b: 'false' },
  },
  object: {
    name: 'Objeto',
    category: 'Dados',
    description: 'Cria ou manipula um dicionário chave/valor',
    icon: '📦',
    color: '#60a5fa',
    defaults: { fields: 'nome, email' },
  },
  array: {
    name: 'Lista / Array',
    category: 'Dados',
    description: 'Cria uma lista a partir de itens conectados',
    icon: '📑',
    color: '#38bdf8',
    defaults: { items: '' },
  },
};

export const categories = ['Interface', 'Lógica', 'Dados'] as const;

/** Tipos visíveis na biblioteca de blocos da barra lateral (telas agora são gerenciadas como abas). */
export const visibleKinds: Kind[] = [
  'button',
  'input',
  'function',
  'condition',
  'validator',
  'switch',
  'delay',
  'notify',
  'state',
  'auth',
  'error',
  'database',
  'api',
  'constant',
  'math',
  'text',
  'compare',
  'boolean',
  'object',
  'array',
];

/** Blocos que pertencem a uma tela (têm `config.screenId`). */
export const interfaceKinds: Kind[] = ['input', 'button'];

/** Blocos que fornecem um valor diretamente, sem precisar ser executados. */
export const valueKinds: Kind[] = ['input', 'constant'];

/** Blocos cuja integração é simulada. */
export const simulatedKinds: Kind[] = ['auth', 'api', 'database'];
