import React from 'react';
import type { Graph } from '../../engine';
import {
  evaluateBinding,
  evaluateListItems,
  evaluateScreenState,
  isComponentVisible,
  migrateScreenToUI,
  type EvaluationScope,
  type ScreenUI,
  type UIComponent,
} from '../../compiler/ui';

type Props = {
  graph: Graph;
  screen?: string;
  screenUI?: ScreenUI;
  values: Record<string, string>;
  store?: Record<string, unknown>;
  onChange: (id: string, value: string) => void;
  onAction: (id: string) => void;
};

/**
 * Renderiza os elementos declarativos de uma tela.
 * Suporta árvores de componentes (ScreenUI / ComponentTree) e migra automaticamente
 * telas legadas para um layout flexível em coluna sem dependência de coordenadas físicas.
 */
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
    explicitScreenUI ||
    (currentScreenNode ? migrateScreenToUI(currentScreenNode, graph) : undefined);

  if (!activeScreenUI) {
    return (
      <div className="preview-empty-screen">
        <p className="subtle" style={{ margin: '16px 0', fontSize: '11px', color: '#8c8fa0' }}>
          Nenhuma tela selecionada ou configurada.
        </p>
      </div>
    );
  }

  const scope: EvaluationScope = {
    store,
    inputs: values,
    variables: {},
  };

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

  // Verifica se o container raiz está vazio
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
  if (!isComponentVisible(comp, scope)) {
    return null;
  }

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
            ? `repeat(${layout.columns}, minmax(0, 1fr))`
            : layout.columns || '1fr';
        style = {
          ...style,
          display: 'grid',
          gridTemplateColumns: cols,
          gap: layout.gap ?? 12,
        };
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
        return (
          <h2 key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>
            {content}
          </h2>
        );
      }
      if (s === 'heading') {
        fontStyle = { ...fontStyle, fontSize: '15px', fontWeight: 600 };
        return (
          <h3 key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>
            {content}
          </h3>
        );
      }
      if (s === 'caption') {
        fontStyle = { ...fontStyle, fontSize: '12px', color: comp.color || '#64748b' };
        return (
          <p key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>
            {content}
          </p>
        );
      }
      fontStyle = { ...fontStyle, fontSize: '14px', lineHeight: 1.5 };
      return (
        <p key={comp.id} id={comp.id} style={fontStyle} {...a11yProps}>
          {content}
        </p>
      );
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
        <label className="field" key={comp.id} id={`label_${comp.id}`}>
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
        <label className="field" key={comp.id} id={`label_${comp.id}`}>
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
        <label className="field" key={comp.id} id={`label_${comp.id}`}>
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
          id={`label_${comp.id}`}
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
          <legend style={{ fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>
            {comp.label}
          </legend>
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
          <div
            key={comp.id}
            id={comp.id}
            className="list-empty-default"
            style={{ padding: '8px 0', color: '#94a3b8', fontSize: '12px' }}
          >
            Nenhum item disponível.
          </div>
        );
      }

      const itemVar = comp.itemVarName || 'item';

      return (
        <div
          key={comp.id}
          id={comp.id}
          className="repeater-container"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          {...a11yProps}
        >
          {items.map((item, idx) => {
            const itemScope: EvaluationScope = {
              ...scope,
              item,
              [itemVar]: item,
              index: idx,
            };
            return (
              <div key={`${comp.id}_item_${idx}`} className="repeater-row">
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{comp.title}</h3>
                {comp.closeEvent && (
                  <button
                    type="button"
                    onClick={() => onAction(comp.closeEvent!)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: '#64748b',
                    }}
                    aria-label="Fechar modal"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comp.children.map((child) =>
                renderComponent(child, scope, values, onChange, onAction),
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'table': {
      const rawItems = evaluateBinding({ kind: 'path', path: comp.itemsPath }, scope);
      const items = Array.isArray(rawItems) ? (rawItems as Array<Record<string, unknown>>) : [];

      if (items.length === 0) {
        if (comp.emptyState) {
          return (
            <div key={comp.id} id={comp.id} className="table-empty-container">
              {renderComponent(comp.emptyState, scope, values, onChange, onAction)}
            </div>
          );
        }
        return (
          <div
            key={comp.id}
            id={comp.id}
            className="table-empty-default"
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '13px',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
            }}
          >
            Nenhum registro encontrado.
          </div>
        );
      }

      const pageSize = comp.pageSize || 10;
      const displayedItems = items.slice(0, pageSize);

      return (
        <div
          key={comp.id}
          id={comp.id}
          className="ui-table-wrapper"
          style={{ width: '100%', overflowX: 'auto', margin: '8px 0' }}
          {...a11yProps}
        >
          <table
            className="ui-data-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                {comp.columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '8px 12px',
                      fontWeight: 600,
                      color: '#475569',
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                {comp.actions && comp.actions.length > 0 && (
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#475569',
                    }}
                  >
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, idx) => (
                <tr
                  key={`${comp.id}_row_${idx}`}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s ease',
                  }}
                  className="ui-table-row"
                >
                  {comp.columns.map((col) => (
                    <td key={col.key} style={{ padding: '8px 12px', color: '#1e293b' }}>
                      {String(item[col.key] ?? '')}
                    </td>
                  ))}
                  {comp.actions && comp.actions.length > 0 && (
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        {comp.actions.map((act) => (
                          <button
                            key={act.actionEvent}
                            type="button"
                            className={act.variant ? `${act.variant} small` : 'secondary small'}
                            style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px' }}
                            onClick={() => {
                              onChange('__selectedRow', JSON.stringify(item));
                              if (item.id !== undefined) onChange('__selectedId', String(item.id));
                              onAction(act.actionEvent);
                            }}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > pageSize && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                fontSize: '11px',
                color: '#64748b',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <span>
                Mostrando {displayedItems.length} de {items.length} registros
              </span>
            </div>
          )}
        </div>
      );
    }

    case 'form': {
      return (
        <form
          key={comp.id}
          id={comp.id}
          className="ui-form-container"
          style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (comp.submitEvent) onAction(comp.submitEvent);
          }}
          {...a11yProps}
        >
          {comp.children.map((child) => renderComponent(child, scope, values, onChange, onAction))}
          {comp.submitLabel && (
            <button type="submit" className="primary wide" style={{ marginTop: 4 }}>
              {comp.submitLabel}
            </button>
          )}
        </form>
      );
    }

    default:
      return null;
  }
}
