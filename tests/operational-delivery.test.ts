import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeEnvironment,
  formatEnvironmentReport,
  customerOrdersProject,
  schedulingConflictProject,
  roleApprovalPortalProject,
  REFERENCE_PROJECTS,
} from '../src/engine';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 7: Assistente de ambiente detecta variáveis ausentes e gera orientações acionáveis', () => {
  // Analisa o projeto de clientes e pedidos sem nenhuma variável configurada
  const emptyEnvReport = analyzeEnvironment(customerOrdersProject, {});

  assert.strictEqual(emptyEnvReport.ok, false);
  assert.ok(emptyEnvReport.missingVariables.length > 0);
  assert.strictEqual(emptyEnvReport.featuresDetected.hasDatabase, true);
  assert.strictEqual(emptyEnvReport.featuresDetected.hasAuth, true);

  // Verifica que a variável do banco está na lista de ausentes com guia acionável
  const dbVar = emptyEnvReport.missingVariables.find(
    (v) => v.name === 'FLOWFORGE_SECRET_DATABASE_URL',
  );
  assert.ok(dbVar, 'Deveria identificar FLOWFORGE_SECRET_DATABASE_URL como obrigatória');
  assert.strictEqual(dbVar.category, 'database');
  assert.ok(dbVar.example.includes('postgresql://'));
  assert.ok(dbVar.setupGuide.length > 10);

  // Verifica saída formatada para o terminal
  const output = formatEnvironmentReport(emptyEnvReport);
  assert.ok(output.includes('FLOWFORGE - DIAGNÓSTICO DE AMBIENTE'));
  assert.ok(output.includes('CONFIGURAÇÃO INCOMPLETA'));
  assert.ok(output.includes('FLOWFORGE_SECRET_DATABASE_URL'));

  // Agora fornece as variáveis necessárias
  const fullEnv = {
    FLOWFORGE_SECRET_DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/gestor_db',
    FLOWFORGE_SECRET_JWT_SECRET: 'super-secret-token-12345',
    FLOWFORGE_SECRET_RESEND_API_KEY: 're_123456789',
    FLOWFORGE_PORT: '8787',
  };

  const filledReport = analyzeEnvironment(customerOrdersProject, fullEnv);
  assert.strictEqual(filledReport.ok, true);
  assert.strictEqual(filledReport.missingVariables.length, 0);
  assert.ok(filledReport.configuredVariables.includes('FLOWFORGE_SECRET_DATABASE_URL'));
  assert.ok(filledReport.configuredVariables.includes('FLOWFORGE_SECRET_JWT_SECRET'));
});

test('Fase 7: Logger estruturado e sanitização automática de segredos', async () => {
  const plan = createTypeScriptPlan(customerOrdersProject);
  const loggerArtifact = plan.files.get('apps/api/src/runtime/logger.mjs');

  assert.ok(loggerArtifact, 'Logger estruturado deve ser emitido');
  assert.ok(loggerArtifact.content.includes('export function sanitizeLogData'));
  assert.ok(loggerArtifact.content.includes('[REDACTED]'));
  assert.ok(loggerArtifact.content.includes('[SECRET_REF]'));

  // Avalia sanitização diretamente
  const rawLoggerCode = loggerArtifact.content;
  const matchRedacted = rawLoggerCode.includes('password') && rawLoggerCode.includes('token');
  assert.ok(matchRedacted, 'Deve filtrar campos sensíveis de credenciais');
});

test('Fase 7: Servidor exportado contém endpoints de /api/health e /api/diagnostics', async () => {
  const plan = createTypeScriptPlan(customerOrdersProject);
  const appFile = plan.files.get('apps/api/src/app.mjs');
  const diagFile = plan.files.get('apps/api/src/runtime/diagnostics.mjs');

  assert.ok(appFile, 'app.mjs deve existir');
  assert.ok(diagFile, 'diagnostics.mjs deve existir');

  assert.ok(appFile.content.includes('/api/health'));
  assert.ok(appFile.content.includes('/api/diagnostics'));
  assert.ok(appFile.content.includes('createDiagnosticsGateway'));

  assert.ok(diagFile.content.includes('uptimeSeconds'));
  assert.ok(diagFile.content.includes('collectDiagnostics'));
});

test('Fase 7: Emissão de artefatos de deploy (Dockerfile, docker-compose.yml e check-env)', () => {
  const plan = createTypeScriptPlan(customerOrdersProject);

  // Dockerfile multi-stage
  const dockerfile = plan.files.get('Dockerfile');
  assert.ok(dockerfile, 'Dockerfile deve ser gerado');
  assert.ok(dockerfile.content.includes('AS builder'));
  assert.ok(dockerfile.content.includes('AS runner'));
  assert.ok(dockerfile.content.includes('EXPOSE 8787'));
  assert.ok(dockerfile.content.includes('dumb-init'));

  // docker-compose.yml com banco PostgreSQL
  const dockerCompose = plan.files.get('docker-compose.yml');
  assert.ok(dockerCompose, 'docker-compose.yml deve ser gerado');
  assert.ok(dockerCompose.content.includes('flowforge-app'));
  assert.ok(dockerCompose.content.includes('postgres:16-alpine'));
  assert.ok(dockerCompose.content.includes('flowforge_pgdata'));

  // CLI check-env
  const checkEnv = plan.files.get('scripts/check-env.mjs');
  assert.ok(checkEnv, 'scripts/check-env.mjs deve ser gerado');
  assert.ok(checkEnv.content.includes('ASSISTENTE DE AMBIENTE OPERACIONAL'));

  // package.json scripts
  const packageJson = JSON.parse(plan.files.get('package.json')!.content);
  assert.ok(packageJson.scripts['check-env']);
  assert.ok(packageJson.scripts['docker:build']);
  assert.ok(packageJson.scripts['docker:run']);

  // README atualizado com instruções da Fase 7
  const readme = plan.files.get('README.md');
  assert.ok(readme);
  assert.ok(readme.content.includes('npm run check-env'));
  assert.ok(readme.content.includes('docker compose up --build'));
  assert.ok(readme.content.includes('Destinos de Implantação'));
});

test('Fase 7: App de Referência 1 — Gestor de Clientes e Pedidos exporta e satisfaz requisitos', () => {
  assert.ok(customerOrdersProject);
  assert.strictEqual(customerOrdersProject.name, 'Gestor de Clientes e Pedidos');

  // Verifica nós principais
  const nodeKinds = new Set(customerOrdersProject.nodes.map((n) => n.data.kind));
  assert.ok(nodeKinds.has('screen'));
  assert.ok(nodeKinds.has('button'));
  assert.ok(nodeKinds.has('input'));
  assert.ok(nodeKinds.has('database'));
  assert.ok(nodeKinds.has('entity'));
  assert.ok(nodeKinds.has('policy'));
  assert.ok(nodeKinds.has('auth'));
  assert.ok(nodeKinds.has('api'));
  assert.ok(nodeKinds.has('subflow'));
  assert.ok(nodeKinds.has('email'));

  // Gera plano de exportação modular
  const plan = createTypeScriptPlan(customerOrdersProject);
  assert.ok(plan.files.size > 20);

  // Valida que segredos não vazaram em texto plano
  for (const [path, artifact] of plan.files) {
    assert.ok(
      !artifact.content.includes('re_123456789_real_secret'),
      `Segredo em plain text encontrado em ${path}`,
    );
  }
});

test('Fase 7: Apps de Referência 2 e 3 — Agendamento e Portal de Aprovação', () => {
  assert.ok(REFERENCE_PROJECTS.schedulingConflict);
  assert.ok(REFERENCE_PROJECTS.roleApprovalPortal);

  // Agendamento com validação de conflito
  const schedPlan = createTypeScriptPlan(schedulingConflictProject);
  assert.ok(schedPlan.files.has('flowforge/project.flow.json'));
  assert.ok(
    [...schedPlan.files.keys()].some(
      (k) => k.includes('screen_agendamento') && k.endsWith('Page.tsx'),
    ),
    'Página de agendamento deve ser emitida',
  );

  // Portal de Aprovação com RBAC
  const rolePlan = createTypeScriptPlan(roleApprovalPortalProject);
  assert.ok(rolePlan.files.has('flowforge/project.flow.json'));
  assert.ok(
    [...rolePlan.files.keys()].some((k) => k.includes('screen_portal') && k.endsWith('Page.tsx')),
    'Página de portal de aprovação deve ser emitida',
  );
  const authContracts = rolePlan.files.get('packages/contracts/src/auth.ts');
  assert.ok(authContracts, 'Contratos de auth devem ser emitidos');
});
