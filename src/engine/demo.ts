import type { Block, BlockData, Graph } from './types';

const block = (id: string, x: number, y: number, data: BlockData): Block => ({
  id,
  type: 'block',
  position: { x, y },
  data,
});

/**
 * Projeto de exemplo refatorado no padrão real de programação (Lado IN / Lado OUT).
 * Somente conexões reais e utilizadas:
 *  - Botão Entrar (#btn-login) [onClick] -> [trigger] Autenticação (#auth)
 *  - E-mail (#email) [value] -> [email] Autenticação (#auth)
 *  - Senha (#password) [value] -> [password] Autenticação (#auth)
 *  - Autenticação (#auth) [onSuccess] -> [execute] Navegação (#navigate)
 *  - Autenticação (#auth) [onError] -> [execute] Exibir Erro (#show-error)
 *  - Autenticação (#auth) [user] -> [user] Tela Home (#home)
 *  - Navegação (#navigate) [onComplete] -> [onEnter] Tela Home (#home)
 */
export const demo: Graph = {
  version: 1,
  name: 'Fluxo de Autenticação Real',
  nodes: [
    // Tela de Login
    block('login', 40, 40, {
      kind: 'screen',
      label: 'Tela de Login',
      config: {
        title: 'Bem-vindo de volta',
      },
      ports: [
        { id: 'onEnter', name: 'onEnter', direction: 'input', type: 'Event' },
      ],
    }),
    // Campos de Entrada da Tela de Login
    block('email', 40, 180, {
      kind: 'input',
      label: 'E-mail',
      config: {
        field: 'email',
        placeholder: 'voce@exemplo.com',
        screenId: 'login',
        value: 'demo@exemplo.com',
      },
      ports: [
        { id: 'value', name: 'value', direction: 'output', type: 'string' },
        { id: 'onChange', name: 'onChange', direction: 'output', type: 'Event' },
      ],
    }),
    block('password', 40, 320, {
      kind: 'input',
      label: 'Senha',
      config: {
        field: 'password',
        placeholder: 'Sua senha',
        screenId: 'login',
        value: '123456',
      },
      ports: [
        { id: 'value', name: 'value', direction: 'output', type: 'string' },
        { id: 'onChange', name: 'onChange', direction: 'output', type: 'Event' },
      ],
    }),
    // Botão de Submissão
    block('btn-login', 400, 40, {
      kind: 'button',
      label: 'Entrar',
      config: { screenId: 'login' },
      ports: [
        { id: 'disabled', name: 'disabled', direction: 'input', type: 'boolean' },
        { id: 'onClick', name: 'onClick', direction: 'output', type: 'Event' },
      ],
    }),
    // Bloco de Autenticação
    block('auth', 400, 200, {
      kind: 'auth',
      label: 'Login',
      config: { provider: 'email', mode: 'login' },
      ports: [
        { id: 'trigger', name: 'trigger', direction: 'input', type: 'Event' },
        { id: 'email', name: 'email', direction: 'input', type: 'string' },
        { id: 'password', name: 'password', direction: 'input', type: 'string' },
        { id: 'onSuccess', name: 'onSuccess', direction: 'output', type: 'Event' },
        { id: 'onError', name: 'onError', direction: 'output', type: 'Error' },
        { id: 'user', name: 'user', direction: 'output', type: 'User' },
      ],
    }),
    // Ramo de Sucesso -> Navegação
    block('navigate', 260, 480, {
      kind: 'navigate',
      label: 'Navigate',
      config: { target: 'home' },
      ports: [
        { id: 'execute', name: 'execute', direction: 'input', type: 'Event' },
        { id: 'route', name: 'route', direction: 'input', type: 'string', value: '/home' },
        { id: 'onComplete', name: 'onComplete', direction: 'output', type: 'Event' },
      ],
    }),
    // Ramo de Falha -> Exibir Erro
    block('show-error', 620, 480, {
      kind: 'function',
      label: 'Show Error',
      config: { code: 'return message || "Credenciais inválidas";' },
      ports: [
        { id: 'execute', name: 'execute', direction: 'input', type: 'Event' },
        { id: 'message', name: 'message', direction: 'input', type: 'string' },
        { id: 'onDismiss', name: 'onDismiss', direction: 'output', type: 'Event' },
      ],
    }),
    // Tela Inicial (Home)
    block('home', 260, 680, {
      kind: 'screen',
      label: 'Tela Home',
      config: {
        title: 'Painel Principal',
      },
      ports: [
        { id: 'onEnter', name: 'onEnter', direction: 'input', type: 'Event' },
        { id: 'user', name: 'user', direction: 'input', type: 'User' },
      ],
    }),
  ],
  edges: [
    {
      id: 'e-btn-auth',
      source: 'btn-login',
      target: 'auth',
      sourceHandle: 'onClick',
      targetHandle: 'trigger',
    },
    {
      id: 'e-email-auth',
      source: 'email',
      target: 'auth',
      sourceHandle: 'value',
      targetHandle: 'email',
    },
    {
      id: 'e-password-auth',
      source: 'password',
      target: 'auth',
      sourceHandle: 'value',
      targetHandle: 'password',
    },
    {
      id: 'e-auth-nav',
      source: 'auth',
      target: 'navigate',
      sourceHandle: 'onSuccess',
      targetHandle: 'execute',
    },
    {
      id: 'e-auth-err',
      source: 'auth',
      target: 'show-error',
      sourceHandle: 'onError',
      targetHandle: 'execute',
    },
    {
      id: 'e-auth-user',
      source: 'auth',
      target: 'home',
      sourceHandle: 'user',
      targetHandle: 'user',
    },
    {
      id: 'e-nav-home',
      source: 'navigate',
      target: 'home',
      sourceHandle: 'onComplete',
      targetHandle: 'onEnter',
    },
  ],
};
