import { generateProjectCode, generateScreenCode, type Graph } from '../engine';

/** Dispara o download de um arquivo no navegador. */
export function download(data: Blob | string, name: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'application/json' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadGraph = (graph: unknown) =>
  download(JSON.stringify(graph, null, 2), 'projeto.flow.json');

export const downloadWorkflowScript = (graph: Graph) => {
  const code = generateProjectCode(graph);
  const blob = new Blob([code], { type: 'text/javascript' });
  const filename = (graph.name || 'workflow').toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.js';
  download(blob, filename);
};

export const downloadScreenScript = (graph: Graph, screenId: string) => {
  const code = generateScreenCode(graph, screenId);
  const blob = new Blob([code], { type: 'text/javascript' });
  const filename = `${screenId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.js`;
  download(blob, filename);
};
