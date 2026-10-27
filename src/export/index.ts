import JSZip from 'jszip';
import { compile } from '../compiler';
import type { Graph } from '../engine';
import { download } from './download';
import { addPythonProject } from './python';
import { addTypeScriptProject } from './typescript';

export { download, downloadGraph, downloadWorkflowScript, downloadScreenScript } from './download';

export type ExportLanguage = 'typescript' | 'python';

export const exportLanguages: Record<ExportLanguage, { title: string; description: string }> = {
  typescript: {
    title: 'TypeScript + React',
    description: 'Aplicativo React com backend Node.js para integrações HTTP reais.',
  },
  python: {
    title: 'Python + Tkinter',
    description: 'Aplicativo desktop simples, interpretador do fluxo e modelos de classes.',
  },
};

export async function createProject(g: Graph, language: ExportLanguage) {
  const compilation = compile(g, { references: language === 'typescript' });
  if (!compilation.ok) {
    throw new Error(
      compilation.diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => d.message)
        .join('\n'),
    );
  }
  const zip = new JSZip();
  if (language === 'typescript') addTypeScriptProject(zip, g);
  else {
    zip.file('graph.json', JSON.stringify(g, null, 2));
    zip.file(
      'README.md',
      '# ' +
        g.name +
        '\nExecute python3 app.py. Requer Tkinter. Auth, banco e APIs de demonstração são simulados.',
    );
    addPythonProject(zip, g);
  }
  return zip;
}

export async function exportProject(g: Graph, language: ExportLanguage) {
  const zip = await createProject(g, language);
  download(await zip.generateAsync({ type: 'blob' }), 'flowforge-' + language + '.zip');
}
