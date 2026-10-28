// Catálogo completo de Funções e Lógicas Pré-Montadas, divididas por categoria,
// compatíveis com todos os 30 tipos de blocos (Kinds) do FlowForge.
// Permite que o código e as conexões do grafo sejam gerados a partir das propriedades escolhidas pelo usuário,
// incluindo recomendações inteligentes e validação de compatibilidade.

import { catalog } from './catalog';
import { getPortDefinition, isExecInput, isExecOutput } from './ports';
import type { Block, Graph, Kind } from './types';

export type LogicCategory =
  | 'Interface & Eventos'
  | 'Validação & Segurança'
  | 'Transformação & Cálculo'
  | 'Controle de Fluxo & Decisão'
  | 'Autenticação & Sessão'
  | 'Persistência & Banco de Dados'
  | 'Integrações, API & Pagamentos'
  | 'Notificações, Mensagens & Tempo Real';

export const LOGIC_CATEGORIES: LogicCategory[] = [
  'Interface & Eventos',
  'Validação & Segurança',
  'Transformação & Cálculo',
  'Controle de Fluxo & Decisão',
  'Autenticação & Sessão',
  'Persistência & Banco de Dados',
  'Integrações, API & Pagamentos',
  'Notificações, Mensagens & Tempo Real',
];

export type LogicVariableType =
  | 'block_ref'
  | 'input_ref'
  | 'screen_ref'
  | 'select'
  | 'text'
  | 'number'
  | 'json';

export type LogicVariableSlot = {
  /** Chave salva em block.data.config (ex: 'callValidatorId', 'rule', 'table', 'targetScreenId') */
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  type: LogicVariableType;
  required?: boolean;
  defaultValue?: string;
  /** Opções caso type === 'select' */
  options?: { value: string; label: string }[];
  /** Tipos de blocos recomendados/compatíveis caso type === 'block_ref' */
  allowedKinds?: Kind[];
  /** Se este slot sincroniza automaticamente uma conexão (aresta) no grafo */
  edgeBinding?: {
    direction: 'outgoing' | 'incoming';
    /** Handle de saída no bloco atual (ex: 'then', 'true', 'false', 'valid', 'invalid', 'onSuccess', 'onError', 'onClick') */
    sourceHandle?: string;
    /** Handle de entrada no bloco de destino (ex: 'execute', 'trigger', 'connection') */
    targetHandle?: string;
    /** Argumento padrão passado na chamada da conexão */
    defaultArg?: string;
  };
};

export type LogicRecommendation = {
  targetKind: Kind;
  title: string;
  reason: string;
  /** Porta de saída onde conectar o bloco recomendado */
  sourceHandle: string;
  /** Porta de entrada do bloco recomendado */
  targetHandle?: string;
  /** Slot de propriedade que será preenchido com o ID do bloco criado/conectado */
  slotKey?: string;
  /** Configuração padrão sugerida para o bloco criado */
  defaultConfig?: Record<string, string>;
};

export type BlockLogicTemplate = {
  id: string;
  name: string;
  category: LogicCategory;
  description: string;
  icon: string;
  /** Tipos de bloco para os quais esta função/lógica foi projetada */
  compatibleKinds: Kind[];
  /** Valores de configuração aplicados imediatamente ao selecionar esta lógica */
  configPatch: Record<string, string>;
  /** Slots variáveis que o usuário preenche (incluindo referências a outros blocos) */
  variables: LogicVariableSlot[];
  /** Recomendações inteligentes baseadas nesta lógica */
  recommendations: LogicRecommendation[];
  /** Gera uma prévia/expressão de código pré-montada com os valores preenchidos pelo usuário */
  buildCodeSnippet: (values: Record<string, string>, blockId: string) => string;
};

/** Sanitiza um ID de bloco em nome de função seguro */
function safeFn(id: string | undefined, fallback = 'blocoDestino'): string {
  if (!id || !id.trim()) return fallback;
  const s = id.trim().replace(/[^a-zA-Z0-9_$]/g, '_');
  return /^[0-9]/.test(s) ? `fn_${s}` : s;
}

export const BLOCK_LOGIC_TEMPLATES: BlockLogicTemplate[] = [
  // ============================================================================
  // 1. INTERFACE & EVENTOS (screen, button, input, navigate)
  // ============================================================================
  {
    id: 'btn_validate_and_auth',
    name: 'Disparar Bloco ao Clicar',
    category: 'Interface & Eventos',
    description: 'Chama outro bloco quando o botão for clicado.',
    icon: 'smart_button',
    compatibleKinds: ['button'],
    configPatch: {},
    variables: [
      {
        key: 'logicTargetId',
        label: 'Ao clicar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['validator', 'function', 'condition', 'auth', 'database', 'api'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onClick',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'validator',
        title: 'Validador',
        reason: 'Validar campos antes de prosseguir.',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
        slotKey: 'logicTargetId',
        defaultConfig: { rule: 'required', message: 'Preencha todos os campos obrigatórios' },
      },
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Autenticar ao clicar.',
        sourceHandle: 'onClick',
        targetHandle: 'trigger',
        slotKey: 'logicTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.logicTargetId, 'validarFormulario')}();`,
  },
  {
    id: 'btn_navigate_screen',
    name: 'Abrir Tela ao Clicar',
    category: 'Interface & Eventos',
    description: 'Navega para outra tela do aplicativo.',
    icon: 'open_in_new',
    compatibleKinds: ['button', 'navigate'],
    configPatch: {},
    variables: [
      {
        key: 'target',
        label: 'Abrir tela:',
        type: 'screen_ref',
        required: true,
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onClick',
          targetHandle: 'onEnter',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'screen',
        title: 'Nova Tela',
        reason: 'Criar tela de destino.',
        sourceHandle: 'onClick',
        targetHandle: 'onEnter',
        slotKey: 'target',
      },
    ],
    buildCodeSnippet: (v) =>
      `return navigateTo('${v.target || 'home'}');`,
  },
  {
    id: 'input_typed_field',
    name: 'Ler Campo e Enviar Valor',
    category: 'Interface & Eventos',
    description: 'Lê o valor digitado e envia para outro bloco.',
    icon: 'edit_note',
    compatibleKinds: ['input'],
    configPatch: { field: 'email', placeholder: 'seu@email.com' },
    variables: [
      {
        key: 'field',
        label: 'Tipo:',
        type: 'select',
        defaultValue: 'email',
        options: [
          { value: 'text', label: 'Texto (text)' },
          { value: 'email', label: 'E-mail (email)' },
          { value: 'password', label: 'Senha (password)' },
          { value: 'number', label: 'Número (number)' },
        ],
      },
      {
        key: 'placeholder',
        label: 'Placeholder:',
        type: 'text',
        defaultValue: 'Digite seu e-mail...',
      },
      {
        key: 'logicConsumerId',
        label: 'Enviar valor para:',
        type: 'block_ref',
        allowedKinds: ['validator', 'function', 'condition', 'auth', 'database'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'value',
          targetHandle: 'value',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'validator',
        title: 'Validador',
        reason: 'Validar formato deste campo.',
        sourceHandle: 'value',
        targetHandle: 'value',
        slotKey: 'logicConsumerId',
      },
    ],
    buildCodeSnippet: (v, blockId) =>
      `return read('${blockId}', 'value', ''); // ➔ ${safeFn(v.logicConsumerId, 'proximo')}`,
  },
  {
    id: 'screen_lifecycle_init',
    name: 'Executar Ao Abrir Tela',
    category: 'Interface & Eventos',
    description: 'Dispara um bloco assim que a tela é carregada.',
    icon: 'web_asset',
    compatibleKinds: ['screen'],
    configPatch: {},
    variables: [
      {
        key: 'title',
        label: 'Título:',
        type: 'text',
        defaultValue: 'Painel Principal',
      },
      {
        key: 'onOpenTargetId',
        label: 'Ao abrir, chamar:',
        type: 'block_ref',
        allowedKinds: ['database', 'api', 'auth', 'function', 'state'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'routes',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Buscar no Banco',
        reason: 'Carregar dados iniciais.',
        sourceHandle: 'routes',
        targetHandle: 'execute',
        slotKey: 'onOpenTargetId',
        defaultConfig: { operation: 'query', table: 'usuarios' },
      },
    ],
    buildCodeSnippet: (v, blockId) =>
      `navigateTo('${blockId}');\n${v.onOpenTargetId ? `return ${safeFn(v.onOpenTargetId)}();` : 'return true;'}`,
  },

  // ============================================================================
  // 2. VALIDAÇÃO & SEGURANÇA (validator, function, policy, condition)
  // ============================================================================
  {
    id: 'fn_call_validator_and_auth',
    name: 'Validar Campo + Chamar Próximo',
    category: 'Validação & Segurança',
    description: 'Lê um campo, valida e chama o próximo bloco.',
    icon: 'verified_user',
    compatibleKinds: ['function'],
    configPatch: {},
    variables: [
      {
        key: 'sourceInputId',
        label: 'Ler campo:',
        type: 'input_ref',
      },
      {
        key: 'callValidatorId',
        label: 'Validar com:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['validator', 'condition'],
      },
      {
        key: 'nextAuthOrDbId',
        label: 'Se passar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['auth', 'database', 'api', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
        },
      },
      {
        key: 'errorTargetId',
        label: 'Se der erro, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onError',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'validator',
        title: 'Validador',
        reason: 'Checar dados antes.',
        sourceHandle: 'then',
        targetHandle: 'execute',
        slotKey: 'callValidatorId',
      },
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Autenticar após validar.',
        sourceHandle: 'then',
        targetHandle: 'trigger',
        slotKey: 'nextAuthOrDbId',
      },
      {
        targetKind: 'error',
        title: 'Tratar Erro',
        reason: 'Capturar falhas.',
        sourceHandle: 'onError',
        targetHandle: 'execute',
        slotKey: 'errorTargetId',
      },
    ],
    buildCodeSnippet: (v) => {
      const readLine = v.sourceInputId
        ? `const dado = read('${v.sourceInputId}', 'value', value);`
        : `const dado = value;`;
      const valCall = v.callValidatorId
        ? `const check = ${safeFn(v.callValidatorId)}(dado);\nif (check && check.valid === false) throw new Error(check.error || 'Dados inválidos');`
        : `if (!dado) throw new Error('Campo obrigatório não preenchido');`;
      return `${readLine}\n${valCall}\nreturn dado;`;
    },
  },
  {
    id: 'val_email_rule',
    name: 'Validar E-mail',
    category: 'Validação & Segurança',
    description: 'Verifica se é um e-mail válido.',
    icon: 'mark_email_read',
    compatibleKinds: ['validator'],
    configPatch: {
      rule: 'email',
      param: '',
      message: 'Informe um endereço de e-mail válido',
    },
    variables: [
      {
        key: 'message',
        label: 'Mensagem de erro:',
        type: 'text',
        defaultValue: 'Informe um endereço de e-mail válido',
      },
      {
        key: 'validTargetId',
        label: 'Se válido, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['auth', 'database', 'function', 'validator', 'api', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'valid',
          targetHandle: 'execute',
          defaultArg: 'value',
        },
      },
      {
        key: 'invalidTargetId',
        label: 'Se inválido, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'invalid',
          targetHandle: 'execute',
          defaultArg: 'validation.error',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Seguir para login.',
        sourceHandle: 'valid',
        targetHandle: 'trigger',
        slotKey: 'validTargetId',
      },
      {
        targetKind: 'error',
        title: 'Bloco de Erro',
        reason: 'Exibir erro se inválido.',
        sourceHandle: 'invalid',
        targetHandle: 'execute',
        slotKey: 'invalidTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const validation = validate(value, 'email', '', '${v.message || 'E-mail inválido'}');\nif (validation.valid) return ${safeFn(v.validTargetId, 'proximoBloco')}(value);\nreturn ${safeFn(v.invalidTargetId, 'tratarErro')}(validation.error);`,
  },
  {
    id: 'val_password_min_length',
    name: 'Validar Tamanho Mínimo',
    category: 'Validação & Segurança',
    description: 'Exige no mínimo N caracteres.',
    icon: 'password',
    compatibleKinds: ['validator'],
    configPatch: {
      rule: 'minLength',
      param: '6',
      message: 'A senha deve ter pelo menos 6 caracteres',
    },
    variables: [
      {
        key: 'param',
        label: 'Mín. caracteres:',
        type: 'number',
        defaultValue: '6',
      },
      {
        key: 'message',
        label: 'Mensagem de erro:',
        type: 'text',
        defaultValue: 'A senha deve ter pelo menos 6 caracteres',
      },
      {
        key: 'validTargetId',
        label: 'Se válido, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['auth', 'database', 'function', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'valid',
          targetHandle: 'execute',
          defaultArg: 'value',
        },
      },
      {
        key: 'invalidTargetId',
        label: 'Se inválido, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'invalid',
          targetHandle: 'execute',
          defaultArg: 'validation.error',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Prosseguir com senha válida.',
        sourceHandle: 'valid',
        targetHandle: 'trigger',
        slotKey: 'validTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const validation = validate(value, 'minLength', '${v.param || '6'}', '${v.message || 'Senha curta'}');\nif (validation.valid) return ${safeFn(v.validTargetId, 'autenticar')}(value);`,
  },
  {
    id: 'val_cpf_or_required',
    name: 'Validar Obrigatório / CPF',
    category: 'Validação & Segurança',
    description: 'Valida campo obrigatório, CPF, número ou Regex.',
    icon: 'fact_check',
    compatibleKinds: ['validator'],
    configPatch: {
      rule: 'required',
      param: '',
      message: 'Este campo é obrigatório',
    },
    variables: [
      {
        key: 'rule',
        label: 'Regra:',
        type: 'select',
        defaultValue: 'required',
        options: [
          { value: 'required', label: 'Obrigatório' },
          { value: 'cpf', label: 'CPF (11 dígitos)' },
          { value: 'numeric', label: 'Apenas Números' },
          { value: 'regex', label: 'Regex' },
        ],
      },
      {
        key: 'message',
        label: 'Mensagem de erro:',
        type: 'text',
        defaultValue: 'Este campo é obrigatório',
      },
      {
        key: 'validTargetId',
        label: 'Se válido, chamar:',
        type: 'block_ref',
        allowedKinds: ['validator', 'auth', 'database', 'function', 'api'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'valid',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Banco de Dados',
        reason: 'Salvar após validar.',
        sourceHandle: 'valid',
        targetHandle: 'execute',
        slotKey: 'validTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const validation = validate(value, '${v.rule || 'required'}', '${v.param || ''}', '${v.message || 'Inválido'}');`,
  },
  {
    id: 'policy_role_guard',
    name: 'Controle de Acesso (RBAC)',
    category: 'Validação & Segurança',
    description: 'Restringe acesso por papel (ex: admin).',
    icon: 'policy',
    compatibleKinds: ['policy'],
    configPatch: {
      name: 'Exigir Papel Admin',
      effect: 'allow',
      target: '*',
      action: '*',
      errorMessage: 'Acesso negado: permissão insuficiente.',
    },
    variables: [
      {
        key: 'name',
        label: 'Política:',
        type: 'text',
        defaultValue: 'Exigir Papel Admin',
      },
      {
        key: 'effect',
        label: 'Efeito:',
        type: 'select',
        defaultValue: 'allow',
        options: [
          { value: 'allow', label: 'Permitir (allow)' },
          { value: 'deny', label: 'Bloquear (deny)' },
        ],
      },
      {
        key: 'errorMessage',
        label: 'Mensagem de bloqueio:',
        type: 'text',
        defaultValue: 'Acesso negado: permissão insuficiente.',
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `if (user?.role !== 'admin') throw new Error('${v.errorMessage || 'Acesso negado'}');`,
  },

  // ============================================================================
  // 3. TRANSFORMAÇÃO & CÁLCULO (function, math, text, object, array, constant)
  // ============================================================================
  {
    id: 'fn_build_payload_for_db',
    name: 'Montar Objeto JSON',
    category: 'Transformação & Cálculo',
    description: 'Lê campos da tela, monta um JSON e envia para outro bloco.',
    icon: 'data_object',
    compatibleKinds: ['function', 'object'],
    configPatch: {
      fields: 'nome, email',
    },
    variables: [
      {
        key: 'fields',
        label: 'Campos (vírgula):',
        type: 'text',
        defaultValue: 'nome, email',
      },
      {
        key: 'targetBlockId',
        label: 'Enviar JSON para:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['database', 'api', 'notify', 'state', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
          defaultArg: 'computed',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Banco de Dados',
        reason: 'Salvar objeto na tabela.',
        sourceHandle: 'then',
        targetHandle: 'execute',
        slotKey: 'targetBlockId',
        defaultConfig: { operation: 'insert', table: 'usuarios' },
      },
    ],
    buildCodeSnippet: (v) => {
      const cols = (v.fields || 'nome, email')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const props = cols.map((c) => `${c}: read('${c}', 'value', '')`).join(', ');
      return `const payload = { id: Date.now(), ${props} };\nreturn payload;`;
    },
  },
  {
    id: 'fn_math_discount_or_calc',
    name: 'Operação Matemática',
    category: 'Transformação & Cálculo',
    description: 'Soma, subtrai, multiplica ou divide A e B.',
    icon: 'calculate',
    compatibleKinds: ['math', 'function'],
    configPatch: {
      operation: 'add',
      a: '100',
      b: '10',
    },
    variables: [
      {
        key: 'operation',
        label: 'Operação:',
        type: 'select',
        defaultValue: 'add',
        options: [
          { value: 'add', label: 'Somar (A + B)' },
          { value: 'sub', label: 'Subtrair (A - B)' },
          { value: 'mul', label: 'Multiplicar (A * B)' },
          { value: 'div', label: 'Dividir (A / B)' },
        ],
      },
      {
        key: 'a',
        label: 'Valor A:',
        type: 'number',
        defaultValue: '100',
      },
      {
        key: 'b',
        label: 'Valor B:',
        type: 'number',
        defaultValue: '10',
      },
      {
        key: 'mathNextBlockId',
        label: 'Enviar resultado para:',
        type: 'block_ref',
        allowedKinds: ['condition', 'payment', 'database', 'notify', 'state', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
          defaultArg: 'result',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'payment',
        title: 'Checkout',
        reason: 'Cobrar valor calculado.',
        sourceHandle: 'then',
        targetHandle: 'execute',
        slotKey: 'mathNextBlockId',
      },
    ],
    buildCodeSnippet: (v) => {
      const opMap: Record<string, string> = { add: '+', sub: '-', mul: '*', div: '/' };
      const op = opMap[v.operation || 'add'] || '+';
      return `const result = Number(${v.a || 0}) ${op} Number(${v.b || 0});\nreturn result;`;
    },
  },
  {
    id: 'text_format_transform',
    name: 'Formatar Texto',
    category: 'Transformação & Cálculo',
    description: 'Converte maiúsculas/minúsculas, limpa espaços ou concatena.',
    icon: 'text_fields',
    compatibleKinds: ['text', 'function'],
    configPatch: {
      operation: 'upper',
      value: '',
      arg: '',
    },
    variables: [
      {
        key: 'operation',
        label: 'Formato:',
        type: 'select',
        defaultValue: 'upper',
        options: [
          { value: 'upper', label: 'MAIÚSCULAS (upper)' },
          { value: 'lower', label: 'minúsculas (lower)' },
          { value: 'trim', label: 'Sem espaços (trim)' },
          { value: 'concat', label: 'Concatenar (concat)' },
        ],
      },
      {
        key: 'arg',
        label: 'Sufixo:',
        type: 'text',
        defaultValue: '',
      },
      {
        key: 'textNextBlockId',
        label: 'Enviar para:',
        type: 'block_ref',
        allowedKinds: ['validator', 'database', 'function', 'notify', 'state'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
          defaultArg: 'result',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) => {
      if (v.operation === 'lower') return `return String(value ?? '').trim().toLowerCase();`;
      if (v.operation === 'trim') return `return String(value ?? '').trim();`;
      if (v.operation === 'concat') return `return String(value ?? '') + '${v.arg || ''}';`;
      return `return String(value ?? '').trim().toUpperCase();`;
    },
  },
  {
    id: 'array_collect_items',
    name: 'Criar Lista (Array)',
    category: 'Transformação & Cálculo',
    description: 'Agrupa itens separados por vírgula em um Array.',
    icon: 'data_array',
    compatibleKinds: ['array'],
    configPatch: { items: 'item1, item2, item3' },
    variables: [
      {
        key: 'items',
        label: 'Itens (vírgula):',
        type: 'text',
        defaultValue: 'item1, item2, item3',
      },
      {
        key: 'arrayNextId',
        label: 'Enviar lista para:',
        type: 'block_ref',
        allowedKinds: ['function', 'database', 'api', 'state'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `return ${JSON.stringify(
        (v.items || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )};`,
  },
  {
    id: 'constant_fixed_value',
    name: 'Valor Constante',
    category: 'Transformação & Cálculo',
    description: 'Retorna um valor fixo.',
    icon: 'pin',
    compatibleKinds: ['constant'],
    configPatch: { valueType: 'string', value: 'ativo' },
    variables: [
      {
        key: 'valueType',
        label: 'Tipo:',
        type: 'select',
        defaultValue: 'string',
        options: [
          { value: 'string', label: 'Texto (string)' },
          { value: 'number', label: 'Número (number)' },
          { value: 'boolean', label: 'Booleano' },
          { value: 'json', label: 'JSON' },
        ],
      },
      {
        key: 'value',
        label: 'Valor:',
        type: 'text',
        defaultValue: 'ativo',
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) => `return ${JSON.stringify(v.value ?? '')};`,
  },

  // ============================================================================
  // 4. CONTROLE DE FLUXO & DECISÃO (condition, switch, compare, boolean, delay, error, subflow)
  // ============================================================================
  {
    id: 'cond_if_else_branch',
    name: 'Condição (Se / Senão)',
    category: 'Controle de Fluxo & Decisão',
    description: 'Compara o valor e desvia para Verdadeiro ou Falso.',
    icon: 'alt_route',
    compatibleKinds: ['condition', 'compare'],
    configPatch: {
      operator: 'equals',
      compare: 'admin',
    },
    variables: [
      {
        key: 'operator',
        label: 'Operador:',
        type: 'select',
        defaultValue: 'equals',
        options: [
          { value: 'truthy', label: 'Preenchido (Boolean)' },
          { value: 'equals', label: 'Igual (===)' },
          { value: 'not_equals', label: 'Diferente (!==)' },
          { value: 'gt', label: 'Maior (>)' },
          { value: 'lt', label: 'Menor (<)' },
          { value: 'gte', label: 'Maior ou igual (>=)' },
          { value: 'lte', label: 'Menor ou igual (<=)' },
        ],
      },
      {
        key: 'compare',
        label: 'Comparar com:',
        type: 'text',
        defaultValue: 'admin',
        placeholder: 'Ex: admin, 18, true',
      },
      {
        key: 'trueTargetId',
        label: 'Se verdadeiro, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: [
          'auth',
          'database',
          'function',
          'notify',
          'screen',
          'condition',
          'api',
          'payment',
        ],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'true',
          targetHandle: 'execute',
          defaultArg: 'value',
        },
      },
      {
        key: 'falseTargetId',
        label: 'Se falso, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify', 'condition', 'function', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'false',
          targetHandle: 'execute',
          defaultArg: 'new Error("Condição não atendida")',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'notify',
        title: 'Notificação (True)',
        reason: 'Confirmar condição verdadeira.',
        sourceHandle: 'true',
        targetHandle: 'execute',
        slotKey: 'trueTargetId',
      },
      {
        targetKind: 'error',
        title: 'Erro (False)',
        reason: 'Tratar condição falsa.',
        sourceHandle: 'false',
        targetHandle: 'execute',
        slotKey: 'falseTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `if (value === '${v.compare || ''}') return ${safeFn(v.trueTargetId, 'seVerdadeiro')}(value);\nreturn ${safeFn(v.falseTargetId, 'seFalso')}(value);`,
  },
  {
    id: 'switch_multi_route',
    name: 'Múltiplos Caminhos (Switch)',
    category: 'Controle de Fluxo & Decisão',
    description: 'Direciona para diferentes blocos conforme o caso.',
    icon: 'fork_right',
    compatibleKinds: ['switch'],
    configPatch: {
      cases: 'aprovado, pendente, recusado',
      defaultCase: 'default',
    },
    variables: [
      {
        key: 'cases',
        label: 'Casos (vírgula):',
        type: 'text',
        defaultValue: 'aprovado, pendente, recusado',
      },
      {
        key: 'case1TargetId',
        label: 'Caso 1, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'database', 'screen', 'function', 'email'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'case1',
          targetHandle: 'execute',
        },
      },
      {
        key: 'case2TargetId',
        label: 'Caso 2, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'database', 'delay', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'case2',
          targetHandle: 'execute',
        },
      },
      {
        key: 'defaultTargetId',
        label: 'Padrão (default), chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'default',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `// Casos: ${v.cases || 'caso1, caso2'}\nreturn ${safeFn(v.case1TargetId || v.defaultTargetId, 'rotaPadrao')}(value);`,
  },
  {
    id: 'boolean_gate_combine',
    name: 'Porta Lógica (AND / OR / NOT)',
    category: 'Controle de Fluxo & Decisão',
    description: 'Combina valores booleanos.',
    icon: 'toggle_on',
    compatibleKinds: ['boolean'],
    configPatch: { operation: 'and', a: 'true', b: 'true' },
    variables: [
      {
        key: 'operation',
        label: 'Operador:',
        type: 'select',
        defaultValue: 'and',
        options: [
          { value: 'and', label: 'E (AND)' },
          { value: 'or', label: 'OU (OR)' },
          { value: 'not', label: 'NÃO (NOT)' },
        ],
      },
      {
        key: 'boolNextId',
        label: 'Enviar para:',
        type: 'block_ref',
        allowedKinds: ['condition', 'function', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      v.operation === 'or'
        ? `return Boolean(a) || Boolean(b);`
        : v.operation === 'not'
          ? `return !Boolean(a);`
          : `return Boolean(a) && Boolean(b);`,
  },
  {
    id: 'delay_wait_and_call',
    name: 'Aguardar Tempo (Timer)',
    category: 'Controle de Fluxo & Decisão',
    description: 'Espera N milissegundos e chama o próximo bloco.',
    icon: 'hourglass_top',
    compatibleKinds: ['delay'],
    configPatch: { duration: '1500' },
    variables: [
      {
        key: 'duration',
        label: 'Espera (ms):',
        type: 'number',
        defaultValue: '1500',
      },
      {
        key: 'delayNextId',
        label: 'Após esperar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['screen', 'notify', 'function', 'api', 'database'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'next',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'screen',
        title: 'Abrir Tela',
        reason: 'Redirecionar após espera.',
        sourceHandle: 'next',
        targetHandle: 'onEnter',
        slotKey: 'delayNextId',
      },
    ],
    buildCodeSnippet: (v) =>
      `await sleep(${Number(v.duration || 1000)});\nreturn ${safeFn(v.delayNextId, 'proximoBloco')}(payload);`,
  },
  {
    id: 'error_catch_and_retry',
    name: 'Capturar Erro + Retry',
    category: 'Controle de Fluxo & Decisão',
    description: 'Exibe mensagem de erro e permite tentar novamente.',
    icon: 'error',
    compatibleKinds: ['error'],
    configPatch: {
      message: 'Não foi possível concluir a operação. Tente novamente.',
      type: 'toast',
    },
    variables: [
      {
        key: 'message',
        label: 'Mensagem de erro:',
        type: 'text',
        defaultValue: 'Não foi possível concluir a operação. Tente novamente.',
      },
      {
        key: 'retryTargetId',
        label: 'Tentar novamente (retry):',
        type: 'block_ref',
        allowedKinds: ['api', 'database', 'auth', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'retry',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v, blockId) =>
      `console.error('${v.message || 'Erro'}', error);\n${v.retryTargetId ? `if (canRetry('${blockId}', 1)) return ${safeFn(v.retryTargetId)}();` : `return { error: true, message: '${v.message || 'Erro'}' };`}`,
  },
  {
    id: 'subflow_invoke',
    name: 'Chamar Subfluxo',
    category: 'Controle de Fluxo & Decisão',
    description: 'Executa um subfluxo reutilizável.',
    icon: 'account_tree',
    compatibleKinds: ['subflow'],
    configPatch: { subflowName: 'ValidacaoPadrao' },
    variables: [
      {
        key: 'subflowName',
        label: 'Subfluxo:',
        type: 'text',
        defaultValue: 'ValidacaoPadrao',
      },
      {
        key: 'subflowSuccessId',
        label: 'Ao concluir, chamar:',
        type: 'block_ref',
        allowedKinds: ['function', 'database', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.subflowSuccessId, 'proximo')}(input); // Subfluxo: ${v.subflowName || 'padrao'}`,
  },

  // ============================================================================
  // 5. AUTENTICAÇÃO & SESSÃO (auth, identityProvider, state)
  // ============================================================================
  {
    id: 'auth_email_password_login',
    name: 'Login / Cadastro (E-mail e Senha)',
    category: 'Autenticação & Sessão',
    description: 'Autentica credenciais e desvia para sucesso ou erro.',
    icon: 'lock_person',
    compatibleKinds: ['auth'],
    configPatch: {
      provider: 'email',
      mode: 'login',
      execution: 'demo',
    },
    variables: [
      {
        key: 'mode',
        label: 'Modo:',
        type: 'select',
        defaultValue: 'login',
        options: [
          { value: 'login', label: 'Login (Entrar)' },
          { value: 'register', label: 'Cadastro (Criar conta)' },
        ],
      },
      {
        key: 'authSuccessTargetId',
        label: 'Se autenticar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['screen', 'notify', 'database', 'state', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
          defaultArg: 'user',
        },
      },
      {
        key: 'authErrorTargetId',
        label: 'Se falhar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onError',
          targetHandle: 'execute',
          defaultArg: 'new Error("Credenciais inválidas")',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'notify',
        title: 'Alerta de Sucesso',
        reason: 'Confirmar login.',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
        slotKey: 'authSuccessTargetId',
        defaultConfig: { type: 'success', message: 'Login realizado com sucesso!' },
      },
      {
        targetKind: 'error',
        title: 'Bloco de Erro',
        reason: 'Tratar senha incorreta.',
        sourceHandle: 'onError',
        targetHandle: 'execute',
        slotKey: 'authErrorTargetId',
        defaultConfig: { message: 'E-mail ou senha incorretos.' },
      },
    ],
    buildCodeSnippet: (v) =>
      `const user = ${v.mode === 'register' ? 'registerUser(email, password)' : "authenticate('email', email, password)"};\nif (user) return ${safeFn(v.authSuccessTargetId, 'sucessoLogin')}(user);\nreturn ${safeFn(v.authErrorTargetId, 'erroLogin')}(new Error('Credenciais inválidas'));`,
  },
  {
    id: 'auth_google_oauth',
    name: 'Login com Google OAuth',
    category: 'Autenticação & Sessão',
    description: 'Autentica via conta Google.',
    icon: 'account_circle',
    compatibleKinds: ['auth'],
    configPatch: {
      provider: 'google',
      mode: 'login',
      googleEmail: 'google.teste@gmail.com',
      googleName: 'Google Teste',
    },
    variables: [
      {
        key: 'googleEmail',
        label: 'E-mail Google:',
        type: 'text',
        defaultValue: 'google.teste@gmail.com',
      },
      {
        key: 'authSuccessTargetId',
        label: 'Se autenticar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['screen', 'notify', 'database', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
          defaultArg: 'user',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `const user = authenticateGoogle({ email: '${v.googleEmail || 'google.teste@gmail.com'}' });\nreturn ${safeFn(v.authSuccessTargetId, 'painel')}(user);`,
  },
  {
    id: 'idp_provider_setup',
    name: 'Provedor JWT / OAuth',
    category: 'Autenticação & Sessão',
    description: 'Configura sessão para o bloco de Autenticação.',
    icon: 'shield_person',
    compatibleKinds: ['identityProvider'],
    configPatch: {
      name: 'Identidade Principal',
      type: 'email',
      sessionDurationSec: '86400',
    },
    variables: [
      {
        key: 'type',
        label: 'Provedor:',
        type: 'select',
        defaultValue: 'email',
        options: [
          { value: 'email', label: 'E-mail / JWT' },
          { value: 'google', label: 'Google OAuth' },
          { value: 'oidc', label: 'OIDC' },
        ],
      },
      {
        key: 'sessionDurationSec',
        label: 'Sessão (seg):',
        type: 'number',
        defaultValue: '86400',
      },
      {
        key: 'authConsumerId',
        label: 'Conectar ao Auth:',
        type: 'block_ref',
        allowedKinds: ['auth'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'connection',
          targetHandle: 'connection',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Vincular ao bloco Auth.',
        sourceHandle: 'connection',
        targetHandle: 'connection',
        slotKey: 'authConsumerId',
      },
    ],
    buildCodeSnippet: (v) =>
      `// Identidade (${v.type || 'email'}) · Sessão: ${v.sessionDurationSec || 86400}s`,
  },
  {
    id: 'state_manage_store',
    name: 'Variável Global (Store)',
    category: 'Autenticação & Sessão',
    description: 'Salva ou lê um valor no estado global.',
    icon: 'memory',
    compatibleKinds: ['state'],
    configPatch: {
      operation: 'set',
      key: 'usuarioAtivo',
      value: '',
    },
    variables: [
      {
        key: 'operation',
        label: 'Ação:',
        type: 'select',
        defaultValue: 'set',
        options: [
          { value: 'set', label: 'Salvar (set)' },
          { value: 'get', label: 'Ler (get)' },
          { value: 'toggle', label: 'Alternar (toggle)' },
          { value: 'clear', label: 'Limpar (clear)' },
        ],
      },
      {
        key: 'key',
        label: 'Chave:',
        type: 'text',
        required: true,
        defaultValue: 'usuarioAtivo',
      },
      {
        key: 'stateNextId',
        label: 'Em seguida, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'screen', 'function', 'condition', 'database'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'next',
          targetHandle: 'execute',
          defaultArg: 'result',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `const result = setVar('${v.key || 'variavel'}', payload);\n${v.stateNextId ? `return ${safeFn(v.stateNextId)}(result);` : 'return result;'}`,
  },

  // ============================================================================
  // 6. PERSISTÊNCIA & BANCO DE DADOS (database, postgresConnection, entity, storage)
  // ============================================================================
  {
    id: 'db_insert_record',
    name: 'Inserir no Banco (INSERT)',
    category: 'Persistência & Banco de Dados',
    description: 'Grava um registro na tabela.',
    icon: 'database',
    compatibleKinds: ['database'],
    configPatch: {
      operation: 'insert',
      table: 'usuarios',
    },
    variables: [
      {
        key: 'table',
        label: 'Tabela:',
        type: 'text',
        required: true,
        defaultValue: 'usuarios',
      },
      {
        key: 'dbSuccessTargetId',
        label: 'Ao salvar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['notify', 'screen', 'function', 'auth', 'email'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
          defaultArg: 'data',
        },
      },
      {
        key: 'dbErrorTargetId',
        label: 'Se der erro, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onError',
          targetHandle: 'execute',
          defaultArg: 'error',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'notify',
        title: 'Notificar Sucesso',
        reason: 'Confirmar gravação.',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
        slotKey: 'dbSuccessTargetId',
        defaultConfig: { type: 'success', message: 'Registro salvo com sucesso!' },
      },
      {
        targetKind: 'error',
        title: 'Tratar Erro',
        reason: 'Capturar falha no banco.',
        sourceHandle: 'onError',
        targetHandle: 'execute',
        slotKey: 'dbErrorTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const data = await db.insert('${v.table || 'usuarios'}', payload);\nreturn ${safeFn(v.dbSuccessTargetId, 'notificarSucesso')}(data);`,
  },
  {
    id: 'db_query_records',
    name: 'Consultar Tabela (SELECT)',
    category: 'Persistência & Banco de Dados',
    description: 'Busca registros da tabela.',
    icon: 'manage_search',
    compatibleKinds: ['database'],
    configPatch: {
      operation: 'query',
      table: 'usuarios',
      limit: '10',
    },
    variables: [
      {
        key: 'table',
        label: 'Tabela:',
        type: 'text',
        required: true,
        defaultValue: 'usuarios',
      },
      {
        key: 'filterField',
        label: 'Filtrar por:',
        type: 'text',
        placeholder: 'Ex: email, status',
      },
      {
        key: 'limit',
        label: 'Limite:',
        type: 'number',
        defaultValue: '10',
      },
      {
        key: 'dbSuccessTargetId',
        label: 'Enviar lista para:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['function', 'condition', 'state', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
          defaultArg: 'data',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'condition',
        title: 'Condição',
        reason: 'Checar se retornou dados.',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
        slotKey: 'dbSuccessTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const data = await db.query('${v.table || 'usuarios'}', payload);\nreturn ${safeFn(v.dbSuccessTargetId, 'processarLista')}(data);`,
  },
  {
    id: 'pg_connection_provider',
    name: 'Conexão PostgreSQL',
    category: 'Persistência & Banco de Dados',
    description: 'Conecta um servidor PostgreSQL ao bloco de Banco.',
    icon: 'dns',
    compatibleKinds: ['postgresConnection'],
    configPatch: {
      host: 'localhost',
      port: '5432',
      database: 'flowforge',
      schema: 'public',
    },
    variables: [
      {
        key: 'database',
        label: 'Database:',
        type: 'text',
        defaultValue: 'flowforge',
      },
      {
        key: 'dbConsumerId',
        label: 'Conectar ao Banco:',
        type: 'block_ref',
        allowedKinds: ['database'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'connection',
          targetHandle: 'connection',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Banco de Dados',
        reason: 'Vincular operação CRUD.',
        sourceHandle: 'connection',
        targetHandle: 'connection',
        slotKey: 'dbConsumerId',
      },
    ],
    buildCodeSnippet: (v) =>
      `// PostgreSQL conectado: "${v.database || 'flowforge'}"`,
  },
  {
    id: 'entity_table_schema',
    name: 'Tabela / Entidade SQL',
    category: 'Persistência & Banco de Dados',
    description: 'Esquema tipado de tabela SQL.',
    icon: 'table_view',
    compatibleKinds: ['entity'],
    configPatch: { name: 'clientes' },
    variables: [
      {
        key: 'name',
        label: 'Tabela:',
        type: 'text',
        required: true,
        defaultValue: 'clientes',
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) => `// Entidade SQL: ${v.name || 'clientes'}`,
  },
  {
    id: 'storage_upload_file',
    name: 'Upload de Arquivo (Storage)',
    category: 'Persistência & Banco de Dados',
    description: 'Salva arquivo no bucket e retorna a URL.',
    icon: 'cloud_upload',
    compatibleKinds: ['storage'],
    configPatch: {
      provider: 'local',
      bucket: 'uploads',
      allowedTypes: 'image/*,application/pdf',
    },
    variables: [
      {
        key: 'bucket',
        label: 'Bucket:',
        type: 'text',
        defaultValue: 'uploads',
      },
      {
        key: 'storageSuccessId',
        label: 'Enviar URL para:',
        type: 'block_ref',
        allowedKinds: ['database', 'function', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Banco de Dados',
        reason: 'Salvar URL no banco.',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
        slotKey: 'storageSuccessId',
      },
    ],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.storageSuccessId, 'salvarUrl')}(fileUrl); // Bucket: ${v.bucket || 'uploads'}`,
  },

  // ============================================================================
  // 7. INTEGRAÇÕES, API & PAGAMENTOS (api, httpConnection, payment, webhook, task)
  // ============================================================================
  {
    id: 'api_rest_request',
    name: 'Requisição HTTP (API)',
    category: 'Integrações, API & Pagamentos',
    description: 'Chama endpoint externo e trata sucesso ou erro.',
    icon: 'api',
    compatibleKinds: ['api'],
    configPatch: {
      method: 'POST',
      url: '/api/clientes',
      mode: 'demo',
      mock: '{"ok":true,"id":101}',
    },
    variables: [
      {
        key: 'method',
        label: 'Método:',
        type: 'select',
        defaultValue: 'POST',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      {
        key: 'url',
        label: 'Endpoint:',
        type: 'text',
        required: true,
        defaultValue: '/api/clientes',
      },
      {
        key: 'apiSuccessTargetId',
        label: 'Se sucesso, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['function', 'database', 'state', 'notify', 'screen', 'condition'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
          defaultArg: 'data',
        },
      },
      {
        key: 'apiErrorTargetId',
        label: 'Se falhar, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onError',
          targetHandle: 'execute',
          defaultArg: 'error',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'error',
        title: 'Erro HTTP',
        reason: 'Capturar falha da API.',
        sourceHandle: 'onError',
        targetHandle: 'execute',
        slotKey: 'apiErrorTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `const data = await fetchApi('${v.method || 'GET'}', '${v.url || '/api'}', body);\nreturn ${safeFn(v.apiSuccessTargetId, 'processarResposta')}(data);`,
  },
  {
    id: 'http_connection_setup',
    name: 'Servidor Base HTTP',
    category: 'Integrações, API & Pagamentos',
    description: 'Define URL base e autenticação para blocos de API.',
    icon: 'http',
    compatibleKinds: ['httpConnection'],
    configPatch: {
      baseUrl: 'https://api.exemplo.com',
      auth: 'bearer',
      secretEnv: 'FLOWFORGE_SECRET_API_TOKEN',
    },
    variables: [
      {
        key: 'baseUrl',
        label: 'URL Base:',
        type: 'text',
        required: true,
        defaultValue: 'https://api.exemplo.com',
      },
      {
        key: 'apiConsumerId',
        label: 'Conectar à API:',
        type: 'block_ref',
        allowedKinds: ['api'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'connection',
          targetHandle: 'connection',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'api',
        title: 'Requisição API',
        reason: 'Vincular a um bloco API.',
        sourceHandle: 'connection',
        targetHandle: 'connection',
        slotKey: 'apiConsumerId',
      },
    ],
    buildCodeSnippet: (v) => `// Base URL: ${v.baseUrl || 'https://api.exemplo.com'}`,
  },
  {
    id: 'payment_checkout_flow',
    name: 'Checkout / Pagamento',
    category: 'Integrações, API & Pagamentos',
    description: 'Gera cobrança via Stripe, PIX ou MercadoPago.',
    icon: 'credit_card',
    compatibleKinds: ['payment'],
    configPatch: {
      provider: 'stripe',
      operation: 'createCheckout',
      currency: 'BRL',
    },
    variables: [
      {
        key: 'provider',
        label: 'Provedor:',
        type: 'select',
        defaultValue: 'stripe',
        options: [
          { value: 'stripe', label: 'Stripe' },
          { value: 'pix', label: 'PIX' },
          { value: 'mercadopago', label: 'MercadoPago' },
        ],
      },
      {
        key: 'paymentSuccessId',
        label: 'Se aprovar, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['database', 'notify', 'email', 'screen', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
        },
      },
      {
        key: 'paymentErrorId',
        label: 'Se falhar, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onError',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'notify',
        title: 'Notificação',
        reason: 'Confirmar cobrança.',
        sourceHandle: 'onSuccess',
        targetHandle: 'execute',
        slotKey: 'paymentSuccessId',
      },
    ],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.paymentSuccessId, 'confirmarPedido')}(result); // ${v.provider || 'stripe'}`,
  },
  {
    id: 'webhook_listener_flow',
    name: 'Escutar Webhook',
    category: 'Integrações, API & Pagamentos',
    description: 'Recebe evento HTTP externo e dispara um bloco.',
    icon: 'webhook',
    compatibleKinds: ['webhook'],
    configPatch: {
      path: '/api/webhooks/pagamento',
      eventType: 'payment.succeeded',
    },
    variables: [
      {
        key: 'path',
        label: 'Rota:',
        type: 'text',
        defaultValue: '/api/webhooks/pagamento',
      },
      {
        key: 'webhookTargetId',
        label: 'Ao receber, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['database', 'function', 'email', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onEvent',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Banco de Dados',
        reason: 'Salvar evento recebido.',
        sourceHandle: 'onEvent',
        targetHandle: 'execute',
        slotKey: 'webhookTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.webhookTargetId, 'processarWebhook')}(payload);`,
  },
  {
    id: 'task_cron_job',
    name: 'Tarefa Agendada (Cron)',
    category: 'Integrações, API & Pagamentos',
    description: 'Executa rotina periodicamente.',
    icon: 'schedule',
    compatibleKinds: ['task'],
    configPatch: {
      schedule: '0 * * * *',
      taskName: 'SincronizacaoHoraria',
    },
    variables: [
      {
        key: 'taskName',
        label: 'Tarefa:',
        type: 'text',
        defaultValue: 'SincronizacaoHoraria',
      },
      {
        key: 'schedule',
        label: 'Cron:',
        type: 'text',
        defaultValue: '0 * * * *',
      },
      {
        key: 'taskTargetId',
        label: 'No horário, chamar:',
        type: 'block_ref',
        allowedKinds: ['function', 'database', 'api', 'email'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onTick',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `// Cron [${v.schedule || '0 * * * *'}] ➔ ${safeFn(v.taskTargetId, 'executarRotina')}()`,
  },

  // ============================================================================
  // 8. NOTIFICAÇÕES, MENSAGENS & TEMPO REAL (notify, email, realtime)
  // ============================================================================
  {
    id: 'notify_toast_and_continue',
    name: 'Exibir Alerta (Toast)',
    category: 'Notificações, Mensagens & Tempo Real',
    description: 'Exibe mensagem visual e opcionalmente chama o próximo bloco.',
    icon: 'notifications',
    compatibleKinds: ['notify'],
    configPatch: {
      type: 'success',
      message: 'Operação realizada com sucesso!',
      duration: '3000',
    },
    variables: [
      {
        key: 'type',
        label: 'Tipo:',
        type: 'select',
        defaultValue: 'success',
        options: [
          { value: 'success', label: 'Sucesso' },
          { value: 'error', label: 'Erro' },
          { value: 'warning', label: 'Aviso' },
          { value: 'info', label: 'Info' },
        ],
      },
      {
        key: 'message',
        label: 'Mensagem:',
        type: 'text',
        required: true,
        defaultValue: 'Operação realizada com sucesso!',
      },
      {
        key: 'notifyNextId',
        label: 'Depois, chamar:',
        type: 'block_ref',
        allowedKinds: ['screen', 'navigate', 'delay', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'next',
          targetHandle: 'execute',
          defaultArg: 'payload',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'screen',
        title: 'Abrir Tela',
        reason: 'Navegar após alerta.',
        sourceHandle: 'next',
        targetHandle: 'onEnter',
        slotKey: 'notifyNextId',
      },
    ],
    buildCodeSnippet: (v) =>
      `notify({ type: '${v.type || 'success'}', message: '${v.message || 'Sucesso!'}' });\n${v.notifyNextId ? `return ${safeFn(v.notifyNextId)}(payload);` : 'return payload;'}`,
  },
  {
    id: 'email_send_transactional',
    name: 'Enviar E-mail',
    category: 'Notificações, Mensagens & Tempo Real',
    description: 'Envia e-mail transacional.',
    icon: 'mail',
    compatibleKinds: ['email'],
    configPatch: {
      provider: 'smtp',
      subject: 'Bem-vindo ao nosso aplicativo!',
      body: 'Olá! Sua conta foi criada com sucesso.',
    },
    variables: [
      {
        key: 'to',
        label: 'Para:',
        type: 'text',
        placeholder: 'cliente@exemplo.com',
      },
      {
        key: 'subject',
        label: 'Assunto:',
        type: 'text',
        required: true,
        defaultValue: 'Bem-vindo ao nosso aplicativo!',
      },
      {
        key: 'emailSuccessId',
        label: 'Ao enviar, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'screen', 'function'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onSuccess',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.emailSuccessId, 'confirmarEnvio')}(result); // Assunto: "${v.subject || ''}"`,
  },
  {
    id: 'realtime_publish_channel',
    name: 'Publicar Tempo Real (SSE/WS)',
    category: 'Notificações, Mensagens & Tempo Real',
    description: 'Envia evento ao vivo no canal.',
    icon: 'sensors',
    compatibleKinds: ['realtime'],
    configPatch: {
      protocol: 'sse',
      action: 'publish',
      channel: 'notifications',
    },
    variables: [
      {
        key: 'channel',
        label: 'Canal:',
        type: 'text',
        required: true,
        defaultValue: 'notifications',
      },
      {
        key: 'realtimeNextId',
        label: 'Depois, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'function', 'database'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'then',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [],
    buildCodeSnippet: (v) =>
      `return ${safeFn(v.realtimeNextId, 'proximo')}(result); // Canal: "${v.channel || 'notifications'}"`,
  },
  {
    id: 'form_group_validate_submit',
    name: 'Validar e Enviar Formulário',
    category: 'Interface & Eventos',
    description: 'Agrupa campos, valida obrigatórios e envia para o próximo bloco.',
    icon: 'dynamic_form',
    compatibleKinds: ['form'],
    configPatch: {
      fields: 'nome, email, senha',
      requiredFields: 'nome, email, senha',
      submitLabel: 'Enviar',
    },
    variables: [
      {
        key: 'fields',
        label: 'Campos (separados por vírgula):',
        type: 'text',
        required: true,
        defaultValue: 'nome, email, senha',
      },
      {
        key: 'validTargetId',
        label: 'Se válido, enviar para:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['database', 'auth', 'api', 'function', 'notify', 'screen'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'valid',
          targetHandle: 'execute',
          defaultArg: 'data',
        },
      },
      {
        key: 'invalidTargetId',
        label: 'Se inválido, chamar:',
        type: 'block_ref',
        allowedKinds: ['error', 'notify'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'invalid',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'database',
        title: 'Salvar no Banco',
        reason: 'Gravar os dados do formulário no banco.',
        sourceHandle: 'valid',
        targetHandle: 'execute',
        slotKey: 'validTargetId',
        defaultConfig: { operation: 'insert', table: 'usuarios' },
      },
      {
        targetKind: 'auth',
        title: 'Autenticação',
        reason: 'Usar dados do formulário para login ou cadastro.',
        sourceHandle: 'valid',
        targetHandle: 'trigger',
        slotKey: 'validTargetId',
      },
    ],
    buildCodeSnippet: (v) => {
      const fList = (v.fields || 'nome, email, senha')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const objFields = fList.map((f) => `${f}: read('${f}', 'value', '')`).join(', ');
      return `const data = { ${objFields} };\nreturn ${safeFn(v.validTargetId, 'salvarDados')}(data);`;
    },
  },
  {
    id: 'loop_foreach_items',
    name: 'Percorrer Lista (ForEach)',
    category: 'Controle de Fluxo & Decisão',
    description: 'Executa um bloco para cada item da lista e prossegue ao terminar.',
    icon: 'repeat',
    compatibleKinds: ['loop'],
    configPatch: {
      sourceKey: 'itens',
      itemVar: 'item',
    },
    variables: [
      {
        key: 'sourceKey',
        label: 'Lista na memória:',
        type: 'text',
        required: true,
        defaultValue: 'itens',
      },
      {
        key: 'eachTargetId',
        label: 'Para cada item, chamar:',
        type: 'block_ref',
        required: true,
        allowedKinds: ['function', 'database', 'api', 'email', 'notify', 'state'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'each',
          targetHandle: 'execute',
          defaultArg: 'item',
        },
      },
      {
        key: 'completeTargetId',
        label: 'Ao terminar lista, chamar:',
        type: 'block_ref',
        allowedKinds: ['notify', 'screen', 'function', 'state'],
        edgeBinding: {
          direction: 'outgoing',
          sourceHandle: 'onComplete',
          targetHandle: 'execute',
        },
      },
    ],
    recommendations: [
      {
        targetKind: 'function',
        title: 'Processar Item',
        reason: 'Executar lógica em cada item da lista.',
        sourceHandle: 'each',
        targetHandle: 'execute',
        slotKey: 'eachTargetId',
      },
      {
        targetKind: 'notify',
        title: 'Notificar Conclusão',
        reason: 'Avisar quando todos os itens forem processados.',
        sourceHandle: 'onComplete',
        targetHandle: 'execute',
        slotKey: 'completeTargetId',
      },
    ],
    buildCodeSnippet: (v) =>
      `for (const ${v.itemVar || 'item'} of (store['${v.sourceKey || 'itens'}'] || [])) {\n  ${safeFn(v.eachTargetId, 'processarItem')}(${v.itemVar || 'item'});\n}\n${v.completeTargetId ? `return ${safeFn(v.completeTargetId)}();` : 'return true;'}`,
  },
];

/**
 * Retorna os templates compatíveis com um determinado tipo de bloco,
 * agrupados por categoria.
 */
export function getLogicTemplatesForKind(
  kind: Kind,
  includeAllCategories = false,
): Record<LogicCategory, BlockLogicTemplate[]> {
  const grouped: Record<LogicCategory, BlockLogicTemplate[]> = {
    'Interface & Eventos': [],
    'Validação & Segurança': [],
    'Transformação & Cálculo': [],
    'Controle de Fluxo & Decisão': [],
    'Autenticação & Sessão': [],
    'Persistência & Banco de Dados': [],
    'Integrações, API & Pagamentos': [],
    'Notificações, Mensagens & Tempo Real': [],
  };

  for (const tmpl of BLOCK_LOGIC_TEMPLATES) {
    if (includeAllCategories || tmpl.compatibleKinds.includes(kind)) {
      grouped[tmpl.category].push(tmpl);
    }
  }

  return grouped;
}

/** Busca um template pelo ID */
export function getLogicTemplateById(id?: string): BlockLogicTemplate | undefined {
  if (!id) return undefined;
  return BLOCK_LOGIC_TEMPLATES.find((t) => t.id === id);
}

/**
 * Infere qual template melhor representa a configuração atual do bloco,
 * mesmo quando o bloco foi criado antes de `logicTemplateId` existir.
 */
export function inferBlockLogicTemplate(block: Block): BlockLogicTemplate | undefined {
  const explicit = getLogicTemplateById(block.data.config.logicTemplateId);
  if (explicit) return explicit;

  const kind = block.data.kind;
  const c = block.data.config;

  if (kind === 'validator') {
    if (c.rule === 'email') return getLogicTemplateById('val_email_rule');
    if (c.rule === 'minLength' || c.rule === 'min_length')
      return getLogicTemplateById('val_password_min_length');
    return getLogicTemplateById('val_cpf_or_required');
  }
  if (kind === 'auth') {
    if (c.provider === 'google') return getLogicTemplateById('auth_google_oauth');
    return getLogicTemplateById('auth_email_password_login');
  }
  if (kind === 'database') {
    if (c.operation === 'insert') return getLogicTemplateById('db_insert_record');
    return getLogicTemplateById('db_query_records');
  }
  if (kind === 'condition' || kind === 'compare') {
    return getLogicTemplateById('cond_if_else_branch');
  }

  return BLOCK_LOGIC_TEMPLATES.find((t) => t.compatibleKinds.includes(kind));
}

export type BlockLogicDiagnostic = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  remediationLabel?: string;
  /** Patch de config para corrigir automaticamente o problema com 1 clique */
  fixConfigPatch?: Record<string, string>;
};

export type BlockIntentAnalysis = {
  /** Resumo legível do que o sistema entendeu que o bloco faz a partir das propriedades escolhidas */
  intentSummary: string;
  /** Template ativo (explícito ou inferido) */
  activeTemplate?: BlockLogicTemplate;
  /** Erros ou incompatibilidades de lógica/conexão detectados neste bloco */
  diagnostics: BlockLogicDiagnostic[];
  /** Recomendações inteligentes de próximos passos ou blocos que faltam vincular */
  recommendations: LogicRecommendation[];
};

/**
 * Analisa um bloco, suas propriedades escolhidas e suas conexões no grafo para:
 * 1. Entender a intenção do usuário (Intent Detection)
 * 2. Detectar erros ou incompatibilidades entre a lógica escolhida, o tipo do bloco e as conexões
 * 3. Recomendar os próximos blocos ou conexões ideais
 */
export function analyzeBlockIntentAndDiagnostics(
  graph: Graph,
  block: Block,
): BlockIntentAnalysis {
  const kind = block.data.kind;
  const config = block.data.config;
  const outEdges = graph.edges.filter((e) => e.source === block.id);
  const inEdges = graph.edges.filter((e) => e.target === block.id);

  const explicitTemplate = getLogicTemplateById(config.logicTemplateId);
  const activeTemplate = explicitTemplate || inferBlockLogicTemplate(block);
  const diagnostics: BlockLogicDiagnostic[] = [];

  // 1. Verifica se o usuário atribuiu uma função/lógica incompatível com o tipo do bloco
  if (explicitTemplate && !explicitTemplate.compatibleKinds.includes(kind)) {
    const allowedNames = explicitTemplate.compatibleKinds
      .map((k) => catalog[k]?.name || k)
      .join(', ');
    const fallbackForKind = BLOCK_LOGIC_TEMPLATES.find((t) => t.compatibleKinds.includes(kind));
    diagnostics.push({
      severity: 'error',
      code: 'INCOMPATIBLE_LOGIC_TEMPLATE',
      message: `A lógica "${explicitTemplate.name}" não é compatível com o bloco do tipo "${catalog[kind]?.name || kind}". Ela foi projetada para: ${allowedNames}.`,
      remediationLabel: fallbackForKind
        ? `Trocar para "${fallbackForKind.name}"`
        : 'Remover lógica incompatível',
      fixConfigPatch: {
        logicTemplateId: fallbackForKind ? fallbackForKind.id : '',
      },
    });
  }

  // 2. Verifica variáveis de referência a blocos (slots) nas propriedades
  if (activeTemplate) {
    for (const slot of activeTemplate.variables) {
      const rawVal = (config[slot.key] || '').trim();

      if (slot.type === 'block_ref' && rawVal) {
        if (rawVal === block.id) {
          diagnostics.push({
            severity: 'error',
            code: 'SELF_REFERENCE_SLOT',
            message: `O campo "${slot.label}" referencia o próprio bloco (#${block.id}), o que causaria um loop infinito.`,
            remediationLabel: 'Limpar auto-referência',
            fixConfigPatch: { [slot.key]: '' },
          });
          continue;
        }

        const targetNode = graph.nodes.find((n) => n.id === rawVal);
        if (!targetNode) {
          diagnostics.push({
            severity: 'error',
            code: 'MISSING_REFERENCED_BLOCK',
            message: `O campo "${slot.label}" chama o bloco "#${rawVal}", mas esse bloco não existe mais no fluxo.`,
            remediationLabel: 'Limpar referência inexistente',
            fixConfigPatch: { [slot.key]: '' },
          });
        } else if (
          slot.allowedKinds &&
          slot.allowedKinds.length > 0 &&
          !slot.allowedKinds.includes(targetNode.data.kind)
        ) {
          const expectedNames = slot.allowedKinds.map((k) => catalog[k]?.name || k).join(', ');
          diagnostics.push({
            severity: 'warning',
            code: 'INCOMPATIBLE_REFERENCED_BLOCK_KIND',
            message: `Incompatibilidade em "${slot.label}": o bloco "${targetNode.data.label}" (#${targetNode.id}) é do tipo "${catalog[targetNode.data.kind]?.name}", mas esta lógica espera: ${expectedNames}.`,
            remediationLabel: 'Desvincular bloco incompatível',
            fixConfigPatch: { [slot.key]: '' },
          });
        }
      }
    }
  }

  // 3. Verifica compatibilidade semântica das conexões existentes com o bloco e a lógica
  for (const edge of outEdges) {
    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (!targetNode) continue;

    // Ex: conectar saída de evento/controle a um bloco puramente de entrada de interface (input)
    if (targetNode.data.kind === 'input' && isExecOutput(edge.sourceHandle, block)) {
      diagnostics.push({
        severity: 'error',
        code: 'INVALID_EXEC_TO_INPUT',
        message: `Conexão incompatível: a saída de execução "${edge.sourceHandle || 'next'}" não pode acionar um Campo de Entrada ("${targetNode.data.label}"). Campos de entrada fornecem dados em vez de receber eventos.`,
      });
    }

    // Verifica se a porta usada existe ou se há conflito entre dados e controle
    if (edge.sourceHandle && edge.targetHandle) {
      const sPort = getPortDefinition(block, edge.sourceHandle, 'output');
      const tPort = getPortDefinition(targetNode, edge.targetHandle, 'input');
      if (sPort && tPort && sPort.mode !== tPort.mode) {
        const allowErrorToControl =
          sPort.mode === 'error' && (tPort.mode === 'control' || tPort.mode === 'error');
        if (!allowErrorToControl) {
          diagnostics.push({
            severity: 'error',
            code: 'PORT_MODE_MISMATCH',
            message: `Conflito de conexão: a porta "${sPort.name}" (${sPort.mode}) de "${block.data.label}" está ligada à porta "${tPort.name}" (${tPort.mode}) de "${targetNode.data.label}".`,
          });
        }
      }
    }
  }

  // 4. Constrói o Resumo de Intenção (O que o app entendeu das escolhas do usuário)
  let intentSummary = catalog[kind]?.description || 'Bloco do fluxo';
  if (kind === 'validator') {
    const ruleLabels: Record<string, string> = {
      required: 'se o campo foi preenchido (obrigatório)',
      email: 'se o valor tem formato de e-mail válido',
      minLength: `se o texto tem no mínimo ${config.param || 6} caracteres`,
      min_length: `se o texto tem no mínimo ${config.param || 6} caracteres`,
      numeric: 'se o valor contém apenas números',
      cpf: 'se o CPF possui 11 dígitos válidos',
      regex: `se o texto atende ao padrão Regex (${config.param || '.*'})`,
    };
    const validEdge = outEdges.find((e) => e.sourceHandle === 'valid');
    const validTarget = validEdge ? graph.nodes.find((n) => n.id === validEdge.target) : undefined;
    intentSummary = `Verifica ${ruleLabels[config.rule || 'required'] || 'a regra configurada'}${
      validTarget
        ? ` e, quando aprovado, chama "${validTarget.data.label}" (#${validTarget.id}).`
        : '. Falta definir qual bloco chamar quando for aprovado.'
    }`;
  } else if (kind === 'auth') {
    const isReg = config.mode === 'register';
    const isGoogle = config.provider === 'google';
    const sucEdge = outEdges.find((e) => e.sourceHandle === 'onSuccess');
    const sucTarget = sucEdge ? graph.nodes.find((n) => n.id === sucEdge.target) : undefined;
    intentSummary = isGoogle
      ? `Autentica o usuário via Google OAuth (${config.googleEmail || 'conta Google'})`
      : isReg
        ? `Cadastra um novo usuário com e-mail e senha na tabela de usuários`
        : `Valida credenciais de login (e-mail e senha)`;
    intentSummary += sucTarget
      ? ` e redireciona/aciona "${sucTarget.data.label}" (#${sucTarget.id}) no sucesso.`
      : '. Recomendado conectar a saída de sucesso (onSuccess) a uma Tela ou Notificação.';
  } else if (kind === 'database') {
    const op = config.operation || 'query';
    const table = config.table || 'usuarios';
    intentSummary =
      op === 'insert'
        ? `Insere um novo registro na tabela "${table}" com os dados recebidos.`
        : op === 'update'
          ? `Atualiza um registro existente na tabela "${table}".`
          : op === 'delete'
            ? `Remove um registro da tabela "${table}".`
            : `Consulta registros da tabela "${table}" (limite: ${config.limit || 10}).`;
  } else if (kind === 'condition') {
    const op = config.operator || 'truthy';
    const cmp = config.compare || '';
    const trueEdge = outEdges.find((e) => e.sourceHandle === 'true');
    const falseEdge = outEdges.find((e) => e.sourceHandle === 'false');
    intentSummary =
      op === 'truthy'
        ? `Avalia se o dado recebido está preenchido/verdadeiro`
        : `Compara se o valor é "${op}" a "${cmp}"`;
    intentSummary += ` (Verdadeiro ➔ ${trueEdge ? `#${trueEdge.target}` : 'retorno direto'} | Falso ➔ ${falseEdge ? `#${falseEdge.target}` : 'retorno direto'}).`;
  } else if (kind === 'function') {
    if (explicitTemplate) {
      intentSummary = `${explicitTemplate.name}: ${explicitTemplate.description}`;
    } else if (config.callValidatorId || config.nextAuthOrDbId) {
      intentSummary = `Executa lógica coordenada chamando ${config.callValidatorId ? `#${config.callValidatorId}` : 'validação'} e encaminhando para ${config.nextAuthOrDbId ? `#${config.nextAuthOrDbId}` : 'o próximo bloco'}.`;
    } else {
      const nextEdge = outEdges[0];
      intentSummary = `Transforma ou processa os dados de entrada${nextEdge ? ` e envia o resultado para #${nextEdge.target}` : ''}.`;
    }
  } else if (explicitTemplate) {
    intentSummary = `${explicitTemplate.name}: ${explicitTemplate.description}`;
  }

  // 5. Filtra recomendações inteligentes que ainda não foram preenchidas/conectadas
  const recommendations: LogicRecommendation[] = [];
  if (activeTemplate) {
    for (const rec of activeTemplate.recommendations) {
      const alreadyConnected = outEdges.some((e) => {
        const target = graph.nodes.find((n) => n.id === e.target);
        return (
          e.sourceHandle === rec.sourceHandle &&
          target &&
          (target.data.kind === rec.targetKind ||
            (rec.slotKey && config[rec.slotKey] === target.id))
        );
      });
      if (!alreadyConnected) {
        recommendations.push(rec);
      }
    }
  }

  // Se é um bloco assíncrono/crítico (auth, database, api, payment) e não tem tratamento de erro (onError)
  if (
    ['auth', 'database', 'api', 'payment'].includes(kind) &&
    !outEdges.some((e) => e.sourceHandle === 'onError' || e.sourceHandle === 'error') &&
    !recommendations.some((r) => r.sourceHandle === 'onError')
  ) {
    recommendations.push({
      targetKind: 'error',
      title: 'Adicionar Bloco de Tratamento de Erro (onError)',
      reason: `O bloco "${block.data.label}" pode falhar em tempo de execução; conecte a saída onError para capturar exceções.`,
      sourceHandle: 'onError',
      targetHandle: 'execute',
    });
  }

  // Se é um botão sem conexão de clique
  if (
    kind === 'button' &&
    outEdges.length === 0 &&
    !recommendations.some((r) => r.sourceHandle === 'onClick')
  ) {
    recommendations.push({
      targetKind: 'function',
      title: 'Conectar Clique a uma Função ou Validação',
      reason: 'Este botão ainda não dispara nenhuma ação quando clicado.',
      sourceHandle: 'onClick',
      targetHandle: 'execute',
    });
  }

  // Evita warning de variável não lida caso inEdges seja útil em futuras heurísticas
  void inEdges;

  return {
    intentSummary,
    activeTemplate,
    diagnostics,
    recommendations,
  };
}

