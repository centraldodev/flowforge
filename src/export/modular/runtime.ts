import type { ProgramIR, InstructionIR } from '../../compiler/ir';
import { lowerBlock } from '../../compiler/lower';
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
  for (const inst of [...result]) {
    if (inst.kind !== 'call_subflow' || !inst.subflowDefinition) continue;
    const def = inst.subflowDefinition;
    const graph = { version: 1 as const, name: def.name, nodes: def.nodes, edges: def.edges };
    for (const node of def.nodes) walk(lowerBlock(node, graph));
  }
  return result;
}

function gatewayAdapterSource(className: string, endpoint: string): string {
  return `export class ${className} {
  async execute(action, payload, context) {
    const response = await fetch(${JSON.stringify(endpoint)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: context.signal,
      body: JSON.stringify({ ...payload, action })
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Serviço indisponível.');
    const result = await response.json();
    if (!response.ok || result.ok === false || result.success === false) throw Object.assign(new Error(result.error?.message || result.error || 'Falha na integração.'), { code: result.error?.code, status: response.status });
    return result;
  }
}
`;
}
const emailAdapterSource = gatewayAdapterSource('MockEmailAdapter', '/api/email');
const storageAdapterSource = gatewayAdapterSource('MockStorageAdapter', '/api/storage');
const taskAdapterSource = gatewayAdapterSource('MockTaskAdapter', '/api/tasks');
const paymentAdapterSource = gatewayAdapterSource(
  'MockPaymentAdapter',
  '/api/payments/checkout',
).replace(
  '    const response = await fetch',
  "    if (!['createCheckout', 'charge'].includes(action)) throw new Error('Esta operação de pagamento ainda não está disponível.');\n    const response = await fetch",
);
const realtimeAdapterSource = gatewayAdapterSource('MockRealtimeAdapter', '/api/realtime/publish');
const webhookAdapterSource = `export class MockWebhookAdapter {
  async execute() { throw new Error('Webhooks são recebidos pelo servidor e não podem ser enviados por este bloco.'); }
}
`;

const subflowAdapterSource = `export class ModularSubflowAdapter {
  async execute(subflowId, inputs, context, definition) {
    if (!definition || definition.id !== subflowId) throw new Error('Definição do subfluxo não encontrada: ' + subflowId);
    const stack = context.__subflowStack || [];
    if (stack.includes(subflowId)) throw new Error('Ciclo recursivo no subfluxo: ' + subflowId);
    for (const parameter of definition.parameters || []) if (parameter.required && (inputs[parameter.id] === undefined || inputs[parameter.id] === '')) throw new Error('Entrada obrigatória ausente: ' + parameter.name);
    const child = { ...context, inputs: { ...inputs }, variables: { ...inputs, value: inputs.input ?? Object.values(inputs)[0] ?? '' }, outputs: {}, __subflowStack: [...stack, subflowId] };
    try { await context.invoke('subflow:' + subflowId, child); }
    finally { context.stepCount = child.stepCount; }
    for (const output of definition.returns || []) if (Object.hasOwn(child.outputs, output.id)) return child.outputs[output.id];
    return child.outputs.output ?? child.outputs.result ?? child.variables.result ?? child.variables.return ?? child.variables.value;
  }
}
`;

export function emitRuntime(plan: ArtifactPlan, program: ProgramIR) {
  plan.text('packages/contracts/src/runtime.ts', runtimeTypesSource, 'contract');
  const all = instructions(program);
  const used = new Set<string>(all.filter((i) => i.kind === 'adapter_call').map((i) => i.adapter));
  if (all.some((i) => i.kind === 'delay')) used.add('delay');
  if (all.some((i) => i.kind === 'call_subflow')) used.add('subflow');
  const adapterDefs = [
    { id: 'auth', name: 'MockAuthAdapter', source: authAdapterSource, type: 'ActionAdapter' },
    { id: 'api', name: 'MockApiAdapter', source: apiAdapterSource, type: 'ActionAdapter' },
    {
      id: 'database',
      name: 'MockDatabaseAdapter',
      source: databaseAdapterSource,
      type: 'ActionAdapter',
    },
    { id: 'delay', name: 'MockDelayAdapter', source: delayAdapterSource, type: 'DelayAdapter' },
    { id: 'email', name: 'MockEmailAdapter', source: emailAdapterSource, type: 'ActionAdapter' },
    {
      id: 'storage',
      name: 'MockStorageAdapter',
      source: storageAdapterSource,
      type: 'ActionAdapter',
    },
    { id: 'task', name: 'MockTaskAdapter', source: taskAdapterSource, type: 'ActionAdapter' },
    {
      id: 'webhook',
      name: 'MockWebhookAdapter',
      source: webhookAdapterSource,
      type: 'ActionAdapter',
    },
    {
      id: 'payment',
      name: 'MockPaymentAdapter',
      source: paymentAdapterSource,
      type: 'ActionAdapter',
    },
    {
      id: 'realtime',
      name: 'MockRealtimeAdapter',
      source: realtimeAdapterSource,
      type: 'ActionAdapter',
    },
    {
      id: 'subflow',
      name: 'ModularSubflowAdapter',
      source: subflowAdapterSource,
      type: 'SubflowAdapter',
    },
  ];
  const adapters = adapterDefs.filter((adapter) => used.has(adapter.id));
  const imports: string[] = [];
  for (const adapter of adapters) {
    const path = `apps/web/src/runtime/adapters/${adapter.id}.js`;
    plan.text(path, adapter.source, 'adapter');
    plan.text(
      path.replace(/\.js$/, '.d.ts'),
      `import type { ${adapter.type} } from '@flowforge/contracts/runtime';\nexport const ${adapter.name}: { new(...args: unknown[]): ${adapter.type} };\n`,
      'contract',
    );
    imports.push(`import { ${adapter.name} } from './adapters/${adapter.id}.js';`);
  }
  const core = ['auth', 'api', 'database', 'delay'];
  const assignments = core.map((id) => {
    const adapter = adapters.find((candidate) => candidate.id === id);
    return adapter
      ? `${id}: new ${adapter.name}(${id === 'delay' ? 'options.fastDelay ?? false' : ''})`
      : `${id}: unavailable`;
  });
  for (const adapter of adapters.filter((candidate) => !core.includes(candidate.id)))
    assignments.push(`${adapter.id}: new ${adapter.name}()`);
  const context = `import type { Context, Options, Adapters } from '@flowforge/contracts/runtime';
${imports.join('\n')}
const unavailable = { async execute(): Promise<never> { throw new Error('Adaptador não incluído neste aplicativo.'); } };
export function createContext(options: Options = {}): Context {
  const adapters: Adapters = { ${assignments.join(',\n    ')} };
  return { inputs: { ...options.inputs }, store: options.store ?? {}, variables: { ...options.variables }, outputs: { ...options.outputs }, screen: options.screen,
    notifications: [], trace: [], logs: [], stepCount: 0, maxSteps: options.maxSteps ?? 100, signal: options.signal, adapters: { ...adapters, ...options.adapters },
    invoke: async () => { throw new Error('Registro de fluxos não inicializado.'); } };
}
`;
  plan.text(
    'apps/web/src/runtime/context.ts',
    context,
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
