import source from './logic-definitions.json';
import { LocalCatalogRepository } from './repository';
import { validateLogicCatalog, type LogicKind, type LogicDefinition } from './validation';
export { validateLogicCatalog } from './validation';
export type { LogicKind, LogicDefinition } from './validation';

const definitions = validateLogicCatalog(source);
export const localLogicCatalog = new LocalCatalogRepository(
  typeof localStorage === 'undefined' ? undefined : localStorage,
);
for (const definition of definitions) {
  const existing = localLogicCatalog.getPublished(definition.id, definition.version);
  if (!existing) localLogicCatalog.publish(definition, 'sistema');
  else if (JSON.stringify(existing.definition) !== JSON.stringify(definition))
    throw new Error('A definição padrão publicada foi modificada.');
}

export function logicDefinition(kind: LogicKind, version = 1): LogicDefinition {
  const definition = localLogicCatalog.getPublished(kind, version)?.definition;
  if (!definition) throw new Error('Definição ausente: ' + kind);
  return { ...definition, options: definition.options.map((option) => ({ ...option })) };
}
export function logicOperation(kind: LogicKind, selection?: string, version = 1): string {
  const definition = logicDefinition(kind, version);
  const option = definition.options.find(
    (item) => item.value === (selection || definition.defaultOperation),
  );
  if (!option) throw new Error('Operação não suportada: ' + selection);
  return option.operation;
}

export function selectedLogicVersion(config: Record<string, string>): number {
  if (!config.catalogVersion) return 1;
  if (!/^[1-9][0-9]*$/.test(config.catalogVersion)) return 0;
  const version = Number(config.catalogVersion);
  return Number.isSafeInteger(version) ? version : 0;
}
