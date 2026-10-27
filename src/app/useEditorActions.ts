// Estado de seleção e ações do editor (blocos, telas e projeto), separados da montagem do layout.
import { useMemo, useState, type RefObject } from 'react';
import { useReactFlow, type Connection } from '@xyflow/react';
import {
  demo,
  DEMO_FOCUS,
  parseGraph,
  validate,
  customerOrdersProject,
  schedulingConflictProject,
  roleApprovalPortalProject,
  type CustomPort,
  type Graph,
  type Kind,
  type ScreenRoute,
} from '../engine';
import type { FieldDefinition } from '../components/PropertyField';
import { DEFAULT_VIEWPORT } from '../features/canvas/constants';
import { configFields } from '../features/inspector/blockFields';
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
  renameBlockId,
  screensOf,
  updateConfig,
  validateBlockId,
} from '../state/graphOps';

export type ProjectTemplateId = 'empty' | 'customerOrders' | 'scheduling' | 'roleApproval';

type Options = {
  graph: Graph;
  commit: (update: (g: Graph) => Graph) => void;
  notify: (message: string) => void;
  resetSimulation: (screenId?: string) => void;
  canvasRef: RefObject<HTMLElement | null>;
};

/** Seleção inicial: foco do exemplo quando presente, senão a primeira tela. */
function initialFocus(graph: Graph) {
  const has = (id: string) => graph.nodes.some((n) => n.id === id);
  return {
    screenId: has(DEMO_FOCUS.screenId) ? DEMO_FOCUS.screenId : screensOf(graph)[0]?.id || '',
    blockId: has(DEMO_FOCUS.blockId) ? DEMO_FOCUS.blockId : null,
  };
}

export function useEditorActions({ graph, commit, notify, resetSimulation, canvasRef }: Options) {
  const flow = useReactFlow();
  const [focus] = useState(() => initialFocus(graph));
  const [selected, setSelected] = useState<string | null>(focus.blockId);
  const [activeScreenId, setActiveScreenId] = useState<string>(focus.screenId);

  const screens = screensOf(graph);
  const currentScreenId = screens.some((s) => s.id === activeScreenId)
    ? activeScreenId
    : screens[0]?.id || '';
  const chosen = graph.nodes.find((n) => n.id === selected);
  const errors = useMemo(() => validate(graph), [graph]);

  function resetView() {
    resetSimulation();
    void flow.setViewport(DEFAULT_VIEWPORT);
  }

  // ---- Blocos ----

  function addBlockOfKind(kind: Kind) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const base = bounds
      ? flow.screenToFlowPosition({
          x: bounds.left + bounds.width / 2 - 100,
          y: bounds.top + bounds.height / 2,
        })
      : { x: 100, y: 100 };

    const position = findFreePosition(graph, base, currentScreenId);
    void flow.setCenter(position.x + 112, position.y + 100, {
      zoom: Math.max(flow.getZoom(), 0.62),
      duration: 200,
    });

    const newBlock = createBlock(kind, position, currentScreenId, graph);
    if (kind !== 'screen' && currentScreenId) {
      newBlock.data.config.screenId = currentScreenId;
    }
    commit((g) => addBlock(g, newBlock));
    setSelected(newBlock.id);
  }

  function addScreen() {
    const newScreen = createBlock('screen', { x: 640, y: 40 }, '', graph);
    commit((g) => addBlock(g, newScreen));
    setActiveScreenId(newScreen.id);
    setSelected(newScreen.id);
  }

  function connectBlocks(c: Connection) {
    const err = connectionError(c, graph);
    if (err) {
      notify(err);
      return;
    }
    commit((g) => connect(g, c));
  }

  function duplicateChosen() {
    if (!chosen) return;
    const clone = duplicateBlock(chosen, graph);
    if (clone.data.kind !== 'screen' && !clone.data.config.screenId && currentScreenId) {
      clone.data.config.screenId = currentScreenId;
    }
    commit((g) => addBlock(g, clone));
    setSelected(clone.id);
  }

  function deleteChosen() {
    if (!chosen) return;
    const deletedId = chosen.id;
    commit((g) => removeBlock(g, deletedId));
    setSelected(null);
    if (chosen.data.kind === 'screen' && activeScreenId === deletedId) {
      const next = screens.find((s) => s.id !== deletedId);
      if (next) setActiveScreenId(next.id);
    }
  }

  function renameChosenId(newId: string): boolean {
    if (!chosen) return false;
    const res = validateBlockId(graph, chosen.id, newId);
    if (!res.valid) {
      notify(res.error || 'ID inválido.');
      return false;
    }
    commit((g) => renameBlockId(g, chosen.id, newId));
    setSelected(newId);
    return true;
  }

  // ---- Projeto ----

  /** Valida o grafo e prepara a simulação; retorna `false` se houver erros. */
  function preparePreview(): boolean {
    if (errors.length) {
      notify(errors[0]);
      return false;
    }
    resetSimulation(screens[0]?.id || '');
    return true;
  }

  function loadExample() {
    commit(() => structuredClone(demo));
    setActiveScreenId(DEMO_FOCUS.screenId);
    setSelected(DEMO_FOCUS.blockId);
    resetView();
  }

  function createProject(name: string, templateId: ProjectTemplateId = 'empty') {
    let targetGraph: Graph;
    if (templateId === 'customerOrders') {
      targetGraph = {
        ...structuredClone(customerOrdersProject),
        name: name.trim() || customerOrdersProject.name,
      };
    } else if (templateId === 'scheduling') {
      targetGraph = {
        ...structuredClone(schedulingConflictProject),
        name: name.trim() || schedulingConflictProject.name,
      };
    } else if (templateId === 'roleApproval') {
      targetGraph = {
        ...structuredClone(roleApprovalPortalProject),
        name: name.trim() || roleApprovalPortalProject.name,
      };
    } else {
      targetGraph = emptyGraph(name.trim() || 'Novo aplicativo');
    }

    commit(() => targetGraph);
    const firstScreen =
      screensOf(targetGraph)[0]?.id ||
      targetGraph.nodes.find((n) => n.data.kind === 'screen')?.id ||
      targetGraph.nodes[0]?.id ||
      '';
    if (firstScreen) {
      setActiveScreenId(firstScreen);
      setSelected(firstScreen);
    }
    resetView();
  }

  async function importFile(file: File) {
    try {
      const imported = parseGraph(await file.text());
      commit(() => imported);
      const firstScreen = screensOf(imported)[0]?.id;
      if (firstScreen) setActiveScreenId(firstScreen);
      setSelected(null);
      notify('Projeto importado.');
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    }
  }

  // ---- Inspetor ----

  const nameField: FieldDefinition | undefined = chosen
    ? {
        id: 'label',
        label: 'Título do bloco',
        value: chosen.data.label,
        onChange: (value: string) => commit((g) => renameBlock(g, chosen.id, value)),
      }
    : undefined;

  const fields = chosen
    ? configFields(graph, chosen, (cfg) => commit((g) => updateConfig(g, chosen.id, cfg)))
    : [];

  const connectionHandlers = {
    onUpdateRoutes: (routes: ScreenRoute[]) =>
      chosen && commit((g) => updateConfig(g, chosen.id, { routes: JSON.stringify(routes) })),
    onRemoveEdge: (edgeId: string) => commit((g) => removeEdge(g, edgeId)),
    onAddPort: (port: CustomPort) => chosen && commit((g) => addPortToBlock(g, chosen.id, port)),
    onRemovePort: (portId: string) =>
      chosen && commit((g) => removePortFromBlock(g, chosen.id, portId)),
  };

  function updateChosenConfig(cfg: Record<string, string>) {
    if (!chosen) return;
    commit((g) => updateConfig(g, chosen.id, cfg));
  }

  return {
    selected,
    setSelected,
    currentScreenId,
    setActiveScreenId,
    chosen,
    errors,
    nameField,
    fields,
    connectionHandlers,
    actions: {
      addBlockOfKind,
      addScreen,
      connectBlocks,
      duplicateChosen,
      deleteChosen,
      renameChosenId,
      updateChosenConfig,
      preparePreview,
      loadExample,
      createProject,
      importFile,
    },
  };
}
