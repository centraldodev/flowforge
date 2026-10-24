import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { catalog, categories, visibleKinds, type BlockDefinition, type Kind } from '../../engine';

// Apenas blocos de componentes e lógica (telas agora são abas superiores).
const allEntries = (Object.entries(catalog) as [Kind, BlockDefinition][]).filter(([kind]) =>
  visibleKinds.includes(kind),
);

export function BlockLibrary({ onAdd }: { onAdd: (kind: Kind) => void }) {
  const [search, setSearch] = useState('');
  const query = search.toLocaleLowerCase();
  const entries = allEntries.filter(([, v]) =>
    (v.name + ' ' + v.description).toLocaleLowerCase().includes(query),
  );

  return (
    <>
      <div className="search">
        <Search size={15} />
        <input
          aria-label="Buscar blocos"
          placeholder="Buscar blocos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {entries.length === 0 && <p className="no-blocks">Nenhum bloco encontrado.</p>}
      {categories.map((category) => {
        const items = entries.filter(([, v]) => v.category === category);
        if (!items.length) return null;
        return (
          <section key={category}>
            <h3>
              {category}
              <span>{items.length}</span>
            </h3>
            {items.map(([kind, v]) => (
              <button
                className="library-block"
                key={kind}
                title={v.description}
                onClick={() => onAdd(kind)}
              >
                <span
                  className="library-icon"
                  style={{ '--icon-color': v.color } as React.CSSProperties}
                >
                  {v.icon}
                </span>
                <span className="library-block-name">{v.name}</span>
                <Plus size={14} className="library-block-plus" />
              </button>
            ))}
          </section>
        );
      })}
    </>
  );
}
