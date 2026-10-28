import type { Graph } from '../../engine/types';

/** Não envia valores de entradas, credenciais ou tokens para o terminal. */
export function sanitizeTerminalText(message: string, inputs: Record<string, string>): string {
  let safe = message
    .replace(/\b(?:ff_sess_|ya29\.)[A-Za-z0-9_.-]+/g, '[oculto]')
    .replace(/(bearer\s+)[^\s]+/gi, '$1[oculto]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[oculto]@')
    .replace(
      /((?:password|senha|token|secret|api[_-]?key|authorization)\s*[=:]\s*)[^\s&,;]+/gi,
      '$1[oculto]',
    );
  for (const value of Object.values(inputs)
    .filter((item) => item.length >= 3)
    .sort((a, b) => b.length - a.length))
    safe = safe.split(value).join('[oculto]');
  return safe;
}

export function playgroundLoginFields(
  graph: Graph,
  screen: string,
): { emailId?: string; passwordId?: string } | null {
  const logins = graph.nodes.filter(
    (node) =>
      node.data.kind === 'auth' &&
      (!node.data.config.mode || node.data.config.mode === 'login') &&
      (!node.data.config.provider || node.data.config.provider === 'email') &&
      (!node.data.config.screenId || node.data.config.screenId === screen),
  );
  for (const login of logins) {
    const source = (port: string) => {
      const edge = graph.edges.find(
        (item) => item.target === login.id && item.targetHandle === port,
      );
      const node = graph.nodes.find(
        (item) =>
          item.id === edge?.source &&
          item.data.kind === 'input' &&
          item.data.config.screenId === screen,
      );
      return node?.id;
    };
    const emailId = source('email');
    const passwordId = source('password');
    if (login.data.config.screenId === screen || emailId || passwordId)
      return { emailId, passwordId };
  }
  return null;
}
