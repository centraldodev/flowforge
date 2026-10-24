export const mainTemplate = `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createProgram } from './program';
import { ScreenFields } from './ScreenFields';
import './style.css';
import graph from './graph.json';
import type { Graph } from './engine/types';

const g = graph as unknown as Graph;
const program = createProgram();

function App() {
  const [screen, setScreen] = useState(
    program.getScreen() || g.nodes.find((n) => n.data.kind === 'screen')?.id,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [store, setStore] = useState<Record<string, unknown>>(program.getState() || {});
  const [log, setLog] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const page = g.nodes.find((n) => n.id === screen);

  async function action(id: string) {
    try {
      const r = await program.dispatch(id, values);
      if (r.screen) setScreen(r.screen);
      setMessages(r.messages);
      setStore({ ...program.getState() });
      setLog(
        r.trace.map((t: { label: string; message: string }) => \`\${t.label}: \${t.message}\`).join('\\n'),
      );
    } catch (e) {
      setLog(String(e));
    }
  }

  return (
    <main>
      <small>PROTÓTIPO · Executado a partir da ProgramIR</small>
      <h1>{page?.data.config.title || page?.data.label || 'Adicione uma tela'}</h1>
      <ScreenFields
        graph={g}
        screen={screen}
        values={values}
        store={store}
        onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onAction={action}
      />
      {messages.map((m, i) => (
        <div className="message" role="status" key={i}>
          {m}
        </div>
      ))}
      <pre>{log}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
`;

export const screenFieldsSource = `import React from 'react';
import type { Block, Graph } from './engine/types';

export type UIBinding =
  | { kind: 'literal'; value: unknown }
  | { kind: 'path'; path: string }
  | {
      kind: 'binary';
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'truthy';
      left: UIBinding;
      right?: UIBinding;
    };

export type UILayout =
  | {
      type: 'flex';
      direction?: 'row' | 'column';
      gap?: number;
      align?: 'start' | 'center' | 'end' | 'stretch';
      justify?: 'start' | 'center' | 'end' | 'between' | 'around';
      wrap?: boolean;
    }
  | {
      type: 'grid';
      columns?: number | string;
      gap?: number;
    };

export type UIAccessibility = {
  ariaLabel?: string;
  role?: string;
  ariaLive?: 'polite' | 'assertive';
};

export type UIComponent =
  | {
      id: string;
      type: 'container';
      layout?: UILayout;
      children: UIComponent[];
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'text';
      content: string | UIBinding;
      style?: 'title' | 'heading' | 'body' | 'caption';
      color?: string;
      align?: 'left' | 'center' | 'right';
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'image';
      src: string | UIBinding;
      alt: string;
      width?: number | string;
      height?: number | string;
      fit?: 'cover' | 'contain' | 'fill';
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'input';
      inputType?: 'text' | 'email' | 'password' | 'number';
      label: string;
      placeholder?: string;
      bindingPath?: string;
      defaultValue?: string;
      required?: boolean;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'textarea';
      label: string;
      placeholder?: string;
      rows?: number;
      bindingPath?: string;
      defaultValue?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'select';
      label: string;
      options: Array<{ label: string; value: string }>;
      bindingPath?: string;
      defaultValue?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'checkbox';
      label: string;
      bindingPath?: string;
      defaultChecked?: boolean;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'radio';
      label: string;
      name: string;
      options: Array<{ label: string; value: string }>;
      bindingPath?: string;
      defaultValue?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'button';
      label: string;
      variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
      actionEvent: string;
      disabled?: UIBinding;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'list';
      itemsPath: string;
      itemVarName?: string;
      template: UIComponent;
      emptyState?: UIComponent;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'modal';
      title?: string;
      openBinding?: UIBinding;
      children: UIComponent[];
      closeEvent?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    };

export type ScreenUI = {
  screenId: string;
  title: string;
  root: UIComponent;
  states?: {
    loading?: UIComponent;
    empty?: UIComponent;
    error?: UIComponent;
  };
  stateBinding?: {
    loading?: UIBinding;
    empty?: UIBinding;
    error?: UIBinding;
  };
};

export interface EvaluationScope {
  store: Record<string, unknown>;
  inputs: Record<string, unknown>;
  variables?: Record<string, unknown>;
  item?: unknown;
  [key: string]: unknown;
}

export function resolvePath(scope: EvaluationScope, path: string): unknown {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.trim().split('.');
  if (parts.length === 0) return undefined;
  const first = parts[0];
  let current: unknown;

  if (first in scope) {
    current = scope[first];
  } else if (scope.item && typeof scope.item === 'object' && first in (scope.item as Record<string, unknown>)) {
    current = (scope.item as Record<string, unknown>)[first];
  } else if (first in scope.store) {
    current = scope.store[first];
  } else if (first in scope.inputs) {
    current = scope.inputs[first];
  } else if (scope.variables && first in scope.variables) {
    current = scope.variables[first];
  } else {
    return undefined;
  }

  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[parts[i]];
  }
  return current;
}

export function evaluateBinding(binding: UIBinding | string | undefined, scope: EvaluationScope): unknown {
  if (binding === undefined || binding === null) return undefined;
  if (typeof binding === 'string') return binding;

  switch (binding.kind) {
    case 'literal':
      return binding.value;
    case 'path':
      return resolvePath(scope, binding.path);
    case 'binary': {
      const leftVal = evaluateBinding(binding.left, scope);
      const rightVal = binding.right ? evaluateBinding(binding.right, scope) : undefined;
      switch (binding.op) {
        case 'truthy':
          return Boolean(leftVal);
        case 'eq':
          return leftVal == rightVal;
        case 'neq':
          return leftVal != rightVal;
        case 'gt':
          return (Number(leftVal) || 0) > (Number(rightVal) || 0);
        case 'gte':
          return (Number(leftVal) || 0) >= (Number(rightVal) || 0);
        case 'lt':
          return (Number(leftVal) || 0) < (Number(rightVal) || 0);
        case 'lte':
          return (Number(leftVal) || 0) <= (Number(rightVal) || 0);
        default:
          return false;
      }
    }
    default:
      return undefined;
  }
}

export function isComponentVisible(comp: UIComponent, scope: EvaluationScope): boolean {
  if (!comp.visible) return true;
  return Boolean(evaluateBinding(comp.visible, scope));
}

export function evaluateScreenState(
  screenUI: ScreenUI,
  scope: EvaluationScope,
): 'loading' | 'error' | 'empty' | 'ready' {
  if (!screenUI.states) return 'ready';
  if (screenUI.states.loading && screenUI.stateBinding?.loading) {
    if (Boolean(evaluateBinding(screenUI.stateBinding.loading, scope))) return 'loading';
  }
  if (screenUI.states.error && screenUI.stateBinding?.error) {
    if (Boolean(evaluateBinding(screenUI.stateBinding.error, scope))) return 'error';
  }
  if (screenUI.states.empty && screenUI.stateBinding?.empty) {
    if (Boolean(evaluateBinding(screenUI.stateBinding.empty, scope))) return 'empty';
  }
  return 'ready';
}

export function evaluateListItems(
  comp: Extract<UIComponent, { type: 'list' }>,
  scope: EvaluationScope,
): unknown[] {
  const items = resolvePath(scope, comp.itemsPath);
  return Array.isArray(items) ? items : [];
}

export function migrateScreenToUI(screenBlock: Block, graph: Graph): ScreenUI {
  const screenId = screenBlock.id;
  const screenTitle = (screenBlock.data.config.title as string) || screenBlock.data.label || 'Tela';

  if (screenBlock.data.config.screenUI) {
    try {
      const parsed = JSON.parse(screenBlock.data.config.screenUI);
      if (parsed && typeof parsed === 'object' && parsed.root) {
        return {
          screenId,
          title: parsed.title || screenTitle,
          root: parsed.root,
          states: parsed.states,
        };
      }
    } catch {}
  }

  const screenBlocks = graph.nodes.filter((n) => n.data.config.screenId === screenId);
  const children: UIComponent[] = [];

  for (const n of screenBlocks) {
    const d = n.data;
    const c = d.config;

    switch (d.kind) {
      case 'input': {
        const inputType =
          c.field === 'email' || c.field === 'password' || c.field === 'number'
            ? c.field
            : 'text';
        children.push({
          id: n.id,
          type: 'input',
          inputType,
          label: d.label || 'Campo',
          placeholder: c.placeholder,
          defaultValue: c.value,
          bindingPath: n.id,
          accessibility: { ariaLabel: d.label },
        });
        break;
      }
      case 'button': {
        children.push({
          id: n.id,
          type: 'button',
          label: d.label || 'Botão',
          variant: 'primary',
          actionEvent: n.id,
          accessibility: { ariaLabel: d.label, role: 'button' },
        });
        break;
      }
      case 'text': {
        const style =
          c.style === 'title' || c.style === 'heading' || c.style === 'caption'
            ? c.style
            : 'body';
        children.push({
          id: n.id,
          type: 'text',
          content: c.text || '',
          style,
          accessibility: {
            role: style === 'title' || style === 'heading' ? 'heading' : undefined,
          },
        });
        break;
      }
      default:
        break;
    }
  }

  return {
    screenId,
    title: screenTitle,
    root: {
      id: \`\${screenId}_root\`,
      type: 'container',
      layout: { type: 'flex', direction: 'column', gap: 12, align: 'stretch' },
      children,
    },
  };
}

type Props = {
  graph: Graph;
  screen?: string;
  screenUI?: ScreenUI;
  values: Record<string, string>;
  store?: Record<string, unknown>;
  onChange: (id: string, value: string) => void;
  onAction: (id: string) => void;
};

export function ScreenFields({
  graph,
  screen,
  screenUI: explicitScreenUI,
  values,
  store = {},
  onChange,
  onAction,
}: Props) {
  const currentScreenNode = graph.nodes.find((n) => n.id === screen);
  const activeScreenUI: ScreenUI | undefined =
    explicitScreenUI || (currentScreenNode ? migrateScreenToUI(currentScreenNode, graph) : undefined);

  if (!activeScreenUI) {
    return (
      <div className="preview-empty-screen">
        <p className="subtle" style={{ margin: '16px 0', fontSize: '11px', color: '#8c8fa0' }}>
          Nenhuma tela selecionada ou configurada.
        </p>
      </div>
    );
  }

  const scope: EvaluationScope = { store, inputs: values, variables: {} };
  const screenState = evaluateScreenState(activeScreenUI, scope);

  if (screenState === 'loading' && activeScreenUI.states?.loading) {
    return (
      <div className="screen-state-loading" role="status" aria-live="polite">
        {renderComponent(activeScreenUI.states.loading, scope, values, onChange, onAction)}
      </div>
    );
  }
  if (screenState === 'error' && activeScreenUI.states?.error) {
    return (
      <div className="screen-state-error" role="alert">
        {renderComponent(activeScreenUI.states.error, scope, values, onChange, onAction)}
      </div>
    );
  }
  if (screenState === 'empty' && activeScreenUI.states?.empty) {
    return (
      <div className="screen-state-empty">
        {renderComponent(activeScreenUI.states.empty, scope, values, onChange, onAction)}
      </div>
    );
  }

  if (activeScreenUI.root.type === 'container' && activeScreenUI.root.children.length === 0) {
    return (
      <div className="preview-empty-screen">
        <p className="subtle" style={{ margin: '16px 0', fontSize: '11px', color: '#8c8fa0' }}>
          Nenhum campo de entrada ou botão vinculado a esta tela.
        </p>
      </div>
    );
  }

  return (
    <div className="screen-ui-root" style={{ width: '100%' }}>
      {renderComponent(activeScreenUI.root, scope, values, onChange, onAction)}
    </div>
  );
}

function renderComponent(
  comp: UIComponent,
  scope: EvaluationScope,
  values: Record<string, string>,
  onChange: (id: string, value: string) => void,
  onAction: (id: string) => void,
): React.ReactNode {
  if (!isComponentVisible(comp, scope)) return null;

  const a11yProps = {
    role: comp.accessibility?.role,
    'aria-label': comp.accessibility?.ariaLabel,
    'aria-live': comp.accessibility?.ariaLive,
  };

  switch (comp.type) {
    case 'container': {
      const layout = comp.layout;
      let style: React.CSSProperties = { boxSizing: 'border-box' };
      if (layout?.type === 'grid') {
        const cols =
          typeof layout.columns === 'number'
            ? \`repeat(\${layout.columns}, minmax(0, 1fr))\`
            : layout.columns || '1fr';
        style = { ...style, display: 'grid', gridTemplateColumns: cols, gap: layout.gap ?? 12 };
      } else {
        const dir = layout?.direction || 'column';
        style = {
          ...style,
          display: 'flex',
          flexDirection: dir,
          gap: layout?.gap ?? 12,
          alignItems: layout?.align || 'stretch',
          justifyContent: layout?.justify || 'flex-start',
          flexWrap: layout?.wrap ? 'wrap' : 'nowrap',
        };
      }
      return (
        <div key={comp.id} id={comp.id} style={style} {...a11yProps}>
          {comp.children.map((child) => renderComponent(child, scope, values, onChange, onAction))}
        </div>
      );
    }

    case 'text': {
      const content = String(evaluateBinding(comp.content, scope) ?? '');
      const s = comp.style || 'body';
      let fontStyle: React.CSSProperties = {
        color: comp.color || '#0f172a',
        textAlign: comp.align || 'left',
        margin: '4px 0',
      };
      if (s === 'title') {
        fontStyle = { ...fontStyle, fontSize: '18px', fontWeight: 700 };
        return <h2 key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>{content}</h2>;
      }
      if (s === 'heading') {
        fontStyle = { ...fontStyle, fontSize: '15px', fontWeight: 600 };
        return <h3 key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>{content}</h3>;
      }
      if (s === 'caption') {
        fontStyle = { ...fontStyle, fontSize: '12px', color: comp.color || '#64748b' };
        return <p key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>{content}</p>;
      }
      fontStyle = { ...fontStyle, fontSize: '14px', lineHeight: 1.5 };
      return <p key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>{content}</p>;
    }

    case 'image': {
      const src = String(evaluateBinding(comp.src, scope) ?? '');
      return (
        <img
          key={comp.id}
          id={comp.id}
          src={src}
          alt={comp.alt}
          style={{
            width: comp.width ?? '100%',
            height: comp.height ?? 'auto',
            objectFit: comp.fit ?? 'cover',
            borderRadius: '6px',
            display: 'block',
          }}
          {...a11yProps}
        />
      );
    }

    case 'input': {
      const key = comp.bindingPath || comp.id;
      const val = values[key] ?? comp.defaultValue ?? '';
      return (
        <label className="field" key={comp.id} id={\`label_\${comp.id}\`}>
          {comp.label}
          <input
            id={comp.id}
            type={comp.inputType || 'text'}
            placeholder={comp.placeholder}
            value={val}
            required={comp.required}
            onChange={(e) => onChange(key, e.target.value)}
            {...a11yProps}
          />
        </label>
      );
    }

    case 'textarea': {
      const key = comp.bindingPath || comp.id;
      const val = values[key] ?? comp.defaultValue ?? '';
      return (
        <label className="field" key={comp.id} id={\`label_\${comp.id}\`}>
          {comp.label}
          <textarea
            id={comp.id}
            rows={comp.rows || 3}
            placeholder={comp.placeholder}
            value={val}
            onChange={(e) => onChange(key, e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
              fontSize: '13px',
              width: '100%',
              boxSizing: 'border-box',
            }}
            {...a11yProps}
          />
        </label>
      );
    }

    case 'select': {
      const key = comp.bindingPath || comp.id;
      const val = values[key] ?? comp.defaultValue ?? (comp.options[0]?.value || '');
      return (
        <label className="field" key={comp.id} id={\`label_\${comp.id}\`}>
          {comp.label}
          <select
            id={comp.id}
            value={val}
            onChange={(e) => onChange(key, e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
              fontSize: '13px',
              width: '100%',
              boxSizing: 'border-box',
            }}
            {...a11yProps}
          >
            {comp.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    case 'checkbox': {
      const key = comp.bindingPath || comp.id;
      const checked =
        values[key] !== undefined ? values[key] === 'true' : Boolean(comp.defaultChecked);
      return (
        <label
          key={comp.id}
          id={\`label_\${comp.id}\`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: '13px',
            margin: '4px 0',
          }}
        >
          <input
            id={comp.id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(key, String(e.target.checked))}
            {...a11yProps}
          />
          {comp.label}
        </label>
      );
    }

    case 'radio': {
      const key = comp.bindingPath || comp.id;
      const selected = values[key] ?? comp.defaultValue ?? '';
      return (
        <fieldset
          key={comp.id}
          id={comp.id}
          style={{ border: 'none', padding: 0, margin: '6px 0' }}
          {...a11yProps}
        >
          <legend style={{ fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>{comp.label}</legend>
          {comp.options.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginRight: 16,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <input
                type="radio"
                name={comp.name}
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => onChange(key, opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      );
    }

    case 'button': {
      const isDisabled = comp.disabled ? Boolean(evaluateBinding(comp.disabled, scope)) : false;
      const variantClass =
        comp.variant === 'secondary'
          ? 'secondary wide'
          : comp.variant === 'danger'
          ? 'danger wide'
          : comp.variant === 'ghost'
          ? 'ghost wide'
          : 'primary wide';
      return (
        <button
          key={comp.id}
          id={comp.id}
          className={variantClass}
          disabled={isDisabled}
          onClick={() => onAction(comp.actionEvent)}
          {...a11yProps}
        >
          {comp.label}
        </button>
      );
    }

    case 'list': {
      const items = evaluateListItems(comp, scope);
      if (items.length === 0) {
        if (comp.emptyState) {
          return (
            <div key={comp.id} id={comp.id} className="list-empty-container">
              {renderComponent(comp.emptyState, scope, values, onChange, onAction)}
            </div>
          );
        }
        return (
          <div key={comp.id} id={comp.id} className="list-empty-default" style={{ padding: '8px 0', color: '#94a3b8', fontSize: '12px' }}>
            Nenhum item disponível.
          </div>
        );
      }
      const itemVar = comp.itemVarName || 'item';
      return (
        <div key={comp.id} id={comp.id} className="repeater-container" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} {...a11yProps}>
          {items.map((item, idx) => {
            const itemScope: EvaluationScope = { ...scope, item, [itemVar]: item, index: idx };
            return (
              <div key={\`\${comp.id}_item_\${idx}\`} className="repeater-row">
                {renderComponent(comp.template, itemScope, values, onChange, onAction)}
              </div>
            );
          })}
        </div>
      );
    }

    case 'modal': {
      const isOpen = comp.openBinding ? Boolean(evaluateBinding(comp.openBinding, scope)) : true;
      if (!isOpen) return null;
      return (
        <div
          key={comp.id}
          id={comp.id}
          className="ui-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={comp.accessibility?.ariaLabel || comp.title}
        >
          <div
            className="ui-modal-card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '90%',
              width: '360px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {comp.title && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{comp.title}</h3>
                {comp.closeEvent && (
                  <button
                    type="button"
                    onClick={() => onAction(comp.closeEvent!)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
                    aria-label="Fechar modal"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comp.children.map((child) => renderComponent(child, scope, values, onChange, onAction))}
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
`;
