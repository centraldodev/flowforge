import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { catalog, categories, type BlockDefinition, type Kind } from '../../engine';

// A tela aparece primeiro; os demais seguem a ordem do catálogo.
const allEntries = (Object.entries(catalog) as [Kind, BlockDefinition][]).sort(([a], [b]) =>
  a === 'screen' ? -1 : b === 'screen' ? 1 : 0,
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
              <button className="library-block" key={kind} onClick={() => onAdd(kind)}>
                <span
                  className="library-icon"
                  style={{ color: v.color, background: v.color + '12' }}
                >
                  {v.icon}
                </span>
                <span>
                  <strong>{v.name}</strong>
                  <small>{v.description}</small>
                </span>
                <Plus size={14} />
              </button>
            ))}
          </section>
        );
      })}
    </>
  );
}
