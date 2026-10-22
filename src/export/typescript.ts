import type JSZip from 'jszip';
import type { Graph } from '../engine';
import { models } from './models';
import screenFieldsSource from '../features/preview/ScreenFields.tsx?raw';
import mainTemplate from './templates/typescript/main.tsx?raw';
import styleTemplate from './templates/typescript/style.css?raw';
import htmlTemplate from './templates/typescript/index.html?raw';

// Todos os módulos do engine são copiados para src/engine/ no projeto exportado.
const engineSources = import.meta.glob<string>('../engine/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const packageJson = {
  name: 'flowforge-app',
  version: '1.0.0',
  type: 'module',
  scripts: { dev: 'vite', build: 'tsc --noEmit && vite build' },
  dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  devDependencies: {
    vite: '^6.0.0',
    typescript: '^5.7.0',
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
  },
};

const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    jsx: 'react-jsx',
    strict: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
  },
  include: ['src'],
};

/** No editor o ScreenFields fica em features/preview; no app exportado, ao lado de engine/. */
function relocateScreenFields(source: string) {
  const from = "from '../../engine'";
  if (!source.includes(from)) throw Error('ScreenFields: import do engine não encontrado');
  return source.replace(from, "from './engine'");
}

export function addTypeScriptProject(zip: JSZip, g: Graph) {
  zip.file('package.json', JSON.stringify(packageJson, null, 2));
  zip.file('tsconfig.json', JSON.stringify(tsconfig));
  zip.file('index.html', htmlTemplate);
  zip.file('src/main.tsx', mainTemplate);
  zip.file('src/style.css', styleTemplate);
  zip.file('src/ScreenFields.tsx', relocateScreenFields(screenFieldsSource));
  zip.file('src/graph.json', JSON.stringify(g, null, 2));
  zip.file('src/models.ts', models(g, 'typescript'));
  for (const [path, source] of Object.entries(engineSources)) {
    zip.file('src/engine/' + path.split('/').pop(), source);
  }
}
