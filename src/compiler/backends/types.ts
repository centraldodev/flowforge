import type { Diagnostic } from '../diagnostics';
import type { ProgramIR } from '../ir';

export type BackendCapability =
  | 'control_flow'
  | 'state'
  | 'async'
  | 'adapters'
  | 'delay'
  | 'notifications'
  | 'ui_tree'
  | 'portable_operations'
  | 'legacy_js_eval';

export interface GeneratedArtifact {
  path: string;
  content: string;
  isEntrypoint?: boolean;
  isRuntime?: boolean;
}

export interface BackendBuildCommands {
  install?: string;
  build?: string;
  test?: string;
  run?: string;
}

export interface BackendEmitResult {
  artifacts: GeneratedArtifact[];
  diagnostics: Diagnostic[];
}

/**
 * Contrato formal para backends do compilador FlowForge (Fase 10).
 * Qualquer nova linguagem (Kotlin, Swift, Dart, Go, C#, Rust) implementa
 * esta interface sem alterar o compilador central ou a UI.
 */
export interface CompilerBackend {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly targetLanguage: string;
  readonly capabilities: ReadonlySet<BackendCapability>;

  /** Valida se a ProgramIR contém recursos não suportados pelo backend */
  validateCompatibility(program: ProgramIR): Diagnostic[];

  /** Emite os artefatos de código para o backend a partir da ProgramIR */
  emit(program: ProgramIR, options?: Record<string, unknown>): BackendEmitResult;

  /** Retorna os arquivos de runtime estáticos ou dinâmicos necessários */
  getRuntimeFiles(): GeneratedArtifact[];

  /** Formata o artefato gerado segundo as regras da linguagem */
  format(artifact: GeneratedArtifact): GeneratedArtifact;

  /** Retorna comandos padronizados de build e teste para o backend */
  getBuildCommands(): BackendBuildCommands;
}
