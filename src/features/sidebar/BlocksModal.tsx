import { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Search, Workflow, X } from 'lucide-react';
import { catalog, categories, visibleKinds, type BlockDefinition, type Kind } from '../../engine';

type Props = {
  onClose: () => void;
  onAdd: (kind: Kind) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const allEntries = (Object.entries(catalog) as [Kind, BlockDefinition][]).filter(([kind]) =>
  visibleKinds.includes(kind),
);

export function BlocksModal({ onClose, onAdd, onMouseEnter, onMouseLeave }: Props) {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleOutsideClick = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [onClose]);

  const query = search.trim().toLocaleLowerCase();
  const filteredEntries = allEntries.filter(([, v]) => {
    if (!query) return true;
    return (v.name + ' ' + v.description + ' ' + v.category).toLocaleLowerCase().includes(query);
  });

  function handleSelect(kind: Kind) {
    onAdd(kind);
    onClose();
  }

  return (
    <div
      ref={popupRef}
      id="blocks-flyout"
      className="blocks-flyout-modal"
      role="dialog"
      aria-label="Biblioteca de blocos"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="blocks-modal-header">
        <div className="blocks-modal-header-title">
          <span className="modal-icon">
            <Layers size={18} />
          </span>
          <div>
            <h2>
              Blocos <span className="block-count">{filteredEntries.length}</span>
            </h2>
            <p>Selecione um bloco para adicionar ao fluxo</p>
          </div>
        </div>
        <button
          type="button"
          className="blocks-modal-close-btn"
          title="Fechar (Esc)"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="blocks-modal-search">
        <Search size={15} className="blocks-modal-search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Buscar blocos por nome ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar blocos"
        />
        {search && (
          <button
            type="button"
            className="blocks-modal-search-clear"
            title="Limpar busca"
            aria-label="Limpar busca"
            onClick={() => {
              setSearch('');
              searchInputRef.current?.focus();
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="blocks-modal-columns">
        {categories.map((category) => {
          const items = filteredEntries.filter(([, v]) => v.category === category);
          return (
            <div className="blocks-modal-column" key={category}>
              <div className="blocks-modal-column-header">
                <span className="blocks-modal-column-title">{category}</span>
                <span className="blocks-modal-column-count">{items.length}</span>
              </div>
              <div className="blocks-modal-column-items">
                {items.length === 0 ? (
                  <div className="blocks-modal-column-empty">Nenhum bloco</div>
                ) : (
                  items.map(([kind, v]) => (
                    <button
                      type="button"
                      className="blocks-modal-block-item"
                      key={kind}
                      onClick={() => handleSelect(kind)}
                      title={v.description}
                    >
                      <span
                        className="library-icon"
                        style={{ '--icon-color': v.color } as React.CSSProperties}
                      >
                        <span className="material-symbols-outlined">{v.icon}</span>
                      </span>
                      <span className="blocks-modal-block-name">{v.name}</span>
                      <Plus size={14} className="blocks-modal-block-plus" />
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEntries.length === 0 && (
        <div className="blocks-modal-empty">
          <Workflow size={28} />
          <p>Nenhum bloco encontrado para "{search}".</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              searchInputRef.current?.focus();
            }}
          >
            Limpar busca
          </button>
        </div>
      )}
    </div>
  );
}
