import { catalog, interfaceKinds } from './catalog';
import { isExecOutput, ports } from './ports';
import { reachableActions, screenRoutes } from './routes';
import type { Block, Graph } from './types';

const isScreen = (g: Graph, id: string) =>
  g.nodes.some((x) => x.id === id && x.data.kind === 'screen');

function isJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function validateScreenRoutes(g: Graph, n: Block, errors: string[]) {
  try {
    const routes = screenRoutes(n);
    const available = reachableActions(g, n.id);
    for (const r of routes) {
      if (!available.some((a) => a.id === r.trigger))
        errors.push(`${n.data.label}: escolha um evento conectado a um botão desta tela.`);
      if (!isScreen(g, r.target)) errors.push(`${n.data.label}: destino da transição não existe.`);
    }
    const overlapping = routes.some((r, i) =>
      routes
        .slice(i + 1)
        .some(
          (t) =>
            t.trigger === r.trigger &&
            (t.when === r.when || t.when === 'always' || r.when === 'always'),
        ),
    );
    if (overlapping) errors.push(`${n.data.label}: transições com condições sobrepostas.`);
  } catch {
    errors.push(`${n.data.label}: transições inválidas.`);
  }
}

function validateBlock(g: Graph, n: Block, errors: string[]) {
  const { kind, label, config: c } = n.data;

  if (interfaceKinds.includes(kind) && !isScreen(g, c.screenId))
    errors.push(`${label}: selecione uma tela.`);

  switch (kind) {
    case 'screen':
      validateScreenRoutes(g, n, errors);
      break;
    case 'navigate':
      if (!isScreen(g, c.target)) errors.push(`${label}: selecione a tela de destino.`);
      break;
    case 'constant':
      if (c.valueType === 'json' && !isJson(c.value)) errors.push(`${label}: JSON inválido.`);
      if (c.valueType === 'number' && !Number.isFinite(Number(c.value)))
        errors.push(`${label}: informe um número.`);
      break;
    case 'validation':
      if (c.rule === 'minLength' && (!Number.isFinite(Number(c.minimum)) || Number(c.minimum) < 0))
        errors.push(`${label}: tamanho mínimo inválido.`);
      break;
    case 'api':
    case 'database':
      if (!isJson(c.mock)) errors.push(`${label}: JSON inválido.`);
      break;
  }
}

/** Retorna a lista de problemas do grafo (vazia quando o fluxo é válido). */
export function validate(g: Graph): string[] {
  const errors: string[] = [];

  if (new Set(g.nodes.map((n) => n.id)).size !== g.nodes.length)
    errors.push('IDs de blocos duplicados.');

  for (const n of g.nodes) {
    if (!catalog[n.data.kind]) {
      errors.push('Tipo de bloco desconhecido.');
      continue;
    }
    validateBlock(g, n, errors);
  }

  for (const e of g.edges) {
    const a = g.nodes.find((n) => n.id === e.source);
    const b = g.nodes.find((n) => n.id === e.target);
    if (!a || !b) {
      errors.push('Conexão com bloco inexistente.');
      continue;
    }
    if (
      !ports(a.data.kind).outputs.includes(e.sourceHandle || '') ||
      !ports(b.data.kind).inputs.includes(e.targetHandle || '')
    )
      errors.push('Porta de conexão inválida.');
    if ((e.targetHandle === 'exec') !== isExecOutput(e.sourceHandle))
      errors.push('Conecte ações a ações e dados a dados.');
  }

  return [...new Set(errors)];
}
