export const messagesSource = String.raw`import { fail } from './errors.mjs';
import { object } from './guards.mjs';
export async function readLimited(stream, maxBytes, controller) {
  let size = 0; const chunks = [];
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maxBytes) { controller?.abort(); fail('PAYLOAD_TOO_LARGE', 'O tamanho máximo da mensagem foi excedido.', 413); }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function redact(value, secret) {
  return secret ? value.split(secret).join('[REDACTED]') : value;
}
export function redactData(value, secret) {
  if (typeof value === 'string') return redact(value, secret);
  if (Array.isArray(value)) return value.map((item) => redactData(item, secret));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key, secret), redactData(item, secret)]));
  return value;
}
`;
