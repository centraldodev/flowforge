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
} from '@xyflow/react';
import { MousePointer2, Plus, RotateCcw, Workflow } from 'lucide-react';
import { catalog, type Block, type BlockData, type Graph, type Trace } from '../../engine';
import { pruneEdges } from '../../state/graphOps';
import { nodeTypes, type FlowNode } from './BlockNode';
import { toFlowEdges, toFlowNodes } from './toFlow';

export const DEFAULT_VIEWPORT = { x: 25, y: 210, zoom: 0.62 };

type Props = {
  graph: Graph;
  selected: string | null;
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
        <div>
          <span className="canvas-dot" /> Editor de fluxo <span className="divider">/</span>
          <span className="muted">{p.graph.nodes.length} blocos</span>
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

      {p.graph.nodes.length === 0 && (
        <div className="blank-canvas">
          <Workflow size={36} />
          <h2>Seu projeto começa em branco.</h2>
          <p>Adicione uma tela e conecte os blocos para construir seu aplicativo.</p>
          <button className="primary" onClick={p.onAddScreen}>
            <Plus size={15} />
            Adicionar primeira tela
          </button>
        </div>
      )}

      <ReactFlow<FlowNode>
        nodes={toFlowNodes(p.graph, p.selected)}
        edges={toFlowEdges(p.graph, p.trace)}
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
          style={{ background: '#181b21', height: 90, width: 135 }}
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
