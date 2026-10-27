import type { CSSProperties, MouseEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  catalog,
  ensureBlockPorts,
  formatValueType,
  getPortType,
  type BlockData,
  type FlowStage,
} from '../../engine';
import { getGraphFlows, resolveBlockFlow } from './constants';

export type FlowNodeData = BlockData & {
  flows?: FlowStage[];
  hasBreakpoint?: boolean;
  isPausedHere?: boolean;
  isExecuting?: boolean;
  onToggleBreakpoint?: (id: string) => void;
  connectionRole?: 'source' | 'target' | null;
  isConnectionDimmed?: boolean;
  debugPayload?: {
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
  };
};

export type FlowNode = Node<FlowNodeData, 'block'>;

function formatPayloadValue(val: unknown): string {
  if (val === undefined) return '';
  if (typeof val === 'string') return val.length > 25 ? val.slice(0, 22) + '...' : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    const str = JSON.stringify(val);
    return str.length > 25 ? str.slice(0, 22) + '...' : str;
  } catch {
    return '[Obj]';
  }
}

export function BlockNode({ id, data, selected }: NodeProps<FlowNode>) {
  const def = catalog[data.kind] || {
    name: 'Bloco',
    icon: '📦',
    color: '#818cf8',
  };

  const flows = getGraphFlows((data as { flows?: FlowStage[] }).flows);
  const { index, flow } = resolveBlockFlow(flows, data.kind, id, data.config.flowId);

  // Formata o título no padrão visual: "Botão — Entrar", "Autenticação — Login", etc.
  const title = (() => {
    if (!data.label) return def.name;
    const label = data.label.trim();
    const kindName = def.name.trim();
    if (label.toLowerCase() === kindName.toLowerCase()) return label;
    if (label.toLowerCase().includes(kindName.toLowerCase())) return label;
    if (label.includes('—') || label.includes('-')) return label;
    // Se for tela ou input simples, prioriza o label direto se for descritivo
    if (data.kind === 'screen' || data.kind === 'input') return label;
    return `${kindName} — ${label}`;
  })();

  const rawPorts =
    data.ports !== undefined
      ? data.ports
      : ensureBlockPorts({ id, data, position: { x: 0, y: 0 } });

  const inPorts = rawPorts
    .filter((p) => p.direction === 'input')
    .map((p) => {
      const debugVal = data.debugPayload?.inputs?.[p.id];
      const displayVal =
        debugVal !== undefined
          ? formatPayloadValue(debugVal)
          : (p as { value?: string }).value ||
            (p.id === 'route' && data.config.target ? `/${data.config.target}` : undefined);

      return {
        id: p.id,
        label: p.name || p.id,
        type: p.type || (p.valueType ? formatValueType(p.valueType) : getPortType(p.id)),
        value: displayVal,
        isDebugValue: debugVal !== undefined,
      };
    });

  const outPorts = rawPorts
    .filter((p) => p.direction === 'output')
    .map((p) => {
      const debugVal =
        data.debugPayload?.outputs?.[p.id] ??
        (p.id === 'value' ? data.debugPayload?.outputs?.['value'] : undefined);
      const displayVal =
        debugVal !== undefined ? formatPayloadValue(debugVal) : (p as { value?: string }).value;

      return {
        id: p.id,
        label: p.name || p.id,
        type: p.type || (p.valueType ? formatValueType(p.valueType) : getPortType(p.id)),
        value: displayVal,
        isDebugValue: debugVal !== undefined,
        isConnectable: p.id !== 'routes' || data.kind !== 'screen',
      };
    });

  const hasIn = inPorts.length > 0;
  const hasOut = outPorts.length > 0;
  const maxRows = Math.max(inPorts.length, outPorts.length);

  const handleBreakpointClick = (e: MouseEvent) => {
    e.stopPropagation();
    data.onToggleBreakpoint?.(id);
  };

  const blockClasses = [
    'block',
    data.kind === 'screen' ? 'block-screen-tab' : '',
    selected ? 'selected' : '',
    data.hasBreakpoint ? 'has-breakpoint' : '',
    data.isPausedHere ? 'is-debug-paused' : '',
    data.isExecuting ? 'is-debug-executing' : '',
    data.connectionRole === 'source' ? 'is-connection-source' : '',
    data.connectionRole === 'target' ? 'is-connection-target' : '',
    data.isConnectionDimmed ? 'is-connection-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={blockClasses} style={{ '--block-color': def.color } as CSSProperties}>
      <div className="block-heading">
        <button
          type="button"
          className={`block-breakpoint-btn ${data.hasBreakpoint ? 'active' : ''}`}
          onClick={handleBreakpointClick}
          title={
            data.hasBreakpoint ? 'Remover breakpoint (parada)' : 'Inserir breakpoint de depuração'
          }
        >
          <span className="breakpoint-dot" />
        </button>

        <div className="block-heading-main">
          <span className="block-icon">
            <span className="material-symbols-outlined">{def.icon}</span>
          </span>
          <span className="block-title" title={title}>
            {title}
          </span>
        </div>
        <div className="block-heading-meta">
          {data.connectionRole === 'source' && (
            <span
              className="block-connection-role-badge source"
              title="Origem da conexão selecionada"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                arrow_forward
              </span>
              Origem
            </span>
          )}
          {data.connectionRole === 'target' && (
            <span
              className="block-connection-role-badge target"
              title="Destino da conexão selecionada"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                input
              </span>
              Destino
            </span>
          )}
          <span
            className="block-phase-badge"
            title={`Fluxo ${index}: ${flow.name}`}
            style={{
              color: flow.color,
              borderColor: `${flow.color}45`,
              backgroundColor: `${flow.color}18`,
            }}
          >
            {index} · {flow.name}
          </span>
          <span className="block-id-tag" title={'ID: #' + id}>
            #{id}
          </span>
        </div>
      </div>

      {hasIn || hasOut ? (
        <div className="ports">
          <div className="ports-header">
            <span className="port-col in">
              {hasIn ? (inPorts.length > 1 ? 'IN · Entradas' : 'IN') : ''}
            </span>
            <span className="port-col out">
              {hasOut ? (outPorts.length > 1 ? 'OUT · Saídas' : 'OUT') : ''}
            </span>
          </div>

          <div className="ports-rows">
            {Array.from({ length: maxRows }, (_, i) => {
              const inPort = inPorts[i];
              const outPort = outPorts[i];
              return (
                <div key={i} className="port-row">
                  {inPort ? (
                    <div className="port in" title={`Entrada: ${inPort.label}`}>
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={inPort.id}
                        className="port-handle in-handle"
                      />
                      <span className="port-label">
                        <span className="port-name">{inPort.label}</span>
                        {inPort.type && (
                          <span className={`port-type type-${inPort.type.toLowerCase()}`}>
                            : {inPort.type}
                          </span>
                        )}
                        {inPort.value && (
                          <span
                            className={`port-val ${inPort.isDebugValue ? 'debug-val-badge' : ''}`}
                            title={
                              inPort.isDebugValue
                                ? `Valor inspecionado: ${inPort.value}`
                                : inPort.value
                            }
                          >
                            {inPort.value}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="port in-empty" />
                  )}

                  {outPort ? (
                    <div className="port out" title={`Saída: ${outPort.label}`}>
                      <span className="port-label">
                        <span className="port-name">{outPort.label}</span>
                        {outPort.type && (
                          <span className={`port-type type-${outPort.type.toLowerCase()}`}>
                            : {outPort.type}
                          </span>
                        )}
                        {outPort.value && (
                          <span
                            className={`port-val ${outPort.isDebugValue ? 'debug-val-badge' : ''}`}
                            title={
                              outPort.isDebugValue
                                ? `Valor inspecionado: ${outPort.value}`
                                : outPort.value
                            }
                          >
                            {outPort.value}
                          </span>
                        )}
                      </span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={outPort.id}
                        isConnectable={outPort.isConnectable}
                        className="port-handle out-handle"
                      />
                    </div>
                  ) : (
                    <div className="port out-empty" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="ports-empty">
          <span>Sem conexões configuradas</span>
        </div>
      )}
    </div>
  );
}
