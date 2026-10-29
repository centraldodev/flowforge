import { catalog } from './catalog';
import { applyDataModelToGraph, type DataModelDesign } from './dataModeling';
import type { Block, CustomPort, Graph, Kind, Link } from './types';
import {
  createTasksReferenceModeling,
  createStoreReferenceModeling,
  createSocialReferenceModeling,
  type AppModeling,
} from './appModeling';

export type ProjectTemplateId = 'empty' | 'tasks' | 'store' | 'social';
type TemplateSpec = {
  name: string;
  table: string;
  item: string;
  title: string;
  detail: string;
  listTitle: string;
  dataModel: DataModelDesign;
  appModeling?: AppModeling;
};

/** Os três modelos compartilham um núcleo verificável de autenticação e CRUD PostgreSQL. */
function makeTemplate(spec: TemplateSpec): Graph {
  const nodes: Block[] = [];
  const edges: Link[] = [];
  const add = (
    id: string,
    kind: Kind,
    label: string,
    config: Record<string, string> = {},
    ports?: CustomPort[],
  ) => {
    const index = nodes.length;
    nodes.push({
      id,
      type: 'block',
      position: { x: 60 + (index % 5) * 300, y: 80 + Math.floor(index / 5) * 240 },
      data: {
        kind,
        label,
        config: { ...catalog[kind].defaults, ...config },
        ...(ports ? { ports } : {}),
      },
    });
  };
  const wire = (source: string, sourceHandle: string, target: string, targetHandle: string) =>
    edges.push({ id: `wire_${edges.length + 1}`, source, sourceHandle, target, targetHandle });
  const uiInput = (id: string, label: string, inputType = 'text') => ({
    id,
    type: 'input',
    label,
    inputType,
    bindingPath: id,
  });
  const uiButton = (id: string, label: string) => ({ id, type: 'button', label, actionEvent: id });
  const loginUI = {
    root: {
      id: 'login_layout',
      type: 'container',
      children: [
        uiInput('email', 'E-mail', 'email'),
        uiInput('senha', 'Senha', 'password'),
        uiButton('entrar', 'Entrar'),
        uiButton('cadastrar', 'Criar conta'),
      ],
    },
  };
  const homeUI = {
    root: {
      id: 'home_layout',
      type: 'container',
      children: [
        {
          id: 'intro',
          type: 'text',
          content: `Informe um identificador único para cada ${spec.item}.`,
          style: 'body',
        },
        uiInput('registro_id', 'Identificador'),
        uiInput('registro_titulo', spec.title),
        uiInput('registro_detalhe', spec.detail),
        uiButton('adicionar', `Adicionar ${spec.item}`),
        uiButton('atualizar', `Atualizar ${spec.item}`),
        uiButton('excluir', `Excluir ${spec.item}`),
        uiButton('listar', 'Atualizar lista'),
        {
          id: 'tabela',
          type: 'table',
          itemsPath: 'store.registros',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'titulo', label: spec.title },
            { key: 'detalhe', label: spec.detail },
          ],
        },
        uiButton('sair', 'Sair'),
      ],
    },
  };
  add('login', 'screen', 'Entrar', {
    title: 'Entrar ou criar conta',
    screenUI: JSON.stringify(loginUI),
  });
  add('home', 'screen', spec.listTitle, {
    title: spec.listTitle,
    screenUI: JSON.stringify(homeUI),
  });
  add('conexao', 'postgresConnection', 'Conexão PostgreSQL', {
    database: 'flowforge',
    secretEnv: 'FLOWFORGE_SECRET_DB_PASSWORD',
    productionSecretEnv: 'FLOWFORGE_SECRET_DB_PASSWORD_PROD',
  });
  add('entidade', 'entity', `Tabela ${spec.listTitle}`, {
    name: spec.table,
    fields: JSON.stringify([
      { name: 'id', type: 'string', primaryKey: true, required: true },
      { name: 'titulo', type: 'string', required: true },
      { name: 'detalhe', type: 'string' },
    ]),
  });
  add('politica', 'policy', 'Permitir acesso autenticado', {
    target: spec.table,
    action: '*',
    effect: 'allow',
    conditions: JSON.stringify([{ operator: 'authenticated' }]),
  });
  add('email', 'input', 'E-mail', {
    screenId: 'login',
    field: 'email',
    placeholder: 'seu@email.com',
    required: 'true',
    mask: 'none',
    logicTemplateId: 'input_typed_field',
    logicConsumerId: 'entrar_auth',
  });
  add('senha', 'input', 'Senha', {
    screenId: 'login',
    field: 'password',
    placeholder: '••••••••',
    required: 'true',
    mask: 'none',
    logicTemplateId: 'input_typed_field',
    logicConsumerId: 'entrar_auth',
  });
  for (const [id, label, mode] of [
    ['entrar', 'Entrar', 'login'],
    ['cadastrar', 'Criar conta', 'register'],
  ] as const) {
    add(id, 'button', label, {
      screenId: 'login',
      buttonText: label,
      variant: id === 'entrar' ? 'primary' : 'secondary',
      loadingText: 'Autenticando...',
      logicTemplateId: 'btn_validate_and_auth',
      logicTargetId: `${id}_auth`,
    });
    add(`${id}_auth`, 'auth', label, {
      screenId: 'login',
      execution: 'real',
      provider: 'email',
      mode,
      authDatabaseId: 'conexao',
      clientId: '',
      mockToken: '',
      logicTemplateId: 'auth_email_password_login',
      onSuccessTargetId: 'home',
    });
    wire(id, 'onClick', `${id}_auth`, 'trigger');
    wire('email', 'value', `${id}_auth`, 'email');
    wire('senha', 'value', `${id}_auth`, 'password');
    wire(`${id}_auth`, 'onSuccess', 'home', 'onEnter');
  }
  add('registro_id', 'input', 'Identificador', {
    screenId: 'home',
    field: 'text',
    placeholder: `ID do(a) ${spec.item}`,
    required: 'true',
    mask: 'none',
    logicTemplateId: 'input_typed_field',
    logicConsumerId: 'validar_id',
  });
  add('registro_titulo', 'input', spec.title, {
    screenId: 'home',
    field: 'text',
    placeholder: `Informe ${spec.title.toLowerCase()}`,
    required: 'true',
    mask: 'none',
    logicTemplateId: 'input_typed_field',
    logicConsumerId: 'validar_titulo',
  });
  add('registro_detalhe', 'input', spec.detail, {
    screenId: 'home',
    field: 'text',
    placeholder: `Informe ${spec.detail.toLowerCase()}`,
    required: 'false',
    mask: 'none',
    logicTemplateId: 'input_typed_field',
    logicConsumerId: 'montar_registro',
  });
  add('form_registro', 'form', `Formulário de ${spec.listTitle}`, {
    screenId: 'home',
    fields: 'registro_id, registro_titulo, registro_detalhe',
    requiredFields: 'registro_id, registro_titulo',
    submitLabel: `Salvar ${spec.item}`,
    logicTemplateId: 'form_group_validate_submit',
    validTargetId: 'db_insert',
    invalidTargetId: 'aviso_invalido',
  });
  add('loop_registros', 'loop', `Percorrer ${spec.listTitle}`, {
    screenId: 'home',
    sourceKey: 'registros',
    itemVar: 'item',
    maxItems: '100',
    logicTemplateId: 'loop_foreach_items',
    eachTargetId: 'guardar_lista',
  });
  add('adicionar', 'button', `Adicionar ${spec.item}`, {
    screenId: 'home',
    buttonText: `Adicionar ${spec.item}`,
    variant: 'primary',
    loadingText: 'Salvando...',
    logicTemplateId: 'btn_validate_and_auth',
    logicTargetId: 'validar_id',
  });
  add('atualizar', 'button', `Atualizar ${spec.item}`, {
    screenId: 'home',
    buttonText: `Atualizar ${spec.item}`,
    variant: 'secondary',
    loadingText: 'Atualizando...',
    logicTemplateId: 'btn_validate_and_auth',
    logicTargetId: 'montar_atualizacao',
  });
  add('excluir', 'button', `Excluir ${spec.item}`, {
    screenId: 'home',
    buttonText: `Excluir ${spec.item}`,
    variant: 'danger',
    loadingText: 'Excluindo...',
    logicTemplateId: 'btn_validate_and_auth',
    logicTargetId: 'db_delete',
  });
  add('listar', 'button', 'Atualizar lista', {
    screenId: 'home',
    buttonText: 'Atualizar lista',
    variant: 'secondary',
    loadingText: 'Carregando...',
    logicTemplateId: 'btn_validate_and_auth',
    logicTargetId: 'db_query',
  });
  add('sair', 'button', 'Sair', {
    screenId: 'home',
    buttonText: 'Sair',
    variant: 'secondary',
    loadingText: 'Saindo...',
    logicTemplateId: 'btn_validate_and_auth',
    logicTargetId: 'logout',
  });
  add('validar_titulo', 'validator', 'Validar título obrigatório', {
    screenId: 'home',
    rule: 'required',
    message: `Informe o campo ${spec.title}.`,
    logicTemplateId: 'val_cpf_or_required',
    validTargetId: 'montar_registro',
    invalidTargetId: 'aviso_invalido',
  });
  add('validar_id', 'validator', 'Validar identificador obrigatório', {
    screenId: 'home',
    rule: 'required',
    message: 'Informe um identificador válido.',
    logicTemplateId: 'val_cpf_or_required',
    validTargetId: 'validar_titulo',
    invalidTargetId: 'aviso_invalido',
  });
  const fieldPorts: CustomPort[] = ['id', 'titulo', 'detalhe'].map((name) => ({
    id: name,
    name,
    direction: 'input',
    mode: 'data',
    cardinality: 'one',
    valueType: { kind: 'string' },
  }));
  add(
    'montar_registro',
    'object',
    `Montar ${spec.item}`,
    {
      screenId: 'home',
      fieldNames: 'id,titulo,detalhe',
      logicTemplateId: 'obj_build_payload',
      objectNextId: 'db_insert',
    },
    fieldPorts,
  );
  for (const op of ['insert', 'update', 'delete', 'query'] as const)
    add(`db_${op}`, 'database', `${op} ${spec.item}`, {
      screenId: 'home',
      mode: 'real',
      table: spec.table,
      operation: op,
      limit: '100',
      mock: '',
      logicTemplateId: op === 'insert' ? 'db_insert_record' : 'db_query_records',
      dbSuccessTargetId: op === 'query' ? 'guardar_lista' : 'db_query',
      dbErrorTargetId: 'aviso_falha',
    });
  add('guardar_lista', 'state', 'Guardar lista na tela', {
    screenId: 'home',
    operation: 'set',
    key: 'registros',
    logicTemplateId: 'state_save_or_read',
  });
  add('aviso_invalido', 'notify', 'Campos obrigatórios', {
    screenId: 'home',
    type: 'error',
    message: 'Preencha o identificador e o título.',
    logicTemplateId: 'notify_toast_feedback',
  });
  add('aviso_falha', 'error', 'Falha na operação', {
    screenId: 'home',
    message: 'Não foi possível concluir a operação.',
    type: 'toast',
    logicTemplateId: 'error_catch_and_retry',
  });
  add('logout', 'auth', 'Encerrar sessão', {
    screenId: 'home',
    execution: 'real',
    provider: 'email',
    mode: 'logout',
    authDatabaseId: 'conexao',
    clientId: '',
    mockToken: '',
    logicTemplateId: 'auth_email_password_login',
    onSuccessTargetId: 'login',
  });
  wire('adicionar', 'onClick', 'validar_id', 'execute');
  wire('registro_id', 'value', 'validar_id', 'value');
  wire('validar_id', 'valid', 'validar_titulo', 'execute');
  wire('validar_id', 'invalid', 'aviso_invalido', 'execute');
  wire('registro_titulo', 'value', 'validar_titulo', 'value');
  wire('validar_titulo', 'invalid', 'aviso_invalido', 'execute');
  // Dois fluxos independentes de escrita mantêm a operação de cada botão explícita.
  wire('validar_titulo', 'valid', 'montar_registro', 'execute');
  for (const [source, target] of [
    ['registro_id', 'id'],
    ['registro_titulo', 'titulo'],
    ['registro_detalhe', 'detalhe'],
  ] as const)
    wire(source, 'value', 'montar_registro', target);
  wire('montar_registro', 'then', 'db_insert', 'execute');
  wire('montar_registro', 'object', 'db_insert', 'data');
  wire('excluir', 'onClick', 'db_delete', 'execute');
  wire('registro_id', 'value', 'db_delete', 'id');
  wire('listar', 'onClick', 'db_query', 'execute');
  wire('db_query', 'onSuccess', 'guardar_lista', 'execute');
  wire('guardar_lista', 'next', 'loop_registros', 'execute');
  wire('form_registro', 'valid', 'montar_registro', 'execute');
  wire('form_registro', 'invalid', 'aviso_invalido', 'execute');
  for (const op of ['insert', 'update', 'delete', 'query']) {
    wire('conexao', 'connection', `db_${op}`, 'connection');
    wire(`db_${op}`, 'onError', 'aviso_falha', 'execute');
  }
  wire('db_insert', 'onSuccess', 'db_query', 'execute');
  wire('db_delete', 'onSuccess', 'db_query', 'execute');
  wire('sair', 'onClick', 'logout', 'trigger');
  wire('logout', 'onSuccess', 'login', 'onEnter');
  // A atualização usa um segundo montador para não executar a inserção.
  const updatePorts = fieldPorts.filter((port) => port.id !== 'id');
  add(
    'montar_atualizacao',
    'object',
    `Montar atualização de ${spec.item}`,
    {
      screenId: 'home',
      fieldNames: 'titulo,detalhe',
      logicTemplateId: 'obj_build_payload',
      objectNextId: 'db_update',
    },
    updatePorts,
  );
  wire('atualizar', 'onClick', 'montar_atualizacao', 'execute');
  wire('registro_titulo', 'value', 'montar_atualizacao', 'titulo');
  wire('registro_detalhe', 'value', 'montar_atualizacao', 'detalhe');
  wire('montar_atualizacao', 'then', 'db_update', 'execute');
  wire('montar_atualizacao', 'object', 'db_update', 'data');
  wire('registro_id', 'value', 'db_update', 'id');
  wire('db_update', 'onSuccess', 'db_query', 'execute');
  const graph = applyDataModelToGraph(
    { version: 1, name: spec.name, nodes, edges, dataModel: spec.dataModel },
    spec.dataModel,
  );
  if (spec.appModeling) {
    graph.appModeling = spec.appModeling;
  }
  return graph;
}

export const appTemplates: Record<Exclude<ProjectTemplateId, 'empty'>, Graph> = {
  tasks: makeTemplate({
    name: 'Minhas Tarefas',
    table: 'tarefas',
    item: 'tarefa',
    title: 'Título',
    detail: 'Descrição',
    listTitle: 'Tarefas',
    appModeling: createTasksReferenceModeling(),
    dataModel: {
      dialect: 'postgres',
      sqliteFilePath: './data/tarefas.sqlite',
      entities: [
        {
          id: 'ent_usuarios',
          name: 'usuarios',
          label: 'Usuários',
          x: 80,
          y: 90,
          attributes: [
            { id: 'u_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'u_nome', name: 'nome', type: 'string', isRequired: true },
            { id: 'u_email', name: 'email', type: 'string', isRequired: true, isUnique: true },
          ],
        },
        {
          id: 'entidade',
          name: 'tarefas',
          label: 'Tarefas',
          x: 450,
          y: 90,
          attributes: [
            { id: 't_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 't_titulo', name: 'titulo', type: 'string', isRequired: true },
            { id: 't_detalhe', name: 'detalhe', type: 'string', isRequired: false },
            { id: 't_concluida', name: 'concluida', type: 'boolean', defaultValue: 'false' },
          ],
        },
        {
          id: 'ent_etiquetas',
          name: 'etiquetas',
          label: 'Etiquetas',
          x: 820,
          y: 90,
          attributes: [
            { id: 'e_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'e_nome', name: 'nome', type: 'string', isRequired: true },
            { id: 'e_cor', name: 'cor', type: 'string', defaultValue: '#10b981' },
          ],
        },
      ],
      relationships: [
        {
          id: 'rel_usuario_tarefas',
          name: 'cria',
          x: 265,
          y: 120,
          sourceEntityId: 'ent_usuarios',
          targetEntityId: 'entidade',
          sourceCardinality: '1,1',
          targetCardinality: '0,N',
        },
        {
          id: 'rel_tarefas_etiquetas',
          name: 'classifica',
          x: 635,
          y: 120,
          sourceEntityId: 'entidade',
          targetEntityId: 'ent_etiquetas',
          sourceCardinality: '0,N',
          targetCardinality: '0,N',
        },
      ],
      seededData: {
        tarefas: [
          {
            id: '1',
            titulo: 'Modelar banco no DER conceitual',
            detalhe: 'Criar entidades e relacionamentos estilo brModelo',
            concluida: true,
          },
          {
            id: '2',
            titulo: 'Testar CRUD conectado ao Backend',
            detalhe: 'Validar inserção, listagem e exclusão no banco',
            concluida: false,
          },
        ],
        etiquetas: [
          { id: 'tag_1', nome: 'Urgente', cor: '#ef4444' },
          { id: 'tag_2', nome: 'Arquitetura', cor: '#6366f1' },
        ],
      },
    },
  }),
  store: makeTemplate({
    name: 'Catálogo de Produtos',
    table: 'produtos',
    item: 'produto',
    title: 'Nome',
    detail: 'Descrição',
    listTitle: 'Produtos',
    appModeling: createStoreReferenceModeling(),
    dataModel: {
      dialect: 'postgres',
      sqliteFilePath: './data/catalogo_loja.sqlite',
      entities: [
        {
          id: 'ent_categorias',
          name: 'categorias',
          label: 'Categorias',
          x: 80,
          y: 90,
          attributes: [
            { id: 'c_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'c_nome', name: 'nome', type: 'string', isRequired: true },
          ],
        },
        {
          id: 'entidade',
          name: 'produtos',
          label: 'Produtos',
          x: 450,
          y: 90,
          attributes: [
            { id: 'p_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'p_titulo', name: 'titulo', type: 'string', isRequired: true },
            { id: 'p_detalhe', name: 'detalhe', type: 'string', isRequired: false },
            { id: 'p_preco', name: 'preco', type: 'number', defaultValue: '0' },
          ],
        },
        {
          id: 'ent_pedidos_loja',
          name: 'pedidos',
          label: 'Pedidos',
          x: 820,
          y: 90,
          attributes: [
            { id: 'o_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'o_cliente', name: 'cliente_nome', type: 'string', isRequired: true },
            { id: 'o_total', name: 'total', type: 'number', isRequired: true },
          ],
        },
      ],
      relationships: [
        {
          id: 'rel_cat_produtos',
          name: 'agrupa',
          x: 265,
          y: 120,
          sourceEntityId: 'ent_categorias',
          targetEntityId: 'entidade',
          sourceCardinality: '1,1',
          targetCardinality: '0,N',
        },
        {
          id: 'rel_prod_pedidos',
          name: 'itens',
          x: 635,
          y: 120,
          sourceEntityId: 'entidade',
          targetEntityId: 'ent_pedidos_loja',
          sourceCardinality: '1,N',
          targetCardinality: '0,N',
        },
      ],
      seededData: {
        categorias: [
          { id: 'cat_1', nome: 'Hardware & Periféricos' },
          { id: 'cat_2', nome: 'Monitores Profissionais' },
        ],
        produtos: [
          {
            id: 'prod_1',
            titulo: 'Teclado Mecânico Wireless',
            detalhe: 'Switch silencioso tátil ABNT2',
            preco: 489.9,
          },
          {
            id: 'prod_2',
            titulo: 'Monitor UltraWide 34"',
            detalhe: 'Painel IPS 144Hz USB-C',
            preco: 2890,
          },
        ],
      },
    },
  }),
  social: makeTemplate({
    name: 'Mural de Publicações',
    table: 'publicacoes',
    item: 'publicação',
    title: 'Título',
    detail: 'Mensagem',
    listTitle: 'Publicações',
    appModeling: createSocialReferenceModeling(),
    dataModel: {
      dialect: 'postgres',
      sqliteFilePath: './data/mural_social.sqlite',
      entities: [
        {
          id: 'ent_autores',
          name: 'autores',
          label: 'Autores',
          x: 80,
          y: 90,
          attributes: [
            { id: 'a_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'a_nome', name: 'nome', type: 'string', isRequired: true },
            { id: 'a_arroba', name: 'arroba', type: 'string', isRequired: true, isUnique: true },
          ],
        },
        {
          id: 'entidade',
          name: 'publicacoes',
          label: 'Publicações',
          x: 450,
          y: 90,
          attributes: [
            { id: 'pub_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'pub_titulo', name: 'titulo', type: 'string', isRequired: true },
            { id: 'pub_detalhe', name: 'detalhe', type: 'string', isRequired: false },
          ],
        },
        {
          id: 'ent_comentarios',
          name: 'comentarios',
          label: 'Comentários',
          x: 820,
          y: 90,
          attributes: [
            { id: 'com_id', name: 'id', type: 'string', isPrimaryKey: true, isRequired: true },
            { id: 'com_texto', name: 'texto', type: 'string', isRequired: true },
          ],
        },
      ],
      relationships: [
        {
          id: 'rel_autor_pub',
          name: 'publica',
          x: 265,
          y: 120,
          sourceEntityId: 'ent_autores',
          targetEntityId: 'entidade',
          sourceCardinality: '1,1',
          targetCardinality: '0,N',
        },
        {
          id: 'rel_pub_comentarios',
          name: 'recebe',
          x: 635,
          y: 120,
          sourceEntityId: 'entidade',
          targetEntityId: 'ent_comentarios',
          sourceCardinality: '1,1',
          targetCardinality: '0,N',
        },
      ],
      seededData: {
        publicacoes: [
          {
            id: 'post_1',
            titulo: 'Nova página de Modelagem de Dados!',
            detalhe:
              'Agora é possível criar diagramas Conceitual, Lógico e SQL (Postgres e SQLite).',
          },
          {
            id: 'post_2',
            titulo: 'Dica de Relacionamento N:N',
            detalhe:
              'Conecte duas entidades com (0,N) para gerar tabelas associativas automaticamente.',
          },
        ],
      },
    },
  }),
};
