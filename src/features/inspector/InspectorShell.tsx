import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  GitBranch,
  Type,
  SlidersHorizontal,
  KeyRound,
  Globe,
  Database,
  ArrowRightLeft,
  Hash,
  FileText,
  Copy,
  Trash2,
  X,
} from 'lucide-react';
import { PropertyField, type FieldDefinition } from '../../components/PropertyField';
import type { Block } from '../../engine';
type Props = {
  children: ReactNode;
  fields: FieldDefinition[];
  chosen?: Block;
  connections: ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
};
export function InspectorShell(p: Props) {
  const [expanded, setExpanded] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
  }
  function show(id: string, trigger?: HTMLButtonElement) {
    cancel();
    if (trigger) lastTrigger.current = trigger;
    setActive(id);
  }
  function closeSoon() {
    cancel();
    timer.current = setTimeout(() => setActive(null), 180);
  }
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    setActive(null);
  }, [p.chosen?.id]);
  useEffect(() => {
    if (!active) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActive(null);
        lastTrigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if ((e.target as Element).closest('.selector-popup')) return;
      if (!root.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [active]);
  const field = p.fields.find((f) => f.id === active);
  const icon = (id: string) =>
    id === 'provider'
      ? KeyRound
      : id === 'url'
        ? Globe
        : id === 'table'
          ? Database
          : id === 'operation' || id === 'mode'
            ? ArrowRightLeft
            : id === 'value' || id === 'minimum'
              ? Hash
              : id === 'label'
                ? Type
                : id === 'text' || id === 'message'
                  ? FileText
                  : SlidersHorizontal;
  return (
    <aside
      ref={root}
      className={'inspector-shell ' + (expanded ? 'expanded' : 'collapsed')}
      aria-label="Painel direito"
    >
      {expanded ? (
        <>
          <div className="inspector-heading">
            <button
              title="Recolher painel direito"
              aria-label="Recolher painel direito"
              aria-expanded="true"
              onClick={() => {
                setExpanded(false);
                setActive(null);
              }}
            >
              <PanelRightClose size={20} />
            </button>
            <span>Inspetor</span>
          </div>
          <div className="inspector-body">{p.children}</div>
        </>
      ) : (
        <nav className="inspector-rail" aria-label="Propriedades do bloco">
          <button
            title="Expandir painel direito"
            aria-label="Expandir painel direito"
            aria-expanded="false"
            onClick={() => {
              setExpanded(true);
              setActive(null);
            }}
          >
            <PanelRightOpen size={20} />
          </button>
          {p.chosen ? (
            <>
              <span className="inspector-rail-separator" />
              {p.fields.map((f) => {
                const Icon = icon(f.id);
                return (
                  <button
                    key={f.id}
                    title={f.label}
                    aria-label={f.label}
                    aria-expanded={active === f.id}
                    aria-haspopup="dialog"
                    className={active === f.id ? 'active' : ''}
                    onClick={(e) => show(f.id, e.currentTarget)}
                  >
                    <Icon size={19} />
                  </button>
                );
              })}
              <div
                className="connections-trigger"
                onMouseEnter={() => show('connections')}
                onMouseLeave={closeSoon}
              >
                <button
                  title="Conexões"
                  aria-label="Conexões"
                  aria-expanded={active === 'connections'}
                  aria-haspopup="dialog"
                  className={active === 'connections' ? 'active' : ''}
                  onClick={(e) => show('connections', e.currentTarget)}
                >
                  <GitBranch size={20} />
                </button>
              </div>
              <div className="inspector-rail-bottom">
                <button title="Duplicar bloco" aria-label="Duplicar bloco" onClick={p.onDuplicate}>
                  <Copy size={18} />
                </button>
                <button title="Excluir bloco" aria-label="Excluir bloco" onClick={p.onDelete}>
                  <Trash2 size={18} />
                </button>
              </div>
            </>
          ) : (
            <button title="Selecione um bloco" aria-label="Selecione um bloco" disabled>
              <Settings2 size={20} />
            </button>
          )}
        </nav>
      )}
      {!expanded && active && (
        <div
          className="inspector-flyout"
          role="dialog"
          aria-label={
            active === 'connections' ? 'Conexões do bloco' : field?.label || 'Propriedade'
          }
          onMouseEnter={cancel}
          onMouseLeave={() => {
            if (active === 'connections') closeSoon();
          }}
        >
          <div className="section-title">
            <h2>{active === 'connections' ? 'Conexões' : field?.label}</h2>
            <button
              title="Fechar painel flutuante"
              aria-label="Fechar painel flutuante"
              onClick={() => setActive(null)}
            >
              <X size={16} />
            </button>
          </div>
          {active === 'connections'
            ? p.connections
            : field &&
              (field.options ? (
                <div
                  className="inspector-options"
                  role="listbox"
                  aria-label={'Opções de ' + field.label}
                >
                  {field.options.map((option) => (
                    <button
                      key={option.value}
                      role="option"
                      aria-selected={field.value === option.value}
                      onClick={() => {
                        field.onChange(option.value);
                        setActive(null);
                        lastTrigger.current?.focus();
                      }}
                    >
                      <span>{option.label}</span>
                      {field.value === option.value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <PropertyField key={field.id} {...field} />
              ))}
        </div>
      )}
    </aside>
  );
}
