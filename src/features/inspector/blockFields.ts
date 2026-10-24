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
        { value: 'query', label: 'Consultar todos' },
        { value: 'insert', label: 'Inserir registro' },
      ],
    },
    { key: 'table', label: 'Nome da tabela' },
    { key: 'mock', label: 'Registros iniciais (array JSON)', area: true },
  ],
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
