import type { Block, Graph } from './types';

export type HttpEntries = { key: string; value: string }[];
export type HttpRequestDefinition = {
  id: string;
  method: string;
  path: string;
  query: HttpEntries;
  headers: HttpEntries;
  body: Record<string, string>;
  responseType: 'json' | 'text';
  connection: {
    development: string;
    production: string;
    auth: string;
    secretEnv: string;
    headerName: string;
    timeoutMs: number;
  };
};
export type HttpManifest = {
  environment: 'development' | 'production';
  requests: HttpRequestDefinition[];
};

export function parseHttpEntries(value = '[]'): HttpEntries {
  const rows: unknown = JSON.parse(value || '[]');
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row.key !== 'string' || typeof row.value !== 'string')
  )
    throw new Error('Use pares de nome e valor válidos.');
  return rows.filter((row) => row.key.trim() !== '');
}

export function httpConnection(graph: Graph, apiId: string): Block | undefined {
  const wire = graph.edges.find(
    (edge) => edge.target === apiId && edge.targetHandle === 'connection',
  );
  return graph.nodes.find(
    (node) => node.id === wire?.source && node.data.kind === 'httpConnection',
  );
}

export function buildHttpManifest(graph: Graph): HttpManifest {
  return {
    environment: graph.httpEnvironment ?? 'development',
    requests: graph.nodes
      .filter((node) => node.data.kind === 'api' && node.data.config.mode === 'real')
      .map((node) => {
        const resource = httpConnection(graph, node.id);
        if (!resource)
          throw new Error(`Conecte uma Conexão HTTP à requisição "${node.data.label}".`);
        const c = resource.data.config;
        const config = node.data.config;
        return {
          id: node.id,
          method: config.method || 'GET',
          path: config.url || '/',
          query: parseHttpEntries(config.query),
          headers: parseHttpEntries(c.headers),
          body: Object.fromEntries(
            parseHttpEntries(config.bodyFields).map(({ key, value }) => [key, value]),
          ),
          responseType: config.responseType === 'text' ? 'text' : 'json',
          connection: {
            development: c.baseUrl || '',
            production: c.productionBaseUrl || '',
            auth: c.auth || 'none',
            secretEnv: c.secretEnv || '',
            headerName: c.headerName || 'X-API-Key',
            timeoutMs: Number(c.timeoutMs || 10000),
          },
        };
      }),
  };
}

export function httpConfigurationIssues(
  graph: Graph,
): { nodeId: string; field: string; message: string }[] {
  const issues: { nodeId: string; field: string; message: string }[] = [];
  const add = (node: Block, field: string, message: string) =>
    issues.push({ nodeId: node.id, field, message: `${node.data.label}: ${message}` });
  if (graph.httpEnvironment && !['development', 'production'].includes(graph.httpEnvironment))
    issues.push({ nodeId: '', field: 'httpEnvironment', message: 'Ambiente HTTP inválido.' });
  for (const node of graph.nodes) {
    const c = node.data.config;
    if (node.data.kind === 'httpConnection') {
      for (const key of ['baseUrl', 'productionBaseUrl']) {
        if (!c[key] && key === 'productionBaseUrl' && graph.httpEnvironment !== 'production')
          continue;
        try {
          const url = new URL(c[key]);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
          )
            throw new Error();
        } catch {
          add(
            node,
            key,
            'informe uma URL base HTTP/HTTPS sem credenciais, parâmetros ou fragmentos.',
          );
        }
      }
      if (
        !Number.isInteger(Number(c.timeoutMs || 10000)) ||
        Number(c.timeoutMs || 10000) < 100 ||
        Number(c.timeoutMs || 10000) > 120000
      )
        add(node, 'timeoutMs', 'o tempo limite deve estar entre 100 e 120000 ms.');
      if (c.auth && !['none', 'bearer', 'apiKey'].includes(c.auth))
        add(node, 'auth', 'autenticação HTTP inválida.');
      if (c.auth && c.auth !== 'none' && !/^FLOWFORGE_SECRET_[A-Z0-9_]+$/.test(c.secretEnv || ''))
        add(
          node,
          'secretEnv',
          'use o nome de uma variável FLOWFORGE_SECRET_..., nunca o valor da chave.',
        );
      if (
        c.auth === 'apiKey' &&
        (!/^[A-Za-z0-9-]+$/.test(c.headerName || '') ||
          /^(host|connection|content-length|transfer-encoding|cookie|proxy-authorization|upgrade)$/i.test(
            c.headerName,
          ))
      )
        add(node, 'headerName', 'informe o nome do cabeçalho da API key.');
      try {
        for (const row of parseHttpEntries(c.headers)) {
          if (
            !/^[A-Za-z0-9-]+$/.test(row.key) ||
            /^(authorization|proxy-authorization|cookie|host|connection|content-length|transfer-encoding|upgrade|x-api-key)$/i.test(
              row.key,
            ) ||
            /[\r\n]/.test(row.value)
          )
            add(
              node,
              'headers',
              'cabeçalho inválido ou reservado. Credenciais devem usar referência de segredo.',
            );
        }
      } catch {
        add(node, 'headers', 'cabeçalhos inválidos.');
      }
    }
    if (node.data.kind === 'api' && c.mode === 'real') {
      if (!httpConnection(graph, node.id))
        add(node, 'connectionId', 'selecione ou conecte um bloco Conexão HTTP.');
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(c.method || 'GET'))
        add(node, 'method', 'método HTTP inválido.');
      if (!c.url?.startsWith('/') || c.url.startsWith('//') || /[\\?#\r\n]/.test(c.url))
        add(node, 'url', 'use um caminho como /clientes; parâmetros vão na lista de parâmetros.');
      for (const field of ['query', 'bodyFields']) {
        try {
          parseHttpEntries(c[field]);
        } catch {
          add(node, field, 'use pares de nome e valor válidos.');
        }
      }
    }
  }
  return issues;
}
