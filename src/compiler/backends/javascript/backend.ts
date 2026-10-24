import type { Diagnostic } from '../../diagnostics';
import type { ProgramIR } from '../../ir';
import type {
  BackendBuildCommands,
  BackendCapability,
  BackendEmitResult,
  CompilerBackend,
  GeneratedArtifact,
} from '../types';
import { generateProgramCode } from './codegen';
import { EMBEDDED_RUNTIME } from './runtimeTemplate';

export class JavaScriptBackend implements CompilerBackend {
  readonly id = 'javascript';
  readonly name = 'JavaScript / TypeScript';
  readonly version = '1.0.0';
  readonly targetLanguage = 'typescript';
  readonly capabilities = new Set<BackendCapability>([
    'control_flow',
    'state',
    'async',
    'adapters',
    'delay',
    'notifications',
    'ui_tree',
    'portable_operations',
    'legacy_js_eval',
  ]);

  validateCompatibility(_program: ProgramIR): Diagnostic[] {
    return [];
  }

  emit(program: ProgramIR, _options?: Record<string, unknown>): BackendEmitResult {
    const diagnostics = this.validateCompatibility(program);
    const code = generateProgramCode(program);
    const artifact = this.format({
      path: 'src/program.ts',
      content: code,
      isEntrypoint: true,
    });

    return {
      artifacts: [artifact],
      diagnostics,
    };
  }

  getRuntimeFiles(): GeneratedArtifact[] {
    return [
      {
        path: 'src/runtime.ts',
        content: EMBEDDED_RUNTIME,
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
      install: 'npm install',
      build: 'tsc --noEmit && vite build',
      test: 'npm test',
      run: 'npm run dev',
    };
  }
}

export const javascriptBackend = new JavaScriptBackend();
