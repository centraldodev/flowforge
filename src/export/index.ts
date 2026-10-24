import JSZip from 'jszip';
import type { Graph } from '../engine';
import { download } from './download';
import { addPythonProject } from './python';
import { addTypeScriptProject } from './typescript';

export { download, downloadGraph, downloadWorkflowScript, downloadScreenScript } from './download';

export type ExportLanguage = 'typescript' | 'python';

export const exportLanguages: Record<ExportLanguage, { title: string; description: string }> = {
  typescript: {
    title: 'TypeScript + React',
    description: 'Aplicativo web com Vite, interpretador do fluxo e modelos de classes.',
  },
  python: {
    title: 'Python + Tkinter',
    description: 'Aplicativo desktop simples, interpretador do fluxo e modelos de classes.',
  },
};

function readme(g: Graph, language: ExportLanguage) {
  const run =
    language === 'typescript'
      ? 'Execute npm install e npm run dev.'
      : 'Execute python3 app.py. Requer Python com Tkinter.';
  return `# ${g.name}

Gerado pelo Flowforge.

${run}

Autenticação, OAuth, recuperação, APIs e banco são SIMULAÇÕES LOCAIS. Nenhuma credencial deve ser usada em produção. A conta demo é demo@exemplo.com / 123456. Cadastros e dados duram apenas durante a execução. Substitua esses adaptadores por serviços reais antes de publicar.

As conexões definem os caminhos. Cada saída de execução aceita um destino; as saídas de condição são true/false. graph.json preserva todo o projeto e pode ser importado no editor. O exportador Python usa Tkinter para uma interface simples; o TypeScript usa React. Classes geradas usam atributos sem tipo específico.
`;
}

export async function createProject(g: Graph, language: ExportLanguage) {
  const zip = new JSZip();
  zip.file('graph.json', JSON.stringify(g, null, 2));
  zip.file('README.md', readme(g, language));
  if (language === 'typescript') addTypeScriptProject(zip, g);
  else addPythonProject(zip, g);
  return zip;
}

export async function exportProject(g: Graph, language: ExportLanguage) {
  const zip = await createProject(g, language);
  download(await zip.generateAsync({ type: 'blob' }), 'flowforge-' + language + '.zip');
}
