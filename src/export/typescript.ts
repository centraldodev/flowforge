import type JSZip from 'jszip';
import { compile } from '../compiler';
import type { Graph } from '../engine/types';
import { ArtifactPlan, json } from './modular/artifacts';
import { emitRuntime } from './modular/runtime';
import { emitWorkflows } from './modular/workflows';
import { emitPages } from './modular/pages';
import { emitServer } from './modular/server';
import { emitProject } from './modular/project';
import { emitDeployment } from './modular/deployment';
import { exportReadme } from './modular/readme';
import { emitTests } from './modular/tests';
import { analyzeEnvironment } from '../engine/envDiagnostics';

/** Planeja todos os artefatos antes de escrever qualquer arquivo no ZIP. */
export function createTypeScriptPlan(graph: Graph): ArtifactPlan {
  const compilation = compile(graph, { references: true });
  if (!compilation.ok)
    throw new Error(
      compilation.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.message)
        .join('\n'),
    );
  const plan = new ArtifactPlan();
  const program = compilation.value;
  emitRuntime(plan, program);
  emitWorkflows(plan, program, graph);
  emitPages(plan, graph);
  const hasServer = emitServer(plan, graph);
  emitProject(plan, hasServer);
  emitDeployment(plan, graph, hasServer);
  emitTests(plan, graph);
  plan.text(
    'apps/web/src/runtime/config.ts',
    `export const appName = ${JSON.stringify(graph.name)};\nexport const entryScreenId = ${JSON.stringify(program.entryScreenId || '')};\n`,
    'configuration',
  );
  plan.text(
    'flowforge/project.flow.json',
    json(graph),
    'visual-source',
    graph.nodes.map((node) => node.id),
  );
  plan.text('README.md', exportReadme(graph.name, hasServer), 'documentation');
  const envReport = analyzeEnvironment(graph);
  const secrets = envReport.requiredVariables
    .map((v) => v.name)
    .filter((name) => name !== 'FLOWFORGE_PORT')
    .sort();
  if (hasServer)
    for (const environment of ['development', 'production'])
      plan.text(
        '.env.' + environment + '.example',
        `FLOWFORGE_ENV=${environment}\nFLOWFORGE_PORT=8787\n${secrets.map((name) => name + '=').join('\n')}\n`,
        'environment',
      );
  plan.validate();
  return plan;
}

export function addTypeScriptProject(zip: JSZip, graph: Graph) {
  createTypeScriptPlan(graph).write(zip);
}
