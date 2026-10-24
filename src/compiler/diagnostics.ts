export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  nodeId?: string;
  portId?: string;
};

export type Result<T, E = Diagnostic[]> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; error: E; diagnostics: Diagnostic[] };

export function ok<T>(value: T, diagnostics: Diagnostic[] = []): Result<T> {
  return { ok: true, value, diagnostics };
}

export function err<T = never>(diagnostics: Diagnostic[]): Result<T> {
  return { ok: false, error: diagnostics, diagnostics };
}
