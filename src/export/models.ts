import type { Graph } from '../engine';

export type ModelLanguage = 'typescript' | 'python';

const safe = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_');

/** Gera classes a partir dos blocos "Classe / modelo". */
export function models(g: Graph, lang: ModelLanguage): string {
  return g.nodes
    .filter((n) => (n.data.kind as string) === 'class')
    .map((n, i) => {
      const name = 'Model_' + safe(n.data.config.name) + '_' + i;
      const fields = n.data.config.fields
        .split(',')
        .map((f, j) => 'field_' + safe(f.trim()) + '_' + j);

      if (lang === 'typescript') {
        const body = fields.map((f) => `  ${f}: unknown = null;`).join('\n');
        return `export class ${name} {\n${body}\n}`;
      }
      const body = fields.map((f) => `        self.${f} = None`).join('\n') || '        pass';
      return `class ${name}:\n    def __init__(self):\n${body}`;
    })
    .join('\n\n');
}
