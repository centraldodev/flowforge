import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import {
  catalog,
  ensureBlockPorts,
  type BlockData,
  type FlowStage,
  type Kind,
  type LogicRecommendation,
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
  logicSummary?: string;
  codePreview?: string;
  statusKind?: 'ready' | 'incomplete' | 'error';
  statusTooltip?: string;
  connectedOutHandles?: string[];
  connectedInHandles?: string[];
  recommendations?: LogicRecommendation[];
  onQuickCreateFromPort?: (
    sourceBlockId: string,
    sourceHandle: string,
    targetKind: Kind,
    slotKey?: string,
    defaultConfig?: Record<string, string>,
  ) => void;
  onOpenBlockProperties?: (blockId: string) => void;
};

export type FlowNode = Node<FlowNodeData, 'block'>;

function formatPayloadValue(val: unknown): string {
  if (val === undefined) return '';
  if (typeof val === 'string') return val.length > 22 ? val.slice(0, 19) + '...' : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    const str = JSON.stringify(val);
    return str.length > 22 ? str.slice(0, 19) + '...' : str;
  } catch {
    return '[Obj]';
  }
}

/** Traduz IDs técnicos de portas para rótulos curtos e fáceis de entender */
const FRIENDLY_PORT_LABELS: Record<string, string> = {
  execute: 'executar',
  trigger: 'disparar',
  value: 'valor',
  input: 'entrada',
  payload: 'dados',
  connection: 'conexão',
  onEnter: 'ao abrir',
  onClick: 'ao clicar',
  then: 'próximo',
  next: 'próximo',
  valid: 'válido',
  invalid: 'inválido',
  true: 'verdadeiro',
  false: 'falso',
  onSuccess: 'sucesso',
  onError: 'erro',
  retry: 'tentar de novo',
  routes: 'ao abrir',
  case1: 'caso 1',
  case2: 'caso 2',
  default: 'padrão',
  onEvent: 'evento',
  onTick: 'horário',
  result: 'resultado',
  output: 'saída',
  user: 'usuário',
  data: 'dados',
  each: 'cada item',
  onComplete: 'ao terminar',
  items: 'lista',
  item: 'item',
};

function getFriendlyPortLabel(portId: string, rawName?: string): string {
  if (FRIENDLY_PORT_LABELS[portId]) return FRIENDLY_PORT_LABELS[portId];
  if (rawName && FRIENDLY_PORT_LABELS[rawName]) return FRIENDLY_PORT_LABELS[rawName];
  return rawName || portId;
}

/** Define a cor semântica da porta (sucesso = verde, erro/falso = vermelho, execução = roxo/azul) */
function getPortSemanticTone(portId: string): 'success' | 'danger' | 'primary' {
  if (['valid', 'true', 'onSuccess', 'then', 'next', 'onClick'].includes(portId)) {
    return 'success';
  }
  if (['invalid', 'false', 'onError'].includes(portId)) {
    return 'danger';
  }
  return 'primary';
}

/** Sugestões rápidas padrão para uma porta de saída quando o usuário clica no botão "+" */
function getQuickOptionsForOutputPort(
  kind: Kind,
  portId: string,
  recommendations?: LogicRecommendation[],
): { targetKind: Kind; label: string; slotKey?: string; defaultConfig?: Record<string, string> }[] {
  const fromRecs = (recommendations || [])
    .filter((r) => r.sourceHandle === portId)
    .map((r) => ({
      targetKind: r.targetKind,
      label: r.title,
      slotKey: r.slotKey,
      defaultConfig: r.defaultConfig,
    }));

  if (fromRecs.length > 0) return fromRecs;

  if (portId === 'invalid' || portId === 'onError' || portId === 'false') {
    return [
      { targetKind: 'error', label: 'Tratar Erro' },
      { targetKind: 'notify', label: 'Alerta de Erro', defaultConfig: { type: 'error' } },
    ];
  }
  if (kind === 'button' || portId === 'onClick') {
    return [
      { targetKind: 'validator', label: 'Validador', slotKey: 'logicTargetId' },
      { targetKind: 'auth', label: 'Autenticação', slotKey: 'logicTargetId' },
      { targetKind: 'function', label: 'Função', slotKey: 'logicTargetId' },
      { targetKind: 'screen', label: 'Abrir Tela', slotKey: 'target' },
    ];
  }
  if (kind === 'input' || portId === 'value') {
    return [
      { targetKind: 'validator', label: 'Validador', slotKey: 'logicConsumerId' },
      { targetKind: 'function', label: 'Função', slotKey: 'logicConsumerId' },
    ];
  }
  return [
    { targetKind: 'auth', label: 'Autenticação' },
    { targetKind: 'database', label: 'Banco de Dados' },
    { targetKind: 'notify', label: 'Exibir Alerta' },
    { targetKind: 'screen', label: 'Abrir Tela' },
  ];
}

export function BlockNode({ id, data, selected }: NodeProps<FlowNode>) {
  const [openPortMenu, setOpenPortMenu] = useState<string | null>(null);

  const def = catalog[data.kind] || {
    name: 'Bloco',
    icon: 'widgets',
    color: '#818cf8',
  };

  const flows = getGraphFlows((data as { flows?: FlowStage[] }).flows);
  const { index, flow } = resolveBlockFlow(flows, data.kind, id, data.config.flowId);

  const title = (() => {
    if (!data.label) return def.name;
    const label = data.label.trim();
    const kindName = def.name.trim();
    if (label.toLowerCase() === kindName.toLowerCase()) return label;
    if (label.toLowerCase().includes(kindName.toLowerCase())) return label;
    if (label.includes('—') || label.includes('-')) return label;
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
        label: getFriendlyPortLabel(p.id, p.name),
        value: displayVal,
        isDebugValue: debugVal !== undefined,
        isConnected: Boolean(data.connectedInHandles?.includes(p.id)),
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
        label: getFriendlyPortLabel(p.id, p.name),
        tone: getPortSemanticTone(p.id),
        value: displayVal,
        isDebugValue: debugVal !== undefined,
        isConnectable: p.id !== 'routes' || data.kind !== 'screen',
        isConnected: Boolean(data.connectedOutHandles?.includes(p.id)),
      };
    });

  const hasIn = inPorts.length > 0;
  const hasOut = outPorts.length > 0;
  const maxRows = Math.max(inPorts.length, outPorts.length);

  const handleBreakpointClick = (e: MouseEvent) => {
    e.stopPropagation();
    data.onToggleBreakpoint?.(id);
  };

  const handleOpenPropsClick = (e: MouseEvent) => {
    e.stopPropagation();
    data.onOpenBlockProperties?.(id);
  };

  const statusKind = data.statusKind || 'ready';

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
    <div
      className={blockClasses}
      style={{ '--block-color': def.color } as CSSProperties}
      onDoubleClick={handleOpenPropsClick}
    >
      {/* 1. Cabeçalho Compacto com Status e Botão Direto de Propriedades */}
      <div className="block-heading">
        <div className="block-heading-main">
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

          <span className="block-icon">
            <span className="material-symbols-outlined">{def.icon}</span>
          </span>
          <span className="block-title" title={title}>
            {title}
          </span>

          {/* Indicador de Status do Bloco (Pronto / Pendente / Erro) */}
          <span
            className={`block-status-dot status-${statusKind}`}
            title={data.statusTooltip || 'Status do bloco'}
          />

          {/* Botão rápido para abrir o modal de Propriedades & Lógica */}
          {data.onOpenBlockProperties && (
            <button
              type="button"
              className="block-quick-props-btn nodrag"
              title="Abrir Propriedades e Lógica (ou dê duplo clique no bloco)"
              onClick={handleOpenPropsClick}
            >
              <SlidersHorizontal size={12} />
            </button>
          )}
        </div>

        <div className="block-heading-meta">
          {data.connectionRole === 'source' && (
            <span className="block-connection-role-badge source">Origem</span>
          )}
          {data.connectionRole === 'target' && (
            <span className="block-connection-role-badge target">Destino</span>
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

      {/* 2. Faixa de Resumo da Regra / Código ao Vivo dentro do Bloco */}
      {data.codePreview && (
        <div
          className="block-inline-code-strip"
          title="Clique duplo para editar a lógica deste bloco"
        >
          <code>{data.codePreview}</code>
        </div>
      )}

      {/* 3. Portas Simplificadas (sem cabeçalhos técnicos IN/OUT e sem tipos :Any/:Event) */}
      {(hasIn || hasOut) && (
        <div className="ports">
          <div className="ports-rows">
            {Array.from({ length: maxRows }, (_, i) => {
              const inPort = inPorts[i];
              const outPort = outPorts[i];
              const isMenuOpen = outPort && openPortMenu === outPort.id;
              const quickOpts = outPort
                ? getQuickOptionsForOutputPort(data.kind, outPort.id, data.recommendations)
                : [];

              return (
                <div key={i} className="port-row">
                  {/* Porta de Entrada */}
                  {inPort ? (
                    <div className="port in" title={`Entrada: ${inPort.label}`}>
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={inPort.id}
                        className={`port-handle in-handle ${inPort.isConnected ? 'is-connected' : ''}`}
                      />
                      <span className="port-label">
                        <span className="port-name">{inPort.label}</span>
                        {inPort.value && (
                          <span
                            className={`port-val ${inPort.isDebugValue ? 'debug-val-badge' : ''}`}
                          >
                            {inPort.value}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="port in-empty" />
                  )}

                  {/* Porta de Saída + Botão "+" de Conexão Rápida */}
                  {outPort ? (
                    <div
                      className={`port out tone-${outPort.tone}`}
                      title={`Saída: ${outPort.label}`}
                    >
                      <span className="port-label">
                        <span className={`port-name tone-${outPort.tone}`}>{outPort.label}</span>
                        {outPort.value && (
                          <span
                            className={`port-val ${outPort.isDebugValue ? 'debug-val-badge' : ''}`}
                          >
                            {outPort.value}
                          </span>
                        )}
                      </span>

                      {/* Botão "+" rápido para criar e conectar o próximo bloco diretamente no canvas */}
                      {data.onQuickCreateFromPort && outPort.isConnectable && (
                        <div className="port-quick-add-wrap nodrag">
                          <button
                            type="button"
                            className={`port-quick-add-btn ${outPort.isConnected ? 'is-connected' : ''}`}
                            title={`Adicionar e conectar bloco na saída "${outPort.label}"`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPortMenu((curr) => (curr === outPort.id ? null : outPort.id));
                            }}
                          >
                            <Plus size={10} />
                          </button>

                          {isMenuOpen && (
                            <div className="port-quick-menu" onClick={(e) => e.stopPropagation()}>
                              <div className="port-quick-menu-title">
                                Conectar em <strong>{outPort.label}</strong>:
                              </div>
                              {quickOpts.map((opt, idx) => {
                                const targetDef = catalog[opt.targetKind];
                                return (
                                  <button
                                    key={`${opt.targetKind}-${idx}`}
                                    type="button"
                                    className="port-quick-menu-item"
                                    onClick={() => {
                                      data.onQuickCreateFromPort?.(
                                        id,
                                        outPort.id,
                                        opt.targetKind,
                                        opt.slotKey,
                                        opt.defaultConfig,
                                      );
                                      setOpenPortMenu(null);
                                    }}
                                  >
                                    {targetDef && (
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: 14, color: targetDef.color }}
                                      >
                                        {targetDef.icon}
                                      </span>
                                    )}
                                    <span>+ {opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <Handle
                        type="source"
                        position={Position.Right}
                        id={outPort.id}
                        isConnectable={outPort.isConnectable}
                        className={`port-handle out-handle tone-${outPort.tone} ${outPort.isConnected ? 'is-connected' : ''}`}
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
      )}
    </div>
  );
}
