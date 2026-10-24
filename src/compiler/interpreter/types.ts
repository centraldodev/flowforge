export type NotificationItem = {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
};

export type TraceItem = {
  id: string;
  label: string;
  message: string;
};

export interface AuthAdapter {
  execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown>;
}

export interface ApiAdapter {
  execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown>;
}

export interface DatabaseAdapter {
  execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown>;
}

export interface DelayAdapter {
  execute(durationMs: number, signal?: AbortSignal): Promise<void>;
}

export interface LegacyFunctionAdapter {
  execute(operation: string, args: unknown[], context: ExecutionContext): Promise<unknown>;
}

export type ExecutionAdapters = {
  auth: AuthAdapter;
  api: ApiAdapter;
  database: DatabaseAdapter;
  delay: DelayAdapter;
  legacyFunction?: LegacyFunctionAdapter;
};

export type ExecutionContext = {
  inputs: Record<string, unknown>;
  store: Record<string, unknown>;
  variables: Record<string, unknown>;
  screen?: string;
  outputs: Record<string, unknown>;
  notifications: NotificationItem[];
  logs: string[];
  trace: TraceItem[];
  stepCount: number;
  maxSteps: number;
  signal?: AbortSignal;
  adapters: ExecutionAdapters;
};

export type ExecutionResult = {
  success: boolean;
  screen?: string;
  trace: TraceItem[];
  notifications: NotificationItem[];
  messages: string[];
  outputs: Record<string, unknown>;
  store: Record<string, unknown>;
  error?: Error;
};
