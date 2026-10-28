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
import { buildDatabaseManifest } from '../engine/database';
import {
  logicDefinition,
  selectedLogicVersion,
  type LogicKind,
} from '../engine/catalogo/logicCatalog';
import { buildCompositionManifest } from '../engine/composition';

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
  const logicKinds: LogicKind[] = ['condition', 'validator'];
  const catalogNodes = [
    ...graph.nodes,
    ...buildCompositionManifest(graph).subflows.flatMap((flow) => flow.nodes),
  ];
  const definitions = logicKinds.flatMap((kind) => {
    const versions = new Set(
      catalogNodes
        .filter((node) => node.data.kind === kind)
        .map((node) => selectedLogicVersion(node.data.config)),
    );
    return [...versions].sort((a, b) => a - b).map((version) => logicDefinition(kind, version));
  });
  plan.text(
    'flowforge/catalog/logic-definitions.json',
    json({ schemaVersion: 1, definitions }),
    'catalog-snapshot',
  );
  plan.text('README.md', exportReadme(graph.name, hasServer), 'documentation');
  const envReport = analyzeEnvironment(graph);
  const secrets = envReport.requiredVariables
    .map((v) => v.name)
    .filter((name) => name !== 'FLOWFORGE_PORT')
    .sort();
  if (hasServer)
    for (const environment of ['development', 'production'] as const) {
      const databaseSecrets = buildDatabaseManifest(graph).connections.map(
        (connection) => connection[environment].secretEnv,
      );
      const environmentSecrets = [...new Set([...secrets, ...databaseSecrets])].sort();
      plan.text(
        '.env.' + environment + '.example',
        `FLOWFORGE_ENV=${environment}\nFLOWFORGE_PORT=8787\n${environmentSecrets.map((name) => name + '=').join('\n')}\n`,
        'environment',
      );
    }
  plan.validate();
  return plan;
}

export function addTypeScriptProject(zip: JSZip, graph: Graph) {
  createTypeScriptPlan(graph).write(zip);
}
