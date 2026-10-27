import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  authConfigurationIssues,
  buildAuthManifest,
  evaluatePolicy,
  type AccessPolicyDefinition,
  type AuthenticatedUser,
} from '../src/engine/auth';
import type { Block, Graph, Kind } from '../src/engine/types';
import {
  clearDevAuth,
  createAuthGateway,
  createSessionForUser,
  executeAuthAction,
  registerServerUser,
} from '../src/server/authGateway';
import { GatewayAuthAdapter } from '../src/compiler/interpreter/authAdapter';
import { createExecutionContext } from '../src/compiler/interpreter/adapters';
import { ArtifactPlan } from '../src/export/modular/artifacts';
import { emitAuth } from '../src/export/modular/auth';
import { emitServer } from '../src/export/modular/server';

function mockBlock(kind: Kind, config: Record<string, unknown> = {}, id = 'b1'): Block {
  const stringConfig: Record<string, string> = Object.fromEntries(
    Object.entries(config).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: kind,
      kind,
      config: stringConfig,
    },
  };
}

test('Fase 3: buildAuthManifest extrai provedores e políticas com tipos estritos', () => {
  const provider = mockBlock(
    'identityProvider',
    {
      name: 'Provedor Google',
      type: 'google',
      clientId: 'meu-client-id.apps.googleusercontent.com',
      clientSecretEnv: 'FLOWFORGE_SECRET_GOOGLE_SECRET',
      sessionDurationSec: 3600,
    },
    'idp1',
  );

  const policy = mockBlock(
    'policy',
    {
      name: 'Apenas Admin',
      target: 'clientes.delete',
      action: 'delete',
      effect: 'allow',
      conditions: JSON.stringify([{ field: 'user.role', operator: 'hasRole', value: 'admin' }]),
      errorMessage: 'Apenas administradores podem excluir clientes.',
    },
    'pol1',
  );

  const graph: Graph = {
    version: 1,
    name: 'App Seguro',
    nodes: [provider, policy],
    edges: [],
  };

  const manifest = buildAuthManifest(graph);
  assert.equal(manifest.providers.length, 1);
  assert.equal(manifest.providers[0].type, 'google');
  assert.equal(manifest.providers[0].sessionDurationSec, 3600);
  assert.equal(manifest.policies.length, 1);
  assert.equal(manifest.policies[0].target, 'clientes.delete');
  assert.equal(manifest.policies[0].conditions[0].operator, 'hasRole');
});

test('Fase 3: authConfigurationIssues diagnostica pendências de segurança no grafo', () => {
  const badSecretProvider = mockBlock(
    'identityProvider',
    {
      name: 'Provedor Inseguro',
      type: 'oidc',
      clientSecretEnv: 'SEGREDO_INVALIDO_SEM_PREFIXO',
    },
    'p_bad',
  );

  const unconfiguredGoogle = mockBlock(
    'identityProvider',
    {
      name: 'Google Sem Client ID',
      type: 'google',
    },
    'p_google',
  );

  const orphanRealAuth = mockBlock(
    'auth',
    {
      mode: 'real',
      operation: 'login',
    },
    'a_real',
  );

  const graph: Graph = {
    version: 1,
    name: 'App Com Erros',
    nodes: [badSecretProvider, unconfiguredGoogle, orphanRealAuth],
    edges: [],
  };

  const issues = authConfigurationIssues(graph);
  assert.ok(issues.some((i) => i.blockId === 'p_bad' && i.message.includes('FLOWFORGE_SECRET_')));
  assert.ok(issues.some((i) => i.blockId === 'p_google' && i.message.includes('Client ID')));
  assert.ok(
    issues.some((i) => i.blockId === 'a_real' && i.message.includes('Provedor de Identidade')),
  );
});

test('Fase 3: motor de políticas de acesso avalia RBAC, ownership e nega por padrão', () => {
  const adminPolicy: AccessPolicyDefinition = {
    id: 'p1',
    name: 'Regra Admin',
    target: 'financeiro',
    action: 'read',
    effect: 'allow',
    conditions: [{ field: 'user.role', operator: 'hasRole', value: 'admin' }],
    errorMessage: 'Acesso restrito ao perfil de administrador.',
  };

  const ownerPolicy: AccessPolicyDefinition = {
    id: 'p2',
    name: 'Regra Dono do Recurso',
    target: 'documentos',
    action: 'update',
    effect: 'allow',
    conditions: [{ field: 'user.id', operator: 'isOwner', value: 'criadoPor' }],
    errorMessage: 'Você só pode editar documentos criados por você.',
  };

  const adminUser: AuthenticatedUser = {
    id: 'u1',
    email: 'admin@empresa.com',
    name: 'Admin',
    role: 'admin',
    orgId: 'org_1',
    provider: 'email',
  };

  const normalUser: AuthenticatedUser = {
    id: 'u2',
    email: 'dev@empresa.com',
    name: 'Dev',
    role: 'user',
    orgId: 'org_1',
    provider: 'email',
  };

  // 1. RBAC: Admin vs User
  assert.equal(evaluatePolicy(adminPolicy, adminUser).allowed, true);
  const evalUser = evaluatePolicy(adminPolicy, normalUser);
  assert.equal(evalUser.allowed, false);
  assert.equal(evalUser.reason, 'Acesso restrito ao perfil de administrador.');

  // 2. Anônimo (sem login)
  assert.equal(evaluatePolicy(adminPolicy, null).allowed, false);

  // 3. ABAC: Propriedade (Owner)
  const docProprio = { id: 'doc_1', criadoPor: 'u2', titulo: 'Minhas notas' };
  const docAlheio = { id: 'doc_2', criadoPor: 'u1', titulo: 'Notas do Admin' };
  assert.equal(evaluatePolicy(ownerPolicy, normalUser, docProprio).allowed, true);
  assert.equal(evaluatePolicy(ownerPolicy, normalUser, docAlheio).allowed, false);
});

test('Fase 3: gateway de autenticação gerencia registro, login, expiração e revogação de sessão', async () => {
  clearDevAuth();

  // 1. Validação de formato no registro
  const fracassoSenha = await executeAuthAction('register', {
    email: 'usuario@empresa.com',
    password: '123', // menos de 6 caracteres
  });
  assert.equal(fracassoSenha.ok, false);
  assert.equal(fracassoSenha.error?.code, 'WEAK_PASSWORD');

  // 2. Registro com sucesso
  const registro = await executeAuthAction('register', {
    email: 'usuario@empresa.com',
    password: 'senhaSegura123',
    name: 'Carlos Silva',
  });
  assert.equal(registro.ok, true);
  assert.ok(registro.user?.id);
  assert.equal(registro.user?.email, 'usuario@empresa.com');
  assert.ok(registro.session?.token);
  const userToken = registro.session!.token;

  // 3. E-mail duplicado é rejeitado com 409
  const duplicado = await executeAuthAction('register', {
    email: 'usuario@empresa.com',
    password: 'outraSenha123',
  });
  assert.equal(duplicado.ok, false);
  assert.equal(duplicado.error?.code, 'EMAIL_ALREADY_EXISTS');

  // 4. Login com senha errada
  const loginErrado = await executeAuthAction('login', {
    email: 'usuario@empresa.com',
    password: 'senhaIncorreta',
  });
  assert.equal(loginErrado.ok, false);
  assert.equal(loginErrado.error?.code, 'INVALID_CREDENTIALS');

  // 5. Login com credenciais válidas
  const loginOk = await executeAuthAction('login', {
    email: 'usuario@empresa.com',
    password: 'senhaSegura123',
  });
  assert.equal(loginOk.ok, true);
  assert.equal(loginOk.user?.name, 'Carlos Silva');
  assert.ok(loginOk.session?.token);

  // 6. Verificação de sessão ativa
  const sessCheck = await executeAuthAction('session', { token: userToken });
  assert.equal(sessCheck.ok, true);
  assert.equal(sessCheck.user?.email, 'usuario@empresa.com');

  // 7. Revogação de sessão (logout)
  const logout = await executeAuthAction('logout', { token: userToken });
  assert.equal(logout.ok, true);

  const sessPosLogout = await executeAuthAction('session', { token: userToken });
  assert.equal(sessPosLogout.ok, false);
  assert.equal(sessPosLogout.error?.code, 'UNAUTHORIZED');
});

test('Fase 3: createAuthGateway intercepta e bloqueia chamadas não autorizadas com 403', async () => {
  clearDevAuth();
  const manifest = {
    providers: [],
    policies: [
      {
        id: 'pol_bloqueio',
        name: 'Bloqueio Restrito',
        target: 'relatorios.export',
        action: 'read' as const,
        effect: 'allow' as const,
        conditions: [{ field: 'user.role', operator: 'hasRole' as const, value: 'admin' }],
        errorMessage: 'Apenas administradores podem exportar relatórios sensíveis.',
      },
    ],
  };

  const handler = createAuthGateway({ manifest });

  // Simula usuário comum tentando acessar
  const normalUser = registerServerUser({
    email: 'comum@teste.com',
    name: 'Comum',
    role: 'user',
    provider: 'email',
  });
  const normalSession = createSessionForUser(normalUser);

  // Mock de requisição HTTP node
  let statusCode = 0;
  let responseData = '';
  const req = {
    method: 'POST',
    url: '/__flowforge/auth',
    headers: {
      authorization: `Bearer ${normalSession.token}`,
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(
        JSON.stringify({
          checkPolicy: true,
          target: 'relatorios.export',
          action: 'read',
        }),
      );
    },
  } as unknown as IncomingMessage;

  const res = {
    setHeader: () => {},
    set statusCode(code: number) {
      statusCode = code;
    },
    end: (content: string) => {
      responseData = content;
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  assert.equal(statusCode, 403);
  const parsed = JSON.parse(responseData) as {
    ok: boolean;
    error?: { code: string; message: string };
  };
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'FORBIDDEN');
  assert.match(parsed.error?.message, /administradores/);
});

test('Fase 3: GatewayAuthAdapter delega para mock quando não-real e para gateway quando real', async () => {
  const adapter = new GatewayAuthAdapter();
  const context = createExecutionContext();

  // 1. Modo não-real (mock padrão com credenciais demo)
  const mockResult = (await adapter.execute(
    'login',
    {
      mode: 'demo',
      email: 'demo@exemplo.com',
      password: '123456',
    },
    context,
  )) as Record<string, unknown>;
  assert.equal(mockResult.email, 'demo@exemplo.com');
  assert.ok(context.store.__session);
});

test('Fase 3: exportação modular gera contratos, gateway e políticas de segurança', () => {
  const plan = new ArtifactPlan();
  const provider = mockBlock(
    'identityProvider',
    {
      name: 'Provedor Principal',
      type: 'email',
      sessionDurationSec: 7200,
    },
    'idp_1',
  );

  const policy = mockBlock(
    'policy',
    {
      name: 'Proteção de Usuários',
      target: 'usuarios.delete',
      action: 'delete',
      effect: 'deny',
      conditions: JSON.stringify([{ field: 'user.role', operator: 'notEquals', value: 'admin' }]),
    },
    'pol_1',
  );

  const authNode = mockBlock(
    'auth',
    {
      mode: 'real',
      operation: 'login',
    },
    'auth_1',
  );

  const graph: Graph = {
    version: 1,
    name: 'App Modular com Identidade',
    nodes: [provider, policy, authNode],
    edges: [
      {
        id: 'e1',
        source: 'idp_1',
        sourceHandle: 'provider',
        target: 'auth_1',
        targetHandle: 'connection',
      },
    ],
  };

  const hasAuth = emitAuth(plan, graph);
  assert.equal(hasAuth, true);

  assert.ok(plan.files.has('packages/contracts/src/auth.ts'));
  assert.ok(plan.files.has('apps/api/src/policies/index.mjs'));
  assert.ok(plan.files.has('apps/api/src/auth/gateway.mjs'));

  // Servidor integra o roteamento de auth no app.mjs
  const hasServer = emitServer(plan, graph);
  assert.equal(hasServer, true);

  const appFile = plan.files.get('apps/api/src/app.mjs');
  assert.ok(appFile);
  assert.ok(appFile.content.includes('createAuthGateway'));
  assert.ok(appFile.content.includes('/__flowforge/auth'));
});
