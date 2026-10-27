export const gatewaySource = String.raw`import { fail, GatewayError } from './errors.mjs';
import { object } from './guards.mjs';
import { readLimited } from './messages.mjs';
import { executeHttpRequest } from './transport.mjs';
import { serveStatic } from './static.mjs';
export function createHttpGateway(options = {}) {
  const env = options.env || process.env;
  return async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const secretSetup = pathname === '/__flowforge/secrets' && options.preview;
    if (pathname !== '/__flowforge/http' && !secretSetup) {
      if (await serveStatic(req, res, pathname, options.staticRoot)) return;
      res.statusCode = 404; res.end('Rota não encontrada.'); return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.method !== 'POST') fail('METHOD_NOT_ALLOWED', 'Use POST.', 405);
      if (req.headers['sec-fetch-site'] === 'cross-site') fail('ORIGIN_DENIED', 'Origem não permitida.', 403);
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail('ORIGIN_DENIED', 'Origem não permitida.', 403); }
        if (origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol)) fail('ORIGIN_DENIED', 'Origem não permitida.', 403);
      }
      if (!req.headers['content-type']?.startsWith('application/json')) fail('INVALID_CONTENT_TYPE', 'Use application/json.', 415);
      const length = Number(req.headers['content-length'] || 0);
      if (length > 1024 * 1024) fail('PAYLOAD_TOO_LARGE', 'O corpo deve ter no máximo 1 MB.', 413);
      let input;
      try { input = JSON.parse(await readLimited(req, 1024 * 1024)); } catch (error) { if (error instanceof GatewayError) throw error; fail('INVALID_JSON', 'Mensagem inválida.'); }
      if (secretSetup) {
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL('http://' + req.headers.host).hostname)) fail('ORIGIN_DENIED', 'Configure credenciais apenas no editor local.', 403);
        if (!object(input) || typeof input.name !== 'string' || !/^FLOWFORGE_SECRET_[A-Z0-9_]+$/.test(input.name) || typeof input.value !== 'string' || !input.value || input.value.length > 8192 || /[\r\n]/.test(input.value)) fail('INVALID_SECRET', 'Referência ou valor de credencial inválido.');
        env[input.name] = input.value;
        res.end(JSON.stringify({ configured: true })); return;
      }
      if (!object(input) || typeof input.id !== 'string') fail('INVALID_INPUT', 'Identificador de requisição obrigatório.');
      if (!options.preview && Object.hasOwn(input, 'manifest')) fail('MANIFEST_NOT_ALLOWED', 'Configuração de conexão não pode ser enviada pelo cliente.');
      const manifest = options.preview ? input.manifest : options.manifest;
      if (!object(manifest) || !Array.isArray(manifest.requests)) fail('MISSING_MANIFEST', 'Configure as conexões do projeto.', 503);
      const spec = manifest.requests.find((r) => r.id === input.id);
      if (!spec) fail('REQUEST_NOT_FOUND', 'Requisição não cadastrada no projeto.', 404);
      const controller = new AbortController();
      const cancel = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', cancel);
      try {
        const result = await executeHttpRequest(spec, input, {
          env, environment: env.FLOWFORGE_ENV || manifest.environment || 'development',
          fetchImpl: options.fetchImpl, signal: controller.signal,
        });
        res.end(JSON.stringify(result));
      } finally { res.off('close', cancel); }
    } catch (error) {
      res.statusCode = error instanceof GatewayError ? error.status : 500;
      res.end(JSON.stringify({ error: { code: error instanceof GatewayError ? error.code : 'GATEWAY_ERROR',
        message: error instanceof GatewayError ? error.message : 'Falha interna na integração HTTP.', status: error.upstreamStatus } }));
    }
  };
}`;
