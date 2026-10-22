import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
export type FieldDefinition = {
  id: string;
  label: string;
  value: string;
  options?: { value: string; label: string }[];
  area?: boolean;
  onChange: (value: string) => void;
};
export function PropertyField(p: FieldDefinition) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        !panel.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(),
    );
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  if (!p.options)
    return (
      <label className="field">
        {p.label}
        {p.area ? (
          <textarea rows={4} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
        ) : (
          <input value={p.value} onChange={(e) => p.onChange(e.target.value)} />
        )}
      </label>
    );
  const options = p.options;
  function show() {
    const r = trigger.current!.getBoundingClientRect();
    const height = Math.min(340, 90 + options.length * 40);
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - 292, r.left - 8)),
      top: Math.max(12, Math.min(window.innerHeight - height - 12, r.bottom + 7)),
    });
    setOpen(true);
  }
  return (
    <div className="field">
      <span id={'label-' + p.id}>{p.label}</span>
      <button
        ref={trigger}
        className="property-select"
        aria-label={p.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{options.find((o) => o.value === p.value)?.label || 'Selecione...'}</span>
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="selector-popup"
            role="dialog"
            aria-label={'Selecionar ' + p.label}
            style={position}
          >
            <div className="section-title">
              <h3>{p.label}</h3>
              <button
                aria-label={'Fechar ' + p.label}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div
              role="listbox"
              aria-label={'Opções de ' + p.label}
              onKeyDown={(e) => {
                const buttons = Array.from(
                  panel.current!.querySelectorAll<HTMLButtonElement>('[role="option"]'),
                );
                const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                let next = index;
                if (e.key === 'ArrowDown') next = (index + 1) % buttons.length;
                else if (e.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = buttons.length - 1;
                else return;
                e.preventDefault();
                buttons[next]?.focus();
              }}
            >
              {options.map((o) => (
                <button
                  key={o.value}
                  role="option"
                  aria-selected={o.value === p.value}
                  onClick={() => {
                    p.onChange(o.value);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === p.value && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
