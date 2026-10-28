import { useEffect, useRef, useState } from 'react';
import { downloadGraph } from '../export';
import { Toast } from '../components/Toast';
import { FlowCanvas } from '../features/canvas/FlowCanvas';
import { DataModelEditor } from '../features/datamodel/DataModelEditor';
import { FrontendEditor } from '../features/frontend/FrontendEditor';
import { Connections } from '../features/inspector/Connections';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { InspectorShell } from '../features/inspector/InspectorShell';
import { ExportModal } from '../features/project/ExportModal';
import { NewProjectModal } from '../features/project/NewProjectModal';
import { SettingsModal } from '../features/project/SettingsModal';
import { PreviewModal } from '../features/preview/PreviewModal';
import { CodeViewerModal } from '../features/preview/CodeViewerModal';
import { TestRunnerModal } from '../features/project/TestRunnerModal';
import { ProductionReadinessModal } from '../features/project/ProductionReadinessModal';
import { Sidebar } from '../features/sidebar/Sidebar';
import { loadSavedGraph, usePersistence } from '../state/persistence';
import { useGraphHistory } from '../state/useGraphHistory';
import { useNotice } from '../state/useNotice';
import { useSimulation } from '../state/useSimulation';
import { Header } from './Header';
import { useEditorActions } from './useEditorActions';

type ModalType = 'preview' | 'export' | 'new' | 'settings' | 'code' | 'tests' | 'readiness' | null;
export type AppTheme = 'light' | 'system' | 'dark';

export function App() {
  const { graph, setGraph, commit, remember, undo, redo, canUndo, canRedo, beginDrag, endDrag } =
    useGraphHistory(loadSavedGraph);

  const [modal, setModal] = useState<ModalType>(null);
  const [sidebar, setSidebar] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'flow' | 'frontend' | 'datamodel'>('flow');
  const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
  const [activeFlowFilter, setActiveFlowFilter] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLElement>(null);

  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    try {
      return (localStorage.getItem('flowforge_app_theme') as AppTheme) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('flowforge_app_theme', appTheme);
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const applyTheme = () => {
        const isDark = appTheme === 'dark' || (appTheme === 'system' && media.matches);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      };
      applyTheme();
      if (appTheme === 'system') {
        media.addEventListener('change', applyTheme);
        return () => media.removeEventListener('change', applyTheme);
      }
    } catch {
      // Ignora erro em ambientes sem matchMedia
    }
  }, [appTheme]);

  const simulation = useSimulation(graph);
  usePersistence(graph, setNotice);

  const editor = useEditorActions({
    graph,
    commit,
    notify: setNotice,
    resetSimulation: simulation.reset,
    canvasRef,
    activeFlowFilter,
  });
  const { chosen, errors, actions } = editor;
  const closeModal = () => setModal(null);

  // Encontra pontos de entrada para depuração na tela atual
  const activeScreenId = editor.currentScreenId;
  const entryButtons = graph.nodes.filter(
    (n) =>
      n.data.kind === 'button' &&
      (!n.data.config.screenId || n.data.config.screenId === activeScreenId),
  );

  const handleStartDebug = () => {
    if (entryButtons.length > 0) {
      simulation.debugStart(entryButtons[0].id, true);
    } else if (graph.nodes.length > 0) {
      simulation.debugStart(graph.nodes[0].id, true);
    }
  };

  const connections = <Connections graph={graph} chosen={chosen} {...editor.connectionHandlers} />;

  return (
    <div className="app">
      <Header
        workspaceMode={workspaceMode}
        onWorkspaceMode={setWorkspaceMode}
        projectName={graph.name}
        onRenameProject={(name) => setGraph((g) => ({ ...g, name }))}
        onViewCode={() => setModal('code')}
        onSimulate={() => actions.preparePreview() && setModal('preview')}
        onOpenTests={() => setModal('tests')}
        testCount={graph.tests?.length}
        onOpenReadiness={() => setModal('readiness')}
        debuggerStatus={simulation.debuggerState.status}
        debuggerCurrentBlockId={simulation.debuggerState.currentBlockId}
        debuggerFrameCount={simulation.debuggerState.frames.length}
        isTimeTravelOpen={isTimeTravelOpen}
        onStartDebug={handleStartDebug}
        onContinueDebug={simulation.debugContinue}
        onPauseDebug={simulation.debugPause}
        onStepDebug={simulation.debugStep}
        onStopDebug={simulation.debugStop}
        onResetDebug={() => simulation.reset()}
        onToggleTimeTravel={() => setIsTimeTravelOpen((prev) => !prev)}
      />

      <div className="workspace">
        {workspaceMode === 'frontend' ? (
          <FrontendEditor
            graph={graph}
            screenId={editor.currentScreenId}
            onSelectScreen={editor.setActiveScreenId}
            onAddScreen={actions.addScreen}
            commit={commit}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onOpenSettings={() => setModal('settings')}
          />
        ) : workspaceMode === 'datamodel' ? (
          <DataModelEditor
            graph={graph}
            commit={commit}
            notify={setNotice}
            simulation={simulation}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        ) : (
          <>
            <Sidebar
              expanded={sidebar}
              onToggle={() => setSidebar((v) => !v)}
              onNew={() => setModal('new')}
              onOpen={() => fileInput.current?.click()}
              onSave={() => downloadGraph(graph)}
              onSettings={() => setModal('settings')}
              onAdd={actions.addBlockOfKind}
              onExport={() => setModal('export')}
            />

            <FlowCanvas
              containerRef={canvasRef}
              graph={graph}
              selected={editor.selected}
              activeScreenId={editor.currentScreenId}
              onSelectScreen={(screenId) => {
                setActiveFlowFilter(null);
                editor.setActiveScreenId(screenId);
              }}
              activeFlowFilter={activeFlowFilter}
              onSelectFlowFilter={setActiveFlowFilter}
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
              simulation={simulation}
              isTimeTravelOpen={isTimeTravelOpen}
              onCloseTimeTravel={() => setIsTimeTravelOpen(false)}
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
              onChangeConfig={actions.updateChosenConfig}
              onConnect={actions.connectBlocks}
              onRemoveEdge={editor.connectionHandlers.onRemoveEdge}
              onUpdateEdgeCallArg={editor.connectionHandlers.onUpdateEdgeCallArg}
              onCreateAndBindBlock={actions.createAndBindForChosen}
              onApplyRecommendation={actions.applyRecommendationForChosen}
            >
              <InspectorPanel
                chosen={chosen}
                graph={graph}
                nameField={editor.nameField}
                configFields={editor.fields}
                connections={connections}
                onChangeConfig={actions.updateChosenConfig}
                onDeleteConfigKey={actions.deleteChosenConfigKey}
                onRenameId={actions.renameChosenId}
                onDuplicate={actions.duplicateChosen}
                onDelete={actions.deleteChosen}
                onConnect={actions.connectBlocks}
                onRemoveEdge={editor.connectionHandlers.onRemoveEdge}
                onUpdateEdgeCallArg={editor.connectionHandlers.onUpdateEdgeCallArg}
                onCreateAndBindBlock={actions.createAndBindForChosen}
                onApplyRecommendation={actions.applyRecommendationForChosen}
              />
            </InspectorShell>
          </>
        )}
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

      <SettingsModal
        isOpen={modal === 'settings'}
        onClose={closeModal}
        graph={graph}
        onEnvironmentChange={(httpEnvironment) => commit((g) => ({ ...g, httpEnvironment }))}
        currentScreenId={editor.currentScreenId}
        onCommit={commit}
        appTheme={appTheme}
        onAppThemeChange={setAppTheme}
      />

      <PreviewModal
        isOpen={modal === 'preview'}
        onClose={closeModal}
        graph={graph}
        simulation={simulation}
      />

      <CodeViewerModal
        isOpen={modal === 'code'}
        onClose={closeModal}
        graph={graph}
        initialScreenId={editor.currentScreenId}
        onNotify={setNotice}
      />

      <TestRunnerModal
        isOpen={modal === 'tests'}
        onClose={closeModal}
        graph={graph}
        onUpdateGraph={commit}
      />

      <ProductionReadinessModal
        isOpen={modal === 'readiness'}
        onClose={closeModal}
        graph={graph}
        onOpenTests={() => setModal('tests')}
        onOpenExport={() => setModal('export')}
      />
    </div>
  );
}
