import type JSZip from 'jszip';

export type Artifact = {
  path: string;
  content: string;
  role: string;
  owners?: string[];
  dependencies?: string[];
};
export function hash(value: string): string {
  let result = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i++)
    result = BigInt.asUintN(64, (result ^ BigInt(value.charCodeAt(i))) * 0x100000001b3n);
  return result.toString(16).padStart(16, '0');
}
export function identity(id: string): string {
  const slug =
    id
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .slice(0, 36) || 'item';
  return `item-${slug}--${hash(id)}`;
}
export const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export function relative(from: string, to: string): string {
  const a = from.split('/').slice(0, -1),
    b = to.split('/');
  while (a.length && b.length && a[0] === b[0]) {
    a.shift();
    b.shift();
  }
  const result = [...a.map(() => '..'), ...b].join('/');
  return result.startsWith('.') ? result : './' + result;
}

export class ArtifactPlan {
  readonly files = new Map<string, Artifact>();
  readonly warnings: { path: string; message: string }[] = [];
  add(artifact: Artifact) {
    const path = artifact.path;
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(path) ||
      path.startsWith('/') ||
      path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    )
      throw new Error(`Caminho de exportação inválido: ${path}`);
    if ([...this.files.keys()].some((existing) => existing.toLowerCase() === path.toLowerCase()))
      throw new Error(`Colisão de arquivo exportado: ${path}`);
    if (/\.(?:tsx?|m?js)$/.test(path) && !path.endsWith('.d.ts') && !path.endsWith('.d.mts')) {
      const lines = artifact.content
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('//')).length;
      if (lines > 600)
        throw new Error(
          `EXPORT_FILE_TOO_LARGE: ${path} possui ${lines} linhas; divida sua responsabilidade.`,
        );
      if (lines > 350)
        this.warnings.push({
          path,
          message: 'Arquivo acima de 350 linhas úteis; revisar divisão semântica.',
        });
      if (artifact.content.includes('@ts-nocheck'))
        throw new Error(`Tipos desativados em ${path}.`);
    }
    this.files.set(path, {
      ...artifact,
      owners: [...new Set(artifact.owners || [])].sort(),
      dependencies: [...new Set(artifact.dependencies || [])].sort(),
    });
  }
  text(
    path: string,
    content: string,
    role: string,
    owners: string[] = [],
    dependencies: string[] = [],
  ) {
    this.add({ path, content, role, owners, dependencies });
  }
  validate() {
    for (const artifact of this.files.values())
      for (const dependency of artifact.dependencies || []) {
        if (!this.files.has(dependency))
          throw new Error(`Dependência ausente: ${artifact.path} → ${dependency}`);
        if (
          (artifact.path.startsWith('apps/web/') ||
            artifact.path.startsWith('packages/contracts/')) &&
          dependency.startsWith('apps/api/')
        )
          throw new Error(`Dependência privada no cliente: ${artifact.path} → ${dependency}`);
      }
    const visiting = new Set<string>(),
      done = new Set<string>();
    const visit = (path: string) => {
      if (visiting.has(path)) throw new Error(`Dependência circular de módulos: ${path}`);
      if (done.has(path)) return;
      visiting.add(path);
      for (const dependency of this.files.get(path)?.dependencies || []) visit(dependency);
      visiting.delete(path);
      done.add(path);
    };
    for (const path of this.files.keys()) visit(path);
  }
  write(zip: JSZip) {
    this.validate();
    const artifacts = [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
    const manifest = artifacts.map((artifact) => ({
      path: artifact.path,
      role: artifact.role,
      hash: hash(artifact.content),
      owners: artifact.owners,
      dependencies: artifact.dependencies,
    }));
    const sourceMap: Record<string, string[]> = {};
    for (const artifact of artifacts)
      for (const id of artifact.owners || []) (sourceMap[id] ??= []).push(artifact.path);
    const output = [
      ...artifacts,
      {
        path: 'flowforge/export-manifest.json',
        content: json({
          version: 1,
          generator: 'flowforge-modular-1',
          hashAlgorithm: 'fnv1a64',
          files: manifest,
        }),
      },
      { path: 'flowforge/source-map.json', content: json(sourceMap) },
      { path: 'flowforge/diagnostics.json', content: json(this.warnings) },
    ];
    for (const artifact of output)
      zip.file(artifact.path, artifact.content, { date: new Date('2000-01-01T00:00:00Z') });
  }
}
