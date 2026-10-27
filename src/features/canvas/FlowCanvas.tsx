import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import {
  Boxes,
  Cable,
  LayoutGrid,
  MousePointer2,
  Plus,
  RotateCcw,
  Workflow,
  X,
} from 'lucide-react';
import {
  catalog,
  syncGraphCode,
  validateConnection,
  type Block,
  type BlockData,
  type Graph,
  type Trace,
} from '../../engine';
import {
  addFlowToGraph,
  organizeGraphByFlow,
  preventBlockCollision,
  pruneEdges,
  removeFlowFromGraph,
} from '../../state/graphOps';
import { BlockNode, type FlowNode } from './BlockNode';
import { DEFAULT_VIEWPORT, GRID_SNAP_SIZE, getGraphFlows } from './constants';
import { toFlowEdges, toFlowNodes } from './toFlow';
import { TimeTravelPanel } from './TimeTravelPanel';
import type { Simulation } from '../../state/useSimulation';

const nodeTypes = { block: BlockNode };

type Props = {
  graph: Graph;
  selected: string | null;
  activeScreenId: string;
  onSelectScreen: (screenId: string) => void;
  trace: Trace[];
  errorCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddScreen: () => void;
  onSelect: (id: string | null) => void;
  /** Aplica uma alteração; `undoable` indica se deve entrar no histórico. */
  onGraphChange: (update: (g: Graph) => Graph, undoable: boolean) => void;
  onConnect: (c: Connection) => void;
  onDragStart: () => void;
  onDragStop: () => void;
  /** Ref para o elemento da área do canvas (usada para centralizar novos blocos). */
  containerRef?: RefObject<HTMLElement | null>;
  /** Simulação e depurador visual integrado */
  simulation?: Simulation;
  /** Estado de exibição da linha do tempo Time-Travel */
  isTimeTravelOpen?: boolean;
  onCloseTimeTravel?: () => void;
};

export function FlowCanvas(p: Props) {
  const screens = p.graph.nodes.filter((n) => n.data.kind === 'screen');
  const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Identifica a tela ativa da barra de abas
  const activeScreenId =
    p.activeScreenId && screens.some((s) => s.id === p.activeScreenId)
      ? p.activeScreenId
      : screens[0]?.id || '';

  const debugOptions = p.simulation
    ? {
        breakpoints: p.simulation.debuggerState.breakpoints,
        currentBlockId: p.simulation.debuggerState.currentBlockId,
        status: p.simulation.debuggerState.status,
        onToggleBreakpoint: p.simulation.toggleBreakpoint,
        activeFrame: p.simulation.activeFrame,
      }
    : undefined;

  // Informações da linha/conexão em evidência para destacar os blocos de origem e destino
  const selectedEdgeInfo = useMemo(() => {
    if (!selectedEdgeId) return null;
    const standard = p.graph.edges.find((e) => e.id === selectedEdgeId);
    if (standard) return { source: standard.source, target: standard.target };
    if (selectedEdgeId.startsWith('route:')) {
      const parts = selectedEdgeId.split(':');
      return { source: parts[1], target: parts[2] };
    }
    return null;
  }, [selectedEdgeId, p.graph.edges]);

  // Filtra nós e conexões exclusivos para a aba de tela selecionada
  const flowNodes = toFlowNodes(
    p.graph,
    p.selected,
    activeScreenId,
    debugOptions,
    selectedEdgeInfo,
  );
  const visibleNodeIds = new Set(flowNodes.map((n) => n.id));
  const flowEdges = toFlowEdges(
    p.graph,
    p.trace,
    visibleNodeIds,
    p.simulation?.activeFrame,
    selectedEdgeId,
  );

  // Cancela o destaque de conexão ao pressionar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Rastreia o início do arrasto de conexão para permitir soltar na aba da tela
  const connectingRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAddingFlow, setIsAddingFlow] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const flows = getGraphFlows(p.graph.flows);

  function handleConnectToScreen(targetScreenId: string) {
    if (!connectingRef.current?.nodeId || !connectingRef.current?.handleId) return;
    if (targetScreenId === activeScreenId) return;

    const sourceNodeId = connectingRef.current.nodeId;
    const sourceHandleId = connectingRef.current.handleId;
    const targetHandle = sourceHandleId === 'user' ? 'user' : 'onEnter';

    p.onConnect({
      source: sourceNodeId,
      sourceHandle: sourceHandleId,
      target: targetScreenId,
      targetHandle,
    });

    connectingRef.current = null;
    setIsConnecting(false);
  }

  function handleSelectScreen(screenId: string) {
    setSelectedEdgeId(null);
    p.onSelectScreen(screenId);
    p.onSelect(screenId);
  }

  const handleNodesChange = (changes: NodeChange<FlowNode>[]) =>
    p.onGraphChange(
      (g) =>
        pruneEdges({ ...g, nodes: applyNodeChanges(changes, g.nodes as FlowNode[]) as Block[] }),
      changes.some((c) => c.type === 'remove'),
    );

  const handleEdgesChange = (changes: EdgeChange[]) =>
    p.onGraphChange(
      (g) => {
        const nextEdges = applyEdgeChanges(changes, g.edges as Edge[]);
        const nextGraph = { ...g, edges: nextEdges };
        return changes.some((c) => c.type === 'remove') ? syncGraphCode(nextGraph) : nextGraph;
      },
      changes.some((c) => c.type === 'remove'),
    );

  return (
    <main className="canvas-area" ref={p.containerRef}>
      <div className="canvas-bar">
        <div className="canvas-bar-left">
          <span className="canvas-dot" /> Telas
          {screens.length > 0 && (
            <>
              <span className="divider">/</span>
              <div className="canvas-screen-tabs" role="tablist" aria-label="Abas de telas">
                {screens.map((screen) => {
                  const isActive = screen.id === activeScreenId;
                  const isOther = screen.id !== activeScreenId;
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-screen-tab-id={screen.id}
                      className={`canvas-screen-tab ${isActive ? 'active' : ''} ${
                        isConnecting && isOther ? 'droppable-target' : ''
                      }`}
                      onClick={() => handleSelectScreen(screen.id)}
                      onMouseUp={() => handleConnectToScreen(screen.id)}
                      title={
                        isConnecting && isOther
                          ? `Solte para conectar ${connectingRef.current?.handleId || ''} em ${screen.data.label}`
                          : `Focar na tela: ${screen.data.label || screen.id}`
                      }
                    >
                      <span className="canvas-screen-tab-label">
                        {screen.data.label || screen.id}
                      </span>
                      {isActive && <span className="canvas-screen-tab-glow" />}
                      {isConnecting && isOther && (
                        <span className="screen-tab-drop-hint">conectar ↵</span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="canvas-screen-tab-add"
                  title="Adicionar nova tela"
                  aria-label="Adicionar nova tela"
                  onClick={p.onAddScreen}
                >
                  <Plus size={12} />
                  <span>Nova tela</span>
                </button>
              </div>
            </>
          )}
        </div>
        <div className="canvas-tools">
          <button title="Desfazer" onClick={p.onUndo} disabled={!p.canUndo}>
            <RotateCcw size={15} />
          </button>
          <button title="Refazer" onClick={p.onRedo} disabled={!p.canRedo}>
            ↪
          </button>
        </div>
      </div>

      <div className="canvas-flow-phases-bar" aria-label="Fluxos do projeto">
        <span className="flow-phases-label">Fluxos:</span>
        {flows.map((flow, idx) => (
          <div
            key={flow.id}
            className="flow-phase-chip"
            style={{ '--phase-color': flow.color } as CSSProperties}
            title={`Fluxo ${idx + 1}: ${flow.name}`}
          >
            <span className="phase-num">{idx + 1}</span>
            <span className="phase-title">{flow.name}</span>
            {flows.length > 1 && (
              <button
                type="button"
                className="flow-phase-remove"
                title={`Remover fluxo "${flow.name}"`}
                aria-label={`Remover fluxo "${flow.name}"`}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onGraphChange((g) => removeFlowFromGraph(g, flow.id), true);
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {isAddingFlow ? (
          <form
            className="flow-phase-add-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (newFlowName.trim()) {
                p.onGraphChange((g) => addFlowToGraph(g, newFlowName.trim()), true);
                setNewFlowName('');
                setIsAddingFlow(false);
              }
            }}
          >
            <input
              type="text"
              className="flow-phase-input"
              placeholder="Nome do novo fluxo..."
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="flow-phase-add-confirm">
              Adicionar
            </button>
            <button
              type="button"
              className="flow-phase-add-cancel"
              onClick={() => {
                setNewFlowName('');
                setIsAddingFlow(false);
              }}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="flow-phase-add-btn"
            onClick={() => setIsAddingFlow(true)}
            title="Adicionar novo fluxo ao projeto"
          >
            <Plus size={11} />
            <span>Novo Fluxo</span>
          </button>
        )}

        <button
          type="button"
          className="flow-phase-organize-btn"
          title="Organizar fluxo automaticamente em colunas por fases"
          aria-label="Organizar fluxo"
          onClick={() => p.onGraphChange((g) => organizeGraphByFlow(g, activeScreenId), true)}
        >
          <LayoutGrid size={13} />
        </button>
      </div>

      {flowNodes.length === 0 && (
        <div className="blank-canvas">
          <Workflow size={36} />
          <h2>Esta tela está vazia.</h2>
          <p>
            Adicione botões, entradas e funções na barra lateral para construir o fluxo desta tela.
          </p>
        </div>
      )}

      <ReactFlow<FlowNode>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        isValidConnection={(c) => !validateConnection(p.graph, c)}
        onConnect={p.onConnect}
        onConnectStart={(_, params) => {
          connectingRef.current = { nodeId: params.nodeId, handleId: params.handleId };
          setIsConnecting(true);
        }}
        onConnectEnd={(event) => {
          setIsConnecting(false);
          const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX;
          const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY;
          if (clientX !== undefined && clientY !== undefined) {
            const elem = document.elementFromPoint(clientX, clientY);
            const tabElem = elem?.closest<HTMLElement>('[data-screen-tab-id]');
            if (tabElem?.dataset.screenTabId) {
              handleConnectToScreen(tabElem.dataset.screenTabId);
            }
          }
          connectingRef.current = null;
        }}
        onEdgeClick={(_, edge) => {
          setSelectedEdgeId((curr) => (curr === edge.id ? null : edge.id));
        }}
        onNodeClick={(_, n) => {
          setSelectedEdgeId(null);
          p.onSelect(n.id);
        }}
        onPaneClick={() => {
          setSelectedEdgeId(null);
          p.onSelect(null);
        }}
        onNodeDragStart={p.onDragStart}
        onNodeDragStop={(_, node) => {
          p.onGraphChange(
            (g) => ({
              ...g,
              nodes: preventBlockCollision(g.nodes, node.id),
            }),
            false,
          );
          p.onDragStop();
        }}
        snapToGrid={true}
        snapGrid={[GRID_SNAP_SIZE, GRID_SNAP_SIZE]}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Controls showInteractive={false} />
        <MiniMap
          style={{ width: 220, height: 140 }}
          nodeColor={(n) => catalog[(n.data as BlockData).kind]?.color || '#818cf8'}
          nodeStrokeColor="rgba(255, 255, 255, 0.2)"
          nodeStrokeWidth={1}
          nodeBorderRadius={4}
          maskColor="rgba(10, 12, 18, 0.68)"
          maskStrokeColor="#818cf8"
          maskStrokeWidth={2}
          position="bottom-right"
          pannable
          zoomable
          offsetScale={8}
        />
      </ReactFlow>

      {p.simulation && (p.isTimeTravelOpen ?? isTimeTravelOpen) && (
        <TimeTravelPanel
          simulation={p.simulation}
          onClose={p.onCloseTimeTravel || (() => setIsTimeTravelOpen(false))}
        />
      )}

      <div className="canvas-footer">
        <div className="footer-stats">
          <span className="footer-stat" title="Total de blocos no projeto">
            <Boxes size={12} />
            <strong>{p.graph.nodes.length}</strong>
            <span>{p.graph.nodes.length === 1 ? 'bloco' : 'blocos'}</span>
          </span>
          <span className="footer-divider">/</span>
          <span className="footer-stat" title="Total de fluxos cadastrados">
            <Workflow size={12} />
            <strong>{flows.length}</strong>
            <span>{flows.length === 1 ? 'fluxo' : 'fluxos'}</span>
          </span>
          <span className="footer-divider">/</span>
          <span className="footer-stat" title="Total de conexões entre blocos">
            <Cable size={12} />
            <strong>{p.graph.edges.length}</strong>
            <span>{p.graph.edges.length === 1 ? 'conexão' : 'conexões'}</span>
          </span>
        </div>

        <div className="footer-right">
          <span className="footer-hint">
            <MousePointer2 size={12} /> Arraste para mover · Conecte pelas portas
          </span>
          <span className="footer-status">
            <i className={p.errorCount ? 'warning' : 'ok'} />
            {p.errorCount ? `${p.errorCount} ajuste(s) pendente(s)` : 'Fluxo válido'}
          </span>
          <span className="footer-version">IR v1</span>
        </div>
      </div>
    </main>
  );
}
