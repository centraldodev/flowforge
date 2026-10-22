import { useEffect } from 'react';
import { demo, parseGraph, type Graph } from '../engine';

const STORAGE_KEY = 'flowforge-v1';

/** Projeto salvo no navegador, ou o exemplo quando não há nada salvo. */
export function loadSavedGraph(): Graph {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return parseGraph(saved);
  } catch {
    // JSON corrompido ou localStorage indisponível: começa pelo exemplo.
  }
  return structuredClone(demo);
}

/** Salva o grafo no localStorage a cada alteração. */
export function usePersistence(graph: Graph, onError: (message: string) => void) {
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    } catch {
      onError('Não foi possível salvar no navegador. Baixe o JSON.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
}
