import { useEffect, useRef } from 'react';
import { parseGraph, type Graph } from '../engine';

const STORAGE_KEY = 'flowforge-v1';
const IDB_NAME = 'flowforge_db';
const IDB_STORE = 'projects';
/** Intervalo sem alterações antes de gravar (evita gravar a cada frame durante arrastes). */
const SAVE_DELAY_MS = 400;

function saveToIndexedDBFallback(serialized: string): void {
  try {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(serialized, STORAGE_KEY);
    };
  } catch {
    // Ignora em ambientes sem IndexedDB
  }
}

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

/** Salva o grafo no localStorage com debounce (e fallback IndexedDB) e garante a gravação ao fechar a página. */
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
    let serialized = '';
    try {
      serialized = JSON.stringify(latest.current);
      localStorage.setItem(STORAGE_KEY, serialized);
      saveToIndexedDBFallback(serialized);
      dirty.current = false;
    } catch {
      if (serialized) {
        saveToIndexedDBFallback(serialized);
      }
      onErrorRef.current(
        'Limite do localStorage atingido; backup salvo no IndexedDB. Recomendamos baixar o JSON de recuperação.',
      );
    }
  }
}
