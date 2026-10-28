import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph } from '../src/engine/types';
import {
  customerOrdersProject,
  schedulingConflictProject,
  roleApprovalPortalProject,
} from '../src/engine';
import { createProject } from '../src/export';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 10: Auditoria E2E de Estrutura do Monorepo Exportado (Customer Orders)', async () => {
  const zip = await createProject(customerOrdersProject, 'typescript');
  const fileNames = Object.keys(zip.files);

  // 1. Arquivos de raiz do monorepo
  assert.ok(fileNames.includes('package.json'), 'package.json raiz deve existir');
  assert.ok(fileNames.includes('README.md'), 'README.md deve existir');
  assert.ok(fileNames.includes('Dockerfile'), 'Dockerfile multi-stage deve existir');
  assert.ok(fileNames.includes('docker-compose.yml'), 'docker-compose.yml deve existir');
  assert.ok(fileNames.includes('.dockerignore'), '.dockerignore deve existir');
  assert.ok(
    fileNames.includes('.env.development.example'),
    '.env.development.example deve existir',
  );
  assert.ok(fileNames.includes('.env.production.example'), '.env.production.example deve existir');
  assert.ok(fileNames.includes('scripts/check-env.mjs'), 'scripts/check-env.mjs deve existir');
  assert.ok(fileNames.includes('flowforge/project.flow.json'), 'project.flow.json deve existir');

  // 2. Pacotes e Workspaces
  assert.ok(fileNames.includes('apps/web/package.json'), 'apps/web/package.json deve existir');
  assert.ok(fileNames.includes('apps/api/package.json'), 'apps/api/package.json deve existir');
  assert.ok(
    fileNames.includes('packages/contracts/package.json'),
    'packages/contracts/package.json deve existir',
  );

  // 3. Validação do package.json raiz
  const rootPkgRaw = await zip.file('package.json')?.async('string');
  assert.ok(rootPkgRaw);
  const rootPkg = JSON.parse(rootPkgRaw);
  assert.ok(Array.isArray(rootPkg.workspaces), 'workspaces deve ser um array');
  assert.ok(rootPkg.workspaces.includes('apps/*'));
  assert.ok(rootPkg.workspaces.includes('packages/*'));
  assert.ok(rootPkg.scripts['check-env'], 'script check-env deve existir na raiz');
  assert.ok(rootPkg.scripts['dev'], 'script dev deve existir na raiz');
  assert.ok(rootPkg.scripts['build'], 'script build deve existir na raiz');

  // 4. Validação do docker-compose.yml
  const composeContent = await zip.file('docker-compose.yml')?.async('string');
  assert.ok(composeContent);
  assert.ok(composeContent.includes('postgres:16-alpine'));
  assert.ok(composeContent.includes('POSTGRES_DB: flowforge_db'));
  assert.ok(composeContent.includes('services:'));
  assert.ok(composeContent.includes('app:'));

  // 5. Validação do Dockerfile multi-stage
  const dockerfileContent = await zip.file('Dockerfile')?.async('string');
  assert.ok(dockerfileContent);
  assert.ok(dockerfileContent.includes('FROM node:20-alpine AS builder'));
  assert.ok(dockerfileContent.includes('FROM node:20-alpine AS runner'));
  assert.ok(dockerfileContent.includes('EXPOSE 8787'));
});

test('Fase 10: Auditoria de Segurança e Zero Segredos Vazados (Zero Secrets Leakage)', async () => {
  const zip = await createProject(customerOrdersProject, 'typescript');
  const fileNames = Object.keys(zip.files);

  // 1. Nenhum arquivo do frontend contém referências a credenciais reais
  const webFiles = fileNames.filter((f) => f.startsWith('apps/web/'));
  for (const f of webFiles) {
    if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json')) {
      const content = await zip.file(f)?.async('string');
      if (content) {
        assert.ok(
          !content.includes('postgres://postgres:'),
          `Arquivo web ${f} não deve vazar connection string com senha`,
        );
        assert.ok(
          !content.includes('super-secret'),
          `Arquivo web ${f} não deve conter segredos de token`,
        );
      }
    }
  }

  // 2. Arquivo .env.development.example não possui senhas em hardcode
  const envContent = await zip.file('.env.development.example')?.async('string');
  assert.ok(envContent);
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('FLOWFORGE_SECRET_')) {
      const parts = line.split('=');
      assert.equal(
        parts[1].trim(),
        '',
        `Variável ${parts[0]} deve ter valor vazio no .env.example`,
      );
    }
  }

  // 3. Logger estruturado com proteção automática de segredos
  const loggerContent = await zip.file('apps/api/src/runtime/logger.mjs')?.async('string');
  assert.ok(loggerContent);
  assert.ok(loggerContent.includes('sanitizeLogData'));
  assert.ok(loggerContent.includes('[REDACTED]'));
});

test('Fase 10: Auditoria de Contratos e Gateways Backend', async () => {
  const zip = await createProject(customerOrdersProject, 'typescript');
  const fileNames = Object.keys(zip.files);

  // Contratos de tipos
  assert.ok(
    fileNames.includes('packages/contracts/src/runtime.ts'),
    'runtime.ts deve ser emitido em contracts',
  );
  assert.ok(fileNames.includes('packages/contracts/src/ui.ts'), 'ui.ts deve ser emitido');
  assert.ok(fileNames.includes('packages/contracts/src/auth.ts'), 'auth.ts deve ser emitido');
  assert.ok(
    fileNames.includes('packages/contracts/src/diagnostics.ts'),
    'diagnostics.ts deve ser emitido',
  );

  // Gateways no backend
  assert.ok(fileNames.includes('apps/api/src/database/gateway.mjs'));
  assert.ok(fileNames.includes('apps/api/src/auth/gateway.mjs'));
  assert.ok(fileNames.includes('apps/api/src/runtime/diagnostics.mjs'));
  assert.ok(fileNames.includes('apps/api/src/app.mjs'));

  // Endpoints registrados no app.mjs
  const appContent = await zip.file('apps/api/src/app.mjs')?.async('string');
  assert.ok(appContent);
  assert.ok(appContent.includes('/api/health'));
  assert.ok(appContent.includes('/api/diagnostics'));
  assert.ok(appContent.includes('/api/db'));
  assert.ok(appContent.includes('/api/auth'));
});

test('Fase 10: Auditoria de Compatibilidade dos 3 Apps Canônicos', async () => {
  // 1. Scheduling Conflict App (App de regras cliente)
  const schedZip = await createProject(schedulingConflictProject, 'typescript');
  const schedFiles = Object.keys(schedZip.files);
  assert.ok(schedFiles.includes('package.json'));
  assert.ok(schedFiles.includes('apps/web/package.json'));
  assert.ok(
    schedFiles.some((f) => f.includes('screen_agendamento') && f.endsWith('Page.tsx')),
    'Página de agendamento deve ser emitida',
  );

  // 2. Role Approval Portal App (App full-stack com RBAC e regras de servidor)
  const roleZip = await createProject(roleApprovalPortalProject, 'typescript');
  const roleFiles = Object.keys(roleZip.files);
  assert.ok(roleFiles.includes('Dockerfile'));
  assert.ok(roleFiles.includes('package.json'));
  assert.ok(roleFiles.includes('apps/api/src/auth/gateway.mjs'));
  assert.ok(roleFiles.includes('apps/api/src/policies/index.mjs'));
});

test('Auditoria 2026-10-27: Verificação das Correções de Segurança, Integridade e Runtime Exportado', async () => {
  const zip = await createProject(customerOrdersProject, 'typescript');

  // Item 1 & 10: Autenticação segura, PBKDF2 e bloqueio de escalonamento de privilégios
  const authGw = await zip.file('apps/api/src/auth/gateway.mjs')?.async('string');
  assert.ok(authGw, 'Gateway de autenticação deve existir');
  assert.ok(authGw.includes('pbkdf2Sync'), 'Deve utilizar PBKDF2 com salt para hashing de senha');
  assert.ok(
    authGw.includes('PRIVILEGE_ESCALATION_DENIED'),
    'Deve rejeitar escalonamento para role não-user no registro público',
  );
  assert.ok(
    authGw.includes('export function verifySession'),
    'Deve exportar função verifySession para autorização central',
  );

  // Item 2 & 5: Gateway de banco de dados com autorização central, isolamento multi-tenant e PostgreSQL real
  const dbGw = await zip.file('apps/api/src/database/gateway.mjs')?.async('string');
  assert.ok(dbGw, 'Gateway de banco de dados deve existir');
  assert.ok(dbGw.includes('verifySession'), 'Deve validar sessão e token de autenticação');
  assert.ok(dbGw.includes('authorizeRequest'), 'Deve invocar o avaliador de políticas de acesso');
  assert.ok(
    dbGw.includes('UNAUTHORIZED_TENANT'),
    'Deve rejeitar requisições multi-tenant sem tenant identificado na sessão',
  );
  assert.ok(dbGw.includes('runMigrations'), 'Deve executar migrações de esquema DDL');
  assert.ok(
    dbGw.includes('new Pool('),
    'Deve instanciar Pool de conexões PostgreSQL para modo real',
  );

  // Dependência pg no apps/api/package.json
  const apiPkgRaw = await zip.file('apps/api/package.json')?.async('string');
  assert.ok(apiPkgRaw);
  const apiPkg = JSON.parse(apiPkgRaw);
  assert.ok(
    apiPkg.dependencies?.pg,
    'apps/api/package.json deve declarar dependência de produção pg',
  );

  // Item 3 & 4: Contratos completos e registro de todos os adaptadores
  const runtimeContracts = await zip.file('packages/contracts/src/runtime.ts')?.async('string');
  assert.ok(runtimeContracts, 'runtime.ts deve ser emitido');
  assert.ok(runtimeContracts.includes('SubflowAdapter'), 'Deve tipar SubflowAdapter');
  assert.ok(
    runtimeContracts.includes('email?: ActionAdapter'),
    'Deve incluir adapter email em Adapters',
  );
  assert.ok(
    runtimeContracts.includes('storage?: ActionAdapter'),
    'Deve incluir adapter storage em Adapters',
  );
  assert.ok(
    runtimeContracts.includes('payment?: ActionAdapter'),
    'Deve incluir adapter payment em Adapters',
  );

  const contextCode = await zip.file('apps/web/src/runtime/context.ts')?.async('string');
  assert.ok(contextCode, 'apps/web/src/runtime/context.ts deve existir');
  assert.ok(
    contextCode.includes('ModularSubflowAdapter'),
    'Deve prover adaptador ModularSubflowAdapter no contexto',
  );
  assert.ok(
    contextCode.includes('MockEmailAdapter'),
    'Deve prover adaptador MockEmailAdapter no contexto',
  );
  assert.ok(
    zip.file('apps/web/src/runtime/adapters/subflow.js'),
    'Arquivo do adaptador de subflow deve ser emitido',
  );
  assert.ok(
    zip.file('apps/web/src/runtime/adapters/email.js'),
    'Arquivo do adaptador de email deve ser emitido',
  );

  // Workflows gerados com retorno explícito (evitando TS2355)
  const workflowFile = Object.keys(zip.files).find(
    (f) =>
      f.startsWith('apps/web/src/') &&
      f.includes('/workflows/') &&
      f.endsWith('.ts') &&
      !f.endsWith('.manifest.json'),
  );
  assert.ok(workflowFile, 'Pelo menos um arquivo de workflow deve ser gerado');
  const wfContent = await zip.file(workflowFile)?.async('string');
  assert.ok(wfContent);
  assert.ok(
    wfContent.includes('return undefined;'),
    'Workflow deve ter retorno explícito para satisfazer Promise<unknown>',
  );

  // Item 6: Verificação de pagamentos
  const paymentProject: Graph = {
    version: 1,
    name: 'payment-audit',
    nodes: [
      {
        id: 'p1',
        type: 'block',
        position: { x: 0, y: 0 },
        data: {
          label: 'Payment',
          kind: 'payment',
          config: { provider: 'stripe', amount: '100' },
        },
      },
    ],
    edges: [],
  };
  const paymentPlan = createTypeScriptPlan(paymentProject);
  const paymentGw = paymentPlan.files.get('apps/api/src/payments/gateway.mjs')?.content;
  assert.ok(paymentGw, 'Gateway de pagamentos deve existir');
  assert.ok(
    paymentGw.includes('PAYMENT_NOT_FOUND'),
    'Deve retornar erro quando pagamento não existe ou é inválido',
  );
  assert.ok(paymentGw.includes("'pending'"), 'Novo pagamento deve iniciar com status pending');

  // Item 7: Validação criptográfica de Webhooks e proteção anti-replay
  const webhookProject: Graph = {
    version: 1,
    name: 'webhook-audit',
    nodes: [
      {
        id: 'w1',
        type: 'block',
        position: { x: 0, y: 0 },
        data: {
          label: 'Webhook',
          kind: 'webhook',
          contractVersion: 1,
          config: { endpoint: '/api/webhooks/audit', secretEnv: 'FLOWFORGE_SECRET_WEBHOOK_SECRET' },
        },
      },
    ],
    edges: [],
  };
  const webhookPlan = createTypeScriptPlan(webhookProject);
  const integrationsGw = webhookPlan.files.get('apps/api/src/integrations/gateway.mjs')?.content;
  assert.ok(integrationsGw, 'Gateway de integrações deve existir');
  assert.ok(
    integrationsGw.includes('timingSafeEqual'),
    'Deve usar timingSafeEqual para validar HMAC',
  );
  assert.ok(integrationsGw.includes('MISSING_SIGNATURE'), 'Deve exigir cabeçalho de assinatura');
  assert.ok(
    integrationsGw.includes('DUPLICATE_EVENT'),
    'Deve rejeitar eventos duplicados (anti-replay)',
  );

  // Item 8: Servidor serve frontend estático mesmo sem conector HTTP externo
  const appCode = await zip.file('apps/api/src/app.mjs')?.async('string');
  assert.ok(appCode, 'app.mjs deve existir');
  assert.ok(appCode.includes('serveStatic'), 'app.mjs deve montar serveStatic');
  assert.ok(zip.file('apps/api/src/runtime/static.mjs'), 'Módulo static.mjs deve ser emitido');

  // Item 9: Dockerfile copia scripts no estágio builder
  const dockerfile = await zip.file('Dockerfile')?.async('string');
  assert.ok(dockerfile, 'Dockerfile deve existir');
  const builderIndex = dockerfile.indexOf('AS builder');
  const runnerIndex = dockerfile.indexOf('AS runner');
  const builderStage = dockerfile.slice(builderIndex, runnerIndex);
  assert.ok(
    builderStage.includes('COPY scripts ./scripts'),
    'Estágio builder deve copiar scripts para viabilizar check-api',
  );
});
