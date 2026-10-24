import { javascriptBackend } from './javascript/backend';
import { pythonBackend } from './python/backend';
import { defaultBackendRegistry } from './registry';

// Registra os backends padrão no registro do compilador
defaultBackendRegistry.register(javascriptBackend);
defaultBackendRegistry.register(pythonBackend);

export * from './javascript';
export * from './python';
export * from './registry';
export * from './types';
