import type { Graph } from '../../engine/types';
import type { ProgramIR } from '../../compiler/ir';
import { lowerInstruction } from '../../compiler/backends/javascript/codegen';
import { emitProgram } from '../../compiler/backends/javascript/ast';
import { SymbolTable } from '../../compiler/backends/javascript/symbols';
import { buildCompositionManifest } from '../../engine/composition';
import { lowerBlock } from '../../compiler/lower';
import { ArtifactPlan, hash, identity, json, relative } from './artifacts';
import { emitRegistry } from './registry';

type Operation = { id: string; symbol: string; code: string };

export function emitComposition(plan: ArtifactPlan, graph: Graph): boolean {
  if (plan.files.has('packages/contracts/src/composition.ts')) return true;

  const manifest = buildCompositionManifest(graph);
  plan.text(
    'packages/contracts/src/composition.ts',
    `export type SubflowPort = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  valueType?: any;
  required?: boolean;
};

export type SubflowDefinition = {
  id: string;
  name: string;
  description?: string;
  parameters: SubflowPort[];
  returns: SubflowPort[];
  nodes: any[];
  edges: any[];
};

export type BlockPreset = {
  id: string;
  name: string;
  kind: string;
  version: number;
  author: 'official' | 'user';
  description?: string;
  config: Record<string, string>;
};

export type RuleDefinition = {
  id: string;
  name: string;
  field: string;
  rule: string;
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
`,
    'contract',
  );

  if (manifest.subflows.length > 0 || manifest.presets.length > 0) {
    plan.text(
      'apps/web/src/workflows/composition.manifest.json',
      json(manifest),
      'configuration',
      manifest.subflows.map((s) => s.id),
      ['packages/contracts/src/composition.ts'],
    );
  }

  return true;
}

export function emitWorkflows(plan: ArtifactPlan, program: ProgramIR, graph: Graph) {
  emitComposition(plan, graph);
  const groups = new Map<string, Operation[]>();
  for (const step of [...program.steps].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (step.kind === 'httpConnection') continue;
    const node = graph.nodes.find((item) => item.id === step.blockId)!;
    const owner = node.data.config.screenId;
    const scope = owner ? `pages/${identity(owner)}/workflows` : 'workflows/shared';
    const basename =
      step.kind === 'button'
        ? `event-${identity(step.id)}`
        : step.kind === 'subflow'
          ? `subflow-${identity(step.id)}`
          : step.kind;
    const path = `apps/web/src/${scope}/${basename}.ts`;
    const symbol = `run_${hash(step.id)}`;
    const body = emitProgram(
      step.instructions.flatMap((inst) => lowerInstruction(inst, new SymbolTable())),
    );
    const operation = {
      id: step.id,
      symbol,
      code: `export async function ${symbol}(context: Context): Promise<unknown> {\n${body}\n  return undefined;\n}\n`,
    };
    const group = groups.get(path) || [];
    group.push(operation);
    groups.set(path, group);
  }
  const entries: { id: string; path: string; expression: string }[] = [];
  const write = (path: string, operations: Operation[], prefix = '') => {
    const size = operations.reduce((sum, op) => sum + op.code.split('\n').length, 0);
    if (size > 300 && operations.length > 1) {
      const buckets = new Map<string, Operation[]>();
      for (const operation of operations) {
        const key = hash(operation.id)[prefix.length];
        const bucket = buckets.get(key) || [];
        bucket.push(operation);
        buckets.set(key, bucket);
      }
      if (prefix.length >= 16) throw new Error('Colisão de identidades dos fluxos.');
      for (const [key, bucket] of buckets) write(path, bucket, prefix + key);
      return;
    }
    const target = prefix ? path.replace(/\.ts$/, `.group-${prefix}.ts`) : path;
    const ops = 'apps/web/src/runtime/operations/index.ts';
    plan.text(
      target,
      `import type { Context } from '@flowforge/contracts/runtime';\nimport { BUILTIN_OPERATIONS } from ${JSON.stringify(relative(target, ops).replace(/\.ts$/, ''))};\n${operations.map((op) => op.code).join('\n')}`,
      'workflow',
      operations.map((op) => op.id),
      [ops, 'packages/contracts/src/runtime.ts'],
    );
    for (const operation of operations)
      entries.push({
        id: operation.id,
        path: target,
        expression: `() => import(${JSON.stringify(relative('apps/web/src/workflows/registry.ts', target).replace(/\.ts$/, ''))}).then((module) => ({ default: module.${operation.symbol} }))`,
      });
  };
  for (const definition of buildCompositionManifest(graph).subflows) {
    const inner: Graph = {
      version: 1,
      name: definition.name,
      nodes: definition.nodes,
      edges: definition.edges,
    };
    const targets = new Set(
      inner.edges
        .filter(
          (edge) =>
            edge.targetHandle === 'execute' ||
            edge.targetHandle === 'listener' ||
            !edge.targetHandle,
        )
        .map((edge) => edge.target),
    );
    const roots = inner.nodes.filter((node) => !targets.has(node.id));
    const instructions = (roots.length ? roots : inner.nodes.slice(0, 1)).flatMap((node) =>
      lowerBlock(node, inner),
    );
    const body = emitProgram(
      instructions.flatMap((instruction) => lowerInstruction(instruction, new SymbolTable())),
    );
    const path = `apps/web/src/workflows/subflows/${identity(definition.id)}.ts`;
    const ops = 'apps/web/src/runtime/operations/index.ts';
    plan.text(
      path,
      `import type { Context } from '@flowforge/contracts/runtime';\nimport { BUILTIN_OPERATIONS } from ${JSON.stringify(relative(path, ops).replace(/\.ts$/, ''))};\nexport default async function run(context: Context): Promise<unknown> {\n${body}\nreturn undefined;\n}\n`,
      'subflow',
      [definition.id],
      [ops, 'packages/contracts/src/runtime.ts'],
    );
    entries.push({
      id: 'subflow:' + definition.id,
      path,
      expression: `() => import(${JSON.stringify(relative('apps/web/src/workflows/registry.ts', path).replace(/\.ts$/, ''))})`,
    });
  }
  for (const [path, group] of groups) write(path, group);
  emitRegistry(
    plan,
    'apps/web/src/workflows/registry.ts',
    entries,
    'WorkflowRegistry',
    "import type { WorkflowRegistry } from '@flowforge/contracts/runtime';",
  );
}
