import type { BlockDefinition, Kind } from './types';

const INTERFACE = '#8d9aff';
const LOGIC = '#f4bf70';
const DATA = '#7fc7ed';
const AUTH = '#b99bff';

// A ordem das chaves define a ordem da biblioteca de blocos (a tela é sempre exibida primeiro).
export const catalog: Record<Kind, BlockDefinition> = {
  text: {
    name: 'Texto / título',
    category: 'Interface',
    description: 'Título, parágrafo ou legenda',
    icon: 'H',
    color: INTERFACE,
    defaults: { screenId: '', text: 'Seu texto aqui', style: 'paragraph' },
  },
  textarea: {
    name: 'Área de texto',
    category: 'Interface',
    description: 'Entrada com várias linhas',
    icon: '☰',
    color: INTERFACE,
    defaults: { screenId: '', placeholder: 'Escreva aqui', value: '' },
  },
  select: {
    name: 'Lista de seleção',
    category: 'Interface',
    description: 'Escolher uma opção de uma lista',
    icon: '▾',
    color: INTERFACE,
    defaults: { screenId: '', options: 'Opção 1,Opção 2,Opção 3', value: 'Opção 1' },
  },
  checkbox: {
    name: 'Caixa de seleção',
    category: 'Interface',
    description: 'Alternar verdadeiro e falso',
    icon: '☑',
    color: INTERFACE,
    defaults: { screenId: '', value: 'false' },
  },
  divider: {
    name: 'Separador',
    category: 'Interface',
    description: 'Divisão visual entre elementos',
    icon: '―',
    color: INTERFACE,
    defaults: { screenId: '' },
  },
  constant: {
    name: 'Valor constante',
    category: 'Dados',
    description: 'Texto, número, booleano ou JSON',
    icon: '#',
    color: DATA,
    defaults: { value: 'Olá', valueType: 'text' },
  },
  variable: {
    name: 'Variável',
    category: 'Lógica',
    description: 'Ler ou definir valor em memória',
    icon: 'x',
    color: LOGIC,
    defaults: { key: 'minhaVariavel', operation: 'set', value: '' },
  },
  validation: {
    name: 'Validar campo',
    category: 'Lógica',
    description: 'Obrigatório, e-mail, tamanho ou número',
    icon: '✓',
    color: LOGIC,
    defaults: { rule: 'required', minimum: '6' },
  },
  transform: {
    name: 'Transformar texto',
    category: 'Lógica',
    description: 'Maiúsculas, minúsculas, limpar ou juntar',
    icon: 'Aa',
    color: LOGIC,
    defaults: { operation: 'trim', suffix: '', value: '' },
  },
  notify: {
    name: 'Mensagem / alerta',
    category: 'Lógica',
    description: 'Exibir mensagem ao usuário',
    icon: '!',
    color: LOGIC,
    defaults: { message: 'Operação concluída' },
  },
  logout: {
    name: 'Encerrar sessão',
    category: 'Lógica',
    description: 'Limpar a sessão simulada',
    icon: '⇥',
    color: LOGIC,
    defaults: {},
  },
  screen: {
    name: 'Tela',
    category: 'Interface',
    description: 'Uma página do seu aplicativo',
    icon: '▣',
    color: INTERFACE,
    defaults: { title: 'Nova tela', routes: '[]' },
  },
  input: {
    name: 'Campo de entrada',
    category: 'Interface',
    description: 'Texto, e-mail, senha ou número',
    icon: 'T',
    color: INTERFACE,
    defaults: { field: 'text', placeholder: 'Digite aqui', screenId: '', value: '' },
  },
  button: {
    name: 'Botão',
    category: 'Interface',
    description: 'Dispara um fluxo de ações',
    icon: '↗',
    color: INTERFACE,
    defaults: { screenId: '' },
  },
  auth: {
    name: 'Autenticação',
    category: 'Lógica',
    description: 'Entrar ou criar uma conta simulada',
    icon: '⌘',
    color: AUTH,
    defaults: { provider: 'email', mode: 'login' },
  },
  condition: {
    name: 'Condição',
    category: 'Lógica',
    description: 'Escolha entre dois caminhos',
    icon: '◇',
    color: LOGIC,
    defaults: { operator: 'truthy', compare: '' },
  },
  math: {
    name: 'Operação matemática',
    category: 'Lógica',
    description: 'Somar, subtrair, multiplicar ou dividir',
    icon: '∑',
    color: LOGIC,
    defaults: { operation: 'add', a: '0', b: '0' },
  },
  navigate: {
    name: 'Navegação',
    category: 'Lógica',
    description: 'Abre outra tela do projeto',
    icon: '→',
    color: '#89d5ba',
    defaults: { target: '' },
  },
  reset: {
    name: 'Redefinir senha',
    category: 'Lógica',
    description: 'Simula envio por e-mail, SMS ou token',
    icon: '↺',
    color: AUTH,
    defaults: { channel: 'email' },
  },
  api: {
    name: 'Requisição API',
    category: 'Dados',
    description: 'Resposta fictícia configurável',
    icon: '↔',
    color: DATA,
    defaults: { method: 'GET', url: '/api/example', mock: '{"ok":true}' },
  },
  database: {
    name: 'Banco de dados',
    category: 'Dados',
    description: 'Consultar ou inserir registros em memória',
    icon: '▤',
    color: DATA,
    defaults: { operation: 'query', table: 'users', mock: '[{"email":"demo@exemplo.com"}]' },
  },
  class: {
    name: 'Classe / modelo',
    category: 'Estrutura',
    description: 'Nome e atributos de uma classe',
    icon: '{}',
    color: '#91cfa3',
    defaults: { name: 'User', fields: 'id,email,name' },
  },
};

export const categories = ['Interface', 'Lógica', 'Dados', 'Estrutura'] as const;

/** Blocos que pertencem a uma tela (têm `config.screenId`). */
export const interfaceKinds: Kind[] = [
  'input',
  'button',
  'text',
  'textarea',
  'select',
  'checkbox',
  'divider',
];

/** Blocos que fornecem um valor diretamente, sem precisar ser executados. */
export const valueKinds: Kind[] = ['input', 'textarea', 'select', 'checkbox', 'constant'];

/** Blocos cuja integração é simulada. */
export const simulatedKinds: Kind[] = ['auth', 'api', 'database', 'reset'];
