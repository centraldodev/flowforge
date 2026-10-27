import type { Block, BlockData, Graph, Link } from './types';

const b = (id: string, x: number, y: number, data: BlockData): Block => ({
  id,
  type: 'block',
  position: { x, y },
  data,
});

const l = (
  id: string,
  source: string,
  target: string,
  sourceHandle = 'output',
  targetHandle = 'input',
): Link => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
});

/**
 * 1. Primeiro App de Referência: Gestor de Clientes e Pedidos
 *
 * Contempla os 7 requisitos da Seção 13 do plano mestre:
 * 1. Login real e página protegida.
 * 2. Cadastro de cliente com validação visual.
 * 3. Listagem persistente com filtro, ordenação e paginação.
 * 4. Alteração e exclusão com autorização por organização/proprietário.
 * 5. Pedido com itens, cálculo de total e transação.
 * 6. Chamada a uma API externa e tratamento de indisponibilidade.
 * 7. Exportação e execução independente com ambientes separados.
 */
export const customerOrdersProject: Graph = {
  version: 1,
  name: 'Gestor de Clientes e Pedidos',
  flows: [
    { id: 'auth_flow', name: 'Autenticação e Sessão', color: '#6366f1' },
    { id: 'clients_flow', name: 'Gestão de Clientes', color: '#10b981' },
    { id: 'orders_flow', name: 'Pedidos e Transações', color: '#f59e0b' },
    { id: 'integrations_flow', name: 'APIs e Notificações', color: '#ec4899' },
  ],
  nodes: [
    // Conexão PostgreSQL
    b('db_conn', 50, 50, {
      kind: 'postgresConnection',
      label: 'Conexão PostgreSQL Produção',
      config: {
        host: 'localhost',
        port: '5432',
        database: 'gestor_db',
        schema: 'public',
        user: 'postgres',
        secretEnv: 'FLOWFORGE_SECRET_DATABASE_URL',
        ssl: 'disable',
        timeoutMs: '5000',
      },
    }),

    // Entidade Clientes
    b('ent_clientes', 50, 180, {
      kind: 'entity',
      label: 'Entidade Clientes',
      config: {
        name: 'clientes',
        fields: JSON.stringify([
          { name: 'id', type: 'string', primaryKey: true, required: true },
          { name: 'nome', type: 'string', required: true },
          { name: 'email', type: 'string', required: true, unique: true },
          { name: 'telefone', type: 'string', required: false },
          { name: 'cep', type: 'string', required: false },
          { name: 'endereco', type: 'string', required: false },
          { name: 'org_id', type: 'string', required: true },
        ]),
      },
    }),

    // Entidade Pedidos
    b('ent_pedidos', 50, 310, {
      kind: 'entity',
      label: 'Entidade Pedidos',
      config: {
        name: 'pedidos',
        fields: JSON.stringify([
          { name: 'id', type: 'string', primaryKey: true, required: true },
          { name: 'cliente_id', type: 'string', required: true },
          { name: 'data', type: 'date', required: true },
          { name: 'status', type: 'string', required: true, defaultValue: 'pendente' },
          { name: 'total', type: 'number', required: true },
          { name: 'org_id', type: 'string', required: true },
        ]),
      },
    }),

    // Entidade Itens do Pedido
    b('ent_itens_pedido', 50, 440, {
      kind: 'entity',
      label: 'Entidade Itens de Pedido',
      config: {
        name: 'itens_pedido',
        fields: JSON.stringify([
          { name: 'id', type: 'string', primaryKey: true, required: true },
          { name: 'pedido_id', type: 'string', required: true },
          { name: 'produto', type: 'string', required: true },
          { name: 'quantidade', type: 'number', required: true },
          { name: 'preco_unitario', type: 'number', required: true },
        ]),
      },
    }),

    // Política de Acesso: Apenas mesma organização
    b('pol_org_clientes', 50, 570, {
      kind: 'policy',
      label: 'Regra de Acesso por Organização',
      config: {
        target: 'clientes.*',
        action: '*',
        effect: 'allow',
        conditions: JSON.stringify([
          { field: 'user.authenticated', operator: 'authenticated' },
          { field: 'user.orgId', operator: 'sameOrg' },
        ]),
        errorMessage: 'Acesso negado: registro pertence a outra organização.',
      },
    }),

    // Política de Exclusão: Apenas Manager ou Admin
    b('pol_delete_clientes', 50, 700, {
      kind: 'policy',
      label: 'Regra de Exclusão Restrita',
      config: {
        target: 'clientes.delete',
        action: 'delete',
        effect: 'allow',
        conditions: [
          { field: 'user.role', operator: 'inList', value: ['manager', 'admin'] },
        ] as unknown as string,
        errorMessage: 'Apenas gestores ou administradores podem excluir clientes.',
      },
    }),

    // Tela 1: Login
    b('screen_login', 300, 100, {
      kind: 'screen',
      label: 'Tela de Autenticação',
      config: {
        title: 'Gestor de Clientes - Login',
        flowId: 'auth_flow',
      },
    }),

    b('input_email', 520, 50, {
      kind: 'input',
      label: 'E-mail Corporativo',
      config: {
        field: 'email',
        placeholder: 'gestor@empresa.com',
        screenId: 'screen_login',
        required: 'true',
      },
    }),

    b('input_password', 520, 160, {
      kind: 'input',
      label: 'Senha de Acesso',
      config: {
        field: 'password',
        placeholder: '••••••••',
        screenId: 'screen_login',
        required: 'true',
      },
    }),

    b('btn_login', 520, 270, {
      kind: 'button',
      label: 'Botão Entrar',
      config: {
        text: 'Acessar Sistema',
        screenId: 'screen_login',
      },
    }),

    b('auth_action', 740, 270, {
      kind: 'auth',
      label: 'Validador de Sessão JWT',
      config: {
        provider: 'email',
        action: 'login',
        jwtSecretEnv: 'FLOWFORGE_SECRET_JWT_SECRET',
      },
    }),

    b('nav_to_clients', 960, 270, {
      kind: 'navigate',
      label: 'Ir para Clientes',
      config: {
        target: 'screen_clientes',
      },
    }),

    // Tela 2: Gestão de Clientes
    b('screen_clientes', 300, 450, {
      kind: 'screen',
      label: 'Tela de Clientes e Cadastros',
      config: {
        title: 'Gestor de Clientes',
        flowId: 'clients_flow',
        tableEntity: 'clientes',
        tablePageSize: '10',
      },
    }),

    b('input_nome_cliente', 520, 400, {
      kind: 'input',
      label: 'Nome do Cliente',
      config: {
        field: 'nome',
        placeholder: 'Nome Completo ou Razão Social',
        screenId: 'screen_clientes',
        required: 'true',
      },
    }),

    b('input_cep_cliente', 520, 500, {
      kind: 'input',
      label: 'CEP para Consulta',
      config: {
        field: 'cep',
        placeholder: '01001000',
        screenId: 'screen_clientes',
      },
    }),

    b('btn_consultar_cep', 740, 500, {
      kind: 'button',
      label: 'Consultar Endereço Externo',
      config: {
        text: 'Buscar CEP',
        screenId: 'screen_clientes',
      },
    }),

    b('api_cep', 960, 500, {
      kind: 'api',
      label: 'API ViaCEP com Fallback',
      config: {
        method: 'GET',
        url: 'https://viacep.com.br/ws/{{cep}}/json/',
        timeoutMs: '3000',
      },
    }),

    b('btn_salvar_cliente', 520, 620, {
      kind: 'button',
      label: 'Salvar Cadastro',
      config: {
        text: 'Salvar Cliente',
        screenId: 'screen_clientes',
      },
    }),

    b('val_cliente', 740, 620, {
      kind: 'validator',
      label: 'Validação Visual do Cliente',
      config: {
        rules: JSON.stringify([
          { field: 'nome', rule: 'required', message: 'Nome é obrigatório.' },
          { field: 'email', rule: 'email', message: 'E-mail corporativo inválido.' },
        ]),
      },
    }),

    b('db_insert_cliente', 960, 620, {
      kind: 'database',
      label: 'Inserir no PostgreSQL',
      config: {
        operation: 'insert',
        table: 'clientes',
        connectionId: 'db_conn',
      },
    }),

    b('notif_sucesso_cliente', 1180, 620, {
      kind: 'notify',
      label: 'Aviso de Sucesso',
      config: {
        message: 'Cliente cadastrado com sucesso!',
        type: 'success',
      },
    }),

    // Tela 3: Pedidos
    b('screen_pedidos', 300, 800, {
      kind: 'screen',
      label: 'Tela de Pedidos e Vendas',
      config: {
        title: 'Novo Pedido com Transação',
        flowId: 'orders_flow',
      },
    }),

    b('btn_criar_pedido', 520, 800, {
      kind: 'button',
      label: 'Finalizar Pedido',
      config: {
        text: 'Confirmar Pedido Transacional',
        screenId: 'screen_pedidos',
      },
    }),

    b('calc_total_pedido', 740, 800, {
      kind: 'subflow',
      label: 'Subfluxo Cálculo Total',
      config: {
        subflowId: 'sub_calcular_pedido',
      },
    }),

    b('db_insert_pedido', 960, 800, {
      kind: 'database',
      label: 'Gravar Pedido com Transação',
      config: {
        operation: 'insert',
        table: 'pedidos',
        connectionId: 'db_conn',
      },
    }),

    b('email_confirmacao', 1180, 800, {
      kind: 'email',
      label: 'E-mail de Confirmação',
      config: {
        provider: 'resend',
        from: 'vendas@minhaempresa.com',
        subject: 'Seu pedido foi registrado!',
        secretEnv: 'FLOWFORGE_SECRET_RESEND_API_KEY',
      },
    }),
  ],
  edges: [
    // Login -> Auth -> Navigate
    l('e1', 'btn_login', 'auth_action', 'onClick', 'trigger'),
    l('e2', 'auth_action', 'nav_to_clients', 'then', 'execute'),

    // CEP API
    l('e3', 'btn_consultar_cep', 'api_cep', 'onClick', 'execute'),

    // Cadastro Cliente -> Validação -> DB Insert -> Notify
    l('e4', 'btn_salvar_cliente', 'val_cliente', 'onClick', 'execute'),
    l('e5', 'val_cliente', 'db_insert_cliente', 'valid', 'execute'),
    l('e6', 'db_insert_cliente', 'notif_sucesso_cliente', 'then', 'execute'),

    // Pedido -> Subfluxo -> DB -> E-mail
    l('e7', 'btn_criar_pedido', 'calc_total_pedido', 'onClick', 'execute'),
    l('e8', 'calc_total_pedido', 'db_insert_pedido', 'then', 'execute'),
    l('e9', 'db_insert_pedido', 'email_confirmacao', 'then', 'execute'),
  ],
  tests: [
    {
      id: 'test_login_success',
      name: 'Login com Credenciais Válidas',
      description: 'Verifica navegação para a tela de clientes ao autenticar com sucesso',
      entryBlockId: 'btn_login',
      initialInputs: {
        email: 'demo@exemplo.com',
        password: '123456',
      },
      assertions: [
        {
          id: 'a1',
          kind: 'trace_contains',
          target: 'auth',
          expectedValue: 'auth',
          message: 'Deve passar pelo bloco de autenticação',
        },
        {
          id: 'a2',
          kind: 'screen_equals',
          expectedValue: 'screen_clientes',
          message: 'Deve navegar para a tela de clientes após autenticação',
        },
      ],
    },
    {
      id: 'test_save_client',
      name: 'Cadastro de Cliente com Validação',
      description: 'Garante que os dados do cliente são validados e inseridos',
      initialScreen: 'screen_clientes',
      entryBlockId: 'btn_salvar_cliente',
      initialInputs: {
        nome: 'Tech Solutions LTDA',
        cep: '01001000',
      },
      assertions: [
        {
          id: 'a3',
          kind: 'trace_contains',
          target: 'database',
          expectedValue: 'database',
          message: 'Deve executar a inserção de dados do cliente no banco',
        },
        {
          id: 'a4',
          kind: 'notification_emitted',
          expectedValue: 'Cliente cadastrado com sucesso!',
          message: 'Deve emitir notificação de sucesso ao cadastrar',
        },
      ],
    },
  ],
};

/**
 * 2. Projeto de Verificação: Agendamento com Prevenção de Conflito
 * Evita sobreposição de horários em recursos compartilhados.
 */
export const schedulingConflictProject: Graph = {
  version: 1,
  name: 'Agendamento de Salas com Prevenção de Conflito',
  flows: [{ id: 'agendamento_flow', name: 'Fluxo de Reserva', color: '#3b82f6' }],
  nodes: [
    b('screen_agendamento', 100, 100, {
      kind: 'screen',
      label: 'Tela de Agendamento',
      config: { title: 'Reserva de Sala', flowId: 'agendamento_flow' },
    }),
    b('input_sala', 320, 50, {
      kind: 'input',
      label: 'Identificação da Sala',
      config: {
        field: 'salaId',
        placeholder: 'Sala 101',
        screenId: 'screen_agendamento',
        required: 'true',
      },
    }),
    b('input_inicio', 320, 160, {
      kind: 'input',
      label: 'Horário Início',
      config: { field: 'dataInicio', screenId: 'screen_agendamento', required: 'true' },
    }),
    b('input_fim', 320, 270, {
      kind: 'input',
      label: 'Horário Fim',
      config: { field: 'dataFim', screenId: 'screen_agendamento', required: 'true' },
    }),
    b('btn_reservar', 320, 380, {
      kind: 'button',
      label: 'Botão Reservar',
      config: { text: 'Confirmar Reserva', screenId: 'screen_agendamento' },
    }),
    b('chk_conflito', 540, 380, {
      kind: 'validator',
      label: 'Verificador de Disponibilidade',
      config: {
        rules: JSON.stringify([
          { field: 'salaId', rule: 'required', message: 'Sala obrigatória.' },
          { field: 'dataInicio', rule: 'required', message: 'Horário inicial obrigatório.' },
        ]),
      },
    }),
    b('db_query_conflitos', 760, 380, {
      kind: 'database',
      label: 'Buscar Conflitos Existentes',
      config: {
        operation: 'query',
        table: 'agendamentos',
        filterField: 'salaId',
      },
    }),
    b('db_salvar_reserva', 980, 380, {
      kind: 'database',
      label: 'Persistir Reserva Aprovada',
      config: {
        operation: 'insert',
        table: 'agendamentos',
      },
    }),
    b('notif_reserva_ok', 1200, 380, {
      kind: 'notify',
      label: 'Reserva Confirmada',
      config: {
        type: 'success',
        message: 'Sala agendada sem conflitos de horário!',
      },
    }),
  ],
  edges: [
    l('e1', 'btn_reservar', 'chk_conflito', 'onClick', 'execute'),
    l('e2', 'chk_conflito', 'db_query_conflitos', 'valid', 'execute'),
    l('e3', 'db_query_conflitos', 'db_salvar_reserva', 'then', 'execute'),
    l('e4', 'db_salvar_reserva', 'notif_reserva_ok', 'then', 'execute'),
  ],
  tests: [
    {
      id: 'test_reserva_valida',
      name: 'Reserva de Sala Válida',
      description: 'Valida preenchimento dos campos e confirma reserva sem conflitos',
      entryBlockId: 'btn_reservar',
      initialInputs: {
        salaId: 'Sala-101',
        dataInicio: '2026-11-01 14:00',
        dataFim: '2026-11-01 15:00',
      },
      assertions: [
        {
          id: 's1',
          kind: 'trace_contains',
          target: 'database',
          expectedValue: 'database',
          message: 'Deve validar e consultar disponibilidade no banco',
        },
        {
          id: 's2',
          kind: 'notification_emitted',
          expectedValue: 'Sala agendada sem conflitos de horário!',
          message: 'Deve confirmar agendamento com notificação de sucesso',
        },
      ],
    },
  ],
};

/**
 * 3. Projeto de Verificação: Portal com Aprovação por Papéis (RBAC)
 * Regras estritas: usuários submetem; gestor ou admin aprova ou rejeita.
 */
export const roleApprovalPortalProject: Graph = {
  version: 1,
  name: 'Portal de Solicitações e Aprovação por Papéis',
  flows: [{ id: 'aprovacao_flow', name: 'Fluxo de Aprovação', color: '#8b5cf6' }],
  nodes: [
    b('pol_solicitante', 50, 50, {
      kind: 'policy',
      label: 'Apenas Leitura e Criação pelo Solicitante',
      config: {
        target: 'solicitacoes.create',
        action: 'create',
        effect: 'allow',
        conditions: JSON.stringify([{ field: 'user.authenticated', operator: 'authenticated' }]),
      },
    }),
    b('pol_aprovador', 50, 180, {
      kind: 'policy',
      label: 'Apenas Gestores Podem Aprovar',
      config: {
        target: 'solicitacoes.update',
        action: 'update',
        effect: 'allow',
        conditions: JSON.stringify([
          { field: 'user.role', operator: 'inList', value: ['manager', 'admin'] },
        ]),
        errorMessage: 'Apenas gestores ou administradores podem aprovar solicitações.',
      },
    }),
    b('screen_portal', 300, 100, {
      kind: 'screen',
      label: 'Portal de Solicitações',
      config: { title: 'Gestão de Solicitações de Compra', flowId: 'aprovacao_flow' },
    }),
    b('input_titulo', 520, 50, {
      kind: 'input',
      label: 'Título do Pedido',
      config: { field: 'titulo', screenId: 'screen_portal', required: 'true' },
    }),
    b('input_valor', 520, 160, {
      kind: 'input',
      label: 'Valor Total (R$)',
      config: { field: 'valor', screenId: 'screen_portal', required: 'true' },
    }),
    b('btn_enviar_solicitacao', 520, 270, {
      kind: 'button',
      label: 'Enviar para Aprovação',
      config: { text: 'Submeter Solicitação', screenId: 'screen_portal' },
    }),
    b('db_inserir_solicitacao', 740, 270, {
      kind: 'database',
      label: 'Gravar Solicitação Pendente',
      config: {
        operation: 'insert',
        table: 'solicitacoes',
      },
    }),
    b('btn_aprovar', 520, 400, {
      kind: 'button',
      label: 'Aprovar Solicitação',
      config: { text: 'Aprovar (Apenas Gestores)', screenId: 'screen_portal' },
    }),
    b('chk_permissao_aprovador', 740, 400, {
      kind: 'auth',
      label: 'Validar Papel do Gestor',
      config: {
        provider: 'email',
        action: 'checkRole',
      },
    }),
    b('db_update_aprovado', 960, 400, {
      kind: 'database',
      label: 'Mudar Status para Aprovado',
      config: {
        operation: 'update',
        table: 'solicitacoes',
      },
    }),
    b('notif_aprovado', 1180, 400, {
      kind: 'notify',
      label: 'Notificação de Aprovação',
      config: {
        type: 'success',
        message: 'Solicitação aprovada com sucesso.',
      },
    }),
  ],
  edges: [
    l('e1', 'btn_enviar_solicitacao', 'db_inserir_solicitacao', 'onClick', 'execute'),
    l('e2', 'btn_aprovar', 'chk_permissao_aprovador', 'onClick', 'trigger'),
    l('e3', 'chk_permissao_aprovador', 'db_update_aprovado', 'then', 'execute'),
    l('e4', 'db_update_aprovado', 'notif_aprovado', 'then', 'execute'),
  ],
  tests: [
    {
      id: 'test_submeter_solicitacao',
      name: 'Submissão de Solicitação de Compra',
      description: 'Valida submissão e gravação de solicitação no banco de dados',
      entryBlockId: 'btn_enviar_solicitacao',
      initialInputs: {
        titulo: 'Notebook Dell XPS',
        valor: '8500',
      },
      assertions: [
        {
          id: 'r1',
          kind: 'trace_contains',
          target: 'database',
          expectedValue: 'database',
          message: 'Deve persistir a solicitação no banco de dados',
        },
      ],
    },
  ],
};

export const REFERENCE_PROJECTS = {
  customerOrders: customerOrdersProject,
  schedulingConflict: schedulingConflictProject,
  roleApprovalPortal: roleApprovalPortalProject,
};
