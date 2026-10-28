export const runtimeTypesSource = `export type Values = Record<string, unknown>;
export type Notification = { message: string; type: string; duration?: number };
export type Trace = { id: string; label: string; message: string };
export type ActionAdapter = { execute(action: string, payload: Values, context: Context): Promise<unknown> };
export type DelayAdapter = { execute(duration: number, signal?: AbortSignal): Promise<void> };
export type SubflowAdapter = { execute(subflowId: string, inputs: Values, context: Context, definition?: unknown): Promise<unknown> };
export type Adapters = {
  auth: ActionAdapter;
  api: ActionAdapter;
  database: ActionAdapter;
  delay: DelayAdapter;
  email?: ActionAdapter;
  storage?: ActionAdapter;
  webhook?: ActionAdapter;
  task?: ActionAdapter;
  payment?: ActionAdapter;
  realtime?: ActionAdapter;
  subflow?: SubflowAdapter;
  [key: string]: unknown;
};
export type Context = {
  inputs: Values; store: Values; variables: Values; outputs: Values;
  notifications: Notification[]; trace: Trace[]; logs: string[];
  screen?: string; signal?: AbortSignal; stepCount: number; maxSteps: number;
  adapters: Adapters; invoke(id: string, scope?: Context): Promise<unknown>;
};
export type Options = Omit<Partial<Context>, 'adapters' | 'invoke'> & { adapters?: Partial<Adapters>; fastDelay?: boolean };
export type Workflow = (context: Context) => Promise<unknown>;
export type WorkflowRegistry = Record<string, () => Promise<{ default: Workflow }>>;
export type Result = { success: boolean; screen?: string; messages: string[]; trace: Trace[]; outputs: Values; store: Values; error?: Error };
`;
export const programSource = `import type { Context, Options, Result, Values } from '@flowforge/contracts/runtime';
import workflows from '../workflows/registry';
import { createContext } from './context';
import { entryScreenId } from './config';
export class FlowForgeProgram {
  readonly context: Context;
  private running = false;
  constructor(options: Options = {}) {
    this.context = createContext(options);
    this.context.screen ??= entryScreenId;
    this.context.invoke = async (id, scope) => {
      const load = workflows[id];
      if (!load) throw new Error('Fluxo não encontrado: ' + id);
      const workflow = await load();
      return workflow.default(scope || this.context);
    };
  }
  async dispatch(eventId: string, inputs: Values = {}): Promise<Result> {
    if (this.running) throw new Error('Aguarde a execução atual.');
    this.running = true;
    this.context.stepCount = 0;
    this.context.inputs = { ...this.context.inputs, ...inputs };
    this.context.trace = [{ id: eventId, label: 'Evento', message: 'Evento onClick disparado (' + eventId + ')' }];
    this.context.logs = []; this.context.notifications = []; this.context.variables = {}; this.context.outputs = {};
    let error: Error | undefined;
    try { await this.context.invoke(eventId); }
    catch (failure) { error = failure instanceof Error ? failure : new Error(String(failure)); }
    finally { this.running = false; }
    return { success: !error, screen: this.context.screen, messages: this.context.logs, trace: this.context.trace, outputs: this.context.outputs, store: this.context.store, error };
  }
  getState(): Values;
  getState(key: string): unknown;
  getState(key?: string) { return key === undefined ? this.context.store : this.context.store[key]; }
  getScreen() { return this.context.screen; }
  getTrace() { return this.context.trace; }
  getNotifications() { return this.context.notifications; }
  getLogs() { return this.context.logs; }
  reset(screen = entryScreenId) {
    if (this.running) throw new Error('Aguarde a execução atual.');
    Object.assign(this.context, { screen, inputs: {}, store: {}, variables: {}, outputs: {}, trace: [], logs: [], notifications: [], stepCount: 0 });
  }
}
export function createProgram(options: Options = {}) { return new FlowForgeProgram(options); }
`;
