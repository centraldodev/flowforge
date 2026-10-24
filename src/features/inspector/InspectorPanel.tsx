import type { CSSProperties, ReactNode } from 'react';
import { Copy, Trash2, Workflow } from 'lucide-react';
import { PropertyField, type FieldDefinition } from '../../components/PropertyField';
import { catalog, type Block, type Graph } from '../../engine';
import { BlockIdEditor } from './BlockIdEditor';
import { DatabaseManager } from './DatabaseManager';

type Props = {
  chosen: Block | undefined;
  graph?: Graph;
  nameField: FieldDefinition | undefined;
  configFields: FieldDefinition[];
  connections: ReactNode;
  onChangeConfig?: (config: Record<string, string>) => void;
  onRenameId?: (newId: string) => boolean | void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function InspectorPanel({
  chosen,
  graph,
  nameField,
  configFields,
  connections,
  onChangeConfig,
  onRenameId,
  onDuplicate,
  onDelete,
}: Props) {
  if (!chosen) {
    return (
      <div className="inspector">
        <div className="empty">
          <Workflow size={28} />
          <h3>Nenhum bloco selecionado</h3>
          <p>Selecione um bloco no canvas para editar propriedades e conexões.</p>
        </div>
      </div>
    );
  }

  const def = catalog[chosen.data.kind];

  return (
    <div className="inspector">
      <div className="inspector-content">
        <div className="selected-kind">
          <span style={{ '--kind-color': def.color } as CSSProperties}>{def.icon}</span>
          <div>
            <div className="kind-header-top">
              <small>{def.category}</small>
              <span className="block-id-badge" title={'ID: ' + chosen.id}>
                #{chosen.id}
              </span>
            </div>
            <h2>{def.name}</h2>
          </div>
        </div>

        {graph && onRenameId && (
          <BlockIdEditor chosen={chosen} graph={graph} onRename={onRenameId} />
        )}

        {nameField && <PropertyField {...nameField} />}

        <div className="form-separator">CONFIGURAÇÃO</div>
        {chosen.data.kind === 'database' && onChangeConfig && (
          <DatabaseManager block={chosen} onChange={onChangeConfig} />
        )}
        {configFields.map((field) => (
          <PropertyField key={field.id} {...field} />
        ))}

        <div className="form-separator">CONEXÕES</div>
        {connections}

        <div className="block-actions">
          <button className="secondary" onClick={onDuplicate}>
            <Copy size={14} /> Duplicar
          </button>
          <button className="danger" title="Excluir bloco" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
