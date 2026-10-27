import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerOrdersProject,
  schedulingConflictProject,
  roleApprovalPortalProject,
} from '../src/engine';
import { createProject } from '../src/export';

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
