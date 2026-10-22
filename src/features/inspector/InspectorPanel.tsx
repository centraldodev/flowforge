import type { CSSProperties, ReactNode } from 'react';
import { Copy, Settings2, Trash2, Workflow } from 'lucide-react';
import { PropertyField, type FieldDefinition } from '../../components/PropertyField';
import { catalog, simulatedKinds, type Block } from '../../engine';

type Props = {
  chosen: Block | undefined;
  nameField: FieldDefinition | undefined;
  configFields: FieldDefinition[];
  connections: ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function InspectorPanel({
  chosen,
  nameField,
  configFields,
  connections,
  onDuplicate,
  onDelete,
}: Props) {
  if (!chosen) {
    return (
      <div className="inspector">
        <div className="inspector-tabs">
          <span className="inspector-section-label">
            <Settings2 size={14} /> Propriedades
          </span>
        </div>
        <div className="empty">
          <Workflow size={36} />
          <h2>Uma ideia de cada vez</h2>
          <p>Selecione um bloco para configurar suas propriedades e conexões.</p>
        </div>
      </div>
    );
  }

  const def = catalog[chosen.data.kind];
  const isSimulated = simulatedKinds.includes(chosen.data.kind);

  return (
    <div className="inspector">
      <div className="inspector-tabs">
        <span className="inspector-section-label">
          <Settings2 size={14} /> Propriedades
        </span>
      </div>

      <div className="inspector-content">
        <div className="selected-kind">
          <span style={{ '--kind-color': def.color } as CSSProperties}>{def.icon}</span>
          <div>
            <div className="kind-header-top">
              <small>{def.category}</small>
              <span className="block-id-badge" title={'ID: ' + chosen.id}>
                #{chosen.id.length > 8 ? chosen.id.slice(0, 8) : chosen.id}
              </span>
            </div>
            <h2>{def.name}</h2>
          </div>
        </div>

        {nameField && <PropertyField {...nameField} />}

        <div className="form-separator">CONFIGURAÇÃO</div>
        {configFields.map((field) => (
          <PropertyField key={field.id} {...field} />
        ))}

        <div className="info-box">
          <span>◈</span>
          <strong>{isSimulated ? 'Modo simulação' : 'Como conectar'}</strong>
          <p>
            {isSimulated
              ? 'Este bloco usa dados locais de exemplo. Você poderá implementar a integração real no código exportado.'
              : 'Saídas "next", "true" e "false" continuam a execução. Saídas "value" alimentam entradas de dados.'}
          </p>
        </div>

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
