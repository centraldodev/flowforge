import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { demo } from '../src/engine/demo';
import {
  compile,
  generateProgramCode,
  generatePythonProgram,
  PythonSymbolTable,
  safePythonLiteral,
  type ProgramIR,
} from '../src/compiler';
import { addPythonProject } from '../src/export/python';

// ============================================================================
// 1. TABELA DE SÍMBOLOS E PALAVRAS RESERVADAS PYTHON
// ============================================================================

test('Fase 6: PythonSymbolTable sanitiza identificadores e protege palavras reservadas', () => {
  const table = new PythonSymbolTable();

  // Sanitização de caracteres especiais
  assert.equal(table.getIdentifier('btn-login-ação!'), 'btn_login_a__o_');

  // Identificador que começa com número
  assert.equal(table.getIdentifier('123campo'), '_123campo');

  // Palavra reservada do Python
  assert.equal(table.getIdentifier('def'), '_def');
  assert.equal(table.getIdentifier('class'), '_class');
  assert.equal(table.getIdentifier('import'), '_import');
  assert.equal(table.getIdentifier('async'), '_async');

  // Builtins do Python
  assert.equal(table.getIdentifier('id'), '_id');
  assert.equal(table.getIdentifier('input'), '_input');

  // Determinismo e resolução de colisão
  const c1 = table.getIdentifier('item');
  const c2 = table.getIdentifier('item');
  assert.equal(c1, 'item');
  assert.equal(c2, 'item');

  const c3 = table.getIdentifier('item-2');
  assert.equal(c3, 'item_2');
});

// ============================================================================
// 2. EMISSÃO SEGURA DE LITERAIS PYTHON
// ============================================================================

test('Fase 6: safeLiteral emite literais Python sem risco de injeção', () => {
  assert.equal(safePythonLiteral(null), 'None');
  assert.equal(safePythonLiteral(undefined), 'None');
  assert.equal(safePythonLiteral(true), 'True');
  assert.equal(safePythonLiteral(false), 'False');
  assert.equal(safePythonLiteral(12345), '12345');
  assert.equal(safePythonLiteral("aspas'simples"), '"aspas\'simples"');
  assert.equal(safePythonLiteral('aspas"duplas'), '"aspas\\"duplas"');
  assert.equal(safePythonLiteral('quebra\nde\nlinha'), '"quebra\\nde\\nlinha"');
  assert.equal(
    safePythonLiteral('${__import__("os").system("echo")}'),
    '"${__import__(\\"os\\").system(\\"echo\\")}"',
  );
  assert.equal(safePythonLiteral([1, true, null]), '[1, True, None]');
  assert.equal(safePythonLiteral({ chave: 'valor' }), '{"chave": "valor"}');
});

// ============================================================================
// 3. PARIDADE DOURADA: JS BACKEND vs PYTHON BACKEND
// ============================================================================

interface ProgramResult {
  success: boolean;
  screen?: string;
  messages: string[];
  trace: Array<{ id: string; label: string; message: string }>;
  store: Record<string, unknown>;
  error?: string;
}

function runPythonProgram(
  pySource: string,
  payload: {
    eventId: string;
    inputs?: Record<string, unknown>;
    store?: Record<string, unknown>;
    screen?: string;
    fastDelay?: boolean;
  },
): ProgramResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-py-test-'));
  const programPath = path.join(tmpDir, 'program.py');

  try {
    fs.writeFileSync(programPath, pySource, 'utf-8');

    const result = spawnSync('python3', [programPath], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      timeout: 10000,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Python execution failed (code ${result.status}): ${result.stderr}`);
    }

    return JSON.parse(result.stdout.trim()) as ProgramResult;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function createJsRunner(jsSource: string) {
  const factory = new Function(`
    ${jsSource.replace(/export class/g, 'class').replace(/export function/g, 'function')}
    return { FlowForgeProgram, createProgram, createRuntimeContext };
  `);
  const { createProgram } = factory() as {
    createProgram: (options?: unknown) => {
      dispatch: (eventId: string, inputs?: Record<string, unknown>) => Promise<ProgramResult>;
      getScreen: () => string;
      getState: (key?: string) => unknown;
    };
  };
  return createProgram({ fastDelay: true });
}

test('Fase 6: Paridade dourada JS vs Python - Login com credenciais válidas', async () => {
  const comp = compile(demo);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ir: ProgramIR = comp.value;
  const jsSource = generateProgramCode(ir);
  const pySource = generatePythonProgram(ir);

  const inputs = { email: 'demo@exemplo.com', senha: '123456' };

  // Executa backend JavaScript
  const jsRunner = createJsRunner(jsSource);
  const jsRes = await jsRunner.dispatch('btn_entrar', inputs);

  // Executa backend Python via child_process
  const pyRes = runPythonProgram(pySource, {
    eventId: 'btn_entrar',
    inputs,
    fastDelay: true,
  });

  // Comparações de paridade dourada
  assert.equal(pyRes.success, jsRes.success);
  assert.equal(pyRes.screen, jsRes.screen);
  assert.equal(pyRes.screen, 'home');

  // Paridade de sessão no store
  const jsSession = (jsRes.store.__session as Array<{ email: string }>) || [];
  const pySession = (pyRes.store.__session as Array<{ email: string }>) || [];
  assert.equal(pySession.length, jsSession.length);
  assert.equal(pySession[0]?.email, jsSession[0]?.email);
  assert.equal(pySession[0]?.email, 'demo@exemplo.com');
});

test('Fase 6: Paridade dourada JS vs Python - Login com senha incorreta', async () => {
  const comp = compile(demo);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ir: ProgramIR = comp.value;
  const jsSource = generateProgramCode(ir);
  const pySource = generatePythonProgram(ir);

  const inputs = { email: 'demo@exemplo.com', senha: 'senha_errada' };

  // Executa backend JavaScript
  const jsRunner = createJsRunner(jsSource);
  const jsRes = await jsRunner.dispatch('btn_entrar', inputs);

  // Executa backend Python
  const pyRes = runPythonProgram(pySource, {
    eventId: 'btn_entrar',
    inputs,
    fastDelay: true,
  });

  assert.equal(pyRes.success, jsRes.success);
  assert.equal(pyRes.screen, jsRes.screen);
  assert.notEqual(pyRes.screen, 'home');

  // Ambos devem ter rejeitado login na sessão
  assert.equal(pyRes.store.__session, undefined);
  assert.equal(jsRes.store.__session, undefined);
});

test('Fase 6: Paridade dourada JS vs Python - Cadastro de nova conta', async () => {
  const comp = compile(demo);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;

  const ir: ProgramIR = comp.value;
  const jsSource = generateProgramCode(ir);
  const pySource = generatePythonProgram(ir);

  const cadastroInputs = {
    email: 'novo_python_user@exemplo.com',
    senha: 'secret123456',
  };

  // JS cadastro
  const jsRunner = createJsRunner(jsSource);
  const jsRes = await jsRunner.dispatch('btn_cadastrar', cadastroInputs);

  // Python cadastro
  const pyRes = runPythonProgram(pySource, {
    eventId: 'btn_cadastrar',
    inputs: cadastroInputs,
    fastDelay: true,
  });

  assert.equal(pyRes.success, jsRes.success);
  assert.equal(pyRes.screen, jsRes.screen);

  // Verifica que ambos criaram usuário no banco (tabela usuarios)
  const jsUsers = (jsRes.store.usuarios as Array<{ email: string }>) || [];
  const pyUsers = (pyRes.store.usuarios as Array<{ email: string }>) || [];
  assert.ok(jsUsers.some((u) => u.email === 'novo_python_user@exemplo.com'));
  assert.ok(pyUsers.some((u) => u.email === 'novo_python_user@exemplo.com'));
});

// ============================================================================
// 4. TESTE DE EXPORTAÇÃO E INTEGRIDADE DO PROJETO TKINTER
// ============================================================================

test('Fase 6: addPythonProject gera app.py desacoplado de program.py sem referências mortas', async () => {
  const zip = new JSZip();
  addPythonProject(zip, demo);

  const files = Object.keys(zip.files);
  assert.ok(files.includes('program.py'));
  assert.ok(files.includes('app.py'));
  assert.ok(files.includes('models.py'));

  const appPyContent = await zip.file('app.py')!.async('string');
  const programPyContent = await zip.file('program.py')!.async('string');

  // app.py deve importar program.py
  assert.ok(appPyContent.includes('from program import create_program'));

  // Não deve conter referências mortas a blocos obsoletos (constant/math reinseridos na Fase 7, textarea/select/checkbox na Fase 8)
  const deadKinds = ['validation', 'transform', 'reset', 'class'];
  for (const dead of deadKinds) {
    assert.ok(
      !appPyContent.includes(`"${dead}"`) && !appPyContent.includes(`'${dead}'`),
      `app.py não deve conter referência a bloco obsoleto: ${dead}`,
    );
  }

  // Validação sintática real usando o compilador Python nativo
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-py-zip-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'program.py'), programPyContent, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'app.py'), appPyContent, 'utf-8');

    const checkResult = spawnSync('python3', ['-m', 'py_compile', 'program.py', 'app.py'], {
      cwd: tmpDir,
      encoding: 'utf-8',
    });

    assert.equal(
      checkResult.status,
      0,
      `Compilação dos arquivos Python exportados falhou: ${checkResult.stderr}`,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
