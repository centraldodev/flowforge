import type { Block, CustomPort, Graph, Kind, Link, ValueType } from './types';

export type SubflowPort = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  valueType?: ValueType;
  required?: boolean;
};

export type SubflowDefinition = {
  id: string;
  name: string;
  description?: string;
  parameters: SubflowPort[];
  returns: SubflowPort[];
  nodes: Block[];
  edges: Link[];
};

export type BlockPreset = {
  id: string;
  name: string;
  kind: Kind;
  version: number;
  author: 'official' | 'user';
  description?: string;
  config: Record<string, string>;
  ports?: CustomPort[];
};

export type RuleDefinition = {
  id: string;
  name: string;
  field: string;
  rule: 'required' | 'email' | 'minLength' | 'maxLength' | 'numeric' | 'regex';
  param?: string;
  message?: string;
};

export type RuleCollection = {
  id: string;
  name: string;
  targetEntity?: string;
  rules: RuleDefinition[];
};

export type CompositionManifest = {
  subflows: SubflowDefinition[];
  presets: BlockPreset[];
  rules: RuleCollection[];
};

/** Higieniza configurações antes de salvar como preset (nunca copia segredos em plain text) */
export function sanitizePresetConfig(config: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    const keyLower = k.toLowerCase();
    if (
      keyLower.includes('password') ||
      keyLower.includes('secret') ||
      keyLower.includes('token')
    ) {
      // Preserva apenas referências seguras
      if (v.startsWith('FLOWFORGE_SECRET_')) {
        sanitized[k] = v;
      }
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/** Cria um preset reutilizável a partir de um bloco configurado */
export function createPresetFromBlock(
  block: Block,
  name: string,
  author: 'official' | 'user' = 'user',
  description?: string,
): BlockPreset {
  return {
    id: `preset_${block.data.kind}_${Date.now()}`,
    name,
    kind: block.data.kind,
    version: 1,
    author,
    description,
    config: sanitizePresetConfig(block.data.config),
    ports: block.data.ports ? [...block.data.ports] : undefined,
  };
}

/** Aplica um preset em um bloco existente sem alterar sua identidade nem seus links */
export function applyPresetToBlock(block: Block, preset: BlockPreset): Block {
  if (block.data.kind !== preset.kind) {
    throw new Error(
      `Preset incompatível: tipo "${preset.kind}" não pode ser aplicado ao bloco "${block.data.kind}".`,
    );
  }
  return {
    ...block,
    data: {
      ...block.data,
      config: {
        ...block.data.config,
        ...preset.config,
      },
      ports: preset.ports ? [...preset.ports] : block.data.ports,
    },
  };
}

/** Constrói o manifesto de composição a partir de um grafo e definições adicionais */
export function buildCompositionManifest(
  graph: Graph,
  extraSubflows: SubflowDefinition[] = [],
  extraPresets: BlockPreset[] = [],
): CompositionManifest {
  const subflows: SubflowDefinition[] = [...extraSubflows];

  // Identifica subfluxos registrados em nós do tipo 'subflow'
  for (const node of graph.nodes) {
    if (node.data.kind === 'subflow' && node.data.config.subflowDefinition) {
      try {
        const parsed = JSON.parse(node.data.config.subflowDefinition) as SubflowDefinition;
        if (parsed.id && !subflows.some((s) => s.id === parsed.id)) {
          subflows.push(parsed);
        }
      } catch {
        // Ignora definições malformadas
      }
    }
  }

  return {
    subflows,
    presets: extraPresets,
    rules: [],
  };
}

/** Detecta ciclos recursivos de chamadas entre subfluxos (ex: A chama B e B chama A) */
export function detectSubflowCycles(subflows: SubflowDefinition[]): {
  hasCycle: boolean;
  cyclePath?: string[];
} {
  const callGraph = new Map<string, string[]>();

  for (const sf of subflows) {
    const callees: string[] = [];
    for (const node of sf.nodes) {
      if (node.data.kind === 'subflow' && node.data.config.subflowId) {
        callees.push(node.data.config.subflowId);
      }
    }
    callGraph.set(sf.id, callees);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];

  function dfs(currentId: string): boolean {
    visited.add(currentId);
    recursionStack.add(currentId);
    currentPath.push(currentId);

    const neighbors = callGraph.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        currentPath.push(neighbor);
        return true;
      }
    }

    recursionStack.delete(currentId);
    currentPath.pop();
    return false;
  }

  for (const sf of subflows) {
    if (!visited.has(sf.id)) {
      if (dfs(sf.id)) {
        return { hasCycle: true, cyclePath: [...currentPath] };
      }
    }
  }

  return { hasCycle: false };
}

export type RuleEvaluationResult = {
  valid: boolean;
  errors: Record<string, string[]>;
};

/** Avalia um registro de dados contra uma coleção reutilizável de regras */
export function evaluateRuleCollection(
  data: Record<string, unknown>,
  collection: RuleCollection,
): RuleEvaluationResult {
  const errors: Record<string, string[]> = {};

  for (const rule of collection.rules) {
    const val = data[rule.field];
    const valStr = String(val ?? '').trim();
    let isViolated = false;
    let defaultMsg = `O campo ${rule.field} é inválido.`;

    switch (rule.rule) {
      case 'required':
        if (val === undefined || val === null || valStr === '') {
          isViolated = true;
          defaultMsg = `O campo ${rule.field} é obrigatório.`;
        }
        break;

      case 'email':
        if (valStr !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valStr)) {
          isViolated = true;
          defaultMsg = `O campo ${rule.field} deve ser um e-mail válido.`;
        }
        break;

      case 'minLength': {
        const min = Number(rule.param || 0);
        if (valStr.length < min) {
          isViolated = true;
          defaultMsg = `O campo ${rule.field} deve ter no mínimo ${min} caracteres.`;
        }
        break;
      }

      case 'maxLength': {
        const max = Number(rule.param || 0);
        if (valStr.length > max) {
          isViolated = true;
          defaultMsg = `O campo ${rule.field} deve ter no máximo ${max} caracteres.`;
        }
        break;
      }

      case 'numeric':
        if (valStr !== '' && isNaN(Number(valStr))) {
          isViolated = true;
          defaultMsg = `O campo ${rule.field} deve ser numérico.`;
        }
        break;

      case 'regex':
        if (rule.param && valStr !== '') {
          try {
            const rx = new RegExp(rule.param);
            if (!rx.test(valStr)) {
              isViolated = true;
              defaultMsg = `O campo ${rule.field} não atende ao padrão esperado.`;
            }
          } catch {
            // regex inválida ignorada
          }
        }
        break;
    }

    if (isViolated) {
      if (!errors[rule.field]) {
        errors[rule.field] = [];
      }
      errors[rule.field].push(rule.message || defaultMsg);
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
