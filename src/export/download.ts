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
