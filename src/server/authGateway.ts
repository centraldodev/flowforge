import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type {
  AuthManifest,
  AuthenticatedUser,
  AuthSession,
  IdentityProviderConfig,
  AccessPolicyDefinition,
} from '../engine/auth';
import { evaluatePolicy } from '../engine/auth';
import { PLAYGROUND_ACCOUNT } from '../engine/playgroundCredentials';

export type AuthExecutionResult = {
  ok: boolean;
  user?: AuthenticatedUser;
  session?: AuthSession;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
};

// Armazenamento em memória do servidor local para usuários e sessões
const serverUsers = new Map<string, AuthenticatedUser & { passwordHash: string }>();
const activeSessions = new Map<string, AuthSession>();

export function clearDevAuth(): void {
  serverUsers.clear();
  activeSessions.clear();
}

export function registerServerUser(
  user: Omit<AuthenticatedUser, 'id'> & { password?: string; id?: string },
): AuthenticatedUser {
  const id = user.id || `usr_${randomBytes(6).toString('hex')}`;
  const record: AuthenticatedUser & { passwordHash: string } = {
    ...user,
    id,
    passwordHash: user.password || '',
  };
  serverUsers.set(user.email.toLowerCase(), record);
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    orgId: record.orgId,
    provider: record.provider,
  };
}

export function createSessionForUser(user: AuthenticatedUser, durationSec = 86400): AuthSession {
  const token = `ff_sess_${randomBytes(24).toString('hex')}`;
  const session: AuthSession = {
    token,
    user,
    expiresAt: Date.now() + durationSec * 1000,
  };
  activeSessions.set(token, session);
  return session;
}

export function getSession(token: string): AuthSession | null {
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

export function revokeSession(token: string): boolean {
  return activeSessions.delete(token);
}

/** Executa uma ação de autenticação de forma segura no servidor */
export async function executeAuthAction(
  action: string,
  payload: {
    email?: string;
    password?: string;
    token?: string;
    name?: string;
    provider?: string;
    providerConfig?: IdentityProviderConfig;
  },
): Promise<AuthExecutionResult> {
  const email = String(payload.email || '')
    .trim()
    .toLowerCase();
  const password = String(payload.password || '');
  const duration = payload.providerConfig?.sessionDurationSec || 86400;

  // 1. LOGIN
  if (action === 'login') {
    if (!email || !password) {
      return {
        ok: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'E-mail e senha são obrigatórios.',
          status: 400,
        },
      };
    }
    const user = serverUsers.get(email);
    if (!user || user.passwordHash !== password) {
      return {
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.', status: 401 },
      };
    }
    const publicUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      provider: user.provider,
    };
    const session = createSessionForUser(publicUser, duration);
    return { ok: true, user: publicUser, session };
  }

  // 2. REGISTER
  if (action === 'register') {
    if (!email || !email.includes('@')) {
      return {
        ok: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Informe um endereço de e-mail válido.',
          status: 400,
        },
      };
    }
    if (password.length < 6) {
      return {
        ok: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'A senha deve conter no mínimo 6 caracteres.',
          status: 400,
        },
      };
    }
    if (serverUsers.has(email)) {
      return {
        ok: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Este e-mail já está cadastrado.',
          status: 409,
        },
      };
    }
    const publicUser = registerServerUser({
      email,
      name: payload.name || email.split('@')[0],
      role: 'user',
      provider: 'email',
      password,
    });
    const session = createSessionForUser(publicUser, duration);
    return { ok: true, user: publicUser, session };
  }

  // 3. GOOGLE OAUTH
  if (action === 'google') {
    const googleToken = String(payload.token || '');
    if (!googleToken) {
      return {
        ok: false,
        error: { code: 'MISSING_TOKEN', message: 'Token OAuth Google obrigatório.', status: 400 },
      };
    }
    // No servidor local, resolve usuário de conta Google
    const googleEmail = email || 'google.usuario@gmail.com';
    let user = serverUsers.get(googleEmail);
    if (!user) {
      user = {
        id: `usr_g_${randomBytes(4).toString('hex')}`,
        email: googleEmail,
        name: payload.name || 'Usuário Google',
        role: 'user',
        provider: 'google',
        passwordHash: '',
      };
      serverUsers.set(googleEmail, user);
    }
    const publicUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      provider: 'google',
    };
    const session = createSessionForUser(publicUser, duration);
    return { ok: true, user: publicUser, session };
  }

  // 4. SESSION CHECK
  if (action === 'session') {
    const token = payload.token || '';
    const session = getSession(token);
    if (!session) {
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sessão expirada ou não autenticada.',
          status: 401,
        },
      };
    }
    return { ok: true, user: session.user, session };
  }

  // 5. LOGOUT
  if (action === 'logout') {
    const token = payload.token || '';
    if (token) revokeSession(token);
    return { ok: true };
  }

  return {
    ok: false,
    error: { code: 'UNSUPPORTED_ACTION', message: `Ação de autenticação "${action}" inválida.` },
  };
}

/** Middleware de autenticação e políticas de segurança para o servidor */
export function createAuthGateway(
  options: { manifest?: AuthManifest; seedPlaygroundAccount?: boolean } = {},
) {
  if (options.seedPlaygroundAccount && !serverUsers.has(PLAYGROUND_ACCOUNT.email)) {
    registerServerUser({
      email: PLAYGROUND_ACCOUNT.email,
      password: PLAYGROUND_ACCOUNT.password,
      name: PLAYGROUND_ACCOUNT.name,
      role: 'user',
      provider: 'email',
    });
  }
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
        }),
      );
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      const manifest = body.manifest || options.manifest;

      // Se for verificação de política de acesso
      if (body.checkPolicy) {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || body.token || '';
        const session = token ? getSession(token) : null;
        const user = session ? session.user : null;

        const targetPolicy = manifest?.policies.find(
          (p: AccessPolicyDefinition) => p.target === body.target || p.target === '*',
        );
        if (targetPolicy) {
          const evalResult = evaluatePolicy(targetPolicy, user, body.record);
          if (!evalResult.allowed) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'FORBIDDEN',
                  message: evalResult.reason || 'Acesso negado pela política.',
                  status: 403,
                },
              }),
            );
            return;
          }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, allowed: true, user }));
        return;
      }

      // Executa ação de login / registro / sessão
      const urlAction = req.url?.split('?')[0].replace('/__flowforge/auth', '').replace(/^\//, '');
      const action = body.action || urlAction || 'login';
      const actionPayload = body.payload || body;
      const result = await executeAuthAction(action, actionPayload);
      res.statusCode = result.ok ? 200 : result.error?.status || 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Erro interno de autenticação.',
          },
        }),
      );
    }
  };
}
