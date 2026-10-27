import type { Block, Graph } from './types';

export type UserRole = 'admin' | 'user' | 'manager' | 'guest';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId?: string;
  provider: 'email' | 'google' | 'oidc';
};

export type AuthSession = {
  token: string;
  user: AuthenticatedUser;
  expiresAt: number; // Unix timestamp em ms
};

export type IdentityProviderConfig = {
  id: string;
  name: string;
  type: 'email' | 'google' | 'oidc';
  clientId?: string;
  clientSecretEnv?: string;
  domain?: string;
  redirectUri?: string;
  sessionDurationSec: number;
};

export type PolicyOperator =
  'authenticated' | 'hasRole' | 'isOwner' | 'sameOrg' | 'equals' | 'notEquals' | 'inList';

export type PolicyCondition = {
  field: 'user.authenticated' | 'user.role' | 'user.id' | 'user.orgId' | string;
  operator: PolicyOperator;
  value?: string | string[];
};

export type AccessPolicyDefinition = {
  id: string;
  name: string;
  target: string; // Ex: 'clientes.delete', 'usuarios.update' ou '*'
  action: 'create' | 'read' | 'update' | 'delete' | '*';
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
  errorMessage?: string;
};

export type AuthManifest = {
  providers: IdentityProviderConfig[];
  policies: AccessPolicyDefinition[];
};

export function parseConditions(value = '[]'): PolicyCondition[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is PolicyCondition =>
        Boolean(c) && typeof c === 'object' && typeof c.operator === 'string',
    );
  } catch {
    return [];
  }
}

export function authProviderFor(graph: Graph, blockId: string): Block | undefined {
  const wire = graph.edges.find(
    (edge) => edge.target === blockId && edge.targetHandle === 'connection',
  );
  if (wire) {
    const node = graph.nodes.find(
      (n) => n.id === wire.source && n.data.kind === 'identityProvider',
    );
    if (node) return node;
  }
  const directId = graph.nodes.find((n) => n.id === blockId)?.data.config.providerId;
  if (directId) {
    return graph.nodes.find((n) => n.id === directId && n.data.kind === 'identityProvider');
  }
  return undefined;
}

export function buildAuthManifest(graph: Graph): AuthManifest {
  const providers: IdentityProviderConfig[] = graph.nodes
    .filter((n) => n.data.kind === 'identityProvider')
    .map((node) => {
      const c = node.data.config;
      return {
        id: node.id,
        name: c.name || node.data.label || 'Identidade Principal',
        type: (c.type as 'email' | 'google' | 'oidc') || 'email',
        clientId: c.clientId || undefined,
        clientSecretEnv: c.clientSecretEnv || undefined,
        domain: c.domain || undefined,
        redirectUri: c.redirectUri || undefined,
        sessionDurationSec: Number(c.sessionDurationSec || 86400),
      };
    });

  const policies: AccessPolicyDefinition[] = graph.nodes
    .filter((n) => n.data.kind === 'policy')
    .map((node) => {
      const c = node.data.config;
      return {
        id: node.id,
        name: c.name || node.data.label || 'Política de Acesso',
        target: c.target || '*',
        action: (c.action as AccessPolicyDefinition['action']) || '*',
        effect: (c.effect as 'allow' | 'deny') || 'allow',
        conditions: parseConditions(c.conditions),
        errorMessage: c.errorMessage || 'Acesso negado pela política de segurança.',
      };
    });

  return { providers, policies };
}

export function authConfigurationIssues(graph: Graph): { blockId: string; message: string }[] {
  const issues: { blockId: string; message: string }[] = [];

  for (const node of graph.nodes) {
    if (node.data.kind === 'identityProvider') {
      const c = node.data.config;
      if (c.clientSecretEnv && !c.clientSecretEnv.startsWith('FLOWFORGE_SECRET_')) {
        issues.push({
          blockId: node.id,
          message: `Provedor de Identidade "${node.data.label}": segredo deve começar com "FLOWFORGE_SECRET_".`,
        });
      }
      if (c.type === 'google' && !c.clientId) {
        issues.push({
          blockId: node.id,
          message: `Provedor de Identidade "${node.data.label}": informe o Client ID para autenticação Google.`,
        });
      }
    }

    if (node.data.kind === 'auth' && node.data.config.mode === 'real') {
      const provider = authProviderFor(graph, node.id);
      if (!provider) {
        issues.push({
          blockId: node.id,
          message: `Bloco de Autenticação "${node.data.label}": conecte a um Provedor de Identidade no modo real.`,
        });
      }
    }
  }

  return issues;
}

/** Avalia uma política de acesso no servidor contra o contexto do usuário e recurso */
export function evaluatePolicy(
  policy: AccessPolicyDefinition,
  subject: AuthenticatedUser | null,
  record?: Record<string, unknown>,
): { allowed: boolean; reason?: string } {
  // Negação por padrão se houver condições
  for (const cond of policy.conditions) {
    let matches = false;

    if (cond.operator === 'authenticated') {
      matches = Boolean(subject && subject.id);
    } else if (cond.operator === 'hasRole') {
      const expectedRole = cond.value;
      if (Array.isArray(expectedRole)) {
        matches = Boolean(subject && expectedRole.includes(subject.role));
      } else {
        matches = Boolean(subject && subject.role === expectedRole);
      }
    } else if (cond.operator === 'isOwner') {
      const ownerField = String(cond.value || 'ownerId');
      matches = Boolean(subject && record && String(record[ownerField]) === String(subject.id));
    } else if (cond.operator === 'sameOrg') {
      const orgField = String(cond.value || 'orgId');
      matches = Boolean(
        subject && subject.orgId && record && String(record[orgField]) === String(subject.orgId),
      );
    } else if (cond.operator === 'equals') {
      const val =
        cond.field.startsWith('user.') && subject
          ? (subject as unknown as Record<string, unknown>)[cond.field.replace('user.', '')]
          : record
            ? record[cond.field]
            : undefined;
      matches = String(val ?? '') === String(cond.value ?? '');
    }

    // Se uma condição falhar, nega
    if (!matches) {
      return {
        allowed: false,
        reason: policy.errorMessage || 'Condição de acesso não satisfeita.',
      };
    }
  }

  return { allowed: policy.effect === 'allow' };
}
