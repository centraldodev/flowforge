// Campos editáveis de cada tipo de bloco no inspetor.
import { type Block, type Graph } from '../../engine';
import type { FieldDefinition } from '../../components/PropertyField';
import { getGraphFlows } from '../canvas/constants';

import { type Option } from '../../engine/blockFields';
import { blockRegistry } from '../../engine/blockRegistry';
import { httpConnection } from '../../engine/http';
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
  return blockRegistry[block.data.kind].properties
    .filter((spec) => !spec.visible || spec.visible(config))
    .map((spec) => ({
      id: spec.key,
      label:
        spec.usage === 'unsupported' ? `${spec.label} (sem efeito na execução atual)` : spec.label,
      value:
        spec.key === 'connectionId'
          ? httpConnection(g, block.id)?.id || ''
          : config[spec.key] || '',
      options:
        spec.options === 'screens'
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
              : spec.options,
      area: spec.area,
      entries: spec.entries,
      onChange: (value: string) => onChange({ [spec.key]: value }),
    }));
}
