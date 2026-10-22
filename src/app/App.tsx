import { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Connection } from '@xyflow/react';
import { demo, parseGraph, validate, type Kind, type ScreenRoute } from '../engine';
import { downloadGraph } from '../export';
import { Toast } from '../components/Toast';
import { FlowCanvas, DEFAULT_VIEWPORT } from '../features/canvas/FlowCanvas';
import { Connections } from '../features/inspector/Connections';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { InspectorShell } from '../features/inspector/InspectorShell';
import { configFields } from '../features/inspector/blockFields';
import { ExportModal } from '../features/project/ExportModal';
import { NewProjectModal } from '../features/project/NewProjectModal';
import { SettingsModal } from '../features/project/SettingsModal';
import { PreviewModal } from '../features/preview/PreviewModal';
import { Sidebar } from '../features/sidebar/Sidebar';
import {
  addBlock,
  addPortToBlock,
  connect,
  connectionError,
  createBlock,
  duplicateBlock,
  emptyGraph,
  findFreePosition,
  removeBlock,
  removeEdge,
  removePortFromBlock,
  renameBlock,
  screensOf,
  updateConfig,
} from '../state/graphOps';
import { loadSavedGraph, usePersistence } from '../state/persistence';
import { useGraphHistory } from '../state/useGraphHistory';
import { useNotice } from '../state/useNotice';
import { useSimulation } from '../state/useSimulation';
import { Header } from './Header';

type ModalType = 'preview' | 'export' | 'new' | 'settings' | null;

export function App() {
  const { graph, setGraph, commit, remember, undo, redo, canUndo, canRedo, beginDrag, endDrag } =
    useGraphHistory(loadSavedGraph);

  const [selected, setSelected] = useState<string | null>('auth');
  const [modal, setModal] = useState<ModalType>(null);
  const [sidebar, setSidebar] = useState(true);
  const [notice, setNotice] = useNotice();

  const simulation = useSimulation(graph);
  usePersistence(graph, setNotice);

  const flow = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);

  const chosen = graph.nodes.find((n) => n.id === selected);
  const errors = validate(graph);

  function handleAdd(kind: Kind) {
    const bounds = document.querySelector('.canvas-area')?.getBoundingClientRect();
    const base = bounds
      ? flow.screenToFlowPosition({
          x: bounds.left + bounds.width / 2 - 100,
          y: bounds.top + bounds.height / 2,
        })
      : { x: 100, y: 100 };

    const position = findFreePosition(graph, base);
    void flow.setCenter(position.x + 112, position.y + 100, {
      zoom: Math.max(flow.getZoom(), 0.62),
      duration: 200,
    });

    const screenId = chosen?.data.kind === 'screen' ? chosen.id : screensOf(graph)[0]?.id || '';
    const newBlock = createBlock(kind, position, screenId);
    commit((g) => addBlock(g, newBlock));
    setSelected(newBlock.id);
  }

  function handleConnect(c: Connection) {
    const err = connectionError(c);
    if (err) {
      setNotice(err);
      return;
    }
    commit((g) => connect(g, c));
  }

  function handleDuplicateChosen() {
    if (!chosen) return;
    const clone = duplicateBlock(chosen);
    commit((g) => addBlock(g, clone));
    setSelected(clone.id);
  }

  function handleDeleteChosen() {
    if (!chosen) return;
    commit((g) => removeBlock(g, chosen.id));
    setSelected(null);
  }

  function handleOpenPreview() {
    if (errors.length) {
      setNotice(errors[0]);
      return;
    }
    const firstScreen = screensOf(graph)[0]?.id || '';
    simulation.reset(firstScreen);
    setModal('preview');
  }

  function handleLoadExample() {
    commit(() => structuredClone(demo));
    setSelected('auth');
    simulation.reset();
    void flow.setViewport(DEFAULT_VIEWPORT);
  }

  function handleCreateProject(name: string) {
    commit(() => emptyGraph(name));
    setSelected(null);
    simulation.reset();
    void flow.setViewport(DEFAULT_VIEWPORT);
  }

  const nameField = chosen
    ? {
        id: 'label',
        label: 'Nome do bloco',
        value: chosen.data.label,
        onChange: (value: string) => commit((g) => renameBlock(g, chosen.id, value)),
      }
    : undefined;

  const currentConfigFields = chosen
    ? configFields(graph, chosen, (cfg) => commit((g) => updateConfig(g, chosen.id, cfg)))
    : [];

  const allInspectorFields = nameField ? [nameField, ...currentConfigFields] : currentConfigFields;

  const connections = (
    <Connections
      graph={graph}
      chosen={chosen}
      onUpdateRoutes={(routes: ScreenRoute[]) =>
        commit((g) => updateConfig(g, chosen!.id, { routes: JSON.stringify(routes) }))
      }
      onRemoveEdge={(edgeId: string) => commit((g) => removeEdge(g, edgeId))}
      onAddPort={(port) => commit((g) => addPortToBlock(g, chosen!.id, port))}
      onRemovePort={(portId) => commit((g) => removePortFromBlock(g, chosen!.id, portId))}
    />
  );

  return (
    <div className="app">
      <Header
        projectName={graph.name}
        onRenameProject={(name) => setGraph((g) => ({ ...g, name }))}
        onSimulate={handleOpenPreview}
      />

      <div className="workspace">
        <Sidebar
          expanded={sidebar}
          onToggle={() => setSidebar((v) => !v)}
          onNew={() => setModal('new')}
          onOpen={() => fileInput.current?.click()}
          onSave={() => downloadGraph(graph)}
          onSettings={() => setModal('settings')}
          onExample={handleLoadExample}
          onAdd={handleAdd}
          onExport={() => setModal('export')}
        />

        <FlowCanvas
          graph={graph}
          selected={selected}
          trace={simulation.trace}
          errorCount={errors.length}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAddScreen={() => handleAdd('screen')}
          onSelect={setSelected}
          onGraphChange={(updater, undoable) => {
            if (undoable) remember();
            setGraph(updater);
          }}
          onConnect={handleConnect}
          onDragStart={beginDrag}
          onDragStop={endDrag}
        />

        <InspectorShell
          chosen={chosen}
          fields={allInspectorFields}
          connections={connections}
          onDuplicate={handleDuplicateChosen}
          onDelete={handleDeleteChosen}
        >
          <InspectorPanel
            chosen={chosen}
            nameField={nameField}
            configFields={currentConfigFields}
            connections={connections}
            onDuplicate={handleDuplicateChosen}
            onDelete={handleDeleteChosen}
          />
        </InspectorShell>
      </div>

      <input
        type="file"
        accept=".json"
        ref={fileInput}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const imported = parseGraph(await file.text());
              commit(() => imported);
              setSelected(null);
              setNotice('Projeto importado.');
            } catch (err) {
              setNotice(String(err));
            }
            e.target.value = '';
          }
        }}
      />

      <Toast message={notice} onClose={() => setNotice('')} />

      <NewProjectModal
        isOpen={modal === 'new'}
        onClose={() => setModal(null)}
        onCreate={handleCreateProject}
      />

      <ExportModal
        isOpen={modal === 'export'}
        onClose={() => setModal(null)}
        graph={graph}
        errors={errors}
        onNotify={setNotice}
      />

      <SettingsModal isOpen={modal === 'settings'} onClose={() => setModal(null)} />

      <PreviewModal
        isOpen={modal === 'preview'}
        onClose={() => setModal(null)}
        graph={graph}
        simulation={simulation}
      />
    </div>
  );
}
