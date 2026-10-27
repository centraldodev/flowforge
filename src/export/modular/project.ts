import { ArtifactPlan, json } from './artifacts';

export function emitProject(plan: ArtifactPlan, hasServer: boolean) {
  const root = {
    name: 'flowforge-app',
    version: '1.0.0',
    private: true,
    type: 'module',
    engines: { node: '>=20.19' },
    workspaces: ['packages/*', 'apps/*'],
    scripts: {
      dev: 'node --env-file-if-exists=.env scripts/dev.mjs',
      'dev:web': 'npm run dev --workspace @flowforge/web',
      ...(hasServer
        ? {
            'dev:server': 'node --env-file-if-exists=.env apps/api/src/main.mjs',
            'check-env': 'node scripts/check-env.mjs',
            'docker:build': 'docker build -t flowforge-app .',
            'docker:run': 'docker compose up -d',
          }
        : {}),
      build: 'npm run build --workspaces --if-present',
      start: hasServer
        ? 'node --env-file-if-exists=.env apps/api/src/main.mjs'
        : 'npm run preview --workspace @flowforge/web',
      test: 'node --test tests/*.test.mjs',
    },
    devDependencies: { typescript: '5.9.3', '@types/node': '22.20.5' },
  };
  plan.text('package.json', json(root), 'workspace');
  plan.text(
    'tsconfig.base.json',
    json({
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
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
      },
    }),
    'configuration',
  );
  plan.text(
    'packages/contracts/package.json',
    json({
      name: '@flowforge/contracts',
      version: '1.0.0',
      private: true,
      type: 'module',
      exports: {
        './runtime': { types: './src/runtime.ts' },
        './ui': { types: './src/ui.ts' },
        ...(hasServer ? { './http': { types: './src/http.ts' } } : {}),
      },
      scripts: { build: 'tsc --noEmit' },
    }),
    'workspace',
  );
  plan.text(
    'packages/contracts/tsconfig.json',
    json({
      extends: '../../tsconfig.base.json',
      compilerOptions: { noEmit: true },
      include: ['src'],
    }),
    'configuration',
    [],
    ['tsconfig.base.json'],
  );
  plan.text(
    'apps/web/package.json',
    json({
      name: '@flowforge/web',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host 127.0.0.1',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview --host 127.0.0.1',
      },
      dependencies: { '@flowforge/contracts': '1.0.0', react: '19.3.1', 'react-dom': '19.3.1' },
      devDependencies: { vite: '6.4.5', '@types/react': '19.3.0', '@types/react-dom': '19.3.0' },
    }),
    'workspace',
  );
  plan.text(
    'apps/web/tsconfig.json',
    json({
      extends: '../../tsconfig.base.json',
      compilerOptions: { noEmit: true },
      include: ['src'],
    }),
    'configuration',
    [],
    ['tsconfig.base.json'],
  );
  plan.text(
    'apps/web/vite.config.ts',
    `import { defineConfig } from 'vite';\nexport default defineConfig({ base: './', ${hasServer ? "server: { proxy: { '/__flowforge': { target: 'http://127.0.0.1:' + (process.env.FLOWFORGE_PORT || 8787), changeOrigin: false } } }" : ''} });\n`,
    'configuration',
  );
  if (hasServer) {
    plan.text(
      'apps/api/package.json',
      json({
        name: '@flowforge/api',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { build: 'node ../../scripts/check-api.mjs' },
        dependencies: { '@flowforge/contracts': '1.0.0' },
      }),
      'workspace',
    );
    plan.text(
      'scripts/check-api.mjs',
      `import { readdir } from 'node:fs/promises';\nimport { fileURLToPath } from 'node:url';\nimport { spawnSync } from 'node:child_process';\nconst root = new URL('../apps/api/src/', import.meta.url);\nasync function check(directory) {\n for (const entry of await readdir(directory, { withFileTypes: true })) {\n  const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);\n  if (entry.isDirectory()) await check(path);\n  else if (entry.name.endsWith('.mjs')) { const child = spawnSync(process.execPath, ['--check', fileURLToPath(path)], { stdio: 'inherit' }); if (child.status !== 0) process.exit(child.status || 1); }\n }\n}\nawait check(root);\n`,
      'build-script',
    );
  }
  plan.text(
    'scripts/dev.mjs',
    `import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const vite = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const children = [];
const stop = () => { for (const child of children) child.kill(); };
function run(args, cwd) {
 const child = spawn(process.execPath, args, { cwd: fileURLToPath(cwd), env: process.env, stdio: 'inherit' });
 children.push(child);
 child.on('error', (error) => { console.error(error.message); stop(); process.exitCode = 1; });
 child.on('exit', (code, signal) => { stop(); if (code) process.exitCode = code; });
}
${hasServer ? "run([fileURLToPath(new URL('../apps/api/src/main.mjs', import.meta.url))], new URL('../', import.meta.url));" : ''}
run([vite, '--host', '127.0.0.1'], new URL('../apps/web/', import.meta.url));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
`,
    'dev-script',
  );
  plan.text(
    'tests/structure.test.mjs',
    `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile, access } from 'node:fs/promises';\nconst root = new URL('../', import.meta.url);\ntest('Todos os artefatos e suas dependências estão no projeto', async () => {\n const manifest = JSON.parse(await readFile(new URL('flowforge/export-manifest.json', root), 'utf8'));\n for (const artifact of manifest.files) {\n  await access(new URL(artifact.path, root));\n  for (const dependency of artifact.dependencies) await access(new URL(dependency, root));\n  assert.ok(!artifact.path.startsWith('../'));\n }\n});\n`,
    'test',
  );
  plan.text(
    '.gitignore',
    'node_modules\napps/web/dist\n.env\n.env.local\n*.tsbuildinfo\n',
    'configuration',
  );
}
