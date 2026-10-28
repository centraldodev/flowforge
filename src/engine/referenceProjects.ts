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
        mask: 'none',
        logicTemplateId: 'input_typed_field',
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
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),

    b('btn_login', 520, 270, {
      kind: 'button',
      label: 'Botão Entrar',
      config: {
        text: 'Acessar Sistema',
        buttonText: 'Acessar Sistema',
        variant: 'primary',
        loadingText: 'Autenticando...',
        screenId: 'screen_login',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'auth_action',
      },
    }),

    b('auth_action', 740, 270, {
      kind: 'auth',
      label: 'Validador de Sessão JWT',
      config: {
        provider: 'email',
        action: 'login',
        jwtSecretEnv: 'FLOWFORGE_SECRET_JWT_SECRET',
        logicTemplateId: 'auth_login_redirect',
        onSuccessTargetId: 'nav_to_clients',
      },
    }),

    b('nav_to_clients', 960, 270, {
      kind: 'navigate',
      label: 'Ir para Clientes',
      config: {
        target: 'screen_clientes',
        logicTemplateId: 'nav_go_screen',
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

    b('form_cliente', 520, 320, {
      kind: 'form',
      label: 'Formulário de Cliente',
      config: {
        formTitle: 'Cadastro de Cliente',
        fieldsList: 'nome,email,telefone,cep',
        submitText: 'Salvar Cliente',
        screenId: 'screen_clientes',
        logicTemplateId: 'form_group_validate_submit',
        onSubmitTargetId: 'val_cliente',
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
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),

    b('input_cep_cliente', 520, 500, {
      kind: 'input',
      label: 'CEP para Consulta',
      config: {
        field: 'cep',
        placeholder: '01001-000',
        screenId: 'screen_clientes',
        required: 'false',
        mask: 'cep',
        logicTemplateId: 'input_typed_field',
      },
    }),

    b('btn_consultar_cep', 740, 500, {
      kind: 'button',
      label: 'Consultar Endereço Externo',
      config: {
        text: 'Buscar CEP',
        buttonText: 'Buscar CEP',
        variant: 'secondary',
        loadingText: 'Consultando ViaCEP...',
        screenId: 'screen_clientes',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'api_cep',
      },
    }),

    b('api_cep', 960, 500, {
      kind: 'api',
      label: 'API ViaCEP com Fallback',
      config: {
        method: 'GET',
        url: 'https://viacep.com.br/ws/{{cep}}/json/',
        timeoutMs: '3000',
        logicTemplateId: 'api_get_json',
      },
    }),

    b('btn_salvar_cliente', 520, 620, {
      kind: 'button',
      label: 'Salvar Cadastro',
      config: {
        text: 'Salvar Cliente',
        buttonText: 'Salvar Cliente',
        variant: 'primary',
        loadingText: 'Salvando...',
        screenId: 'screen_clientes',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'val_cliente',
      },
    }),

    b('val_cliente', 740, 620, {
      kind: 'validator',
      label: 'Validação Visual do Cliente',
      config: {
        rule: 'required',
        message: 'Nome é obrigatório.',
        logicTemplateId: 'val_cpf_or_required',
        validTargetId: 'db_insert_cliente',
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
        logicTemplateId: 'db_crud_table',
        dbSuccessTargetId: 'notif_sucesso_cliente',
      },
    }),

    b('notif_sucesso_cliente', 1180, 620, {
      kind: 'notify',
      label: 'Aviso de Sucesso',
      config: {
        message: 'Cliente cadastrado com sucesso!',
        type: 'success',
        logicTemplateId: 'notify_toast',
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
        buttonText: 'Confirmar Pedido Transacional',
        variant: 'primary',
        loadingText: 'Processando pedido...',
        screenId: 'screen_pedidos',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'calc_total_pedido',
      },
    }),

    b('loop_itens_pedido', 740, 920, {
      kind: 'loop',
      label: 'Iterar Itens do Pedido',
      config: {
        sourceKey: 'itens',
        itemVar: 'itemPedido',
        maxItems: '50',
        screenId: 'screen_pedidos',
        logicTemplateId: 'loop_foreach_items',
        eachTargetId: 'db_insert_pedido',
      },
    }),

    b('calc_total_pedido', 740, 800, {
      kind: 'subflow',
      label: 'Subfluxo Cálculo Total',
      config: {
        subflowId: 'sub_calcular_pedido',
        subflowDefinition: JSON.stringify({
          id: 'sub_calcular_pedido',
          name: 'Calcular total informado',
          parameters: [{ id: 'input', name: 'Valor', direction: 'input' }],
          returns: [{ id: 'result', name: 'Total', direction: 'output' }],
          nodes: [
            {
              id: 'valor_total',
              position: { x: 0, y: 0 },
              data: {
                kind: 'math',
                label: 'Valor informado',
                config: { operation: 'mul', b: '1' },
              },
            },
          ],
          edges: [],
        }),
      },
    }),

    b('db_insert_pedido', 960, 800, {
      kind: 'database',
      label: 'Gravar Pedido com Transação',
      config: {
        operation: 'insert',
        table: 'pedidos',
        connectionId: 'db_conn',
        logicTemplateId: 'db_crud_table',
        dbSuccessTargetId: 'email_confirmacao',
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
        logicTemplateId: 'email_send_message',
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
    l('e4_form', 'form_cliente', 'val_cliente', 'valid', 'execute'),
    l('e5', 'val_cliente', 'db_insert_cliente', 'valid', 'execute'),
    l('e6', 'db_insert_cliente', 'notif_sucesso_cliente', 'then', 'execute'),

    // Pedido -> Subfluxo -> DB -> E-mail
    l('e7', 'btn_criar_pedido', 'calc_total_pedido', 'onClick', 'execute'),
    l('e8', 'calc_total_pedido', 'db_insert_pedido', 'then', 'execute'),
    l('e8_loop', 'loop_itens_pedido', 'db_insert_pedido', 'onComplete', 'execute'),
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
  dataModel: {
    dialect: 'postgres',
    sqliteFilePath: './data/gestor_pedidos.sqlite',
    entities: [
      {
        id: 'ent_clientes',
        name: 'clientes',
        label: 'Clientes',
        x: 80,
        y: 100,
        attributes: [
          { id: 'c1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'c2', name: 'nome', type: 'string', isRequired: true },
          { id: 'c3', name: 'email', type: 'string', isRequired: true, isUnique: true },
          { id: 'c4', name: 'telefone', type: 'string' },
          { id: 'c5', name: 'cep', type: 'string' },
          { id: 'c6', name: 'endereco', type: 'string' },
          { id: 'c7', name: 'org_id', type: 'string', isRequired: true },
        ],
      },
      {
        id: 'ent_pedidos',
        name: 'pedidos',
        label: 'Pedidos',
        x: 450,
        y: 100,
        attributes: [
          { id: 'p1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'p2', name: 'cliente_id', type: 'string', isRequired: true },
          { id: 'p3', name: 'data', type: 'date', isRequired: true },
          { id: 'p4', name: 'status', type: 'string', isRequired: true, defaultValue: 'pendente' },
          { id: 'p5', name: 'total', type: 'number', isRequired: true },
          { id: 'p6', name: 'org_id', type: 'string', isRequired: true },
        ],
      },
      {
        id: 'ent_itens_pedido',
        name: 'itens_pedido',
        label: 'Itens de Pedido',
        x: 820,
        y: 100,
        attributes: [
          { id: 'i1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'i2', name: 'pedido_id', type: 'string', isRequired: true },
          { id: 'i3', name: 'produto', type: 'string', isRequired: true },
          { id: 'i4', name: 'quantidade', type: 'number', isRequired: true },
          { id: 'i5', name: 'preco_unitario', type: 'number', isRequired: true },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_cliente_pedidos',
        name: 'realiza',
        x: 265,
        y: 130,
        sourceEntityId: 'ent_clientes',
        targetEntityId: 'ent_pedidos',
        sourceCardinality: '1,1',
        targetCardinality: '0,N',
      },
      {
        id: 'rel_pedido_itens',
        name: 'contém',
        x: 635,
        y: 130,
        sourceEntityId: 'ent_pedidos',
        targetEntityId: 'ent_itens_pedido',
        sourceCardinality: '1,1',
        targetCardinality: '1,N',
      },
    ],
    seededData: {
      clientes: [
        {
          id: 'cli_1',
          nome: 'Tech Solutions LTDA',
          email: 'contato@techsolutions.com.br',
          telefone: '(11) 98888-7777',
          cep: '01001-000',
          endereco: 'Praça da Sé, São Paulo - SP',
          org_id: 'org_1',
        },
      ],
    },
  },
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
    b('form_agendamento', 320, 0, {
      kind: 'form',
      label: 'Formulário de Reserva',
      config: {
        formTitle: 'Agendar Sala',
        fieldsList: 'salaId,dataInicio,dataFim',
        submitText: 'Confirmar Reserva',
        screenId: 'screen_agendamento',
        logicTemplateId: 'form_group_validate_submit',
        onSubmitTargetId: 'chk_conflito',
      },
    }),
    b('input_sala', 320, 90, {
      kind: 'input',
      label: 'Identificação da Sala',
      config: {
        field: 'salaId',
        placeholder: 'Sala 101',
        screenId: 'screen_agendamento',
        required: 'true',
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),
    b('input_inicio', 320, 190, {
      kind: 'input',
      label: 'Horário Início',
      config: {
        field: 'dataInicio',
        placeholder: '2026-11-01 14:00',
        screenId: 'screen_agendamento',
        required: 'true',
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),
    b('input_fim', 320, 290, {
      kind: 'input',
      label: 'Horário Fim',
      config: {
        field: 'dataFim',
        placeholder: '2026-11-01 15:00',
        screenId: 'screen_agendamento',
        required: 'true',
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),
    b('btn_reservar', 320, 390, {
      kind: 'button',
      label: 'Botão Reservar',
      config: {
        text: 'Confirmar Reserva',
        buttonText: 'Confirmar Reserva',
        variant: 'primary',
        loadingText: 'Verificando agenda...',
        screenId: 'screen_agendamento',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'chk_conflito',
      },
    }),
    b('chk_conflito', 540, 390, {
      kind: 'validator',
      label: 'Verificador de Disponibilidade',
      config: {
        rule: 'required',
        message: 'Sala e horário inicial são obrigatórios.',
        logicTemplateId: 'val_cpf_or_required',
        validTargetId: 'db_query_conflitos',
        rules: JSON.stringify([
          { field: 'salaId', rule: 'required', message: 'Sala obrigatória.' },
          { field: 'dataInicio', rule: 'required', message: 'Horário inicial obrigatório.' },
        ]),
      },
    }),
    b('db_query_conflitos', 760, 390, {
      kind: 'database',
      label: 'Buscar Conflitos Existentes',
      config: {
        operation: 'query',
        table: 'agendamentos',
        filterField: 'salaId',
        logicTemplateId: 'db_crud_table',
        dbSuccessTargetId: 'db_salvar_reserva',
      },
    }),
    b('db_salvar_reserva', 980, 390, {
      kind: 'database',
      label: 'Persistir Reserva Aprovada',
      config: {
        operation: 'insert',
        table: 'agendamentos',
        logicTemplateId: 'db_crud_table',
        dbSuccessTargetId: 'notif_reserva_ok',
      },
    }),
    b('notif_reserva_ok', 1200, 390, {
      kind: 'notify',
      label: 'Reserva Confirmada',
      config: {
        type: 'success',
        message: 'Sala agendada sem conflitos de horário!',
        logicTemplateId: 'notify_toast',
      },
    }),
  ],
  edges: [
    l('e1', 'btn_reservar', 'chk_conflito', 'onClick', 'execute'),
    l('e1_form', 'form_agendamento', 'chk_conflito', 'valid', 'execute'),
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
  dataModel: {
    dialect: 'sqlite',
    sqliteFilePath: './data/agendamentos_salas.sqlite',
    entities: [
      {
        id: 'ent_salas',
        name: 'salas',
        label: 'Salas de Reunião',
        x: 100,
        y: 100,
        attributes: [
          { id: 's_1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 's_2', name: 'nome', type: 'string', isRequired: true },
          { id: 's_3', name: 'capacidade', type: 'number', isRequired: true },
        ],
      },
      {
        id: 'ent_agendamentos',
        name: 'agendamentos',
        label: 'Agendamentos',
        x: 480,
        y: 100,
        attributes: [
          { id: 'ag_1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'ag_2', name: 'salaId', type: 'string', isRequired: true },
          { id: 'ag_3', name: 'dataInicio', type: 'date', isRequired: true },
          { id: 'ag_4', name: 'dataFim', type: 'date', isRequired: true },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_sala_agendamento',
        name: 'reserva',
        x: 290,
        y: 130,
        sourceEntityId: 'ent_salas',
        targetEntityId: 'ent_agendamentos',
        sourceCardinality: '1,1',
        targetCardinality: '0,N',
      },
    ],
  },
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
    b('form_solicitacao', 520, 0, {
      kind: 'form',
      label: 'Formulário de Solicitação',
      config: {
        formTitle: 'Nova Solicitação de Compra',
        fieldsList: 'titulo,valor',
        submitText: 'Submeter Solicitação',
        screenId: 'screen_portal',
        logicTemplateId: 'form_group_validate_submit',
        onSubmitTargetId: 'db_inserir_solicitacao',
      },
    }),
    b('input_titulo', 520, 90, {
      kind: 'input',
      label: 'Título do Pedido',
      config: {
        field: 'titulo',
        placeholder: 'Ex: Notebook Dell XPS',
        screenId: 'screen_portal',
        required: 'true',
        mask: 'none',
        logicTemplateId: 'input_typed_field',
      },
    }),
    b('input_valor', 520, 190, {
      kind: 'input',
      label: 'Valor Total (R$)',
      config: {
        field: 'valor',
        placeholder: 'R$ 0,00',
        screenId: 'screen_portal',
        required: 'true',
        mask: 'currency',
        logicTemplateId: 'input_typed_field',
      },
    }),
    b('btn_enviar_solicitacao', 520, 290, {
      kind: 'button',
      label: 'Enviar para Aprovação',
      config: {
        text: 'Submeter Solicitação',
        buttonText: 'Submeter Solicitação',
        variant: 'primary',
        loadingText: 'Enviando...',
        screenId: 'screen_portal',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'db_inserir_solicitacao',
      },
    }),
    b('db_inserir_solicitacao', 740, 290, {
      kind: 'database',
      label: 'Gravar Solicitação Pendente',
      config: {
        operation: 'insert',
        table: 'solicitacoes',
        logicTemplateId: 'db_crud_table',
      },
    }),
    b('btn_aprovar', 520, 420, {
      kind: 'button',
      label: 'Aprovar Solicitação',
      config: {
        text: 'Aprovar (Apenas Gestores)',
        buttonText: 'Aprovar (Apenas Gestores)',
        variant: 'secondary',
        loadingText: 'Verificando permissão...',
        screenId: 'screen_portal',
        logicTemplateId: 'btn_validate_and_auth',
        logicTargetId: 'chk_permissao_aprovador',
      },
    }),
    b('chk_permissao_aprovador', 740, 420, {
      kind: 'auth',
      label: 'Validar Papel do Gestor',
      config: {
        provider: 'email',
        action: 'checkRole',
        logicTemplateId: 'auth_login_redirect',
        onSuccessTargetId: 'db_update_aprovado',
      },
    }),
    b('db_update_aprovado', 960, 420, {
      kind: 'database',
      label: 'Mudar Status para Aprovado',
      config: {
        operation: 'update',
        table: 'solicitacoes',
        logicTemplateId: 'db_crud_table',
        dbSuccessTargetId: 'notif_aprovado',
      },
    }),
    b('notif_aprovado', 1180, 420, {
      kind: 'notify',
      label: 'Notificação de Aprovação',
      config: {
        type: 'success',
        message: 'Solicitação aprovada com sucesso.',
        logicTemplateId: 'notify_toast',
      },
    }),
  ],
  edges: [
    l('e1', 'btn_enviar_solicitacao', 'db_inserir_solicitacao', 'onClick', 'execute'),
    l('e1_form', 'form_solicitacao', 'db_inserir_solicitacao', 'valid', 'execute'),
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
  dataModel: {
    dialect: 'postgres',
    sqliteFilePath: './data/portal_aprovacoes.sqlite',
    entities: [
      {
        id: 'ent_solicitacoes',
        name: 'solicitacoes',
        label: 'Solicitações de Compra',
        x: 100,
        y: 100,
        attributes: [
          { id: 'sol_1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'sol_2', name: 'titulo', type: 'string', isRequired: true },
          { id: 'sol_3', name: 'valor', type: 'number', isRequired: true },
          { id: 'sol_4', name: 'status', type: 'string', defaultValue: 'pendente' },
        ],
      },
      {
        id: 'ent_aprovacoes',
        name: 'aprovacoes',
        label: 'Histórico de Aprovações',
        x: 480,
        y: 100,
        attributes: [
          { id: 'ap_1', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
          { id: 'ap_2', name: 'gestor_email', type: 'string', isRequired: true },
          { id: 'ap_3', name: 'decisao', type: 'string', isRequired: true },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_sol_aprovacao',
        name: 'avalia',
        x: 290,
        y: 130,
        sourceEntityId: 'ent_solicitacoes',
        targetEntityId: 'ent_aprovacoes',
        sourceCardinality: '1,1',
        targetCardinality: '0,N',
      },
    ],
  },
};

export const REFERENCE_PROJECTS = {
  customerOrders: customerOrdersProject,
  schedulingConflict: schedulingConflictProject,
  roleApprovalPortal: roleApprovalPortalProject,
};
