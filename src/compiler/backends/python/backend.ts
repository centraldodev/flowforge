import type { Diagnostic } from '../../diagnostics';
import type { InstructionIR, ProgramIR } from '../../ir';
import type {
  BackendBuildCommands,
  BackendCapability,
  BackendEmitResult,
  CompilerBackend,
  GeneratedArtifact,
} from '../types';
import { generatePythonProgram } from './codegen';
import { PYTHON_EMBEDDED_RUNTIME } from './runtimeTemplate';

export class PythonBackend implements CompilerBackend {
  readonly id = 'python';
  readonly name = 'Python';
  readonly version = '1.0.0';
  readonly targetLanguage = 'python';
  readonly capabilities = new Set<BackendCapability>([
    'control_flow',
    'state',
    'async',
    'adapters',
    'delay',
    'notifications',
    'ui_tree',
    'portable_operations',
  ]);

  validateCompatibility(program: ProgramIR): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const checkInstruction = (inst: InstructionIR) => {
      if (
        inst.kind === 'adapter_call' &&
        inst.adapter === 'api' &&
        inst.payload.mode?.kind === 'literal' &&
        inst.payload.mode.value === 'real'
      ) {
        diagnostics.push({
          code: 'UNSUPPORTED_REAL_HTTP',
          severity: 'error',
          message: 'HTTP real exige backend TypeScript nesta fase.',
        });
      }
      if (inst.kind === 'call_operation') {
        const op = inst.operation;
        // Se a operação for um código JS inseguro legado
        if (op === 'legacy_js_eval') {
          diagnostics.push({
            code: 'UNSUPPORTED_LEGACY_JS_EVAL',
            severity: 'error',
            message:
              'Operações de eval textual em JavaScript legado não são suportadas pelo backend Python.',
          });
        }
      } else if (inst.kind === 'sequence') {
        for (const sub of inst.instructions) checkInstruction(sub);
      } else if (inst.kind === 'conditional') {
        for (const sub of inst.thenBranch) checkInstruction(sub);
        if (inst.elseBranch) for (const sub of inst.elseBranch) checkInstruction(sub);
      } else if (inst.kind === 'try_catch') {
        for (const sub of inst.body) checkInstruction(sub);
        for (const sub of inst.catchBranch) checkInstruction(sub);
      } else if (inst.kind === 'switch') {
        for (const c of inst.cases) {
          for (const sub of c.branch) checkInstruction(sub);
        }
        if (inst.defaultBranch) {
          for (const sub of inst.defaultBranch) checkInstruction(sub);
        }
      }
    };

    for (const scr of program.screens) {
      for (const [_, insts] of Object.entries(scr.handlers)) {
        for (const inst of insts) {
          checkInstruction(inst);
        }
      }
    }

    return diagnostics;
  }

  emit(program: ProgramIR, _options?: Record<string, unknown>): BackendEmitResult {
    const diagnostics = this.validateCompatibility(program);
    const code = generatePythonProgram(program);
    const artifact = this.format({
      path: 'program.py',
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
        path: 'runtime.py',
        content: PYTHON_EMBEDDED_RUNTIME,
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
      install: 'pip install -r requirements.txt',
      test: 'python3 -m unittest',
      run: 'python3 app.py',
    };
  }
}

export const pythonBackend = new PythonBackend();
