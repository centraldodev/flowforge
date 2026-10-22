import type { CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { catalog, ports, type Block, type BlockData } from '../../engine';

export type FlowNode = Node<BlockData, 'block'>;

const PORT_TOP = 112;
const PORT_GAP = 24;

const outputLabels: Record<string, string> = {
  next: 'próximo',
  value: 'valor',
  true: 'sim',
  false: 'não',
};

/** Linha de resumo exibida abaixo do nome do bloco. */
function subtitle(data: Block['data']): string {
  const c = data.config;
  switch (data.kind) {
    case 'input':
      return c.placeholder;
    case 'auth':
      return `${c.provider} · ${c.mode === 'register' ? 'cadastro' : 'autenticação'}`;
    case 'api':
      return `${c.method} ${c.url}`;
    case 'condition':
      return 'Se / então / senão';
    case 'screen':
      return c.title;
    default:
      return catalog[data.kind].description;
  }
}

export function BlockNode({ data, selected }: NodeProps<FlowNode>) {
  const def = catalog[data.kind];
  const { inputs, outputs } = ports(data.kind);

  return (
    <div
      className={'block ' + (selected ? 'selected' : '')}
      style={{ '--block-color': def.color } as CSSProperties}
    >
      <div className="block-heading">
        <span className="block-icon">{def.icon}</span>
        <span>{def.name}</span>
        <span className="dots">···</span>
      </div>
      <strong>{data.label}</strong>
      <div className="block-sub">{subtitle(data)}</div>
      <div className="ports">
        {inputs.map((port, i) => (
          <div key={'i' + port} className="port in" style={{ top: PORT_TOP + i * PORT_GAP }}>
            <Handle type="target" position={Position.Left} id={port} />
            <span>{port === 'exec' ? 'executar' : port}</span>
          </div>
        ))}
        {outputs.map((port, i) => (
          <div key={'o' + port} className="port out" style={{ top: PORT_TOP + i * PORT_GAP }}>
            <span>{outputLabels[port]}</span>
            <Handle type="source" position={Position.Right} id={port} />
          </div>
        ))}
        {data.kind === 'screen' && (
          // Origem visual das transições de tela (configuradas no inspetor, não por arraste).
          <div className="port out" style={{ top: PORT_TOP }}>
            <span>telas</span>
            <Handle type="source" position={Position.Right} id="routes" isConnectable={false} />
          </div>
        )}
      </div>
    </div>
  );
}

export const nodeTypes = { block: BlockNode };
