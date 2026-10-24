// Campos editáveis de cada tipo de bloco no inspetor.
import { type Block, type Graph, type Kind } from '../../engine';
import type { FieldDefinition } from '../../components/PropertyField';
import { getGraphFlows } from '../canvas/constants';

type Option = { value: string; label: string };

type FieldSpec = {
  key: string;
  label: string;
  /** Lista fixa de opções, 'screens' para as telas do projeto, ou 'flows' para os fluxos cadastrados. */
  options?: Option[] | 'screens' | 'flows';
  area?: boolean;
  /** Exibe o campo somente quando a condição for verdadeira. */
  visible?: (config: Record<string, string>) => boolean;
};

const same = (...values: string[]): Option[] => values.map((v) => ({ value: v, label: v }));

const SCREEN_ID: FieldSpec = { key: 'screenId', label: 'Pertence à tela', options: 'screens' };
const FLOW_ID: FieldSpec = { key: 'flowId', label: 'Vincular ao Fluxo', options: 'flows' };

const specificFields: Partial<Record<Kind, FieldSpec[]>> = {
  screen: [{ key: 'title', label: 'Título da tela' }],
  input: [
    { key: 'field', label: 'Tipo do campo', options: same('text', 'email', 'password', 'number') },
    { key: 'placeholder', label: 'Texto de ajuda' },
    { key: 'value', label: 'Valor inicial' },
  ],
  button: [],
  function: [],
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
      visible: (c) => !c.provider || c.provider === 'email',
    },
    {
      key: 'clientId',
      label: 'Client ID (Google)',
      visible: (c) => c.provider === 'google',
    },
    {
      key: 'mockToken',
      label: 'Token OAuth Fictício',
      visible: (c) => c.provider === 'google',
    },
    {
      key: 'googleEmail',
      label: 'E-mail Teste Google',
      visible: (c) => c.provider === 'google',
    },
  ],
  error: [
    { key: 'message', label: 'Mensagem do alerta de erro' },
    {
      key: 'type',
      label: 'Tipo de alerta',
      options: [
        { value: 'toast', label: 'Notificação rápida (Toast)' },
        { value: 'modal', label: 'Modal de erro' },
        { value: 'banner', label: 'Banner inline' },
      ],
    },
  ],
  notify: [
    {
      key: 'type',
      label: 'Tipo de Notificação',
      options: [
        { value: 'success', label: 'Sucesso (Verde)' },
        { value: 'warning', label: 'Aviso (Amarelo)' },
        { value: 'info', label: 'Informativo (Azul)' },
        { value: 'error', label: 'Erro (Vermelho)' },
      ],
    },
    { key: 'message', label: 'Mensagem da notificação' },
    { key: 'duration', label: 'Duração em tela (ms)' },
  ],
  state: [
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'set', label: 'Salvar valor (Set)' },
        { value: 'get', label: 'Ler valor (Get)' },
        { value: 'toggle', label: 'Alternar booleano (Toggle)' },
        { value: 'clear', label: 'Limpar variável (Clear)' },
      ],
    },
    { key: 'key', label: 'Nome da variável / Chave' },
    { key: 'value', label: 'Valor fixo ou padrão' },
  ],
  validator: [
    {
      key: 'rule',
      label: 'Regra de Validação',
      options: [
        { value: 'required', label: 'Obrigatório (Não vazio)' },
        { value: 'email', label: 'Formato de E-mail' },
        { value: 'minLength', label: 'Tamanho Mínimo (caracteres)' },
        { value: 'maxLength', label: 'Tamanho Máximo (caracteres)' },
        { value: 'numeric', label: 'Numérico' },
        { value: 'cpf', label: 'CPF (11 dígitos)' },
        { value: 'regex', label: 'Expressão Regular (Regex)' },
      ],
    },
    { key: 'param', label: 'Parâmetro da regra (mín, máx ou padrão regex)' },
    { key: 'message', label: 'Mensagem de erro se inválido' },
  ],
  switch: [
    { key: 'cases', label: 'Casos possíveis (separados por vírgula)' },
    { key: 'defaultCase', label: 'Rótulo do caso padrão' },
  ],
  delay: [{ key: 'duration', label: 'Tempo de espera (ms)' }],
  navigate: [{ key: 'target', label: 'Tela de destino', options: 'screens' }],
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
        { value: 'query', label: 'Consultar (Query)' },
        { value: 'get', label: 'Buscar por ID (Get)' },
        { value: 'insert', label: 'Inserir registro (Insert)' },
        { value: 'update', label: 'Atualizar registro (Update)' },
        { value: 'delete', label: 'Excluir registro (Delete)' },
      ],
    },
    { key: 'table', label: 'Nome da tabela' },
    { key: 'filterField', label: 'Campo do filtro (Query)' },
    { key: 'filterValue', label: 'Valor do filtro (Query)' },
    { key: 'limit', label: 'Limite / Page size (Query)' },
    { key: 'offset', label: 'Deslocamento / Offset (Query)' },
    { key: 'orderBy', label: 'Ordenar por (Query)' },
    {
      key: 'orderDirection',
      label: 'Direção da ordenação',
      options: [
        { value: 'asc', label: 'Crescente (ASC)' },
        { value: 'desc', label: 'Decrescente (DESC)' },
      ],
    },
    { key: 'recordId', label: 'ID do registro (Get/Update/Delete)' },
    { key: 'mock', label: 'Registros iniciais (array JSON)', area: true },
  ],
  constant: [
    {
      key: 'valueType',
      label: 'Tipo da Constante',
      options: [
        { value: 'string', label: 'Texto (string)' },
        { value: 'number', label: 'Número (number)' },
        { value: 'boolean', label: 'Booleano (boolean)' },
        { value: 'json', label: 'JSON / Objeto' },
      ],
    },
    { key: 'value', label: 'Valor da Constante' },
  ],
  math: [
    {
      key: 'operation',
      label: 'Operação Matemática',
      options: [
        { value: 'add', label: 'Soma (+)' },
        { value: 'sub', label: 'Subtração (-)' },
        { value: 'mul', label: 'Multiplicação (*)' },
        { value: 'div', label: 'Divisão (/)' },
        { value: 'mod', label: 'Resto da divisão (%)' },
        { value: 'pow', label: 'Potência (**)' },
        { value: 'round', label: 'Arredondar' },
        { value: 'abs', label: 'Valor absoluto' },
      ],
    },
    { key: 'a', label: 'Valor A (padrão se desconectado)' },
    { key: 'b', label: 'Valor B (padrão se desconectado)' },
  ],
  text: [
    {
      key: 'operation',
      label: 'Operação de Texto',
      options: [
        { value: 'concat', label: 'Concatenar / Juntar' },
        { value: 'upper', label: 'Converter para MAIÚSCULAS' },
        { value: 'lower', label: 'Converter para minúsculas' },
        { value: 'trim', label: 'Aparar espaços nas pontas' },
        { value: 'split', label: 'Dividir por caractere' },
        { value: 'replace', label: 'Substituir termo' },
      ],
    },
    { key: 'value', label: 'Texto base' },
    { key: 'arg', label: 'Argumento extra / Separador / Substituto' },
  ],
  compare: [
    {
      key: 'operator',
      label: 'Operador de Comparação',
      options: [
        { value: 'eq', label: 'Igual a (==)' },
        { value: 'neq', label: 'Diferente de (!=)' },
        { value: 'gt', label: 'Maior que (>)' },
        { value: 'gte', label: 'Maior ou igual a (>=)' },
        { value: 'lt', label: 'Menor que (<)' },
        { value: 'lte', label: 'Menor ou igual a (<=)' },
        { value: 'contains', label: 'Texto contém substring' },
      ],
    },
    { key: 'left', label: 'Valor à Esquerda (A)' },
    { key: 'right', label: 'Valor à Direita (B)' },
  ],
  boolean: [
    {
      key: 'operation',
      label: 'Operação Lógica',
      options: [
        { value: 'and', label: 'E lógico (AND)' },
        { value: 'or', label: 'OU lógico (OR)' },
        { value: 'not', label: 'NÃO lógico (NOT)' },
      ],
    },
    {
      key: 'a',
      label: 'Valor A',
      options: [
        { value: 'true', label: 'Verdadeiro' },
        { value: 'false', label: 'Falso' },
      ],
    },
    {
      key: 'b',
      label: 'Valor B',
      options: [
        { value: 'true', label: 'Verdadeiro' },
        { value: 'false', label: 'Falso' },
      ],
      visible: (c) => c.operation !== 'not',
    },
  ],
  object: [{ key: 'fields', label: 'Campos do objeto (JSON ou chaves separadas por vírgula)' }],
  array: [{ key: 'items', label: 'Itens iniciais (separados por vírgula)' }],
};

const CODE_FIELD: FieldSpec = {
  key: 'code',
  label: 'Código',
  area: true,
};

export function fieldsFor(kind: Kind): FieldSpec[] {
  const specific = specificFields[kind] ?? [];
  const base = kind !== 'screen' ? [SCREEN_ID, FLOW_ID, ...specific] : [FLOW_ID, ...specific];
  return [...base.filter((f) => f.key !== 'code'), CODE_FIELD];
}

export function screenOptions(g: Graph): Option[] {
  return [
    { value: '', label: 'Selecione uma tela' },
    ...g.nodes
      .filter((n) => n.data.kind === 'screen')
      .map((n) => ({ value: n.id, label: n.data.label })),
  ];
}

export function flowOptions(g: Graph): Option[] {
  const flows = getGraphFlows(g.flows);
  return [
    { value: '', label: 'Automático / Padrão da fase' },
    ...flows.map((f, idx) => ({
      value: f.id,
      label: `Fase ${idx + 1} · ${f.name}`,
    })),
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
      options:
        spec.options === 'screens'
          ? screenOptions(g)
          : spec.options === 'flows'
            ? flowOptions(g)
            : spec.options,
      area: spec.area,
      onChange: (value: string) => onChange({ [spec.key]: value }),
    }));
}
