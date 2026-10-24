import { useRef, useState } from 'react';
import { downloadGraph } from '../export';
import { Toast } from '../components/Toast';
import { FlowCanvas } from '../features/canvas/FlowCanvas';
import { Connections } from '../features/inspector/Connections';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { InspectorShell } from '../features/inspector/InspectorShell';
import { ExportModal } from '../features/project/ExportModal';
import { NewProjectModal } from '../features/project/NewProjectModal';
import { SettingsModal } from '../features/project/SettingsModal';
import { PreviewModal } from '../features/preview/PreviewModal';
import { Sidebar } from '../features/sidebar/Sidebar';
import { loadSavedGraph, usePersistence } from '../state/persistence';
import { useGraphHistory } from '../state/useGraphHistory';
import { useNotice } from '../state/useNotice';
import { useSimulation } from '../state/useSimulation';
import { Header } from './Header';
import { useEditorActions } from './useEditorActions';

type ModalType = 'preview' | 'export' | 'new' | 'settings' | null;

export function App() {
  const { graph, setGraph, commit, remember, undo, redo, canUndo, canRedo, beginDrag, endDrag } =
    useGraphHistory(loadSavedGraph);

  const [modal, setModal] = useState<ModalType>(null);
  const [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useNotice();
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLElement>(null);

  const simulation = useSimulation(graph);
  usePersistence(graph, setNotice);

  const editor = useEditorActions({
    graph,
    commit,
    notify: setNotice,
    resetSimulation: simulation.reset,
    canvasRef,
  });
  const { chosen, errors, actions } = editor;
  const closeModal = () => setModal(null);

  const connections = <Connections graph={graph} chosen={chosen} {...editor.connectionHandlers} />;

  return (
    <div className="app">
      <Header
        projectName={graph.name}
        onRenameProject={(name) => setGraph((g) => ({ ...g, name }))}
        onSimulate={() => actions.preparePreview() && setModal('preview')}
      />

      <div className="workspace">
        <Sidebar
          expanded={sidebar}
          onToggle={() => setSidebar((v) => !v)}
          onNew={() => setModal('new')}
          onOpen={() => fileInput.current?.click()}
          onSave={() => downloadGraph(graph)}
          onSettings={() => setModal('settings')}
          onExample={actions.loadExample}
          onAdd={actions.addBlockOfKind}
          onExport={() => setModal('export')}
        />

        <FlowCanvas
          containerRef={canvasRef}
          graph={graph}
          selected={editor.selected}
          activeScreenId={editor.currentScreenId}
          onSelectScreen={editor.setActiveScreenId}
          trace={simulation.trace}
          errorCount={errors.length}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAddScreen={actions.addScreen}
          onSelect={editor.setSelected}
          onGraphChange={(updater, undoable) => {
            if (undoable) remember();
            setGraph(updater);
          }}
          onConnect={actions.connectBlocks}
          onDragStart={beginDrag}
          onDragStop={endDrag}
        />

        <InspectorShell
          chosen={chosen}
          graph={graph}
          nameField={editor.nameField}
          onRenameId={actions.renameChosenId}
          fields={editor.fields}
          connections={connections}
          onDuplicate={actions.duplicateChosen}
          onDelete={actions.deleteChosen}
        >
          <InspectorPanel
            chosen={chosen}
            graph={graph}
            nameField={editor.nameField}
            configFields={editor.fields}
            connections={connections}
            onChangeConfig={actions.updateChosenConfig}
            onRenameId={actions.renameChosenId}
            onDuplicate={actions.duplicateChosen}
            onDelete={actions.deleteChosen}
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
          if (!file) return;
          await actions.importFile(file);
          e.target.value = '';
        }}
      />

      <Toast message={notice} onClose={() => setNotice('')} />

      <NewProjectModal
        isOpen={modal === 'new'}
        onClose={closeModal}
        onCreate={actions.createProject}
      />

      <ExportModal
        isOpen={modal === 'export'}
        onClose={closeModal}
        graph={graph}
        errors={errors}
        onNotify={setNotice}
      />

      <SettingsModal isOpen={modal === 'settings'} onClose={closeModal} />

      <PreviewModal
        isOpen={modal === 'preview'}
        onClose={closeModal}
        graph={graph}
        simulation={simulation}
      />
    </div>
  );
}
