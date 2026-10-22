import { useEffect, useState, type KeyboardEvent } from 'react';
import { AlertCircle, Check, Tag } from 'lucide-react';
import { validateBlockId } from '../../state/graphOps';
import type { Block, Graph } from '../../engine';

type Props = {
  chosen: Block;
  graph: Graph;
  onRename: (newId: string) => boolean | void;
};

export function BlockIdEditor({ chosen, graph, onRename }: Props) {
  const [value, setValue] = useState(chosen.id);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza se o usuário selecionar outro bloco
  useEffect(() => {
    setValue(chosen.id);
    setError(null);
  }, [chosen.id]);

  function handleChange(candidate: string) {
    setValue(candidate);
    const result = validateBlockId(graph, chosen.id, candidate);
    if (!result.valid) {
      setError(result.error || 'ID inválido');
    } else {
      setError(null);
    }
  }

  function handleCommit() {
    const trimmed = value.trim();
    if (trimmed === chosen.id) {
      setError(null);
      return;
    }
    const result = validateBlockId(graph, chosen.id, trimmed);
    if (!result.valid) {
      setError(result.error || 'ID inválido');
      return;
    }
    setError(null);
    onRename(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      setValue(chosen.id);
      setError(null);
    }
  }

  const isChanged = value.trim() !== chosen.id && value.trim() !== '';
  const isValid = !error && isChanged;

  return (
    <div className="block-id-editor">
      <div className="block-id-editor-header">
        <label htmlFor="block-id-input" className="block-id-label">
          <Tag size={12} />
          <span>ID DO BLOCO (IDENTIFICADOR)</span>
        </label>
        <span
          className="block-id-tag-help"
          title="Identificador único utilizado nas conexões e no código exportado"
        >
          Único & Exportável
        </span>
      </div>

      <div className={`block-id-input-box ${error ? 'has-error' : isValid ? 'is-valid' : ''}`}>
        <span className="block-id-prefix">#</span>
        <input
          id="block-id-input"
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          placeholder="ex: calcular_total"
          spellCheck={false}
          autoComplete="off"
        />
        {isValid && (
          <button
            type="button"
            className="btn-save-id"
            title="Salvar novo ID (Enter)"
            onClick={handleCommit}
          >
            <Check size={13} />
            <span>Salvar</span>
          </button>
        )}
      </div>

      {error ? (
        <div className="block-id-message error" role="alert">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      ) : isValid ? (
        <div className="block-id-message success">
          <Check size={13} />
          <span>ID disponível! Pressione Enter ou clique em Salvar.</span>
        </div>
      ) : (
        <p className="block-id-hint">
          Identificador exclusivo deste bloco nas conexões e nome de função/variável ao exportar
          código.
        </p>
      )}
    </div>
  );
}
