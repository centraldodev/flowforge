import { catalog } from './catalog';
import type { Block, CustomPort, Graph, Kind, Link } from './types';

export type ProjectTemplateId = 'empty' | 'tasks' | 'store' | 'social';
type TemplateSpec = {
  name: string;
  table: string;
  item: string;
  title: string;
  detail: string;
  listTitle: string;
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
  add('email', 'input', 'E-mail', { screenId: 'login', field: 'email' });
  add('senha', 'input', 'Senha', { screenId: 'login', field: 'password' });
  for (const [id, label, mode] of [
    ['entrar', 'Entrar', 'login'],
    ['cadastrar', 'Criar conta', 'register'],
  ] as const) {
    add(id, 'button', label, { screenId: 'login' });
    add(`${id}_auth`, 'auth', label, {
      screenId: 'login',
      execution: 'real',
      provider: 'email',
      mode,
      authDatabaseId: 'conexao',
      clientId: '',
      mockToken: '',
    });
    wire(id, 'onClick', `${id}_auth`, 'trigger');
    wire('email', 'value', `${id}_auth`, 'email');
    wire('senha', 'value', `${id}_auth`, 'password');
    wire(`${id}_auth`, 'onSuccess', 'home', 'onEnter');
  }
  add('registro_id', 'input', 'Identificador', { screenId: 'home', field: 'text' });
  add('registro_titulo', 'input', spec.title, { screenId: 'home', field: 'text' });
  add('registro_detalhe', 'input', spec.detail, { screenId: 'home', field: 'text' });
  add('adicionar', 'button', `Adicionar ${spec.item}`, { screenId: 'home' });
  add('atualizar', 'button', `Atualizar ${spec.item}`, { screenId: 'home' });
  add('excluir', 'button', `Excluir ${spec.item}`, { screenId: 'home' });
  add('listar', 'button', 'Atualizar lista', { screenId: 'home' });
  add('sair', 'button', 'Sair', { screenId: 'home' });
  add('validar_titulo', 'validator', 'Validar título obrigatório', {
    screenId: 'home',
    rule: 'required',
    message: '',
  });
  add('validar_id', 'validator', 'Validar identificador obrigatório', {
    screenId: 'home',
    rule: 'required',
    message: '',
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
    { screenId: 'home', fieldNames: 'id,titulo,detalhe' },
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
    });
  add('guardar_lista', 'state', 'Guardar lista na tela', {
    screenId: 'home',
    operation: 'set',
    key: 'registros',
  });
  add('aviso_invalido', 'notify', 'Campos obrigatórios', {
    screenId: 'home',
    type: 'error',
    message: 'Preencha o identificador e o título.',
  });
  add('aviso_falha', 'error', 'Falha na operação', {
    screenId: 'home',
    message: 'Não foi possível concluir a operação.',
  });
  add('logout', 'auth', 'Encerrar sessão', {
    screenId: 'home',
    execution: 'real',
    provider: 'email',
    mode: 'logout',
    authDatabaseId: 'conexao',
    clientId: '',
    mockToken: '',
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
    { screenId: 'home', fieldNames: 'titulo,detalhe' },
    updatePorts,
  );
  wire('atualizar', 'onClick', 'montar_atualizacao', 'execute');
  wire('registro_titulo', 'value', 'montar_atualizacao', 'titulo');
  wire('registro_detalhe', 'value', 'montar_atualizacao', 'detalhe');
  wire('montar_atualizacao', 'then', 'db_update', 'execute');
  wire('montar_atualizacao', 'object', 'db_update', 'data');
  wire('registro_id', 'value', 'db_update', 'id');
  wire('db_update', 'onSuccess', 'db_query', 'execute');
  return { version: 1, name: spec.name, nodes, edges };
}

export const appTemplates: Record<Exclude<ProjectTemplateId, 'empty'>, Graph> = {
  tasks: makeTemplate({
    name: 'Minhas Tarefas',
    table: 'tarefas',
    item: 'tarefa',
    title: 'Título',
    detail: 'Descrição',
    listTitle: 'Tarefas',
  }),
  store: makeTemplate({
    name: 'Catálogo de Produtos',
    table: 'produtos',
    item: 'produto',
    title: 'Nome',
    detail: 'Descrição',
    listTitle: 'Produtos',
  }),
  social: makeTemplate({
    name: 'Mural de Publicações',
    table: 'publicacoes',
    item: 'publicação',
    title: 'Título',
    detail: 'Mensagem',
    listTitle: 'Publicações',
  }),
};
