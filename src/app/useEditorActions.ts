// Estado de seleção e ações do editor (blocos, telas e projeto), separados da montagem do layout.
import { useMemo, useState, type RefObject } from 'react';
import { useReactFlow, type Connection } from '@xyflow/react';
import {
  catalog,
  parseGraph,
  validate,
  type CustomPort,
  type Graph,
  type Kind,
  type LogicRecommendation,
  type ScreenRoute,
} from '../engine';
import type { FieldDefinition } from '../components/PropertyField';
import { DEFAULT_VIEWPORT } from '../features/canvas/constants';
import { configFields } from '../features/inspector/blockFields';
import { appTemplates, type ProjectTemplateId } from '../engine/appTemplates';
import {
  addBlock,
  addPortToBlock,
  applyLogicRecommendation,
  connect,
  connectionError,
  createAndBindTargetBlock,
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
  deleteBlockConfigKey,
  updateEdgeCallArg,
  validateBlockId,
} from '../state/graphOps';

export type { ProjectTemplateId } from '../engine/appTemplates';

type Options = {
  graph: Graph;
  commit: (update: (g: Graph) => Graph) => void;
  notify: (message: string) => void;
  resetSimulation: (screenId?: string) => void;
  canvasRef: RefObject<HTMLElement | null>;
  activeFlowFilter?: string | null;
};

/** Seleciona a primeira tela do projeto aberto. */
function initialFocus(graph: Graph) {
  return {
    screenId: screensOf(graph)[0]?.id || '',
    blockId: null,
  };
}

export function useEditorActions({
  graph,
  commit,
  notify,
  resetSimulation,
  canvasRef,
  activeFlowFilter,
}: Options) {
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
    if (kind !== 'screen' && activeFlowFilter) {
      newBlock.data.config.flowId = activeFlowFilter;
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

  function createProject(name: string, templateId: ProjectTemplateId = 'empty') {
    const targetGraph: Graph =
      templateId === 'empty'
        ? emptyGraph(name.trim() || 'Novo aplicativo')
        : {
            ...structuredClone(appTemplates[templateId]),
            name: name.trim() || appTemplates[templateId].name,
          };

    commit(() => targetGraph);
    const firstScreen =
      screensOf(targetGraph)[0]?.id ||
      targetGraph.nodes.find((n) => n.data.kind === 'screen')?.id ||
      targetGraph.nodes[0]?.id ||
      '';
    if (firstScreen) {
      setActiveScreenId(firstScreen);
      setSelected(firstScreen);
    } else {
      setActiveScreenId('');
      setSelected(null);
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
    onUpdateEdgeCallArg: (edgeId: string, callArg: string) =>
      commit((g) => updateEdgeCallArg(g, edgeId, callArg)),
    onConnect: (c: Connection & { data?: { callArg?: string; customCode?: string } }) =>
      connectBlocks(c),
  };

  function updateChosenConfig(cfg: Record<string, string>) {
    if (!chosen) return;
    commit((g) => updateConfig(g, chosen.id, cfg));
  }

  function deleteChosenConfigKey(key: string) {
    if (!chosen) return;
    commit((g) => deleteBlockConfigKey(g, chosen.id, key));
  }

  function createAndBindForChosen(
    targetKind: Kind,
    options: {
      slotKey?: string;
      sourceHandle?: string;
      targetHandle?: string;
      defaultConfig?: Record<string, string>;
      defaultArg?: string;
    },
  ) {
    if (!chosen) return;
    commit((g) => createAndBindTargetBlock(g, chosen.id, targetKind, options).graph);
    notify(
      `Bloco de ${catalog[targetKind]?.name || targetKind} criado e vinculado automaticamente!`,
    );
  }

  function applyRecommendationForChosen(rec: LogicRecommendation) {
    if (!chosen) return;
    commit((g) => applyLogicRecommendation(g, chosen.id, rec).graph);
    notify(`Recomendação aplicada: ${rec.title}`);
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
      deleteChosenConfigKey,
      createAndBindForChosen,
      applyRecommendationForChosen,
      updateEdgeCallArg: (edgeId: string, callArg: string) =>
        commit((g) => updateEdgeCallArg(g, edgeId, callArg)),
      preparePreview,
      createProject,
      importFile,
    },
  };
}
