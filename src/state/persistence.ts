import { useEffect, useRef } from 'react';
import { parseGraph, type Graph } from '../engine';

const STORAGE_KEY = 'flowforge-v1';
/** Intervalo sem alterações antes de gravar (evita gravar a cada frame durante arrastes). */
const SAVE_DELAY_MS = 400;

/** Projeto salvo no navegador, ou um projeto vazio quando não há nada salvo. */
export function loadSavedGraph(): Graph {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return parseGraph(saved);
  } catch {
    // JSON corrompido ou localStorage indisponível: começa com projeto vazio.
  }
  return { version: 1, name: 'Novo aplicativo', nodes: [], edges: [] };
}

/** Salva o grafo no localStorage com debounce e garante a gravação ao fechar a página. */
export function usePersistence(graph: Graph, onError: (message: string) => void) {
  const latest = useRef(graph);
  const onErrorRef = useRef(onError);
  const dirty = useRef(false);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    latest.current = graph;
    dirty.current = true;
    const timer = window.setTimeout(() => save(), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [graph]);

  useEffect(() => {
    const flush = () => save();
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  function save() {
    if (!dirty.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      dirty.current = false;
    } catch {
      onErrorRef.current('Não foi possível salvar no navegador. Baixe o JSON.');
    }
  }
}
