import { useCallback, useRef, useState } from 'react';
import type { Graph } from '../engine';

const HISTORY_LIMIT = 40;

/** Grafo do projeto com desfazer/refazer. */
export function useGraphHistory(initial: () => Graph) {
  const [graph, setGraph] = useState<Graph>(initial);
  const [history, setHistory] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);
  const dragSnapshot = useRef<Graph | null>(null);

  const pushHistory = (snapshot: Graph) => {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), snapshot]);
    setFuture([]);
  };

  /** Registra o estado atual no histórico (chame antes de uma alteração desfazível). */
  const remember = useCallback(() => pushHistory(structuredClone(graph)), [graph]);

  /** Aplica uma alteração desfazível. */
  const commit = (update: (g: Graph) => Graph) => {
    remember();
    setGraph(update);
  };

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    setFuture((f) => [graph, ...f]);
    setGraph(prev);
    setHistory((h) => h.slice(0, -1));
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((h) => [...h, graph]);
    setGraph(next);
    setFuture((f) => f.slice(1));
  }

  // Arrastar gera muitas mudanças de posição; registramos só o estado de antes do arraste.
  const beginDrag = () => {
    dragSnapshot.current = structuredClone(graph);
  };
  const endDrag = () => {
    if (!dragSnapshot.current) return;
    pushHistory(dragSnapshot.current);
    dragSnapshot.current = null;
  };

  return {
    graph,
    /** Altera o grafo sem registrar no histórico. */
    setGraph,
    commit,
    remember,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    beginDrag,
    endDrag,
  };
}
