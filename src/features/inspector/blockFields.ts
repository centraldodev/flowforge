// Campos editáveis de cada tipo de bloco no inspetor.
import { interfaceKinds, type Block, type Graph, type Kind } from '../../engine';
import type { FieldDefinition } from '../../components/PropertyField';

type Option = { value: string; label: string };

type FieldSpec = {
  key: string;
  label: string;
  /** Lista fixa de opções, ou 'screens' para as telas do projeto. */
  options?: Option[] | 'screens';
  area?: boolean;
  /** Exibe o campo somente quando a condição for verdadeira. */
  visible?: (config: Record<string, string>) => boolean;
};

const same = (...values: string[]): Option[] => values.map((v) => ({ value: v, label: v }));

const SCREEN_ID: FieldSpec = { key: 'screenId', label: 'Pertence à tela', options: 'screens' };

const specificFields: Partial<Record<Kind, FieldSpec[]>> = {
  screen: [{ key: 'title', label: 'Título da tela' }],
  input: [
    { key: 'field', label: 'Tipo do campo', options: same('text', 'email', 'password', 'number') },
    { key: 'placeholder', label: 'Texto de ajuda' },
    { key: 'value', label: 'Valor inicial' },
  ],
  text: [
    { key: 'text', label: 'Conteúdo', area: true },
    {
      key: 'style',
      label: 'Estilo',
      options: [
        { value: 'title', label: 'Título' },
        { value: 'paragraph', label: 'Parágrafo' },
        { value: 'caption', label: 'Legenda' },
      ],
    },
  ],
  textarea: [
    { key: 'placeholder', label: 'Texto de ajuda' },
    { key: 'value', label: 'Valor inicial', area: true },
  ],
  select: [
    { key: 'options', label: 'Opções separadas por vírgula' },
    { key: 'value', label: 'Opção inicial' },
  ],
  checkbox: [
    {
      key: 'value',
      label: 'Estado inicial',
      options: [
        { value: 'false', label: 'Desmarcado' },
        { value: 'true', label: 'Marcado' },
      ],
    },
  ],
  constant: [
    {
      key: 'valueType',
      label: 'Tipo do valor',
      options: [
        { value: 'text', label: 'Texto' },
        { value: 'number', label: 'Número' },
        { value: 'boolean', label: 'Booleano' },
        { value: 'json', label: 'JSON' },
      ],
    },
    { key: 'value', label: 'Valor', area: true },
  ],
  variable: [
    { key: 'key', label: 'Nome da variável' },
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'set', label: 'Definir valor' },
        { value: 'get', label: 'Ler valor' },
      ],
    },
    { key: 'value', label: 'Valor padrão' },
  ],
  validation: [
    {
      key: 'rule',
      label: 'Regra',
      options: [
        { value: 'required', label: 'Obrigatório' },
        { value: 'email', label: 'E-mail válido' },
        { value: 'minLength', label: 'Tamanho mínimo' },
        { value: 'number', label: 'É um número' },
      ],
    },
    {
      key: 'minimum',
      label: 'Quantidade mínima de caracteres',
      visible: (c) => c.rule === 'minLength',
    },
  ],
  transform: [
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'trim', label: 'Remover espaços nas pontas' },
        { value: 'upper', label: 'Maiúsculas' },
        { value: 'lower', label: 'Minúsculas' },
        { value: 'concat', label: 'Acrescentar texto' },
      ],
    },
    { key: 'value', label: 'Texto padrão' },
    { key: 'suffix', label: 'Texto para acrescentar', visible: (c) => c.operation === 'concat' },
  ],
  notify: [{ key: 'message', label: 'Mensagem padrão', area: true }],
  auth: [
    {
      key: 'provider',
      label: 'Provedor',
      options: [
        { value: 'email', label: 'E-mail e senha' },
        { value: 'google', label: 'Google OAuth' },
        { value: 'facebook', label: 'Facebook OAuth' },
        { value: 'firebase', label: 'Firebase Auth' },
      ],
    },
    {
      key: 'mode',
      label: 'Operação',
      options: [
        { value: 'login', label: 'Entrar' },
        { value: 'register', label: 'Criar conta' },
      ],
    },
  ],
  condition: [
    {
      key: 'operator',
      label: 'Comparação',
      options: [
        { value: 'truthy', label: 'É verdadeiro / tem valor' },
        { value: 'equals', label: 'É igual a' },
        { value: 'gt', label: 'É maior que' },
      ],
    },
    { key: 'compare', label: 'Comparar com', visible: (c) => c.operator !== 'truthy' },
  ],
  math: [
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'add', label: 'Somar' },
        { value: 'subtract', label: 'Subtrair' },
        { value: 'multiply', label: 'Multiplicar' },
        { value: 'divide', label: 'Dividir' },
      ],
    },
    { key: 'a', label: 'Valor A (quando não conectado)' },
    { key: 'b', label: 'Valor B (quando não conectado)' },
  ],
  navigate: [{ key: 'target', label: 'Tela de destino', options: 'screens' }],
  reset: [
    { key: 'channel', label: 'Método de recuperação', options: same('email', 'sms', 'token') },
  ],
  api: [
    { key: 'method', label: 'Método HTTP', options: same('GET', 'POST', 'PUT', 'PATCH', 'DELETE') },
    { key: 'url', label: 'Endpoint' },
    { key: 'mock', label: 'Resposta simulada (JSON)', area: true },
  ],
  database: [
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'query', label: 'Consultar todos' },
        { value: 'insert', label: 'Inserir registro' },
      ],
    },
    { key: 'table', label: 'Nome da tabela' },
    { key: 'mock', label: 'Registros iniciais (array JSON)', area: true },
  ],
  class: [
    { key: 'name', label: 'Nome da classe' },
    { key: 'fields', label: 'Atributos separados por vírgula' },
  ],
};

function fieldsFor(kind: Kind): FieldSpec[] {
  const specific = specificFields[kind] ?? [];
  return interfaceKinds.includes(kind) ? [SCREEN_ID, ...specific] : specific;
}

export function screenOptions(g: Graph): Option[] {
  return [
    { value: '', label: 'Selecione uma tela' },
    ...g.nodes
      .filter((n) => n.data.kind === 'screen')
      .map((n) => ({ value: n.id, label: n.data.label })),
  ];
}

/** Campos de configuração do bloco, prontos para o PropertyField. */
export function configFields(
  g: Graph,
  block: Block,
  onChange: (config: Record<string, string>) => void,
): FieldDefinition[] {
  const config = block.data.config;
  return fieldsFor(block.data.kind)
    .filter((spec) => !spec.visible || spec.visible(config))
    .map((spec) => ({
      id: spec.key,
      label: spec.label,
      value: config[spec.key] || '',
      options: spec.options === 'screens' ? screenOptions(g) : spec.options,
      area: spec.area,
      onChange: (value: string) => onChange({ [spec.key]: value }),
    }));
}
