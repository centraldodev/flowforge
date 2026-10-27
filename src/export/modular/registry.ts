import { ArtifactPlan, hash, json, relative } from './artifacts';

/** Registros grandes são compostos por prefixo de identidade, sem um índice gigante. */
export function emitRegistry(
  plan: ArtifactPlan,
  path: string,
  entries: { id: string; path: string; expression?: string }[],
  type: string,
  typeImport: string,
  depth = 0,
) {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (sorted.length > 48) {
    if (depth * 2 >= 16) {
      throw new Error('Registro excede o limite de distribuição por identidade.');
    }
    const buckets = new Map<string, typeof sorted>();
    for (const entry of sorted) {
      const prefix = hash(entry.id).slice(depth * 2, depth * 2 + 2);
      const bucket = buckets.get(prefix) || [];
      bucket.push(entry);
      buckets.set(prefix, bucket);
    }
    // O prefixo completo fica no nome, mantendo o conteúdo de grupos independentes estável.
    const children = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, bucket]) => {
        const target = path.replace(/\.ts$/, (depth === 0 ? '.group-' : '-') + `${prefix}.ts`);
        if (bucket.length === sorted.length && buckets.size === 1)
          throw new Error('Registro excede o limite de distribuição por identidade.');
        emitRegistry(plan, target, bucket, type, typeImport, depth + 1);
        return target;
      });
    plan.text(
      path,
      `${typeImport}\n${children.map((child, i) => `import group${i} from ${JSON.stringify(relative(path, child).replace(/\.ts$/, ''))};`).join('\n')}\nexport default Object.assign(Object.create(null), ${children.map((_, i) => `group${i}`).join(', ')}) as ${type};\n`,
      'registry',
      sorted.map((e) => e.id),
      children,
    );
  } else {
    plan.text(
      path,
      `${typeImport}\nconst registry: ${type} = {\n${sorted.map((entry) => `  ${json(entry.id).trim()}: ${entry.expression || `() => import(${JSON.stringify(relative(path, entry.path).replace(/\.tsx?$/, ''))})`},`).join('\n')}\n};\nexport default registry;\n`,
      'registry',
      sorted.map((e) => e.id),
      sorted.map((e) => e.path),
    );
  }
}
