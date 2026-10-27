import type { ExecutionContext } from './types';
import type { DebugFrame, DebuggerState, DebuggerStatus, StepDebugInfo } from './debuggerTypes';

type Listener = (state: DebuggerState) => void;

/**
 * Controlador do Depurador Visual com suporte a Breakpoints, Passo a Passo e Time-Travel Trace.
 */
export class VisualDebugger {
  private breakpoints = new Set<string>();
  private frames: DebugFrame[] = [];
  private status: DebuggerStatus = 'idle';
  private currentBlockId: string | null = null;
  private currentStepIndex = 0;
  private selectedFrameIndex: number | null = null;
  private errorMessage?: string;

  private stepOverMode = false;
  private pausedResolver: (() => void) | null = null;
  private stopSignal = false;
  private listeners = new Set<Listener>();

  constructor(initialBreakpoints: string[] = []) {
    for (const bp of initialBreakpoints) {
      this.breakpoints.add(bp);
    }
  }

  // --- Gerenciamento de Breakpoints ---

  public toggleBreakpoint(blockId: string): boolean {
    const has = this.breakpoints.has(blockId);
    if (has) {
      this.breakpoints.delete(blockId);
    } else {
      this.breakpoints.add(blockId);
    }
    this.notify();
    return !has;
  }

  public setBreakpoint(blockId: string, enabled = true): void {
    if (enabled) {
      this.breakpoints.add(blockId);
    } else {
      this.breakpoints.delete(blockId);
    }
    this.notify();
  }

  public hasBreakpoint(blockId: string): boolean {
    return this.breakpoints.has(blockId);
  }

  public clearBreakpoints(): void {
    this.breakpoints.clear();
    this.notify();
  }

  public getBreakpoints(): string[] {
    return Array.from(this.breakpoints);
  }

  // --- Início e Fim de Execução ---

  public startExecution(isStepMode = false): void {
    this.frames = [];
    this.status = isStepMode ? 'paused' : 'running';
    this.stepOverMode = isStepMode;
    this.currentBlockId = null;
    this.currentStepIndex = 0;
    this.selectedFrameIndex = null;
    this.errorMessage = undefined;
    this.stopSignal = false;
    this.pausedResolver = null;
    this.notify();
  }

  public completeExecution(): void {
    if (this.status !== 'stopped') {
      this.status = 'completed';
    }
    this.notify();
  }

  public failExecution(err: unknown): void {
    if (this.status === 'stopped' || this.stopSignal) {
      return;
    }
    this.status = 'error';
    this.errorMessage = err instanceof Error ? err.message : String(err);
    this.notify();
  }

  // --- Controles de Depuração ---

  /** Avança um único passo e pausa no próximo */
  public step(): void {
    if (this.status === 'paused' && this.pausedResolver) {
      this.stepOverMode = true;
      const resolve = this.pausedResolver;
      this.pausedResolver = null;
      this.status = 'running';
      this.notify();
      resolve();
    }
  }

  /** Continua a execução normalmente até o próximo breakpoint */
  public continue(): void {
    if (this.status === 'paused' && this.pausedResolver) {
      this.stepOverMode = false;
      const resolve = this.pausedResolver;
      this.pausedResolver = null;
      this.status = 'running';
      this.notify();
      resolve();
    }
  }

  /** Força uma pausa no próximo bloco executado */
  public pause(): void {
    this.stepOverMode = true;
    this.notify();
  }

  /** Interrompe imediatamente a execução atual */
  public stop(): void {
    this.stopSignal = true;
    this.status = 'stopped';
    if (this.pausedResolver) {
      const resolve = this.pausedResolver;
      this.pausedResolver = null;
      resolve();
    }
    this.notify();
  }

  /** Reseta o estado completo do depurador */
  public reset(): void {
    this.stop();
    this.status = 'idle';
    this.frames = [];
    this.currentBlockId = null;
    this.currentStepIndex = 0;
    this.selectedFrameIndex = null;
    this.errorMessage = undefined;
    this.notify();
  }

  // --- Time Travel Trace ---

  /** Seleciona um frame anterior ou atual para inspeção profunda */
  public seekFrame(index: number | null): void {
    if (index === null || (index >= 0 && index < this.frames.length)) {
      this.selectedFrameIndex = index;
      this.notify();
    }
  }

  public getSelectedFrame(): DebugFrame | null {
    if (this.selectedFrameIndex !== null && this.frames[this.selectedFrameIndex]) {
      return this.frames[this.selectedFrameIndex];
    }
    if (this.frames.length > 0) {
      return this.frames[this.frames.length - 1];
    }
    return null;
  }

  // --- Hooks do Interpretador ---

  /**
   * Chamado antes de executar um bloco ou instrução relevante.
   * Se o bloco for um breakpoint ou estiver em modo passo a passo, pausa e aguarda.
   */
  public async beforeStep(info: StepDebugInfo, context: ExecutionContext): Promise<void> {
    if (this.stopSignal) {
      throw new Error('Execução interrompida pelo depurador.');
    }

    this.currentStepIndex++;
    this.currentBlockId = info.blockId;

    const frame = this.createFrame('before', info, context);
    this.frames.push(frame);

    const isBp = this.hasBreakpoint(info.blockId);
    const shouldPause = isBp || this.stepOverMode;

    if (shouldPause) {
      this.status = 'paused';
      this.selectedFrameIndex = this.frames.length - 1;
      this.notify();

      await new Promise<void>((resolve) => {
        this.pausedResolver = resolve;
      });

      if (this.stopSignal) {
        throw new Error('Execução interrompida pelo depurador.');
      }
    } else {
      this.notify();
    }
  }

  /**
   * Chamado após a execução de um bloco para registrar saídas atualizadas no frame.
   */
  public async afterStep(info: StepDebugInfo, context: ExecutionContext): Promise<void> {
    if (this.stopSignal) {
      throw new Error('Execução interrompida pelo depurador.');
    }

    const frame = this.createFrame('after', info, context);
    this.frames.push(frame);

    // Se estava em stepOverMode, podemos pausar aqui após a execução do bloco
    if (this.stepOverMode) {
      this.status = 'paused';
      this.selectedFrameIndex = this.frames.length - 1;
      this.notify();

      await new Promise<void>((resolve) => {
        this.pausedResolver = resolve;
      });

      if (this.stopSignal) {
        throw new Error('Execução interrompida pelo depurador.');
      }
    } else {
      this.notify();
    }
  }

  private createFrame(
    phase: 'before' | 'after',
    info: StepDebugInfo,
    context: ExecutionContext,
  ): DebugFrame {
    return {
      stepIndex: this.currentStepIndex,
      blockId: info.blockId,
      blockKind: info.blockKind,
      blockLabel: info.blockLabel,
      phase,
      inputs: { ...context.inputs },
      outputs: { ...context.outputs },
      variables: { ...context.variables },
      store: { ...context.store },
      screen: context.screen,
      timestamp: Date.now(),
      message: info.message,
    };
  }

  // --- Subscrição de Estado ---

  public getState(): DebuggerState {
    return {
      status: this.status,
      breakpoints: Array.from(this.breakpoints),
      currentBlockId: this.currentBlockId,
      currentStepIndex: this.currentStepIndex,
      frames: [...this.frames],
      selectedFrameIndex: this.selectedFrameIndex,
      errorMessage: this.errorMessage,
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
