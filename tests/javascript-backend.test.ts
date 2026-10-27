import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { demo } from '../src/engine/demo';
import {
  compile,
  interpret,
  createExecutionContext,
  generateProgramCode,
  SymbolTable,
  safeLiteral,
  type ProgramIR,
} from '../src/compiler';
import { addTypeScriptProject } from '../src/export/typescript';

// ============================================================================
// 1. TABELA DE SÍMBOLOS E PALAVRAS RESERVADAS
// ============================================================================

test('Fase 5: SymbolTable sanitiza nomes, trata palavras reservadas e resolve colisões', () => {
  const table = new SymbolTable();

  // Sanitização de caracteres especiais
  assert.equal(table.getIdentifier('btn-login-ação!'), 'btn_login_a__o_');

  // Identificador que começa com número
  assert.equal(table.getIdentifier('123campo'), '_123campo');

  // Palavra reservada do JS
  const reserved = table.getIdentifier('function');
  assert.equal(reserved, '_function');

  const reserved2 = table.getIdentifier('class');
  assert.equal(reserved2, '_class');

  // Resolução determinística de colisões
  const col1 = table.getIdentifier('item');
  const col2 = table.getIdentifier('item'); // mesmo identificador deve retornar o mesmo símbolo mapeado
  assert.equal(col1, 'item');
  assert.equal(col2, 'item');

  const col3 = table.getIdentifier('item-2'); // sanitiza para item_2
  assert.equal(col3, 'item_2');
});

// ============================================================================
// 2. EMISSÃO SEGURA DE LITERAIS
// ============================================================================

test('Fase 5: safeLiteral emite valores sem risco de injeção de código', () => {
  assert.equal(safeLiteral("aspas'simples"), '"aspas\'simples"');
  assert.equal(safeLiteral('aspas"duplas'), '"aspas\\"duplas"');
  assert.equal(safeLiteral('quebra\nde\nlinha'), '"quebra\\nde\\nlinha"');
  assert.equal(safeLiteral('${process.exit()}'), '"${process.exit()}"');
  assert.equal(safeLiteral(12345), '12345');
  assert.equal(safeLiteral(true), 'true');
  assert.equal(safeLiteral(null), 'null');
});

// ============================================================================
// 3. GERAÇÃO DE PROGRAMA JAVASCRIPT A PARTIR DA PROGRAMIR & PARIDADE DOURADA
// ============================================================================

test('Fase 5: código gerado a partir da ProgramIR executa e coincide com o interpretador IR', async () => {
  const compilation = compile(demo);
  assert.equal(compilation.ok, true);
  if (!compilation.ok) return;

  const programIR: ProgramIR = compilation.value;
  const jsSource = generateProgramCode(programIR);

  // Garante que o código foi gerado e possui os exports esperados
  assert.ok(jsSource.includes('export class FlowForgeProgram'));
  assert.ok(jsSource.includes('export function createProgram'));
  assert.ok(jsSource.includes('createRuntimeContext'));

  // Cria executor do código gerado usando new Function para simular módulo
  const moduleExportFactory = new Function(`
    ${jsSource.replace(/export class/g, 'class').replace(/export function/g, 'function')}
    return { FlowForgeProgram, createProgram, createRuntimeContext };
  `);

  const { createProgram } = moduleExportFactory() as {
    createProgram: (options?: unknown) => {
      dispatch: (
        eventId: string,
        inputs?: Record<string, unknown>,
      ) => Promise<{
        success: boolean;
        screen?: string;
        messages: string[];
        trace: Array<{ id: string; label: string; message: string }>;
        store: Record<string, unknown>;
      }>;
      getScreen: () => string;
      getState: (key?: string) => unknown;
      getNotifications: () => unknown[];
      getLogs: () => string[];
      reset: (startScreen?: string) => void;
    };
  };

  // --- CENÁRIO 1: Login com credenciais válidas ---
  const validInputs = { email: 'demo@exemplo.com', senha: '123456' };

  // Execução via interpretador IR (Fase 4)
  const ctxIR = createExecutionContext({
    inputs: validInputs,
    screen: 'login',
  });
  const resIR = await interpret(programIR, 'btn_entrar', ctxIR);

  // Execução via código gerado pelo backend JS (Fase 5)
  const appJS = createProgram({
    inputs: validInputs,
    screen: 'login',
    fastDelay: true,
  });
  const resJS = await appJS.dispatch('btn_entrar');

  assert.equal(resJS.success, true);
  assert.equal(resJS.screen, resIR.screen);
  assert.equal(resJS.screen, 'home');
  assert.ok(appJS.getState('__session'));

  // --- CENÁRIO 2: Login com credenciais inválidas ---
  const invalidInputs = { email: 'demo@exemplo.com', senha: 'errada' };

  const appJSInvalid = createProgram({
    inputs: invalidInputs,
    screen: 'login',
    fastDelay: true,
  });
  const resJSInvalid = await appJSInvalid.dispatch('btn_entrar');

  assert.equal(resJSInvalid.success, true);
  assert.notEqual(resJSInvalid.screen, 'home');
  assert.equal(appJSInvalid.getState('__session'), undefined);
  assert.ok(appJSInvalid.getNotifications().length > 0);

  // --- CENÁRIO 3: Cadastro de nova conta gravando no banco ---
  const cadastroInputs = { email: 'novo_js_backend@teste.com', senha: 'senha_valida_123' };

  const appJSCadastro = createProgram({
    inputs: cadastroInputs,
    screen: 'login',
    fastDelay: true,
  });
  const resJSCadastro = await appJSCadastro.dispatch('btn_cadastrar');

  assert.equal(resJSCadastro.success, true);
  assert.equal(resJSCadastro.screen, 'home');
  assert.ok(appJSCadastro.getState('__session'));

  const usuarios = appJSCadastro.getState('usuarios') as Array<{ email: string }>;
  assert.ok(usuarios.some((u) => u.email === 'novo_js_backend@teste.com'));
});

// ============================================================================
// 4. TESTE END-TO-END DO PACOTE EXPORTADO (ZIP TYPESCRIPT / REACT)
// ============================================================================

test('Exportação React: workspaces, páginas e fluxos substituem o programa monolítico', async () => {
  const zip = new JSZip();
  addTypeScriptProject(zip, demo);
  for (const path of [
    'package.json',
    'tsconfig.base.json',
    'apps/web/src/main.tsx',
    'apps/web/src/runtime/program.ts',
    'apps/web/src/app/routes.tsx',
    'packages/contracts/src/runtime.ts',
    'flowforge/project.flow.json',
    'flowforge/export-manifest.json',
    'flowforge/source-map.json',
  ])
    assert.ok(zip.file(path), path);
  assert.equal(zip.file('src/program.ts'), null);
  assert.equal(zip.file('src/ScreenFields.tsx'), null);
  const main = await zip.file('apps/web/src/main.tsx')!.async('text');
  assert.ok(main.includes("from './app/App'"));
  const program = await zip.file('apps/web/src/runtime/program.ts')!.async('text');
  assert.ok(program.includes('export class FlowForgeProgram'));
  assert.ok(!program.includes('@ts-nocheck'));
  assert.ok(zip.file(/^apps\/web\/src\/pages\/.+\/Page\.tsx$/).length >= 2);
});
