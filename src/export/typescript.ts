import type JSZip from 'jszip';
import { compile, defaultBackendRegistry, generateProgramCode } from '../compiler';
import type { Graph } from '../engine';
import { models } from './models';
import { htmlTemplate, styleTemplate } from './templates/typescript/assets';
import { mainTemplate, screenFieldsSource } from './templates/typescript/templateSources';

let cachedEngineSources: Record<string, string> | null = null;

function getEngineSources(): Record<string, string> {
  if (cachedEngineSources) return cachedEngineSources;
  cachedEngineSources = {};

  if (typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function') {
    const globbed = import.meta.glob<string>('../engine/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    Object.assign(cachedEngineSources, globbed);
  }

  // Fallback para ambiente de testes Node.js
  if (Object.keys(cachedEngineSources).length === 0 && typeof process !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path');
      const engineDir = path.resolve(process.cwd(), 'src/engine');
      if (fs.existsSync(engineDir)) {
        for (const f of fs.readdirSync(engineDir)) {
          if (f.endsWith('.ts')) {
            cachedEngineSources['../engine/' + f] = fs.readFileSync(
              path.join(engineDir, f),
              'utf-8',
            );
          }
        }
      }
    } catch {
      // Ambiente de execução restrito sem require
    }
  }

  return cachedEngineSources;
}

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

export function addTypeScriptProject(zip: JSZip, g: Graph) {
  zip.file('package.json', JSON.stringify(packageJson, null, 2));
  zip.file('tsconfig.json', JSON.stringify(tsconfig));
  zip.file('index.html', htmlTemplate);
  zip.file('src/main.tsx', mainTemplate);
  zip.file('src/style.css', styleTemplate);
  zip.file('src/ScreenFields.tsx', screenFieldsSource);
  zip.file('src/graph.json', JSON.stringify(g, null, 2));
  zip.file('src/models.ts', models(g, 'typescript'));

  // Compilação semântica baseada exclusivamente em ProgramIR e BackendRegistry
  const compilation = compile(g);
  let programCode: string;
  if (compilation.ok) {
    const jsBackend = defaultBackendRegistry.get('javascript');
    programCode = jsBackend
      ? jsBackend.emit(compilation.value).artifacts[0]?.content ||
        generateProgramCode(compilation.value)
      : generateProgramCode(compilation.value);
  } else {
    programCode = `export function createProgram() { throw new Error(${JSON.stringify(compilation.diagnostics[0]?.message || 'Erro de compilação')}); }`;
  }

  zip.file('src/program.ts', programCode);

  const engineSources = getEngineSources();
  for (const [path, source] of Object.entries(engineSources)) {
    zip.file('src/engine/' + path.split('/').pop(), source);
  }
}
