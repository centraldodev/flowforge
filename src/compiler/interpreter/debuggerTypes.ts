/**
 * Tipos e interfaces do Depurador Visual e Time-Travel Trace (Fase 12)
 */

export type DebuggerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';

/** Snapshot imutável de um momento no tempo durante a execução */
export type DebugFrame = {
  stepIndex: number;
  blockId: string;
  blockKind?: string;
  blockLabel?: string;
  phase: 'before' | 'after';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  store: Record<string, unknown>;
  screen?: string;
  timestamp: number;
  message?: string;
};

/** Estado reativo do depurador visual */
export type DebuggerState = {
  status: DebuggerStatus;
  breakpoints: string[];
  currentBlockId: string | null;
  currentStepIndex: number;
  frames: DebugFrame[];
  selectedFrameIndex: number | null;
  errorMessage?: string;
};

/** Informações passadas aos hooks do depurador */
export type StepDebugInfo = {
  blockId: string;
  blockKind?: string;
  blockLabel?: string;
  message?: string;
};
