import type { Graph } from '../../engine/types';
import { analyzeEnvironment } from '../../engine/envDiagnostics';
import { ArtifactPlan, json } from './artifacts';

export function emitDiagnostics(plan: ArtifactPlan, graph: Graph, hasServer: boolean): boolean {
  if (!hasServer) return false;

  const report = analyzeEnvironment(graph, {});

  // Contratos TypeScript públicos
  plan.text(
    'packages/contracts/src/diagnostics.ts',
    `export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}

export interface DiagnosticsResponse {
  ok: boolean;
  environment: string;
  configuredVariablesCount: number;
  requiredVariablesCount: number;
  missingVariables: string[];
  features: {
    database: boolean;
    auth: boolean;
    storage: boolean;
    email: boolean;
    webhooks: boolean;
    tasks: boolean;
  };
}
`,
    'contract',
  );

  const root = 'apps/api/src/';

  // Logger estruturado com mascaramento automático de segredos
  const loggerCode = `/**
 * Logger estruturado do FlowForge com higienização estrita de dados sensíveis.
 */
const SENSITIVE_KEYS = new Set([
  'password', 'senha', 'secret', 'token', 'authorization', 'apiKey', 'apikey',
  'jwt', 'key', 'credential', 'access_key', 'secret_key', 'private_key'
]);

export function sanitizeLogData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Reduz tokens Bearer ou strings longas com formato de chave
    if (data.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    if (data.startsWith('FLOWFORGE_SECRET_')) return '[SECRET_REF]';
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }
  return data;
}

function emit(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...(Object.keys(meta).length > 0 ? { meta: sanitizeLogData(meta) } : {})
  };
  const line = JSON.stringify(entry);
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg, meta) => emit('INFO', msg, meta),
  warn: (msg, meta) => emit('WARN', msg, meta),
  error: (msg, meta) => emit('ERROR', msg, meta),
  debug: (msg, meta) => {
    if (process.env.DEBUG || process.env.FLOWFORGE_ENV === 'development') {
      emit('DEBUG', msg, meta);
    }
  }
};
`;

  plan.text(root + 'runtime/logger.mjs', loggerCode, 'runtime');

  // Coletor de diagnósticos do backend
  const diagnosticsCode = `import { logger } from './logger.mjs';

const REQUIRED_MANIFEST = ${json(report.requiredVariables)};

export function collectDiagnostics(env = process.env) {
  const missing = [];
  const configured = [];

  for (const item of REQUIRED_MANIFEST) {
    const val = env[item.name];
    if (val && val.trim() !== '') {
      configured.push(item.name);
    } else if (item.required) {
      missing.push(item.name);
    }
  }

  return {
    ok: missing.length === 0,
    environment: env.FLOWFORGE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    configuredVariablesCount: configured.length,
    requiredVariablesCount: REQUIRED_MANIFEST.filter((i) => i.required).length,
    missingVariables: missing,
    features: ${json(report.featuresDetected)}
  };
}

export function createDiagnosticsGateway() {
  return async (req, res) => {
    const p = req.url?.split('?')[0] || '';
    res.setHeader('Content-Type', 'application/json');

    if (p === '/api/health') {
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }));
      return;
    }

    if (p === '/api/diagnostics') {
      const diag = collectDiagnostics();
      res.statusCode = diag.ok ? 200 : 206; // 206 Partial Content se faltarem configurações opcionais/mockadas
      res.end(JSON.stringify(diag, null, 2));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'Endpoint não encontrado' }));
  };
}
`;

  plan.text(
    root + 'runtime/diagnostics.mjs',
    diagnosticsCode,
    'runtime',
    [],
    [root + 'runtime/logger.mjs'],
  );

  // Script CLI acionável `scripts/check-env.mjs`
  const checkEnvScript = `#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Carrega .env manualmente se existir e não tiver sido injetado pelo node
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const REQUIRED_VARS = ${json(report.requiredVariables)};

console.log('\\x1b[1m\\x1b[36m=====================================================\\x1b[0m');
console.log('\\x1b[1m\\x1b[36m   FLOWFORGE - ASSISTENTE DE AMBIENTE OPERACIONAL    \\x1b[0m');
console.log('\\x1b[1m\\x1b[36m=====================================================\\x1b[0m\\n');

const missing = [];
const configured = [];

for (const item of REQUIRED_VARS) {
  const val = process.env[item.name];
  if (val && val.trim() !== '') {
    configured.push(item);
  } else if (item.required) {
    missing.push(item);
  }
}

console.log(\`Ambiente ativo: \\x1b[33m\${process.env.FLOWFORGE_ENV || 'development'}\\x1b[0m\`);
console.log(\`Variáveis configuradas: \\x1b[32m\${configured.length}/\${REQUIRED_VARS.length}\\x1b[0m\\n\`);

if (missing.length === 0) {
  console.log('\\x1b[32m✔ Todas as variáveis obrigatórias estão configuradas com sucesso!\\x1b[0m');
  console.log('O projeto está pronto para execução local ou em produção.\\n');
  process.exit(0);
} else {
  console.log(\`\\x1b[31m✖ Atenção: \${missing.length} variável(is) obrigatória(s) estão ausentes:\\x1b[0m\\n\`);
  for (const v of missing) {
    console.log(\`\\x1b[1m[!] \${v.name}\\x1b[0m (\${v.category})\`);
    console.log(\`    Finalidade: \${v.description}\`);
    console.log(\`    Exemplo:    \\x1b[33m\${v.example}\\x1b[0m\`);
    console.log(\`    Ação:       \${v.setupGuide}\\n\`);
  }
  console.log('\\x1b[33mDica: Copie .env.development.example para .env e preencha os valores antes de rodar npm run dev.\\x1b[0m\\n');
  process.exit(1);
}
`;

  plan.text('scripts/check-env.mjs', checkEnvScript, 'diagnostic-script');

  return true;
}
