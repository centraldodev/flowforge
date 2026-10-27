import type { ProgramIR, InstructionIR } from '../../compiler/ir';
import { ArtifactPlan } from './artifacts';
import { authAdapterSource } from '../templates/modular/authAdapter';
import { databaseAdapterSource } from '../templates/modular/databaseAdapter';
import { apiAdapterSource } from '../templates/modular/apiAdapter';
import { delayAdapterSource } from '../templates/modular/delayAdapter';
import { validateOperationsSource } from '../templates/modular/operations-validate';
import { mathOperationsSource } from '../templates/modular/operations-math';
import { textOperationsSource } from '../templates/modular/operations-text';
import { objectOperationsSource } from '../templates/modular/operations-object';
import { arrayOperationsSource } from '../templates/modular/operations-array';
import { programSource, runtimeTypesSource } from '../templates/modular/runtimeTypes';

export function instructions(program: ProgramIR): InstructionIR[] {
  const result: InstructionIR[] = [];
  const walk = (list: InstructionIR[]) => {
    for (const inst of list) {
      result.push(inst);
      if (inst.kind === 'sequence') walk(inst.instructions);
      if (inst.kind === 'conditional') {
        walk(inst.thenBranch);
        walk(inst.elseBranch || []);
      }
      if (inst.kind === 'try_catch') {
        walk(inst.body);
        walk(inst.catchBranch);
      }
      if (inst.kind === 'switch') {
        for (const branch of inst.cases) walk(branch.branch);
        walk(inst.defaultBranch || []);
      }
    }
  };
  for (const step of program.steps) walk(step.instructions);
  return result;
}

export function emitRuntime(plan: ArtifactPlan, program: ProgramIR) {
  plan.text('packages/contracts/src/runtime.ts', runtimeTypesSource, 'contract');
  const all = instructions(program);
  const used = new Set<string>(all.filter((i) => i.kind === 'adapter_call').map((i) => i.adapter));
  if (all.some((i) => i.kind === 'delay')) used.add('delay');
  const adapters = [
    { id: 'auth', name: 'MockAuthAdapter', source: authAdapterSource },
    { id: 'api', name: 'MockApiAdapter', source: apiAdapterSource },
    { id: 'database', name: 'MockDatabaseAdapter', source: databaseAdapterSource },
    { id: 'delay', name: 'MockDelayAdapter', source: delayAdapterSource },
  ].filter((adapter) => used.has(adapter.id));
  const imports: string[] = [];
  for (const adapter of adapters) {
    const path = `apps/web/src/runtime/adapters/${adapter.id}.js`;
    plan.text(path, adapter.source, 'adapter');
    plan.text(
      path.replace(/\.js$/, '.d.ts'),
      `import type { ${adapter.id === 'delay' ? 'DelayAdapter' : 'ActionAdapter'} } from '@flowforge/contracts/runtime';\nexport const ${adapter.name}: { new(...args: unknown[]): ${adapter.id === 'delay' ? 'DelayAdapter' : 'ActionAdapter'} };\n`,
      'contract',
    );
    imports.push(`import { ${adapter.name} } from './adapters/${adapter.id}.js';`);
  }
  const context = `import type { Context, Options, Adapters } from '@flowforge/contracts/runtime';
${imports.join('\n')}
const unavailable = { async execute(): Promise<never> { throw new Error('Adaptador não incluído neste aplicativo.'); } };
export function createContext(options: Options = {}): Context {
  const adapters: Adapters = { auth: unavailable, api: unavailable, database: unavailable, delay: unavailable,
    ${adapters.map((a) => `${a.id}: new ${a.name}(${a.id === 'delay' ? 'options.fastDelay ?? false' : ''})`).join(',\n    ')}
  };
  return { inputs: { ...options.inputs }, store: options.store ?? {}, variables: { ...options.variables }, outputs: { ...options.outputs }, screen: options.screen,
    notifications: [], trace: [], logs: [], stepCount: 0, maxSteps: options.maxSteps ?? 100, signal: options.signal, adapters: { ...adapters, ...options.adapters },
    invoke: async () => { throw new Error('Registro de fluxos não inicializado.'); } };
}
`;
  // Atribuições explícitas evitam propriedades duplicadas quando um adaptador está presente.
  const deduplicated = context.replace(
    'auth: unavailable, api: unavailable, database: unavailable, delay: unavailable,',
    ['auth', 'api', 'database', 'delay']
      .filter((id) => !adapters.some((a) => a.id === id))
      .map((id) => `${id}: unavailable`)
      .join(', ') + (adapters.length === 4 ? '' : ','),
  );
  plan.text(
    'apps/web/src/runtime/context.ts',
    deduplicated,
    'runtime',
    [],
    adapters.map((a) => `apps/web/src/runtime/adapters/${a.id}.js`),
  );
  const groups: Record<string, string> = {
    validate: validateOperationsSource,
    math: mathOperationsSource,
    text: textOperationsSource,
    object: objectOperationsSource,
    array: arrayOperationsSource,
  };
  const needed = new Set<string>();
  const inspect = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.kind === 'literal') return;
    if (item.kind === 'call_operation' && typeof item.operation === 'string')
      needed.add(item.operation.split('_')[0]);
    Object.values(item).forEach(inspect);
  };
  all.forEach(inspect);
  const active = Object.keys(groups).filter((group) => needed.has(group));
  for (const group of active) {
    const path = `apps/web/src/runtime/operations/${group}.js`;
    plan.text(path, groups[group], 'operations');
    plan.text(
      path.replace(/\.js$/, '.d.ts'),
      `export const operations: Record<string, (...args: unknown[]) => unknown>;\n`,
      'contract',
    );
  }
  plan.text(
    'apps/web/src/runtime/operations/index.ts',
    `${active.map((name) => `import { operations as ${name} } from './${name}.js';`).join('\n')}\nexport const BUILTIN_OPERATIONS: Record<string, (...args: unknown[]) => unknown> = { ${active.map((name) => '...' + name).join(', ')} };\n`,
    'registry',
    [],
    active.map((name) => `apps/web/src/runtime/operations/${name}.js`),
  );
  plan.text(
    'apps/web/src/runtime/program.ts',
    programSource,
    'runtime',
    [],
    [
      'apps/web/src/runtime/context.ts',
      'apps/web/src/workflows/registry.ts',
      'apps/web/src/runtime/config.ts',
    ],
  );
}
