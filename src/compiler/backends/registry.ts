import type { CompilerBackend } from './types';

/**
 * Registro extensível de backends do compilador FlowForge.
 */
export class BackendRegistry {
  private backends = new Map<string, CompilerBackend>();

  register(backend: CompilerBackend): void {
    this.backends.set(backend.id, backend);
  }

  get(id: string): CompilerBackend | undefined {
    return this.backends.get(id);
  }

  has(id: string): boolean {
    return this.backends.has(id);
  }

  list(): CompilerBackend[] {
    return Array.from(this.backends.values());
  }

  unregister(id: string): boolean {
    return this.backends.delete(id);
  }

  clear(): void {
    this.backends.clear();
  }
}

export const defaultBackendRegistry = new BackendRegistry();
