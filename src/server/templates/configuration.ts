export const configurationSource = String.raw`import { fail } from './errors.mjs';
import { object, pairs } from './guards.mjs';
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const reserved = /^(authorization|proxy-authorization|cookie|host|connection|content-length|transfer-encoding|upgrade|x-api-key)$/i;
export function definition(spec, environment) {
  if (!object(spec) || !methods.has(spec.method) || typeof spec.path !== 'string' || !spec.path.startsWith('/') || spec.path.startsWith('//') || /[\\?#\r\n]/.test(spec.path))
    fail('INVALID_CONFIGURATION', 'Método ou caminho HTTP inválido.');
  const c = spec.connection;
  if (!object(c) || !['none', 'bearer', 'apiKey'].includes(c.auth)) fail('INVALID_CONFIGURATION', 'Conexão HTTP inválida.');
  let base;
  try { base = new URL(c[environment]); } catch { fail('MISSING_ENVIRONMENT', 'Configure a URL da conexão para o ambiente selecionado.', 503); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    fail('INVALID_CONFIGURATION', 'A URL base deve usar HTTP/HTTPS sem credenciais ou parâmetros.');
  if (!Number.isInteger(c.timeoutMs) || c.timeoutMs < 100 || c.timeoutMs > 120000) fail('INVALID_CONFIGURATION', 'Tempo limite inválido.');
  if (!pairs(spec.headers) || !pairs(spec.query) || !object(spec.body) || !['json', 'text'].includes(spec.responseType)) fail('INVALID_CONFIGURATION', 'Parâmetros HTTP inválidos.');
  if (spec.headers.some((h) => !/^[A-Za-z0-9-]+$/.test(h.key) || reserved.test(h.key) || /[\r\n]/.test(h.value))) fail('INVALID_CONFIGURATION', 'Cabeçalho reservado ou inválido.');
  if (c.auth !== 'none' && !/^FLOWFORGE_SECRET_[A-Z0-9_]+$/.test(c.secretEnv)) fail('INVALID_CONFIGURATION', 'Referência de segredo inválida.');
  if (c.auth === 'apiKey' && (!/^[A-Za-z0-9-]+$/.test(c.headerName) || /^(host|connection|content-length|transfer-encoding|cookie|proxy-authorization|upgrade)$/i.test(c.headerName))) fail('INVALID_CONFIGURATION', 'Cabeçalho de API key inválido.');
  const basePath = base.pathname.replace(/\/$/, '');
  const target = new URL(base.origin + basePath + spec.path);
  if (target.origin !== base.origin || (basePath && !target.pathname.startsWith(basePath + '/'))) fail('INVALID_CONFIGURATION', 'O caminho deve permanecer dentro da URL base.');
  return { c, target };
}
`;
