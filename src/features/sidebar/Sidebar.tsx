import { useEffect, useRef, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  FilePlus2,
  FolderOpen,
  FileJson,
  Settings2,
  Code2,
  Layers,
} from 'lucide-react';
import { visibleKinds, type Kind } from '../../engine';
import { BlockLibrary } from './BlockLibrary';
import { BlocksModal } from './BlocksModal';

type Props = {
  expanded: boolean;
  onToggle: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSettings: () => void;
  onExport: () => void;
  onAdd: (kind: Kind) => void;
};

export function Sidebar(p: Props) {
  const [blocksModalOpen, setBlocksModalOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function open() {
    cancelClose();
    setBlocksModalOpen(true);
  }

  function closeSoon() {
    cancelClose();
    timer.current = setTimeout(() => setBlocksModalOpen(false), 240);
  }

  function close() {
    cancelClose();
    setBlocksModalOpen(false);
  }

  useEffect(() => {
    if (p.expanded) {
      cancelClose();
      setBlocksModalOpen(false);
    }
  }, [p.expanded]);

  useEffect(() => () => cancelClose(), []);

  return (
    <aside
      className={'unified-sidebar ' + (p.expanded ? 'is-expanded' : 'is-collapsed')}
      aria-label="Menu lateral"
    >
      {p.expanded ? (
        <div className="expanded-content library">
          <div className="sidebar-heading">
            <button
              title="Recolher menu"
              aria-label="Recolher menu"
              aria-expanded="true"
              onClick={p.onToggle}
            >
              <PanelLeftClose size={18} />
            </button>
            <span>Biblioteca</span>
          </div>
          <nav className="project-menu" aria-label="Projeto">
            <span className="eyebrow">PROJETO</span>
            <button onClick={p.onNew}>
              <FilePlus2 size={15} />
              Novo projeto
            </button>
            <button onClick={p.onOpen}>
              <FolderOpen size={15} />
              Abrir projeto
            </button>
            <button onClick={p.onSave}>
              <FileJson size={15} />
              Salvar projeto
            </button>
            <button onClick={p.onExport}>
              <Code2 size={15} />
              Exportar projeto
            </button>
            <button onClick={p.onSettings}>
              <Settings2 size={15} />
              Configurações
            </button>
          </nav>
          <div className="section-title">
            <h2>Blocos</h2>
            <span className="block-count">{visibleKinds.length}</span>
          </div>
          <BlockLibrary onAdd={p.onAdd} />
        </div>
      ) : (
        <>
          <nav className="rail" aria-label="Navegação do projeto">
            <button
              title="Expandir menu"
              aria-label="Expandir menu"
              aria-expanded="false"
              onClick={p.onToggle}
            >
              <PanelLeftOpen size={18} />
            </button>
            <button title="Novo projeto" aria-label="Novo projeto" onClick={p.onNew}>
              <FilePlus2 size={18} />
            </button>
            <button title="Abrir projeto" aria-label="Abrir projeto" onClick={p.onOpen}>
              <FolderOpen size={18} />
            </button>
            <div
              className="blocks-trigger"
              onMouseEnter={open}
              onMouseLeave={closeSoon}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) closeSoon();
              }}
            >
              <button
                className={blocksModalOpen ? 'active' : ''}
                title="Biblioteca de Blocos"
                aria-label="Biblioteca de Blocos"
                aria-haspopup="dialog"
                aria-expanded={blocksModalOpen}
                onClick={() => setBlocksModalOpen((prev) => !prev)}
              >
                <Layers size={19} />
              </button>

              {blocksModalOpen && (
                <BlocksModal
                  onClose={close}
                  onAdd={(kind) => {
                    p.onAdd(kind);
                    close();
                  }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeSoon}
                />
              )}
            </div>
            <button title="Salvar projeto" aria-label="Salvar projeto" onClick={p.onSave}>
              <FileJson size={18} />
            </button>
            <button title="Exportar projeto" aria-label="Exportar projeto" onClick={p.onExport}>
              <Code2 size={18} />
            </button>
            <div className="rail-bottom">
              <button title="Configurações" aria-label="Configurações" onClick={p.onSettings}>
                <Settings2 size={18} />
              </button>
            </div>
          </nav>
        </>
      )}
    </aside>
  );
}
