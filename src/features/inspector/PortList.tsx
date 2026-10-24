import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { getPortType, type Block, type CustomPort, type Graph } from '../../engine';

type Props = {
  block: Block;
  ports: CustomPort[];
  edges: Graph['edges'];
  onRemovePort: (portId: string) => void;
};

/** Portas configuradas no bloco, com contagem de fios e botão de remoção. */
export function PortList({ block, ports, edges, onRemovePort }: Props) {
  if (ports.length === 0) {
    return (
      <div className="ports-list">
        <div className="no-ports-notice">
          Bloco vazio sem conexões. Adicione portas abaixo para conectá-lo no canvas.
        </div>
      </div>
    );
  }

  return (
    <div className="ports-list">
      {ports.map((port) => {
        const edgeCount = edges.filter((e) =>
          port.direction === 'output'
            ? e.source === block.id && e.sourceHandle === port.id
            : e.target === block.id && e.targetHandle === port.id,
        ).length;
        const type = port.type || getPortType(port.id);

        return (
          <div className="port-chip-row" key={port.id}>
            <div className="port-chip-info">
              <span className={`direction-tag ${port.direction}`}>
                {port.direction === 'input' ? <ArrowRight size={10} /> : <ArrowLeft size={10} />}
                {port.direction === 'input' ? 'IN' : 'OUT'}
              </span>
              <strong className="port-name">{port.name}</strong>
              {type && <span className="port-type-tag">:{type}</span>}
              {edgeCount > 0 ? (
                <span className="port-edge-count">{edgeCount} fio(s)</span>
              ) : (
                <span className="port-idle-status">livre</span>
              )}
            </div>
            <button
              type="button"
              className="port-remove-btn"
              title={`Remover porta ${port.name}`}
              aria-label={`Remover porta ${port.name}`}
              onClick={() => onRemovePort(port.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
