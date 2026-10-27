import type { Graph } from '../../engine/types';
import { buildAuthManifest } from '../../engine/auth';
import { ArtifactPlan, json } from './artifacts';

export function emitAuth(plan: ArtifactPlan, graph: Graph): boolean {
  const manifest = buildAuthManifest(graph);
  const hasAuthNodes = graph.nodes.some(
    (n) => n.data.kind === 'auth' || n.data.kind === 'identityProvider' || n.data.kind === 'policy',
  );

  if (!hasAuthNodes && !manifest.providers.length && !manifest.policies.length) {
    return false;
  }

  if (plan.files.has('packages/contracts/src/auth.ts')) {
    return true;
  }

  const root = 'apps/api/src/';

  // 1. Contratos de Autenticação em packages/contracts/src/auth.ts
  const contractsCode = `// Contratos de tipos para Identidade e Políticas de Segurança do FlowForge
export type UserRole = 'admin' | 'user' | 'manager' | 'guest';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId?: string;
  provider: 'email' | 'google' | 'oidc';
}

export interface AuthSession {
  token: string;
  user: AuthenticatedUser;
  expiresAt: number;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
}
`;
  plan.text('packages/contracts/src/auth.ts', contractsCode, 'contract');

  // 2. Políticas de Acesso em apps/api/src/policies/index.mjs
  const policiesJson = json(manifest.policies);
  const policiesCode = `// Motor de Políticas de Acesso (RBAC / ABAC) do FlowForge com negação por padrão
export const policies = ${policiesJson};

export function evaluatePolicy(policy, subject, record) {
  for (const cond of policy.conditions || []) {
    let matches = false;
    if (cond.operator === 'authenticated') {
      matches = Boolean(subject && subject.id);
    } else if (cond.operator === 'hasRole') {
      const expected = cond.value;
      if (Array.isArray(expected)) {
        matches = Boolean(subject && expected.includes(subject.role));
      } else {
        matches = Boolean(subject && subject.role === expected);
      }
    } else if (cond.operator === 'isOwner') {
      const ownerField = cond.value || 'ownerId';
      matches = Boolean(subject && record && String(record[ownerField]) === String(subject.id));
    } else if (cond.operator === 'sameOrg') {
      const orgField = cond.value || 'orgId';
      matches = Boolean(
        subject && subject.orgId && record && String(record[orgField]) === String(subject.orgId)
      );
    } else if (cond.operator === 'equals') {
      const val = cond.field?.startsWith('user.') && subject
        ? subject[cond.field.replace('user.', '')]
        : record ? record[cond.field] : undefined;
      matches = String(val ?? '') === String(cond.value ?? '');
    }

    if (!matches) {
      return { allowed: false, reason: policy.errorMessage || 'Condição de acesso não satisfeita.' };
    }
  }

  return { allowed: policy.effect === 'allow' };
}

export function authorizeRequest({ user, target, action = '*', record }) {
  const matchingPolicies = policies.filter((p) => {
    const targetMatch = p.target === '*' || p.target === target;
    const actionMatch = p.action === '*' || p.action === action;
    return targetMatch && actionMatch;
  });

  if (matchingPolicies.length === 0) {
    // Negação por padrão: se não há política explícita de permissão para recurso protegido, nega
    return { allowed: false, reason: 'Nenhuma política concede permissão para esta ação.' };
  }

  // Se qualquer regra explícita de negação disparar, o acesso é barrado imediatamente
  for (const policy of matchingPolicies) {
    const res = evaluatePolicy(policy, user, record);
    if (!res.allowed) {
      return res;
    }
  }

  return { allowed: true };
}
`;
  plan.text(
    `${root}policies/index.mjs`,
    policiesCode,
    'policy',
    manifest.policies.map((p) => p.id),
  );

  // 3. Runtime de Autenticação em apps/api/src/auth/gateway.mjs
  const providersJson = json(manifest.providers);
  const authGatewayCode = `import { randomBytes, createHash } from 'node:crypto';
import { policies, evaluatePolicy, authorizeRequest } from '../policies/index.mjs';

const configuredProviders = ${providersJson};

// Armazenamento de usuários e sessões
const users = new Map();
const sessions = new Map();

function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

export function createAuthGateway(options = {}) {
  const env = options.env || process.env;

  return async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }));
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      const urlAction = req.url?.split('?')[0].replace('/__flowforge/auth', '').replace('/api/auth', '').replace(/^\\//, '');
      const action = body.action || urlAction || 'login';
      const payload = body.payload || body;

      // 1. Verificação de Políticas de Acesso
      if (body.checkPolicy || action === 'check-policy') {
        const token = req.headers.authorization?.replace(/^Bearer\\s+/i, '') || payload.token || '';
        const session = sessions.get(token);
        const user = session && Date.now() < session.expiresAt ? session.user : null;

        const authz = authorizeRequest({
          user,
          target: payload.target,
          action: payload.action,
          record: payload.record,
        });

        if (!authz.allowed) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: authz.reason || 'Acesso negado.', status: 403 } }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, allowed: true, user }));
        return;
      }

      // 2. LOGIN
      if (action === 'login') {
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '');
        if (!email || !password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'E-mail e senha são obrigatórios.', status: 400 } }));
          return;
        }

        const user = users.get(email);
        if (!user || user.passwordHash !== hashPassword(password)) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.', status: 401 } }));
          return;
        }

        const duration = Number(configuredProviders[0]?.sessionDurationSec || 86400);
        const token = 'ff_sess_' + randomBytes(24).toString('hex');
        const session = {
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, provider: user.provider },
          expiresAt: Date.now() + duration * 1000,
        };
        sessions.set(token, session);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, user: session.user, session }));
        return;
      }

      // 3. REGISTER
      if (action === 'register') {
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '');
        if (!email || !email.includes('@')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'INVALID_EMAIL', message: 'Informe um e-mail válido.', status: 400 } }));
          return;
        }
        if (password.length < 6) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'WEAK_PASSWORD', message: 'A senha deve conter no mínimo 6 caracteres.', status: 400 } }));
          return;
        }
        if (users.has(email)) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado.', status: 409 } }));
          return;
        }

        const newUser = {
          id: 'usr_' + randomBytes(6).toString('hex'),
          email,
          name: payload.name || email.split('@')[0],
          role: payload.role || 'user',
          orgId: payload.orgId,
          provider: 'email',
          passwordHash: hashPassword(password),
        };
        users.set(email, newUser);

        const duration = Number(configuredProviders[0]?.sessionDurationSec || 86400);
        const token = 'ff_sess_' + randomBytes(24).toString('hex');
        const session = {
          token,
          user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, orgId: newUser.orgId, provider: newUser.provider },
          expiresAt: Date.now() + duration * 1000,
        };
        sessions.set(token, session);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, user: session.user, session }));
        return;
      }

      // 4. SESSION CHECK
      if (action === 'session') {
        const token = payload.token || req.headers.authorization?.replace(/^Bearer\\s+/i, '') || '';
        const session = sessions.get(token);
        if (!session || Date.now() > session.expiresAt) {
          if (token) sessions.delete(token);
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão expirada ou não autenticada.', status: 401 } }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, user: session.user, session }));
        return;
      }

      // 5. LOGOUT
      if (action === 'logout') {
        const token = payload.token || req.headers.authorization?.replace(/^Bearer\\s+/i, '') || '';
        if (token) sessions.delete(token);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'UNSUPPORTED_ACTION', message: 'Ação não suportada.' } }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Erro interno.' } }));
    }
  };
}
`;
  plan.text(
    `${root}auth/gateway.mjs`,
    authGatewayCode,
    'auth-runtime',
    manifest.providers.map((p) => p.id),
    [`${root}policies/index.mjs`],
  );

  return true;
}
