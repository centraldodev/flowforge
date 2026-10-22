import type { Block, BlockData, Graph } from './types';

const block = (id: string, x: number, y: number, data: BlockData): Block => ({
  id,
  type: 'block',
  position: { x, y },
  data,
});

/** Projeto de exemplo: login, cadastro, OAuth, recuperação de senha e logout. */
export const demo: Graph = {
  version: 1,
  name: 'Meu primeiro aplicativo',
  nodes: [
    block('login', 40, 80, {
      kind: 'screen',
      label: 'Tela de login',
      config: {
        title: 'Bem-vindo de volta',
        routes: JSON.stringify([
          { id: 'login-success', trigger: 'check', when: 'true', target: 'home' },
          { id: 'google-success', trigger: 'oauth', when: 'true', target: 'home' },
        ]),
      },
    }),
    block('email', 300, 20, {
      kind: 'input',
      label: 'E-mail',
      config: { field: 'email', placeholder: 'voce@exemplo.com', screenId: 'login', value: '' },
    }),
    block('password', 300, 240, {
      kind: 'input',
      label: 'Senha',
      config: { field: 'password', placeholder: 'Sua senha', screenId: 'login', value: '' },
    }),
    block('enter', 40, 310, { kind: 'button', label: 'Entrar', config: { screenId: 'login' } }),
    block('auth', 590, 110, {
      kind: 'auth',
      label: 'Validar acesso',
      config: { provider: 'email', mode: 'login' },
    }),
    block('check', 870, 110, {
      kind: 'condition',
      label: 'Acesso autorizado?',
      config: { operator: 'truthy', compare: '' },
    }),
    block('go', 1150, 60, { kind: 'navigate', label: 'Abrir início', config: { target: 'home' } }),
    block('home', 1420, 60, {
      kind: 'screen',
      label: 'Página inicial',
      config: {
        title: 'Você chegou ao seu app',
        routes: JSON.stringify([
          { id: 'logout-login', trigger: 'logout-action', when: 'always', target: 'login' },
        ]),
      },
    }),
    block('forgot', 40, 510, {
      kind: 'button',
      label: 'Esqueci minha senha',
      config: { screenId: 'login' },
    }),
    block('reset', 590, 440, {
      kind: 'reset',
      label: 'Enviar recuperação',
      config: { channel: 'email' },
    }),
    block('google', 300, 650, {
      kind: 'button',
      label: 'Continuar com Google',
      config: { screenId: 'login' },
    }),
    block('oauth', 590, 650, {
      kind: 'auth',
      label: 'Google OAuth',
      config: { provider: 'google', mode: 'login' },
    }),
    block('signup', 40, 820, {
      kind: 'button',
      label: 'Criar conta',
      config: { screenId: 'login' },
    }),
    block('register', 590, 850, {
      kind: 'auth',
      label: 'Cadastrar usuário',
      config: { provider: 'email', mode: 'register' },
    }),
    block('logout-button', 1420, 320, {
      kind: 'button',
      label: 'Sair da conta',
      config: { screenId: 'home' },
    }),
    block('logout-action', 1690, 320, { kind: 'logout', label: 'Encerrar sessão', config: {} }),
  ],
  // [origem, destino, porta de saída, porta de entrada]
  edges: [
    ['logout-button', 'logout-action', 'next', 'exec'],
    ['email', 'auth', 'value', 'email'],
    ['password', 'auth', 'value', 'password'],
    ['enter', 'auth', 'next', 'exec'],
    ['auth', 'check', 'next', 'exec'],
    ['auth', 'check', 'value', 'value'],
    ['check', 'go', 'true', 'exec'],
    ['go', 'home', 'next', 'exec'],
    ['forgot', 'reset', 'next', 'exec'],
    ['email', 'reset', 'value', 'email'],
    ['google', 'oauth', 'next', 'exec'],
    ['oauth', 'go', 'next', 'exec'],
    ['signup', 'register', 'next', 'exec'],
    ['email', 'register', 'value', 'email'],
    ['password', 'register', 'value', 'password'],
    ['register', 'check', 'next', 'exec'],
    ['register', 'check', 'value', 'value'],
  ].map(([source, target, sourceHandle, targetHandle], i) => ({
    id: 'e' + i,
    source,
    target,
    sourceHandle,
    targetHandle,
  })),
};
