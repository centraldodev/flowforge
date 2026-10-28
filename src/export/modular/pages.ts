import type { Graph } from '../../engine/types';
import { migrateAllScreens } from '../../compiler/ui/migrate';
import { ArtifactPlan, identity, json } from './artifacts';
import { emitRegistry } from './registry';
import { uiTypesSource } from '../templates/modular/uiTypes';
import { bindingsSource } from '../templates/modular/bindings';
import { fieldsSource } from '../templates/modular/fields';
import { contentSource } from '../templates/modular/content';
import { layoutSource } from '../templates/modular/layout';
import { screenViewSource, rendererSource, renderTypesSource } from '../templates/modular/screen';
import { appSource, darkModeAppSource, mainSource, routesSource } from '../templates/modular/app';
import {
  styleTemplate,
  darkModeStyleAdditions,
  htmlTemplate,
  darkModeHtmlTemplate,
} from '../templates/typescript/assets';
import { generateVisualCss } from '../../engine/visualDesign';

export function emitPages(plan: ArtifactPlan, graph: Graph) {
  plan.text('packages/contracts/src/ui.ts', uiTypesSource, 'contract');
  const root = 'apps/web/src/runtime/rendering/';
  for (const [path, content, deps] of [
    ['bindings.ts', bindingsSource, []],
    ['types.ts', renderTypesSource, []],
    ['fields.tsx', fieldsSource, ['bindings.ts', 'types.ts']],
    ['content.tsx', contentSource, ['bindings.ts', 'types.ts']],
    ['layout.tsx', layoutSource, ['bindings.ts', 'types.ts']],
    [
      'Renderer.tsx',
      rendererSource,
      ['bindings.ts', 'fields.tsx', 'content.tsx', 'layout.tsx', 'types.ts'],
    ],
    ['ScreenView.tsx', screenViewSource, ['bindings.ts', 'Renderer.tsx']],
  ] as [string, string, string[]][])
    plan.text(
      root + path,
      content,
      'rendering',
      [],
      [...deps.map((p) => root + p), 'packages/contracts/src/ui.ts'],
    );
  const screens = migrateAllScreens(graph);
  const entries = [];
  for (const [id, screen] of Object.entries(screens).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const path = `apps/web/src/pages/${identity(id)}`;
    const definitionPath = path + '/definition.json';
    const definition = json(screen);
    if (definition.length > 256 * 1024)
      throw new Error(`Tela ${id} excede 256 KB; divida a composição em telas menores.`);
    plan.text(definitionPath, definition, 'page-definition', [id]);
    plan.text(
      path + '/Page.tsx',
      `import type { ScreenUI } from '@flowforge/contracts/ui';\nimport { ScreenView, type ScreenProps } from '../../runtime/rendering/ScreenView';\nimport definition from './definition.json';\nexport default function Page(props: ScreenProps) {\n return <section><h1>{definition.title}</h1><ScreenView definition={definition as ScreenUI} {...props} /></section>;\n}\n`,
      'page',
      [id],
      [definitionPath, root + 'ScreenView.tsx'],
    );
    entries.push({ id, path: path + '/Page.tsx' });
  }
  emitRegistry(
    plan,
    'apps/web/src/app/page-registry.ts',
    entries,
    'Record<string, () => Promise<{ default: ComponentType<ScreenProps> }>>',
    "import type { ComponentType } from 'react';\nimport type { ScreenProps } from '../runtime/rendering/ScreenView';",
  );
  plan.text(
    'apps/web/src/app/routes.tsx',
    routesSource,
    'routes',
    [],
    ['apps/web/src/app/page-registry.ts'],
  );
  const isDark = Boolean(graph.darkModeEnabled);
  plan.text(
    'apps/web/src/app/App.tsx',
    isDark ? darkModeAppSource : appSource,
    'app',
    [],
    [
      'apps/web/src/runtime/program.ts',
      'apps/web/src/runtime/config.ts',
      'apps/web/src/app/routes.tsx',
    ],
  );
  plan.text(
    'apps/web/src/main.tsx',
    mainSource,
    'entrypoint',
    [],
    ['apps/web/src/app/App.tsx', 'apps/web/src/styles/global.css'],
  );
  plan.text(
    'apps/web/src/styles/global.css',
    isDark ? `${styleTemplate}\n${darkModeStyleAdditions}` : styleTemplate,
    'style',
  );
  plan.text(
    'apps/web/src/styles/visual-design.css',
    generateVisualCss(graph.visualDesign, isDark),
    'style',
  );
  plan.text(
    'apps/web/index.html',
    isDark ? darkModeHtmlTemplate : htmlTemplate,
    'entrypoint',
    [],
    ['apps/web/src/main.tsx'],
  );
}
