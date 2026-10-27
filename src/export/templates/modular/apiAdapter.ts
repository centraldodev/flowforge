export const apiAdapterSource = `export class MockApiAdapter {
  async execute(action, payload, context) {
    if (payload.mode === 'real') {
      const response = await fetch('/__flowforge/http', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: context.signal,
        body: JSON.stringify({ id: payload.blockId, body: payload.body, query: payload.query })
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Backend HTTP indisponível. Inicie o servidor do projeto exportado.');
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Falha na integração HTTP.'), { code: result.error?.code, status: result.error?.status });
      return result;
    }
    if (payload.mock && typeof payload.mock === "string") {
      try {
        return JSON.parse(payload.mock);
      } catch {}
    }
    return { ok: true, status: 200, data: payload.body ?? null };
  }
}

`;
