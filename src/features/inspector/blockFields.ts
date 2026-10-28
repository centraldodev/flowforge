// Campos editáveis de cada tipo de bloco no inspetor.
import { type Block, type Graph } from '../../engine';
import type { FieldDefinition } from '../../components/PropertyField';
import { getGraphFlows } from '../canvas/constants';

import { type Option } from '../../engine/blockFields';
import { blockRegistry } from '../../engine/blockRegistry';
import { httpConnection } from '../../engine/http';
import {
  logicDefinition,
  localLogicCatalog,
  selectedLogicVersion,
} from '../../engine/catalogo/logicCatalog';
export { fieldsFor } from '../../engine/blockFields';

export function screenOptions(g: Graph): Option[] {
  return [
    { value: '', label: 'Selecione uma tela' },
    ...g.nodes
      .filter((n) => n.data.kind === 'screen')
      .map((n) => ({ value: n.id, label: n.data.label })),
  ];
}

export function flowOptions(g: Graph): Option[] {
  const flows = getGraphFlows(g.flows);
  return [
    { value: '', label: 'Automático / Padrão da fase' },
    ...flows.map((f, idx) => ({
      value: f.id,
      label: `Fase ${idx + 1} · ${f.name}`,
    })),
  ];
}

/** Campos de configuração do bloco, prontos para o PropertyField. */
export function configFields(
  g: Graph,
  block: Block,
  onChange: (config: Record<string, string>) => void,
): FieldDefinition[] {
  const config = block.data.config;
  const logicKind =
    block.data.kind === 'condition' || block.data.kind === 'validator'
      ? block.data.kind
      : undefined;
  let logicOptions: Option[] = [];
  if (logicKind) {
    try {
      logicOptions = logicDefinition(logicKind, selectedLogicVersion(config)).options.map(
        ({ value, label }) => ({ value, label }),
      );
    } catch {
      /* O compilador informa a versão indisponível. */
    }
  }
  return blockRegistry[block.data.kind].properties
    .filter((spec) => !spec.visible || spec.visible(config))
    .map((spec) => ({
      id: spec.key,
      label:
        spec.usage === 'unsupported' ? `${spec.label} (sem efeito na execução atual)` : spec.label,
      value:
        spec.key === 'catalogVersion' && logicKind
          ? String(selectedLogicVersion(config))
          : spec.key === 'connectionId'
            ? httpConnection(g, block.id)?.id || ''
            : config[spec.key] || '',
      options:
        logicKind && spec.options === 'logicCatalogVersions'
          ? localLogicCatalog
              .listPublished()
              .filter((record) => record.definition.id === logicKind)
              .map((record) => ({
                value: String(record.definition.version),
                label: `Versão ${record.definition.version}`,
              }))
          : logicKind && spec.key === (logicKind === 'condition' ? 'operator' : 'rule')
            ? logicOptions
            : spec.options === 'screens'
              ? screenOptions(g)
              : spec.options === 'flows'
                ? flowOptions(g)
                : spec.options === 'httpConnections'
                  ? [
                      { value: '', label: 'Selecione uma conexão' },
                      ...g.nodes
                        .filter((node) => node.data.kind === 'httpConnection')
                        .map((node) => ({ value: node.id, label: node.data.label })),
                    ]
                  : spec.options === 'postgresConnections'
                    ? [
                        { value: '', label: 'Selecione uma conexão PostgreSQL' },
                        ...g.nodes
                          .filter((node) => node.data.kind === 'postgresConnection')
                          .map((node) => ({ value: node.id, label: node.data.label })),
                      ]
                    : Array.isArray(spec.options)
                      ? spec.options
                      : undefined,
      area: spec.area,
      entries: spec.entries,
      onChange: (value: string) => onChange({ [spec.key]: value }),
    }));
}
