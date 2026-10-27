export const layoutSource = `import React from 'react';
import type { UIComponent, EvaluationScope } from '@flowforge/contracts/ui';
import { evaluateBinding, isComponentVisible, evaluateListItems } from './bindings';
import type { RenderComponent } from './types';
export function renderLayout(comp: UIComponent, scope: EvaluationScope, values: Record<string, string>, onChange: (id: string, value: string) => void, onAction: (id: string) => void, renderComponent: RenderComponent): React.ReactNode {
  const a11yProps = { role: comp.accessibility?.role, 'aria-label': comp.accessibility?.ariaLabel, 'aria-live': comp.accessibility?.ariaLive };
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

    case 'table': {
      const raw = evaluateBinding({ kind: 'path', path: comp.itemsPath }, scope);
      const items = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
      if (items.length === 0) {
        if (comp.emptyState) return <div key={comp.id} id={comp.id}>{renderComponent(comp.emptyState, scope, values, onChange, onAction)}</div>;
        return <div key={comp.id} id={comp.id} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>Nenhum registro encontrado.</div>;
      }
      const pageSize = comp.pageSize || 10;
      const displayed = items.slice(0, pageSize);
      return (
        <div key={comp.id} id={comp.id} style={{ width: '100%', overflowX: 'auto', margin: '8px 0' }} {...a11yProps}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                {comp.columns.map((col) => (
                  <th key={col.key} style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: col.width }}>{col.label}</th>
                ))}
                {comp.actions && comp.actions.length > 0 && <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, idx) => (
                <tr key={\`\${comp.id}_row_\${idx}\`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {comp.columns.map((col) => <td key={col.key} style={{ padding: '8px 12px', color: '#1e293b' }}>{String(item[col.key] ?? '')}</td>)}
                  {comp.actions && comp.actions.length > 0 && (
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {comp.actions.map((act) => (
                          <button
                            key={act.actionEvent}
                            type="button"
                            className={act.variant ? \`\${act.variant} small\` : 'secondary small'}
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
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
              Mostrando {displayed.length} de {items.length} registros
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

    default: return null;
  }
}
`;
