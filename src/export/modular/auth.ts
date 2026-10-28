import type { Graph } from '../../engine/types';
import { buildAuthManifest } from '../../engine/auth';
import { ArtifactPlan, json } from './artifacts';
import { parseConnectionConfig } from '../../engine/database';

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
  const realAuth = graph.nodes.find(
    (node) => node.data.kind === 'auth' && node.data.config.execution === 'real',
  );
  const connection =
    realAuth &&
    graph.nodes.find(
      (node) =>
        node.id === realAuth.data.config.authDatabaseId && node.data.kind === 'postgresConnection',
    );
  const persistence = connection ? parseConnectionConfig(connection) : null;
  if (realAuth && !persistence) throw new Error('Autenticação real exige uma conexão PostgreSQL.');
  if (persistence)
    plan.text(
      `${root}auth/store.mjs`,
      `import { createHash } from 'node:crypto';
const connection = ${json(persistence)};
let pending;
async function database() {
  if (!pending) pending = (async () => {
    const environment = process.env.FLOWFORGE_ENV || ${JSON.stringify(graph.httpEnvironment || 'development')};
    if (!['development', 'production'].includes(environment)) throw new Error('Ambiente de autenticação inválido.');
    const config = connection[environment];
    const secret = process.env[config.secretEnv];
    if (!secret) throw new Error('Credencial PostgreSQL da autenticação não configurada.');
    const { Pool } = await import('pg');
    const params = /^postgres(?:ql)?:\\/\\//i.test(secret) ? { connectionString: secret } : { host: config.host, port: config.port, database: config.database, user: config.user, password: secret };
    const pool = new Pool({ ...params, connectionTimeoutMillis: config.timeoutMs, ssl: config.ssl === 'require' ? { rejectUnauthorized: true } : undefined });
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS flowforge_auth_users (id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, role text NOT NULL, org_id text, provider text NOT NULL, password_hash text NOT NULL)');
      await pool.query('CREATE TABLE IF NOT EXISTS flowforge_auth_sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES flowforge_auth_users(id) ON DELETE CASCADE, expires_at bigint NOT NULL)');
      return pool;
    } catch (error) { await pool.end(); throw error; }
  })().catch((error) => { pending = undefined; throw error; });
  return pending;
}
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const userFrom = (row) => row && ({ id: row.id, email: row.email, name: row.name, role: row.role, orgId: row.org_id || undefined, provider: row.provider, passwordHash: row.password_hash });
export async function getUser(email) { const db = await database(); return userFrom((await db.query('SELECT * FROM flowforge_auth_users WHERE email = $1', [email])).rows[0]); }
export async function createUser(user) {
  const db = await database();
  try { await db.query('INSERT INTO flowforge_auth_users (id,email,name,role,org_id,provider,password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)', [user.id,user.email,user.name,user.role,user.orgId || null,user.provider,user.passwordHash]); }
  catch (error) { if (error.code === '23505') throw Object.assign(new Error('Este e-mail já está cadastrado.'), { status: 409, code: 'EMAIL_ALREADY_EXISTS' }); throw error; }
}
export async function saveSession(session) { const db = await database(); await db.query('INSERT INTO flowforge_auth_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hashToken(session.token), session.user.id, session.expiresAt]); }
export async function findSession(token) {
  if (!token) return null;
  const db = await database();
  const row = (await db.query('SELECT u.*, s.expires_at FROM flowforge_auth_sessions s JOIN flowforge_auth_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2', [hashToken(token), Date.now()])).rows[0];
  if (!row) return null;
  const { passwordHash: _passwordHash, ...user } = userFrom(row);
  return { token, user, expiresAt: Number(row.expires_at) };
}
export async function deleteSession(token) { if (token) { const db = await database(); await db.query('DELETE FROM flowforge_auth_sessions WHERE token_hash = $1', [hashToken(token)]); } }
`,
      'auth-store',
      [connection!.id],
    );
  const authGatewayCode = `import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { policies, evaluatePolicy, authorizeRequest } from '../policies/index.mjs';
${persistence ? "import * as persistentStore from './store.mjs';" : ''}

const configuredProviders = ${providersJson};

// Armazenamento de usuários e sessões
export const users = new Map();
export const sessions = new Map();

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex');
  return \`\${salt}:\${hash}\`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex');
  return computed === hash;
}

export function verifySession(token) {
  ${persistence ? 'return persistentStore.findSession(token);' : ''}
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) sessions.delete(token);
    return null;
  }
  return session;
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
        const session = await verifySession(token);
        const user = session ? session.user : null;

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

        const user = ${persistence ? 'await persistentStore.getUser(email)' : 'users.get(email)'};
        if (!user || !verifyPassword(password, user.passwordHash)) {
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
        ${persistence ? 'await persistentStore.saveSession(session);' : 'sessions.set(token, session);'}

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
        if (${persistence ? 'await persistentStore.getUser(email)' : 'users.has(email)'}) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado.', status: 409 } }));
          return;
        }

        // Bloqueio rigoroso de elevação de privilégios no cadastro público
        if (payload.role && payload.role !== 'user') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: false,
            error: {
              code: 'PRIVILEGE_ESCALATION_DENIED',
              message: 'Não é permitida atribuição de papéis privilegiados no cadastro público.',
              status: 400
            }
          }));
          return;
        }

        const newUser = {
          id: 'usr_' + randomBytes(6).toString('hex'),
          email,
          name: payload.name || email.split('@')[0],
          role: 'user',
          orgId: undefined,
          provider: 'email',
          passwordHash: hashPassword(password),
        };
        ${persistence ? 'await persistentStore.createUser(newUser);' : 'users.set(email, newUser);'}

        const duration = Number(configuredProviders[0]?.sessionDurationSec || 86400);
        const token = 'ff_sess_' + randomBytes(24).toString('hex');
        const session = {
          token,
          user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, orgId: newUser.orgId, provider: newUser.provider },
          expiresAt: Date.now() + duration * 1000,
        };
        ${persistence ? 'await persistentStore.saveSession(session);' : 'sessions.set(token, session);'}

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, user: session.user, session }));
        return;
      }

      // 4. SESSION CHECK
      if (action === 'session') {
        const token = payload.token || req.headers.authorization?.replace(/^Bearer\\s+/i, '') || '';
        const session = await verifySession(token);
        if (!session || Date.now() > session.expiresAt) {
          ${persistence ? '' : 'if (token) sessions.delete(token);'}
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
        ${persistence ? 'await persistentStore.deleteSession(token);' : 'if (token) sessions.delete(token);'}
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: 'UNSUPPORTED_ACTION', message: 'Ação não suportada.' } }));
    } catch (err) {
      res.statusCode = err.status || 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { code: err.code === 'EMAIL_ALREADY_EXISTS' ? err.code : 'INTERNAL_ERROR', message: err.status ? err.message : 'Serviço de autenticação indisponível.' } }));
    }
  };
}
`;
  plan.text(
    `${root}auth/gateway.mjs`,
    authGatewayCode,
    'auth-runtime',
    manifest.providers.map((p) => p.id),
    [`${root}policies/index.mjs`, ...(persistence ? [`${root}auth/store.mjs`] : [])],
  );

  return true;
}
