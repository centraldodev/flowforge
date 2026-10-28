import { validateLogicCatalog, type LogicDefinition, type LogicKind } from './validation';

export type CatalogRecord = { definition: LogicDefinition; publishedAt: string; actor: string };
export type CatalogAudit = {
  action: 'publish';
  id: LogicKind;
  version: number;
  at: string;
  actor: string;
};
export interface CatalogReader {
  listPublished(): CatalogRecord[];
  getPublished(id: LogicKind, version: number): CatalogRecord | undefined;
}
export interface CatalogPublisher extends CatalogReader {
  publish(definition: unknown, actor: string): CatalogRecord;
  audit(): CatalogAudit[];
}
export interface CatalogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
type State = { schemaVersion: 1; records: CatalogRecord[]; audit: CatalogAudit[] };
const KEY = 'flowforge.catalog.local.v1';
const MAX_BYTES = 256 * 1024;

/** Repositório local para desenvolvimento, sem substituir autorização no servidor futuro. */
export class LocalCatalogRepository implements CatalogPublisher {
  private state: State = { schemaVersion: 1, records: [], audit: [] };
  constructor(
    private storage?: CatalogStorage,
    private key = KEY,
  ) {}

  private read(): State {
    const serialized = this.storage?.getItem(this.key);
    const raw: unknown =
      serialized === null || serialized === undefined ? this.state : JSON.parse(serialized);
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('schemaVersion' in raw) ||
      raw.schemaVersion !== 1 ||
      !('records' in raw) ||
      !Array.isArray(raw.records) ||
      !('audit' in raw) ||
      !Array.isArray(raw.audit)
    )
      throw new Error('Repositório de catálogo inválido.');
    const records: CatalogRecord[] = [];
    const keys = new Set<string>();
    for (const item of raw.records as CatalogRecord[]) {
      const definition = validateLogicCatalog(
        { schemaVersion: 1, definitions: [item?.definition] },
        { complete: false },
      )[0];
      if (
        !definition ||
        typeof item.actor !== 'string' ||
        !item.actor ||
        typeof item.publishedAt !== 'string' ||
        !Number.isFinite(Date.parse(item.publishedAt))
      )
        throw new Error('Registro publicado inválido.');
      const id = definition.id + ':' + definition.version;
      if (keys.has(id)) throw new Error('Versão duplicada no repositório.');
      keys.add(id);
      records.push({ definition, actor: item.actor, publishedAt: item.publishedAt });
    }
    const audit: CatalogAudit[] = [];
    for (const event of raw.audit as CatalogAudit[]) {
      if (
        !event ||
        event.action !== 'publish' ||
        !['condition', 'validator'].includes(event.id) ||
        !Number.isSafeInteger(event.version) ||
        event.version < 1 ||
        typeof event.actor !== 'string' ||
        !event.actor ||
        typeof event.at !== 'string' ||
        !Number.isFinite(Date.parse(event.at))
      )
        throw new Error('Auditoria de catálogo inválida.');
      audit.push({
        action: 'publish',
        id: event.id,
        version: event.version,
        actor: event.actor,
        at: event.at,
      });
    }
    return { schemaVersion: 1, records, audit };
  }

  listPublished(): CatalogRecord[] {
    return this.read().records.sort(
      (a, b) =>
        a.definition.id.localeCompare(b.definition.id) ||
        a.definition.version - b.definition.version,
    );
  }
  getPublished(id: LogicKind, version: number): CatalogRecord | undefined {
    return this.read().records.find(
      (record) => record.definition.id === id && record.definition.version === version,
    );
  }
  audit(): CatalogAudit[] {
    return this.read().audit;
  }
  publish(input: unknown, actor: string): CatalogRecord {
    if (typeof actor !== 'string' || !actor.trim() || actor.length > 100)
      throw new Error('Identificação de publicação inválida.');
    const definition = validateLogicCatalog(
      { schemaVersion: 1, definitions: [input] },
      { complete: false },
    )[0];
    if (!definition) throw new Error('Definição ausente.');
    const state = this.read();
    if (
      state.records.some(
        (record) =>
          record.definition.id === definition.id &&
          record.definition.version === definition.version,
      )
    )
      throw new Error('Esta versão já foi publicada e é imutável.');
    const at = new Date().toISOString();
    const record = { definition, publishedAt: at, actor: actor.trim() };
    state.records.push(record);
    state.audit.push({
      action: 'publish',
      id: definition.id,
      version: definition.version,
      at,
      actor: record.actor,
    });
    const serialized = JSON.stringify(state);
    if (new TextEncoder().encode(serialized).length > MAX_BYTES)
      throw new Error('Limite do repositório de catálogo excedido.');
    if (this.storage) this.storage.setItem(this.key, serialized);
    else this.state = JSON.parse(serialized) as State;
    return JSON.parse(JSON.stringify(record)) as CatalogRecord;
  }
}
