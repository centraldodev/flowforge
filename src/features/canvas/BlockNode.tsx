import type { CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { catalog, ports, type Block, type BlockData } from '../../engine';

export type FlowNode = Node<BlockData, 'block'>;

/** Linha de resumo exibida abaixo do nome do bloco. */
function subtitle(data: Block['data']): string {
  const c = data.config;
  switch (data.kind) {
    case 'input':
      return c.placeholder ? `"${c.placeholder}"` : 'Campo de entrada';
    case 'textarea':
      return c.placeholder ? `"${c.placeholder}"` : 'Área de texto';
    case 'select':
      return c.options ? `Opções: ${c.options}` : 'Lista de seleção';
    case 'checkbox':
      return c.value === 'true' ? 'Marcado por padrão' : 'Desmarcado por padrão';
    case 'constant':
      return `${c.valueType || 'texto'}: ${c.value || '""'}`;
    case 'variable':
      return `${c.operation === 'get' ? 'Ler' : 'Definir'} ${c.key || 'variável'}`;
    case 'validation':
      return `Regra: ${c.rule || 'obrigatório'}${c.minimum ? ` (mín: ${c.minimum})` : ''}`;
    case 'transform':
      return `Operação: ${c.operation || 'transformar'}`;
    case 'notify':
      return c.message ? `"${c.message}"` : 'Mensagem ao usuário';
    case 'auth':
      return `${c.provider} · ${c.mode === 'register' ? 'cadastro' : 'autenticação'}`;
    case 'api':
      return `${c.method || 'GET'} ${c.url || '/api'}`;
    case 'database':
      return `${c.operation === 'insert' ? 'Inserir em' : 'Consultar'} ${c.table || 'tabela'}`;
    case 'condition':
      return c.compare ? `Se ${c.operator} "${c.compare}"` : 'Se / então / senão';
    case 'math':
      return `${c.operation || 'somar'} (a, b)`;
    case 'navigate':
      return c.target ? `Ir para: ${c.target}` : 'Navegar para tela';
    case 'reset':
      return `Redefinir via ${c.channel || 'email'}`;
    case 'screen':
      return c.title || 'Tela do aplicativo';
    case 'text':
      return c.text
        ? c.text.length > 36
          ? c.text.slice(0, 36) + '…'
          : c.text
        : catalog.text.description;
    case 'class':
      return c.fields ? `Campos: ${c.fields}` : catalog.class.description;
    default:
      return catalog[data.kind]?.description || '';
  }
}

export function BlockNode({ id, data, selected }: NodeProps<FlowNode>) {
  const def = catalog[data.kind];

  const inPorts =
    data.ports !== undefined
      ? data.ports.filter((p) => p.direction === 'input').map((p) => ({ id: p.id, label: p.name }))
      : ports(data.kind).inputs.map((p) => ({ id: p, label: p }));

  const outPorts =
    data.ports !== undefined
      ? data.ports
          .filter((p) => p.direction === 'output')
          .map((p) => ({
            id: p.id,
            label: p.name,
            isConnectable: p.id !== 'routes' || data.kind !== 'screen',
          }))
      : [
          ...ports(data.kind).outputs.map((p) => ({
            id: p,
            label: p,
            isConnectable: true,
          })),
          ...(data.kind === 'screen'
            ? [{ id: 'routes', label: 'routes', isConnectable: false }]
            : []),
        ];

  const maxRows = Math.max(inPorts.length, outPorts.length);

  return (
    <div
      className={'block ' + (selected ? 'selected' : '')}
      style={{ '--block-color': def.color } as CSSProperties}
    >
      <div className="block-heading">
        <span className="block-icon">{def.icon}</span>
        <span>{def.name}</span>
        <span className="block-id-tag" title={'ID: ' + id}>
          #{id.length > 8 ? id.slice(0, 8) : id}
        </span>
        <span className="dots">···</span>
      </div>
      <strong>{data.label}</strong>
      <div className="block-sub">{subtitle(data)}</div>
      {maxRows > 0 && (
        <div className="ports">
          {Array.from({ length: maxRows }, (_, i) => {
            const inPort = inPorts[i];
            const outPort = outPorts[i];
            return (
              <div key={i} className="port-row">
                {inPort ? (
                  <div className="port in">
                    <Handle type="target" position={Position.Left} id={inPort.id} />
                    <span>{inPort.label}</span>
                  </div>
                ) : (
                  <div />
                )}
                {outPort ? (
                  <div className="port out">
                    <span>{outPort.label}</span>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={outPort.id}
                      isConnectable={outPort.isConnectable}
                    />
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const nodeTypes = { block: BlockNode };
