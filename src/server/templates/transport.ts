export const transportSource = String.raw`import { fail, GatewayError } from './errors.mjs';
import { object } from './guards.mjs';
import { definition } from './configuration.mjs';
import { readLimited, redact, redactData } from './messages.mjs';
export async function executeHttpRequest(spec, input = {}, options = {}) {
  const environment = options.environment || 'development';
  if (!['development', 'production'].includes(environment)) fail('INVALID_ENVIRONMENT', 'Ambiente HTTP inválido.', 503);
  const { c, target } = definition(spec, environment);
  const env = options.env || process.env;
  const secret = c.auth === 'none' ? '' : env[c.secretEnv];
  if (c.auth !== 'none' && (!secret || /[\r\n]/.test(secret))) fail('MISSING_SECRET', 'Configure a credencial da conexão no ambiente do servidor.', 503);
  const headers = Object.fromEntries(spec.headers.map((h) => [h.key, h.value]));
  if (c.auth === 'bearer') headers.Authorization = 'Bearer ' + secret;
  if (c.auth === 'apiKey') headers[c.headerName] = secret;
  const dynamicQuery = input.query === '' || input.query === undefined ? {} : input.query;
  if (!object(dynamicQuery)) fail('INVALID_INPUT', 'Os parâmetros devem ser um objeto.');
  const allowedQuery = new Set(spec.query.map((row) => row.key));
  if (Object.keys(dynamicQuery).some((key) => !allowedQuery.has(key))) fail('INVALID_INPUT', 'Parâmetro não declarado na requisição.');
  for (const row of spec.query) {
    const value = Object.hasOwn(dynamicQuery, row.key) ? dynamicQuery[row.key] : row.value;
    if (!['string', 'number', 'boolean'].includes(typeof value)) fail('INVALID_INPUT', 'Parâmetro deve ser texto, número ou booleano.');
    target.searchParams.append(row.key, String(value));
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, c.timeoutMs);
  try {
    const request = { method: spec.method, headers, redirect: 'error', signal: controller.signal };
    if (!['GET', 'DELETE'].includes(spec.method)) {
      request.body = JSON.stringify(input.body === undefined || input.body === '' ? spec.body : input.body);
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    }
    const response = await (options.fetchImpl || fetch)(target, request);
    if (!response.ok) { await response.body?.cancel(); fail('HTTP_STATUS', 'O serviço externo respondeu com erro HTTP ' + response.status + '.', 502, response.status); }
    const raw = response.body ? await readLimited(response.body, 2 * 1024 * 1024, controller) : '';
    let data = null;
    if (spec.responseType === 'text') data = redact(raw, secret);
    else if (raw && response.status !== 204) {
      try { data = redactData(JSON.parse(raw), secret); } catch { fail('INVALID_RESPONSE', 'O serviço externo não retornou JSON válido.', 502); }
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (timedOut) fail('HTTP_TIMEOUT', 'O serviço externo excedeu o tempo limite.', 504);
    if (controller.signal.aborted) fail('HTTP_CANCELLED', 'Requisição cancelada.', 499);
    fail('HTTP_NETWORK', 'Não foi possível conectar ao serviço externo. Verifique a conexão e a URL configurada.', 502);
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort); }
}
`;
