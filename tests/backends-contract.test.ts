import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compile,
  defaultBackendRegistry,
  type BackendBuildCommands,
  type BackendCapability,
  type BackendEmitResult,
  type CompilerBackend,
  type Diagnostic,
  type GeneratedArtifact,
  type ProgramIR,
} from '../src/compiler';
import type { Graph } from '../src/engine/types';

test('Fase 10: defaultBackendRegistry possui backends JavaScript e Python registrados por padrão', () => {
  assert.ok(defaultBackendRegistry.has('javascript'));
  assert.ok(defaultBackendRegistry.has('python'));

  const jsBackend = defaultBackendRegistry.get('javascript');
  const pyBackend = defaultBackendRegistry.get('python');

  assert.equal(jsBackend?.id, 'javascript');
  assert.equal(jsBackend?.version, '1.0.0');
  assert.equal(jsBackend?.targetLanguage, 'typescript');
  assert.ok(jsBackend?.capabilities.has('control_flow'));
  assert.ok(jsBackend?.capabilities.has('legacy_js_eval'));

  assert.equal(pyBackend?.id, 'python');
  assert.equal(pyBackend?.version, '1.0.0');
  assert.equal(pyBackend?.targetLanguage, 'python');
  assert.ok(pyBackend?.capabilities.has('control_flow'));
  assert.equal(pyBackend?.capabilities.has('legacy_js_eval'), false);
});

test('Fase 10: Backends padrão fornecem comandos de build e runtime files', () => {
  const jsBackend = defaultBackendRegistry.get('javascript')!;
  const pyBackend = defaultBackendRegistry.get('python')!;

  const jsCmds = jsBackend.getBuildCommands();
  assert.ok(jsCmds.build?.includes('vite build'));
  assert.ok(jsCmds.test?.includes('npm test'));

  const pyCmds = pyBackend.getBuildCommands();
  assert.ok(pyCmds.run?.includes('python3 app.py'));
  assert.ok(pyCmds.test?.includes('python3 -m unittest'));

  const jsRuntime = jsBackend.getRuntimeFiles();
  assert.ok(jsRuntime.some((a) => a.path === 'src/runtime.ts'));

  const pyRuntime = pyBackend.getRuntimeFiles();
  assert.ok(pyRuntime.some((a) => a.path === 'runtime.py'));
});

test('Fase 10: JavaScriptBackend e PythonBackend emitem artefatos válidos a partir da ProgramIR', () => {
  const graph: Graph = {
    version: 1,
    name: 'Backend Contract Test',
    nodes: [
      {
        id: 'scr',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'screen', label: 'Tela Inicial', config: {} },
      },
      {
        id: 'btn',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { kind: 'button', label: 'Clique', config: { screenId: 'scr' } },
      },
      {
        id: 'notif',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { kind: 'notify', label: 'Alerta', config: { message: 'Olá mundo!' } },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'btn',
        target: 'notif',
        sourceHandle: 'onClick',
        targetHandle: 'execute',
      },
    ],
  };

  const comp = compile(graph);
  assert.equal(comp.ok, true);

  const jsBackend = defaultBackendRegistry.get('javascript')!;
  const jsResult = jsBackend.emit(comp.value);
  assert.equal(jsResult.diagnostics.length, 0);
  assert.equal(jsResult.artifacts.length, 1);
  assert.equal(jsResult.artifacts[0].path, 'src/program.ts');
  assert.ok(jsResult.artifacts[0].content.includes('class FlowForgeProgram'));

  const pyBackend = defaultBackendRegistry.get('python')!;
  const pyResult = pyBackend.emit(comp.value);
  assert.equal(pyResult.diagnostics.length, 0);
  assert.equal(pyResult.artifacts.length, 1);
  assert.equal(pyResult.artifacts[0].path, 'program.py');
  assert.ok(pyResult.artifacts[0].content.includes('class FlowForgeProgram:'));
});

test('Fase 10: Registro de novo backend (ex: Kotlin/TestingBackend) sem alterar compilador central ou UI', () => {
  // Cria um backend mínimo para comprovar a extensibilidade da arquitetura
  class KotlinTestBackend implements CompilerBackend {
    readonly id = 'kotlin';
    readonly name = 'Kotlin Multiplatform';
    readonly version = '0.5.0';
    readonly targetLanguage = 'kotlin';
    readonly capabilities = new Set<BackendCapability>([
      'control_flow',
      'state',
      'async',
      'notifications',
    ]);

    validateCompatibility(program: ProgramIR): Diagnostic[] {
      const diags: Diagnostic[] = [];
      // Simula detecção de recurso não suportado por Kotlin neste backend mínimo
      if (program.screens.some((s) => Object.keys(s.handlers).length > 10)) {
        diags.push({
          code: 'TOO_MANY_HANDLERS',
          severity: 'warning',
          message: 'Mais de 10 handlers em uma única tela.',
        });
      }
      return diags;
    }

    emit(program: ProgramIR): BackendEmitResult {
      const diags = this.validateCompatibility(program);
      const ktCode = `// Generated Kotlin for ${program.name}\npackage com.flowforge.app\nclass FlowForgeApp {\n    fun dispatch(event: String) {}\n}\n`;
      return {
        artifacts: [
          this.format({
            path: 'FlowForgeApp.kt',
            content: ktCode,
            isEntrypoint: true,
          }),
        ],
        diagnostics: diags,
      };
    }

    getRuntimeFiles(): GeneratedArtifact[] {
      return [
        {
          path: 'Runtime.kt',
          content: 'package com.flowforge.app\nclass RuntimeContext\n',
          isRuntime: true,
        },
      ];
    }

    format(artifact: GeneratedArtifact): GeneratedArtifact {
      return {
        ...artifact,
        content: artifact.content.trim() + '\n',
      };
    }

    getBuildCommands(): BackendBuildCommands {
      return {
        build: './gradlew build',
        test: './gradlew test',
        run: './gradlew run',
      };
    }
  }

  const kotlinBackend = new KotlinTestBackend();
  defaultBackendRegistry.register(kotlinBackend);

  try {
    assert.ok(defaultBackendRegistry.has('kotlin'));
    const retrieved = defaultBackendRegistry.get('kotlin');
    assert.equal(retrieved?.name, 'Kotlin Multiplatform');
    assert.equal(retrieved?.getBuildCommands().build, './gradlew build');

    const dummyProgram: ProgramIR = {
      version: 1,
      name: 'TestKotlinApp',
      screens: [],
      entryScreenId: 'scr1',
      steps: [],
    };

    const emitRes = retrieved?.emit(dummyProgram);
    assert.equal(emitRes?.artifacts.length, 1);
    assert.equal(emitRes?.artifacts[0].path, 'FlowForgeApp.kt');
    assert.ok(emitRes?.artifacts[0].content.includes('package com.flowforge.app'));
  } finally {
    // Limpeza para não poluir testes posteriores
    defaultBackendRegistry.unregister('kotlin');
  }

  assert.equal(defaultBackendRegistry.has('kotlin'), false);
});
