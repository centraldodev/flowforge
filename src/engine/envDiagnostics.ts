import type { Graph } from './types';
import { buildHttpManifest } from './http';
import { buildDatabaseManifest } from './database';
import { buildIntegrationsManifest } from './integrations';
import { buildPaymentManifest } from './paymentsAndRealtime';

export interface RequiredEnvVar {
  name: string;
  category: 'database' | 'auth' | 'http' | 'storage' | 'email' | 'webhook' | 'payment' | 'server';
  required: boolean;
  description: string;
  example: string;
  setupGuide: string;
}

export interface EnvironmentAnalysisReport {
  ok: boolean;
  requiredVariables: RequiredEnvVar[];
  missingVariables: RequiredEnvVar[];
  configuredVariables: string[];
  warnings: string[];
  recommendations: string[];
  featuresDetected: {
    hasDatabase: boolean;
    hasAuth: boolean;
    hasHttpIntegrations: boolean;
    hasStorage: boolean;
    hasEmail: boolean;
    hasWebhooks: boolean;
    hasTasks: boolean;
    hasPayments: boolean;
    hasRealtime: boolean;
  };
}

/**
 * Analisa os requisitos de variáveis de ambiente para um grafo do FlowForge
 * e valida contra o ambiente fornecido (ou process.env).
 */
export function analyzeEnvironment(
  graph: Graph,
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): EnvironmentAnalysisReport {
  const requiredVariables: RequiredEnvVar[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const dbManifest = buildDatabaseManifest(graph);
  const httpManifest = buildHttpManifest(graph);
  const integrationsManifest = buildIntegrationsManifest(graph);

  const hasDb =
    dbManifest.connections.length > 0 || graph.nodes.some((n) => n.data.kind === 'database');
  const hasAuth = graph.nodes.some((n) => n.data.kind === 'auth' || n.data.kind === 'policy');
  const hasHttp =
    httpManifest.requests.length > 0 || graph.nodes.some((n) => n.data.kind === 'api');
  const hasStorage =
    integrationsManifest.storage.length > 0 || graph.nodes.some((n) => n.data.kind === 'storage');
  const hasEmail =
    integrationsManifest.email.length > 0 || graph.nodes.some((n) => n.data.kind === 'email');
  const hasWebhooks =
    integrationsManifest.webhooks.length > 0 || graph.nodes.some((n) => n.data.kind === 'webhook');
  const hasTasks =
    integrationsManifest.tasks.length > 0 || graph.nodes.some((n) => n.data.kind === 'task');
  const paymentManifest = buildPaymentManifest(graph);
  const hasPayments =
    paymentManifest.payments.length > 0 || graph.nodes.some((n) => n.data.kind === 'payment');
  const hasRealtime = graph.nodes.some((n) => n.data.kind === 'realtime');

  // Variáveis básicas do servidor
  requiredVariables.push({
    name: 'FLOWFORGE_PORT',
    category: 'server',
    required: false,
    description: 'Porta TCP do servidor de backend (padrão: 8787).',
    example: '8787',
    setupGuide:
      'Opcional. Defina caso a porta padrão esteja ocupada ou seja atribuída pela hospedagem (ex: Railway/Render).',
  });

  // Requisitos de Banco de Dados
  if (hasDb) {
    for (const conn of dbManifest.connections) {
      if (conn.development?.secretEnv) {
        requiredVariables.push({
          name: conn.development.secretEnv,
          category: 'database',
          required: true,
          description: `String de conexão PostgreSQL para a conexão "${conn.id}".`,
          example: 'postgresql://postgres:postgres@localhost:5432/flowforge_db',
          setupGuide:
            'Obtenha a URL de conexão do PostgreSQL (local via Docker ou nuvem: Supabase, Neon, RDS). Adicione ao .env ou nas variáveis da hospedagem.',
        });
      }
    }
    // Fallback padrão se houver nó de database sem secretEnv explícito
    if (dbManifest.connections.length === 0) {
      requiredVariables.push({
        name: 'FLOWFORGE_SECRET_DATABASE_URL',
        category: 'database',
        required: true,
        description: 'String de conexão PostgreSQL do projeto.',
        example: 'postgresql://postgres:postgres@localhost:5432/flowforge_db',
        setupGuide: 'Configure a URL de conexão com usuário, senha, host, porta e banco de dados.',
      });
    }
  }

  // Requisitos de Autenticação
  if (hasAuth) {
    const hasGoogleAuth = graph.nodes.some(
      (n) =>
        n.data.kind === 'auth' &&
        n.data.config?.execution === 'real' &&
        (n.data.config?.provider === 'google' || n.data.config?.enableGoogle === 'true'),
    );
    if (hasGoogleAuth) {
      requiredVariables.push({
        name: 'FLOWFORGE_SECRET_GOOGLE_CLIENT_ID',
        category: 'auth',
        required: true,
        description: 'ID de Cliente OAuth 2.0 do Google Cloud Console.',
        example: '123456789-abc.apps.googleusercontent.com',
        setupGuide:
          'Crie credenciais OAuth 2.0 no Google Cloud Console e configure a URL de callback.',
      });
      requiredVariables.push({
        name: 'FLOWFORGE_SECRET_GOOGLE_CLIENT_SECRET',
        category: 'auth',
        required: true,
        description: 'Chave secreta OAuth 2.0 do Google Cloud Console.',
        example: 'GOCSPX-sampleSecretKey123',
        setupGuide:
          'Obtenha no painel de credenciais do Google Cloud Console. Mantenha em sigilo estrito no servidor.',
      });
    }
  }

  // Requisitos de HTTP / APIs Externas
  if (hasHttp) {
    for (const req of httpManifest.requests) {
      if (req.connection.auth !== 'none' && req.connection.secretEnv) {
        requiredVariables.push({
          name: req.connection.secretEnv,
          category: 'http',
          required: true,
          description: `Chave de API / Token para o conector HTTP "${req.id}".`,
          example: 'Bearer sk_live_your_api_key_here',
          setupGuide: `Adicione a credencial correspondente gerada no provedor da API (${req.id}) no arquivo .env.`,
        });
      }
    }
  }

  // Requisitos de Storage
  if (hasStorage) {
    for (const s of integrationsManifest.storage) {
      if (s.secretEnv) {
        requiredVariables.push({
          name: s.secretEnv,
          category: 'storage',
          required: true,
          description: `Credencial de acesso ao provedor de armazenamento de arquivos (${s.provider}).`,
          example: 's3_access_key_or_api_secret',
          setupGuide: `Configure a chave de acesso ou token para o bucket "${s.bucket}" no provedor ${s.provider}.`,
        });
      }
    }
  }

  // Requisitos de Email
  if (hasEmail) {
    for (const e of integrationsManifest.email) {
      if (e.secretEnv) {
        requiredVariables.push({
          name: e.secretEnv,
          category: 'email',
          required: true,
          description: `Credencial / API Key para envio de e-mails transacionais via ${e.provider}.`,
          example: 're_123456789_resend_or_smtp_password',
          setupGuide: `Gere a chave de envio no painel de ${e.provider} com permissão para o remetente configurado.`,
        });
      }
    }
  }

  // Requisitos de Webhooks
  if (hasWebhooks) {
    for (const w of integrationsManifest.webhooks) {
      if (w.secretEnv) {
        requiredVariables.push({
          name: w.secretEnv,
          category: 'webhook',
          required: true,
          description: `Segredo compartilhado HMAC para validação de assinaturas no endpoint ${w.path}.`,
          example: 'whsec_sample_hmac_secret_token_123',
          setupGuide:
            'Configure o mesmo segredo no serviço emissor do webhook (ex: Stripe, GitHub) e nesta variável.',
        });
      }
    }
  }

  // Requisitos de Pagamentos
  if (hasPayments) {
    for (const p of paymentManifest.payments) {
      if (p.secretEnv) {
        requiredVariables.push({
          name: p.secretEnv,
          category: 'payment',
          required: true,
          description: `Chave de API / Segredo para processamento de pagamentos via ${p.provider}.`,
          example:
            p.provider === 'pix'
              ? 'pix_chave_aleatoria_ou_certificado'
              : 'sk_live_stripe_secret_key_123',
          setupGuide: `Obtenha a chave secreta no painel do ${p.provider} e configure em ${p.secretEnv} no .env.`,
        });
      }
    }
  }

  // Deduplicação por nome
  const uniqueVars = Array.from(new Map(requiredVariables.map((v) => [v.name, v])).values());

  const missingVariables: RequiredEnvVar[] = [];
  const configuredVariables: string[] = [];

  for (const v of uniqueVars) {
    const val = env[v.name];
    if (val && val.trim() !== '') {
      configuredVariables.push(v.name);
    } else if (v.required) {
      missingVariables.push(v);
    }
  }

  if (missingVariables.length > 0) {
    warnings.push(
      `Existem ${missingVariables.length} variável(is) obrigatória(s) ausente(s) no ambiente atual.`,
    );
  }

  if (
    hasDb &&
    !env.FLOWFORGE_SECRET_DATABASE_URL &&
    !configuredVariables.some((c) => c.includes('DATABASE'))
  ) {
    recommendations.push(
      'Para executar localmente com banco PostgreSQL, use o comando: docker compose up -d postgres',
    );
  }

  return {
    ok: missingVariables.length === 0,
    requiredVariables: uniqueVars,
    missingVariables,
    configuredVariables,
    warnings,
    recommendations,
    featuresDetected: {
      hasDatabase: hasDb,
      hasAuth,
      hasHttpIntegrations: hasHttp,
      hasStorage,
      hasEmail,
      hasWebhooks,
      hasTasks,
      hasPayments,
      hasRealtime,
    },
  };
}

/**
 * Formata um relatório de diagnóstico de ambiente em texto legível para terminal ou logs.
 */
export function formatEnvironmentReport(report: EnvironmentAnalysisReport): string {
  const lines: string[] = [];
  lines.push('=====================================================');
  lines.push('   FLOWFORGE - DIAGNÓSTICO DE AMBIENTE OPERACIONAL   ');
  lines.push('=====================================================');
  lines.push('');

  lines.push(`Status Geral: ${report.ok ? '✔ PRONTO PARA EXECUÇÃO' : '✖ CONFIGURAÇÃO INCOMPLETA'}`);
  lines.push(
    `Variáveis Configuradas: ${report.configuredVariables.length}/${report.requiredVariables.length}`,
  );
  lines.push('');

  if (report.missingVariables.length > 0) {
    lines.push('--- VARIÁVEIS OBRIGATÓRIAS AUSENTES ---');
    for (const v of report.missingVariables) {
      lines.push(`[!] ${v.name} (${v.category})`);
      lines.push(`    Finalidade: ${v.description}`);
      lines.push(`    Exemplo:    ${v.example}`);
      lines.push(`    Como agir:  ${v.setupGuide}`);
      lines.push('');
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('--- RECOMENDAÇÕES OPERACIONAIS ---');
    for (const rec of report.recommendations) {
      lines.push(`* ${rec}`);
    }
    lines.push('');
  }

  lines.push('=====================================================');
  return lines.join('\n');
}
