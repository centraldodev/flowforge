import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
} from '@xyflow/react';
import { MousePointer2, Plus, RotateCcw, Workflow } from 'lucide-react';
import { catalog, type Block, type BlockData, type Graph, type Trace } from '../../engine';
import { pruneEdges } from '../../state/graphOps';
import { nodeTypes, type FlowNode } from './BlockNode';
import { toFlowEdges, toFlowNodes } from './toFlow';

export const DEFAULT_VIEWPORT = { x: 30, y: 70, zoom: 0.72 };

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
};

export function FlowCanvas(p: Props) {
  const screens = p.graph.nodes.filter((n) => n.data.kind === 'screen');

  // Identifica a tela ativa da barra de abas
  const activeScreenId =
    p.activeScreenId && screens.some((s) => s.id === p.activeScreenId)
      ? p.activeScreenId
      : screens[0]?.id || '';

  // Filtra nós e conexões exclusivos para a aba de tela selecionada
  const flowNodes = toFlowNodes(p.graph, p.selected, activeScreenId);
  const visibleNodeIds = new Set(flowNodes.map((n) => n.id));
  const flowEdges = toFlowEdges(p.graph, p.trace, visibleNodeIds);

  function handleSelectScreen(screenId: string) {
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
      (g) => ({ ...g, edges: applyEdgeChanges(changes, g.edges as Edge[]) }),
      changes.some((c) => c.type === 'remove'),
    );

  return (
    <main className="canvas-area">
      <div className="canvas-bar">
        <div className="canvas-bar-left">
          <span className="canvas-dot" /> Editor de fluxo <span className="divider">/</span>
          <span className="muted">{p.graph.nodes.length} blocos</span>
          {screens.length > 0 && (
            <>
              <span className="divider">/</span>
              <div className="canvas-screen-tabs" role="tablist" aria-label="Abas de telas">
                {screens.map((screen) => {
                  const isActive = screen.id === activeScreenId;
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`canvas-screen-tab ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectScreen(screen.id)}
                      title={`Focar na tela: ${screen.data.label || screen.id}`}
                    >
                      <span className="canvas-screen-tab-icon">📱</span>
                      <span className="canvas-screen-tab-label">
                        {screen.data.label || screen.id}
                      </span>
                      {isActive && <span className="canvas-screen-tab-glow" />}
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
          <button
            className="add-screen-button"
            title="Adicionar tela"
            aria-label="Adicionar tela"
            onClick={p.onAddScreen}
          >
            <Plus size={16} />
            Adicionar tela
          </button>
        </div>
      </div>

      {flowNodes.length === 0 && (
        <div className="blank-canvas">
          <Workflow size={36} />
          <h2>Esta tela está vazia.</h2>
          <p>Adicione botões, entradas e funções na barra lateral para construir o fluxo desta tela.</p>
        </div>
      )}

      <ReactFlow<FlowNode>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={p.onConnect}
        onNodeClick={(_, n) => p.onSelect(n.id)}
        onPaneClick={() => p.onSelect(null)}
        onNodeDragStart={p.onDragStart}
        onNodeDragStop={p.onDragStop}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background color="#343740" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => catalog[(n.data as BlockData).kind].color}
          maskColor="#111318c9"
        />
      </ReactFlow>

      <div className="canvas-footer">
        <span>
          <MousePointer2 size={13} /> Arraste para mover · Conecte pelas portas
        </span>
        <span>
          <i className={p.errorCount ? 'warning' : 'ok'} />
          {p.errorCount ? `${p.errorCount} ajuste(s) pendente(s)` : 'Fluxo válido'}
          <span className="footer-version">IR v1</span>
        </span>
      </div>
    </main>
  );
}
