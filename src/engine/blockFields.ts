// Definições de propriedades independentes da interface React.
import type { Kind } from './types';
import { logicDefinition } from './catalogo/logicCatalog';

export type Option = { value: string; label: string };

export type FieldSpec = {
  key: string;
  label: string;
  /** Lista fixa de opções, 'screens' para as telas do projeto, ou 'flows' para os fluxos cadastrados. */
  options?:
    | Option[]
    | 'screens'
    | 'flows'
    | 'httpConnections'
    | 'postgresConnections'
    | 'logicCatalogVersions';
  entries?: boolean;
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
    {
      key: 'field',
      label: 'Tipo do campo',
      options: same('text', 'email', 'password', 'number', 'tel', 'date', 'select', 'checkbox'),
    },
    { key: 'placeholder', label: 'Texto de ajuda (Placeholder)' },
    { key: 'value', label: 'Valor inicial' },
    {
      key: 'required',
      label: 'Obrigatório',
      options: [
        { value: 'false', label: 'Opcional' },
        { value: 'true', label: 'Obrigatório' },
      ],
    },
    {
      key: 'mask',
      label: 'Máscara de formatação',
      options: [
        { value: 'none', label: 'Sem máscara' },
        { value: 'cpf', label: 'CPF (000.000.000-00)' },
        { value: 'cnpj', label: 'CNPJ (00.000.000/0000-00)' },
        { value: 'phone', label: 'Telefone ((00) 00000-0000)' },
        { value: 'cep', label: 'CEP (00000-000)' },
        { value: 'currency', label: 'Moeda (R$ 0,00)' },
      ],
    },
  ],
  button: [
    { key: 'buttonText', label: 'Texto do botão' },
    {
      key: 'variant',
      label: 'Estilo visual',
      options: [
        { value: 'primary', label: 'Primário (Destaque)' },
        { value: 'secondary', label: 'Secundário' },
        { value: 'danger', label: 'Perigo / Excluir' },
      ],
    },
    { key: 'loadingText', label: 'Texto durante carregamento' },
  ],
  form: [
    { key: 'fields', label: 'Campos do formulário (separados por vírgula)' },
    { key: 'requiredFields', label: 'Campos obrigatórios (separados por vírgula)' },
    { key: 'submitLabel', label: 'Texto do botão de envio' },
  ],
  loop: [
    { key: 'sourceKey', label: 'Lista de origem (variável no store ou entrada)' },
    { key: 'itemVar', label: 'Nome da variável de cada item (ex: item)' },
    { key: 'maxItems', label: 'Limite máximo de iterações' },
  ],
  function: [],
  condition: [
    {
      key: 'catalogVersion',
      label: 'Versão publicada do catálogo',
      options: 'logicCatalogVersions',
    },
    {
      key: 'operator',
      label: 'Comparação',
      options: logicDefinition('condition').options.map(({ value, label }) => ({ value, label })),
    },
    { key: 'compare', label: 'Comparar com (valor2)', visible: (c) => c.operator !== 'truthy' },
    { key: 'trueValue', label: 'Retorno se True (ex: valor3)' },
    { key: 'falseValue', label: 'Retorno se False (ex: "Texto personalizado")' },
  ],
  auth: [
    {
      key: 'execution',
      label: 'Execução',
      options: [
        { value: 'demo', label: 'Demonstração' },
        { value: 'real', label: 'Autenticação pelo servidor' },
      ],
    },
    {
      key: 'authDatabaseId',
      label: 'Banco PostgreSQL para usuários e sessões',
      options: 'postgresConnections',
      visible: (c) => c.execution === 'real',
    },
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
        { value: 'session', label: 'Consultar sessão' },
        { value: 'logout', label: 'Sair' },
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
      key: 'catalogVersion',
      label: 'Versão publicada do catálogo',
      options: 'logicCatalogVersions',
    },
    {
      key: 'rule',
      label: 'Regra de Validação',
      options: logicDefinition('validator').options.map(({ value, label }) => ({ value, label })),
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
    {
      key: 'mode',
      label: 'Execução',
      options: [
        { value: 'demo', label: 'Demonstração (sem rede)' },
        { value: 'real', label: 'HTTP real pelo servidor' },
      ],
    },
    {
      key: 'connectionId',
      label: 'Conexão HTTP',
      options: 'httpConnections',
      visible: (c) => c.mode === 'real',
    },
    { key: 'method', label: 'Método HTTP', options: same('GET', 'POST', 'PUT', 'PATCH', 'DELETE') },
    { key: 'url', label: 'Endpoint' },
    { key: 'query', label: 'Parâmetros da URL', entries: true, visible: (c) => c.mode === 'real' },
    {
      key: 'bodyFields',
      label: 'Campos do corpo (ou conecte a porta body)',
      entries: true,
      visible: (c) => c.mode === 'real' && ['POST', 'PUT', 'PATCH'].includes(c.method),
    },
    {
      key: 'responseType',
      label: 'Formato da resposta',
      options: same('json', 'text'),
      visible: (c) => c.mode === 'real',
    },
    {
      key: 'mock',
      label: 'Resposta de demonstração (JSON)',
      area: true,
      visible: (c) => c.mode !== 'real',
    },
  ],
  httpConnection: [
    { key: 'baseUrl', label: 'URL base — desenvolvimento' },
    { key: 'productionBaseUrl', label: 'URL base — produção' },
    {
      key: 'auth',
      label: 'Autenticação',
      options: [
        { value: 'none', label: 'Sem autenticação' },
        { value: 'bearer', label: 'Token Bearer' },
        { value: 'apiKey', label: 'API key em cabeçalho' },
      ],
    },
    {
      key: 'secretEnv',
      label: 'Nome do segredo (ex.: FLOWFORGE_SECRET_API_TOKEN)',
      visible: (c) => c.auth !== 'none',
    },
    { key: 'headerName', label: 'Cabeçalho da API key', visible: (c) => c.auth === 'apiKey' },
    { key: 'headers', label: 'Cabeçalhos públicos adicionais', entries: true },
    { key: 'timeoutMs', label: 'Tempo limite (ms)' },
  ],
  postgresConnection: [
    {
      key: 'engine',
      label: 'Motor do Banco de Dados',
      options: [
        { value: 'postgres', label: 'PostgreSQL (Servidor)' },
        { value: 'sqlite', label: 'SQLite (Arquivo Local / Embarcado)' },
      ],
    },
    {
      key: 'sqlitePath',
      label: 'Caminho do Arquivo SQLite (ex.: ./data/flowforge.sqlite)',
      visible: (c) => c.engine === 'sqlite',
    },
    { key: 'host', label: 'Host (Desenvolvimento)', visible: (c) => c.engine !== 'sqlite' },
    { key: 'port', label: 'Porta (Desenvolvimento)', visible: (c) => c.engine !== 'sqlite' },
    { key: 'database', label: 'Nome do Banco (Desenvolvimento)' },
    { key: 'schema', label: 'Esquema (Desenvolvimento)', visible: (c) => c.engine !== 'sqlite' },
    { key: 'user', label: 'Usuário (Desenvolvimento)', visible: (c) => c.engine !== 'sqlite' },
    {
      key: 'secretEnv',
      label: 'Segredo de Senha (ex.: FLOWFORGE_SECRET_DB_PASSWORD)',
      visible: (c) => c.engine !== 'sqlite',
    },
    {
      key: 'ssl',
      label: 'Modo TLS / SSL',
      options: [
        { value: 'disable', label: 'Desativado (disable)' },
        { value: 'require', label: 'Obrigatório (require)' },
        { value: 'prefer', label: 'Preferencial (prefer)' },
      ],
      visible: (c) => c.engine !== 'sqlite',
    },
    { key: 'timeoutMs', label: 'Tempo limite (ms)' },
    { key: 'productionHost', label: 'Host (Produção)', visible: (c) => c.engine !== 'sqlite' },
    { key: 'productionPort', label: 'Porta (Produção)', visible: (c) => c.engine !== 'sqlite' },
    {
      key: 'productionDatabase',
      label: 'Nome do Banco (Produção)',
      visible: (c) => c.engine !== 'sqlite',
    },
    {
      key: 'productionSchema',
      label: 'Esquema (Produção)',
      visible: (c) => c.engine !== 'sqlite',
    },
    { key: 'productionUser', label: 'Usuário (Produção)', visible: (c) => c.engine !== 'sqlite' },
    {
      key: 'productionSecretEnv',
      label: 'Segredo de Senha (Produção)',
      visible: (c) => c.engine !== 'sqlite',
    },
    {
      key: 'productionSsl',
      label: 'Modo TLS / SSL (Produção)',
      options: [
        { value: 'disable', label: 'Desativado (disable)' },
        { value: 'require', label: 'Obrigatório (require)' },
        { value: 'prefer', label: 'Preferencial (prefer)' },
      ],
      visible: (c) => c.engine !== 'sqlite',
    },
    {
      key: 'multiTenancy',
      label: 'Isolamento Multi-Tenancy',
      options: [
        { value: 'none', label: 'Desativado (Mono-tenant)' },
        { value: 'column', label: 'Por Coluna (tenant_id)' },
        { value: 'schema', label: 'Por Esquema PostgreSQL' },
      ],
    },
    {
      key: 'tenantColumn',
      label: 'Nome da Coluna de Tenant (padrão: tenant_id)',
      visible: (c) => c.multiTenancy === 'column',
    },
  ],
  entity: [
    { key: 'name', label: 'Nome da Tabela' },
    { key: 'schema', label: 'Esquema PostgreSQL (padrão: public)' },
    {
      key: 'multiTenancy',
      label: 'Multi-Tenancy',
      options: [
        { value: 'none', label: 'Padrão da Conexão' },
        { value: 'column', label: 'Forçar Isolamento por Coluna (tenant_id)' },
        { value: 'schema', label: 'Forçar Isolamento por Schema' },
      ],
    },
    {
      key: 'tenantColumn',
      label: 'Nome da Coluna de Tenant',
      visible: (c) => c.multiTenancy === 'column',
    },
    { key: 'fields', label: 'Definição de Campos (JSON)', area: true },
  ],
  identityProvider: [
    { key: 'name', label: 'Nome do Provedor' },
    {
      key: 'type',
      label: 'Tipo de Provedor',
      options: [
        { value: 'email', label: 'E-mail e Senha' },
        { value: 'google', label: 'Google OAuth' },
        { value: 'oidc', label: 'OpenID Connect (OIDC)' },
      ],
    },
    { key: 'clientId', label: 'Client ID', visible: (c) => c.type !== 'email' },
    {
      key: 'clientSecretEnv',
      label: 'Segredo (ex.: FLOWFORGE_SECRET_AUTH_SECRET)',
      visible: (c) => c.type !== 'email',
    },
    { key: 'domain', label: 'Domínio / URL', visible: (c) => c.type === 'oidc' },
    { key: 'redirectUri', label: 'URL de Retorno', visible: (c) => c.type !== 'email' },
    { key: 'sessionDurationSec', label: 'Duração da Sessão (segundos)' },
  ],
  policy: [
    { key: 'name', label: 'Nome da Política' },
    { key: 'target', label: 'Recurso Alvo (ex.: clientes.delete, *)' },
    {
      key: 'action',
      label: 'Ação',
      options: [
        { value: '*', label: 'Todas as ações (*)' },
        { value: 'create', label: 'Criar (create)' },
        { value: 'read', label: 'Ler (read)' },
        { value: 'update', label: 'Atualizar (update)' },
        { value: 'delete', label: 'Excluir (delete)' },
      ],
    },
    {
      key: 'effect',
      label: 'Efeito',
      options: [
        { value: 'allow', label: 'Permitir (Allow)' },
        { value: 'deny', label: 'Negar (Deny)' },
      ],
    },
    { key: 'conditions', label: 'Condições da Regra (JSON)', area: true },
    { key: 'errorMessage', label: 'Mensagem se Negado' },
  ],
  database: [
    {
      key: 'mode',
      label: 'Modo de Execução',
      options: [
        { value: 'mock', label: 'Demonstração (em memória)' },
        { value: 'real', label: 'PostgreSQL Real (Servidor)' },
      ],
    },
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
    {
      key: 'filterField',
      label: 'Campo do filtro (Query)',
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'filterValue',
      label: 'Valor do filtro (Query)',
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'limit',
      label: 'Limite / Page size (Query)',
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'offset',
      label: 'Deslocamento / Offset (Query)',
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'orderBy',
      label: 'Ordenar por (Query)',
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'orderDirection',
      label: 'Direção da ordenação',
      options: [
        { value: 'asc', label: 'Crescente (ASC)' },
        { value: 'desc', label: 'Decrescente (DESC)' },
      ],
      visible: (c) => !c.operation || c.operation === 'query',
    },
    {
      key: 'recordId',
      label: 'ID do registro (Get/Update/Delete)',
      visible: (c) => ['get', 'update', 'delete'].includes(c.operation || ''),
    },
    {
      key: 'data',
      label: 'Dados do registro (JSON para Insert/Update)',
      area: true,
      visible: (c) => ['insert', 'update'].includes(c.operation || ''),
    },
    {
      key: 'mock',
      label: 'Registros iniciais (array JSON)',
      area: true,
      visible: (c) => c.mode !== 'real',
    },
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
  object: [
    { key: 'fields', label: 'Campos do objeto (JSON)' },
    { key: 'fieldNames', label: 'Campos conectados (separados por vírgula)' },
  ],
  array: [{ key: 'items', label: 'Itens iniciais (separados por vírgula)' }],
  subflow: [
    { key: 'subflowId', label: 'Identificador do Subfluxo' },
    { key: 'subflowName', label: 'Nome do Subfluxo' },
    { key: 'subflowDefinition', label: 'Definição do Subfluxo (JSON)', area: true },
  ],
  storage: [
    {
      key: 'execution',
      label: 'Execução',
      options: [
        { value: 'real', label: 'Serviço real' },
        { value: 'demo', label: 'Demonstração' },
      ],
    },
    {
      key: 'provider',
      label: 'Provedor de Armazenamento',
      options: [
        { value: 'local', label: 'Servidor Local (Uploads)' },
        { value: 's3', label: 'Amazon S3 / Compatível' },
      ],
    },
    { key: 'bucket', label: 'Nome do Bucket / Pasta' },
    { key: 'maxSizeBytes', label: 'Tamanho Máximo (bytes)' },
    { key: 'allowedTypes', label: 'Tipos de Arquivo Permitidos (MIME)' },
    { key: 'secretEnv', label: 'Referência ao Segredo de Acesso' },
  ],
  email: [
    {
      key: 'execution',
      label: 'Execução',
      options: [
        { value: 'real', label: 'Serviço real' },
        { value: 'demo', label: 'Demonstração' },
      ],
    },
    {
      key: 'provider',
      label: 'Provedor de E-mail',
      options: [
        { value: 'smtp', label: 'Servidor SMTP' },
        { value: 'resend', label: 'Resend API' },
      ],
    },
    { key: 'from', label: 'Remetente Autorizado (From)' },
    { key: 'to', label: 'Destinatário (To)' },
    { key: 'subject', label: 'Assunto do E-mail' },
    { key: 'body', label: 'Corpo da Mensagem (Texto ou HTML)', area: true },
    { key: 'secretEnv', label: 'Referência ao Segredo (API Key / Senha)' },
  ],
  webhook: [
    { key: 'path', label: 'Caminho do Webhook (ex: /api/webhooks/gateway)' },
    { key: 'eventType', label: 'Tipo de Evento Aceito (* para todos)' },
    { key: 'secretEnv', label: 'Referência ao Segredo de Assinatura (HMAC)' },
  ],
  task: [
    {
      key: 'execution',
      label: 'Execução',
      options: [
        { value: 'real', label: 'Serviço real' },
        { value: 'demo', label: 'Demonstração' },
      ],
    },
    { key: 'taskName', label: 'Nome da Tarefa' },
    { key: 'schedule', label: 'Expressão Cron (ex: 0 * * * *)' },
  ],
  payment: [
    {
      key: 'execution',
      label: 'Execução',
      options: [
        { value: 'real', label: 'Serviço real' },
        { value: 'demo', label: 'Demonstração' },
      ],
    },
    {
      key: 'provider',
      label: 'Provedor de Pagamento',
      options: [
        { value: 'stripe', label: 'Stripe Checkout / API' },
        { value: 'pix', label: 'PIX (Banco Central / QR Code)' },
        { value: 'mercadopago', label: 'Mercado Pago' },
      ],
    },
    {
      key: 'operation',
      label: 'Operação',
      options: [
        { value: 'createCheckout', label: 'Criar Sessão de Checkout' },
        { value: 'charge', label: 'Cobrança Direta' },
        { value: 'verify', label: 'Consultar Status do Pagamento' },
        { value: 'refund', label: 'Estorno de Cobrança' },
      ],
    },
    {
      key: 'currency',
      label: 'Moeda',
      options: [
        { value: 'BRL', label: 'BRL - Real Brasileiro' },
        { value: 'USD', label: 'USD - Dólar Americano' },
        { value: 'EUR', label: 'EUR - Euro' },
      ],
    },
    { key: 'amount', label: 'Valor Padrão (centavos ou decimal)' },
    { key: 'description', label: 'Descrição do Item / Pedido' },
    { key: 'successUrl', label: 'URL de Sucesso (após pagamento)' },
    { key: 'cancelUrl', label: 'URL de Cancelamento' },
    { key: 'secretEnv', label: 'Referência ao Segredo (API Key / Token)' },
  ],
  realtime: [
    {
      key: 'protocol',
      label: 'Protocolo de Tempo Real',
      options: [
        { value: 'sse', label: 'Server-Sent Events (SSE)' },
        { value: 'websocket', label: 'WebSocket (Bidirecional)' },
      ],
    },
    {
      key: 'action',
      label: 'Ação',
      options: [
        { value: 'publish', label: 'Publicar Evento no Canal' },
        { value: 'subscribe', label: 'Assinar e Ouvir Canal' },
        { value: 'broadcast', label: 'Transmitir para Todos os Clientes' },
      ],
    },
    { key: 'channel', label: 'Canal / Tópico (ex: pedidos, alertas)' },
    { key: 'event', label: 'Nome do Evento (ex: novo_pedido)' },
  ],
};

const CODE_FIELD: FieldSpec = {
  key: 'code',
  label: 'Código',
  area: true,
};

export function fieldsFor(kind: Kind): FieldSpec[] {
  const specific = specificFields[kind] ?? [];
  if (
    [
      'httpConnection',
      'postgresConnection',
      'entity',
      'identityProvider',
      'policy',
      'storage',
      'email',
      'webhook',
      'task',
      'payment',
      'realtime',
    ].includes(kind)
  )
    return specific;
  const base = kind !== 'screen' ? [SCREEN_ID, FLOW_ID, ...specific] : [FLOW_ID, ...specific];
  return kind === 'api' ? base : [...base.filter((f) => f.key !== 'code'), CODE_FIELD];
}
