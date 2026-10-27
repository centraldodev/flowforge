import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  GitBranch,
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
  Tag,
  Code2,
  Monitor,
} from 'lucide-react';
import { PropertyField, type FieldDefinition } from '../../components/PropertyField';
import { catalog, type Block, type Graph } from '../../engine';
import { BlockIdEditor } from './BlockIdEditor';
import { HttpRequestTools } from './HttpRequestTools';

type Props = {
  children: ReactNode;
  fields: FieldDefinition[];
  chosen?: Block;
  graph?: Graph;
  nameField?: FieldDefinition;
  onRenameId?: (newId: string) => boolean | void;
  connections: ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeConfig?: (config: Record<string, string>) => void;
};

export function InspectorShell(p: Props) {
  const [expanded, setExpanded] = useState(false);
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
    timer.current = setTimeout(() => setActive(null), 220);
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
    id === 'identity' || id === 'label'
      ? Tag
      : id === 'code'
        ? Code2
        : id === 'screenId' || id === 'target'
          ? Monitor
          : id === 'provider'
            ? KeyRound
            : id === 'url'
              ? Globe
              : id === 'table'
                ? Database
                : id === 'operation' || id === 'mode'
                  ? ArrowRightLeft
                  : id === 'value' || id === 'minimum'
                    ? Hash
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
              <PanelRightClose size={18} />
            </button>
            <span>Propriedades</span>
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
            <PanelRightOpen size={18} />
          </button>
          {p.chosen ? (
            <>
              <span className="inspector-rail-separator" />

              {/* Botão de Identidade: ID e Título unificados */}
              <div
                className="rail-item-wrapper"
                onMouseEnter={(e) =>
                  show('identity', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title={`Identidade do Bloco (${catalog[p.chosen.data.kind]?.name || p.chosen.id})`}
                  aria-label={`Identidade do Bloco (${catalog[p.chosen.data.kind]?.name || p.chosen.id})`}
                  aria-expanded={active === 'identity'}
                  aria-haspopup="dialog"
                  className={active === 'identity' ? 'active' : ''}
                  onClick={(e) => show('identity', e.currentTarget)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 20,
                      color: catalog[p.chosen.data.kind]?.color || '#c4b1f2',
                    }}
                  >
                    {catalog[p.chosen.data.kind]?.icon || 'widgets'}
                  </span>
                </button>
              </div>

              {/* Demais propriedades de configuração */}
              {['api', 'httpConnection'].includes(p.chosen.data.kind) && (
                <button
                  title="Testar e configurar HTTP"
                  aria-label="Testar e configurar HTTP"
                  onClick={(event) => show('http-tools', event.currentTarget)}
                >
                  <Globe size={19} />
                </button>
              )}
              {p.fields
                .filter((f) => f.id !== 'label')
                .map((f) => {
                  const Icon = icon(f.id);
                  return (
                    <div
                      key={f.id}
                      className="rail-item-wrapper"
                      onMouseEnter={(e) =>
                        show(f.id, e.currentTarget.querySelector('button') || undefined)
                      }
                      onMouseLeave={closeSoon}
                    >
                      <button
                        title={f.label}
                        aria-label={f.label}
                        aria-expanded={active === f.id}
                        aria-haspopup="dialog"
                        className={active === f.id ? 'active' : ''}
                        onClick={(e) => show(f.id, e.currentTarget)}
                      >
                        <Icon size={19} />
                      </button>
                    </div>
                  );
                })}

              {/* Conexões e portas */}
              <div
                className="connections-trigger"
                onMouseEnter={(e) =>
                  show('connections', e.currentTarget.querySelector('button') || undefined)
                }
                onMouseLeave={closeSoon}
              >
                <button
                  title="Conexões (Portas)"
                  aria-label="Conexões (Portas)"
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
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: '#6b7280' }}
              >
                widgets
              </span>
            </button>
          )}
        </nav>
      )}
      {!expanded && active && (
        <div
          className="inspector-flyout"
          role="dialog"
          aria-label={
            active === 'identity'
              ? 'Identidade do bloco'
              : active === 'connections'
                ? 'Conexões do bloco'
                : active === 'http-tools'
                  ? 'Testar e configurar HTTP'
                  : field?.label || 'Propriedade'
          }
          onMouseEnter={cancel}
          onMouseLeave={closeSoon}
        >
          <div className="section-title">
            <h2>
              {active === 'identity'
                ? 'Identidade do Bloco'
                : active === 'connections'
                  ? 'Conexões'
                  : active === 'http-tools'
                    ? 'Integração HTTP'
                    : field?.label}
            </h2>
            <button
              title="Fechar painel flutuante"
              aria-label="Fechar painel flutuante"
              onClick={() => setActive(null)}
            >
              <X size={16} />
            </button>
          </div>

          {active === 'identity' ? (
            <div className="inspector-identity-flyout">
              {p.graph && p.onRenameId && p.chosen && (
                <BlockIdEditor chosen={p.chosen} graph={p.graph} onRename={p.onRenameId} />
              )}
              {p.nameField && <PropertyField {...p.nameField} />}
            </div>
          ) : active === 'connections' ? (
            p.connections
          ) : active === 'http-tools' && p.chosen && p.graph && p.onChangeConfig ? (
            <HttpRequestTools
              key={p.chosen.id}
              block={p.chosen}
              graph={p.graph}
              onChangeConfig={p.onChangeConfig}
            />
          ) : field ? (
            field.options ? (
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
            )
          ) : null}
        </div>
      )}
    </aside>
  );
}
