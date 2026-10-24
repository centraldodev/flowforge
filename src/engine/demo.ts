import { syncGraphCode } from './codeGen';
import type { Block, BlockData, Graph } from './types';

const block = (id: string, x: number, y: number, data: BlockData): Block => ({
  id,
  type: 'block',
  position: { x, y },
  data,
});

/** Tela e bloco destacados ao abrir o exemplo. */
export const DEMO_FOCUS = { screenId: 'login', blockId: 'banco_usuarios' } as const;

/**
 * Projeto de demonstração completo com autenticação, banco de dados e Google OAuth:
 * 1. Tela Login (#login)
 * 2. Inputs de E-mail (#email) e Senha (#senha)
 * 3. Botão Entrar (#btn_entrar) -> Validação (#validar_login) -> Condição (#checar_dados) -> Autenticação (#auth_login)
 * 4. Botão Google (#btn_google) -> Google OAuth (#auth_google com token fictício) -> Salva no Banco (#banco_usuarios) -> Home (#home)
 * 5. Botão Criar Conta (#btn_cadastrar) -> Cadastro (#cadastrar_usuario) -> Salva no Banco (#banco_usuarios) -> Home (#home)
 * 6. Banco de Dados (#banco_usuarios) com contas pré-configuradas para teste
 * 7. Tratamento de Erro (#show_error) para credenciais inválidas ou e-mail já existente
 * 8. Tela Principal (#home) com botão de logout
 */
const rawDemo: Graph = {
  version: 1,
  name: 'Fluxo Completo de Autenticação e Banco',
  flows: [
    { id: 'screen', name: 'Tela de Entrada', color: '#6366f1' },
    { id: 'inputs', name: 'Inputs & Ações', color: '#38bdf8' },
    { id: 'validation', name: 'Validações', color: '#fbbf24' },
    { id: 'database', name: 'Banco de Dados', color: '#10b981' },
    { id: 'auth', name: 'Autenticação & OAuth', color: '#f43f5e' },
    { id: 'destination', name: 'Destino & Erros', color: '#a855f7' },
  ],
  nodes: [
    // FASE 1: TELA DE ENTRADA (Origem do Fluxo)
    block('login', 60, 160, {
      kind: 'screen',
      label: 'Tela de Login',
      config: {
        title: 'Acesse sua Conta',
        flowId: 'screen',
      },
      ports: [{ id: 'onEnter', name: 'onEnter', direction: 'input', type: 'Event' }],
    }),

    // FASE 2: CAMPOS & AÇÕES DA INTERFACE (Inputs e Botões de Disparo)
    block('email', 460, 60, {
      kind: 'input',
      label: 'E-mail',
      config: {
        field: 'email',
        placeholder: 'demo@exemplo.com',
        screenId: 'login',
        value: 'demo@exemplo.com',
        flowId: 'inputs',
      },
      ports: [
        { id: 'value', name: 'value', direction: 'output', type: 'string' },
        { id: 'onChange', name: 'onChange', direction: 'output', type: 'Event' },
      ],
    }),
    block('senha', 460, 220, {
      kind: 'input',
      label: 'Senha',
      config: {
        field: 'password',
        placeholder: '123456',
        screenId: 'login',
        value: '123456',
        flowId: 'inputs',
      },
      ports: [
        { id: 'value', name: 'value', direction: 'output', type: 'string' },
        { id: 'onChange', name: 'onChange', direction: 'output', type: 'Event' },
      ],
    }),
    block('btn_entrar', 460, 380, {
      kind: 'button',
      label: 'Entrar com E-mail',
      config: { screenId: 'login', flowId: 'inputs' },
      ports: [
        { id: 'disabled', name: 'disabled', direction: 'input', type: 'boolean' },
        { id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' },
      ],
    }),
    block('btn_google', 460, 520, {
      kind: 'button',
      label: 'Entrar com Google',
      config: { screenId: 'login', flowId: 'inputs' },
      ports: [
        { id: 'disabled', name: 'disabled', direction: 'input', type: 'boolean' },
        { id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' },
      ],
    }),
    block('btn_cadastrar', 460, 660, {
      kind: 'button',
      label: 'Criar Nova Conta',
      config: { screenId: 'login', flowId: 'inputs' },
      ports: [
        { id: 'disabled', name: 'disabled', direction: 'input', type: 'boolean' },
        { id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' },
      ],
    }),

    // FASE 3: VALIDAÇÃO DOS DADOS DE ENTRADA
    block('validar_login', 880, 60, {
      kind: 'function',
      label: 'Validação de Login',
      config: { screenId: 'login', flowId: 'validation' },
      ports: [
        { id: 'listenerClick', name: 'listenerClick', direction: 'input', type: 'Event' },
        { id: 'email', name: 'email', direction: 'input', type: 'string' },
        { id: 'senha', name: 'senha', direction: 'input', type: 'string' },
        { id: 'then', name: 'then', direction: 'output', type: 'Event' },
      ],
    }),
    block('checar_dados', 880, 280, {
      kind: 'condition',
      label: 'Checagem de Credenciais',
      config: {
        operator: 'truthy',
        screenId: 'login',
        flowId: 'validation',
      },
      ports: [
        { id: 'listener', name: 'listener', direction: 'input', type: 'Event' },
        { id: 'true', name: 'true', direction: 'output', type: 'Event' },
        { id: 'false', name: 'false', direction: 'output', type: 'Event' },
      ],
    }),

    // FASE 4: BANCO DE DADOS EM MEMÓRIA (Central de Persistência)
    block('banco_usuarios', 1300, 240, {
      kind: 'database',
      label: 'Banco de Usuários',
      config: {
        operation: 'insert',
        table: 'usuarios',
        flowId: 'database',
        mock: JSON.stringify(
          [
            {
              id: 1,
              nome: 'Usuário Teste',
              email: 'demo@exemplo.com',
              senha: '123456',
              provider: 'email',
            },
            {
              id: 2,
              nome: 'Google Teste',
              email: 'google.teste@gmail.com',
              senha: 'google_oauth_pass',
              provider: 'google',
              token: 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE',
            },
          ],
          null,
          2,
        ),
        screenId: 'login',
      },
      ports: [
        { id: 'execute', name: 'execute', direction: 'input', type: 'Event' },
        { id: 'data', name: 'data', direction: 'input', type: 'object' },
        { id: 'user', name: 'user', direction: 'input', type: 'User' },
        { id: 'onSuccess', name: 'onSuccess', direction: 'output', type: 'Event' },
        { id: 'onError', name: 'onError', direction: 'output', type: 'Error' },
      ],
    }),

    // FASE 5: AUTENTICAÇÃO & OAUTH
    block('auth_login', 1720, 60, {
      kind: 'auth',
      label: 'Autenticação',
      config: {
        provider: 'email',
        mode: 'login',
        screenId: 'login',
        flowId: 'auth',
      },
      ports: [
        { id: 'trigger', name: 'trigger', direction: 'input', type: 'Event' },
        { id: 'email', name: 'email', direction: 'input', type: 'string' },
        { id: 'password', name: 'password', direction: 'input', type: 'string' },
        { id: 'onSuccess', name: 'onSuccess', direction: 'output', type: 'Event' },
        { id: 'onError', name: 'onError', direction: 'output', type: 'Error' },
        { id: 'user', name: 'user', direction: 'output', type: 'User' },
      ],
    }),
    block('auth_google', 1720, 280, {
      kind: 'auth',
      label: 'Google OAuth',
      config: {
        provider: 'google',
        clientId: 'google-oauth-flowforge.apps.googleusercontent.com',
        mockToken: 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE',
        googleEmail: 'google.teste@gmail.com',
        googleName: 'Google Teste',
        screenId: 'login',
        flowId: 'auth',
      },
      ports: [
        { id: 'trigger', name: 'trigger', direction: 'input', type: 'Event' },
        { id: 'token', name: 'token', direction: 'input', type: 'string' },
        { id: 'onSuccess', name: 'onSuccess', direction: 'output', type: 'Event' },
        { id: 'onError', name: 'onError', direction: 'output', type: 'Error' },
        { id: 'user', name: 'user', direction: 'output', type: 'User' },
      ],
    }),
    block('cadastrar_usuario', 1720, 500, {
      kind: 'auth',
      label: 'Cadastro no Banco',
      config: {
        provider: 'email',
        mode: 'register',
        screenId: 'login',
        flowId: 'auth',
      },
      ports: [
        { id: 'trigger', name: 'trigger', direction: 'input', type: 'Event' },
        { id: 'email', name: 'email', direction: 'input', type: 'string' },
        { id: 'password', name: 'password', direction: 'input', type: 'string' },
        { id: 'onSuccess', name: 'onSuccess', direction: 'output', type: 'Event' },
        { id: 'onError', name: 'onError', direction: 'output', type: 'Error' },
        { id: 'user', name: 'user', direction: 'output', type: 'User' },
      ],
    }),

    // FASE 6: DESTINO & TRATAMENTO DE ERROS
    block('home', 2160, 140, {
      kind: 'screen',
      label: 'Painel Principal',
      config: {
        title: 'Dashboard do Usuário',
        flowId: 'destination',
      },
      ports: [
        { id: 'onEnter', name: 'onEnter', direction: 'input', type: 'Event' },
        { id: 'user', name: 'user', direction: 'input', type: 'User' },
      ],
    }),
    block('show_error', 2160, 480, {
      kind: 'error',
      label: 'Tratamento de Erro',
      config: {
        message: 'E-mail ou senha incorretos. Verifique suas credenciais.',
        type: 'toast',
        screenId: 'login',
        flowId: 'destination',
      },
      ports: [
        { id: 'execute', name: 'execute', direction: 'input', type: 'Event' },
        { id: 'retry', name: 'retry', direction: 'output', type: 'Event' },
        { id: 'msg', name: 'msg', direction: 'output', type: 'string' },
      ],
    }),

    // Blocos pertencentes à Tela Home (Aba Home)
    block('boas_vindas', 460, 140, {
      kind: 'input',
      label: 'Boas-vindas',
      config: {
        field: 'welcome',
        placeholder: 'Mensagem',
        screenId: 'home',
        value: 'Painel Principal do Usuário',
        flowId: 'inputs',
      },
      ports: [{ id: 'value', name: 'value', direction: 'output', type: 'string' }],
    }),
    block('btn_logout', 460, 300, {
      kind: 'button',
      label: 'Sair da Conta',
      config: { screenId: 'home', flowId: 'inputs' },
      ports: [{ id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' }],
    }),
  ],
  edges: [
    // --- FLUXO 1: LOGIN COM EMAIL & SENHA ---
    {
      id: 'e-btn-validar',
      source: 'btn_entrar',
      target: 'validar_login',
      sourceHandle: 'onClick',
      targetHandle: 'listenerClick',
    },
    {
      id: 'e-email-validar',
      source: 'email',
      target: 'validar_login',
      sourceHandle: 'value',
      targetHandle: 'email',
    },
    {
      id: 'e-senha-validar',
      source: 'senha',
      target: 'validar_login',
      sourceHandle: 'value',
      targetHandle: 'senha',
    },
    {
      id: 'e-validar-checar',
      source: 'validar_login',
      target: 'checar_dados',
      sourceHandle: 'then',
      targetHandle: 'listener',
    },
    {
      id: 'e-checar-true',
      source: 'checar_dados',
      target: 'auth_login',
      sourceHandle: 'true',
      targetHandle: 'trigger',
    },
    {
      id: 'e-checar-false',
      source: 'checar_dados',
      target: 'show_error',
      sourceHandle: 'false',
      targetHandle: 'execute',
    },
    {
      id: 'e-auth-home',
      source: 'auth_login',
      target: 'home',
      sourceHandle: 'onSuccess',
      targetHandle: 'onEnter',
    },
    {
      id: 'e-auth-err',
      source: 'auth_login',
      target: 'show_error',
      sourceHandle: 'onError',
      targetHandle: 'execute',
    },

    // --- FLUXO 2: GOOGLE OAUTH LINKADO AO BANCO ---
    {
      id: 'e-btn-google',
      source: 'btn_google',
      target: 'auth_google',
      sourceHandle: 'onClick',
      targetHandle: 'trigger',
    },
    {
      id: 'e-google-banco',
      source: 'auth_google',
      target: 'banco_usuarios',
      sourceHandle: 'onSuccess',
      targetHandle: 'execute',
    },
    {
      id: 'e-google-err',
      source: 'auth_google',
      target: 'show_error',
      sourceHandle: 'onError',
      targetHandle: 'execute',
    },
    {
      id: 'e-banco-home',
      source: 'banco_usuarios',
      target: 'home',
      sourceHandle: 'onSuccess',
      targetHandle: 'onEnter',
    },

    // --- FLUXO 3: CADASTRO DE NOVA CONTA NO BANCO ---
    {
      id: 'e-btn-cadastrar',
      source: 'btn_cadastrar',
      target: 'cadastrar_usuario',
      sourceHandle: 'onClick',
      targetHandle: 'trigger',
    },
    {
      id: 'e-email-cadastro',
      source: 'email',
      target: 'cadastrar_usuario',
      sourceHandle: 'value',
      targetHandle: 'email',
    },
    {
      id: 'e-senha-cadastro',
      source: 'senha',
      target: 'cadastrar_usuario',
      sourceHandle: 'value',
      targetHandle: 'password',
    },
    {
      id: 'e-cadastro-home',
      source: 'cadastrar_usuario',
      target: 'home',
      sourceHandle: 'onSuccess',
      targetHandle: 'onEnter',
    },
    {
      id: 'e-cadastro-err',
      source: 'cadastrar_usuario',
      target: 'show_error',
      sourceHandle: 'onError',
      targetHandle: 'execute',
    },

    // --- RETENTATIVA & NAVEGAÇÃO ---
    {
      id: 'e-err-retry',
      source: 'show_error',
      target: 'validar_login',
      sourceHandle: 'retry',
      targetHandle: 'listenerClick',
    },
    {
      id: 'e-logout-login',
      source: 'btn_logout',
      target: 'login',
      sourceHandle: 'onClick',
      targetHandle: 'onEnter',
    },
  ],
};

/** Grafo de demonstração completo com códigos gerados e sincronizados atomicamente. */
export const demo: Graph = syncGraphCode(rawDemo);
