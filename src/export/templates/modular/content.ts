export const contentSource = `import React from 'react';
import type { UIComponent, EvaluationScope } from '@flowforge/contracts/ui';
import { evaluateBinding, isComponentVisible, evaluateListItems } from './bindings';
import type { RenderComponent } from './types';
export function renderContent(comp: UIComponent, scope: EvaluationScope, values: Record<string, string>, onChange: (id: string, value: string) => void, onAction: (id: string) => void, renderComponent: RenderComponent): React.ReactNode {
  const a11yProps = { role: comp.accessibility?.role, 'aria-label': comp.accessibility?.ariaLabel, 'aria-live': comp.accessibility?.ariaLive };
  switch (comp.type) {
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
          {comp.iconName && (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', marginRight: comp.label ? '6px' : '0' }}
            >
              {comp.iconName}
            </span>
          )}
          {comp.label}
        </button>
      );
    }

    case 'icon': {
      return (
        <span
          key={comp.id}
          id={comp.id}
          className="material-symbols-outlined"
          style={{
            fontSize: comp.size ? comp.size + 'px' : '24px',
            color: comp.color || 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: comp.actionEvent ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={comp.actionEvent ? () => onAction(comp.actionEvent!) : undefined}
          {...a11yProps}
        >
          {comp.iconName || 'star'}
        </span>
      );
    }

    case 'dropdown': {
      const items = comp.items || [];
      return (
        <details key={comp.id} id={comp.id} className="ui-dropdown" style={{ position: 'relative', width: '100%', marginBottom: '8px' }} {...a11yProps}>
          <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e222b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', listStyle: 'none', color: '#f8fafc', fontWeight: 500, fontSize: '14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {comp.iconName && comp.iconName !== 'arrow_drop_down' && (
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{comp.iconName}</span>
              )}
              <span>{comp.label}</span>
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', opacity: 0.7 }}>arrow_drop_down</span>
          </summary>
          <div className="ui-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#181b22', border: '1px solid #334155', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100, overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => {
                  if (item.actionType === 'screen' && item.targetScreenId) onAction(item.targetScreenId);
                  else if (item.actionType === 'workflow' && item.actionEvent) onAction(item.actionEvent);
                  else if (comp.actionEvent) onAction(comp.actionEvent);
                }}
              >
                {item.icon && <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#a78bfa' }}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </details>
      );
    }

    case 'hamburger': {
      const items = comp.items || [];
      return (
        <details key={comp.id} id={comp.id} className="ui-hamburger-menu" style={{ position: 'relative', display: 'inline-block' }} {...a11yProps}>
          <summary style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', background: '#1e222b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', listStyle: 'none', color: '#f8fafc' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{comp.iconName || 'menu'}</span>
          </summary>
          <div className="ui-hamburger-drawer" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '220px', background: '#181b22', border: '1px solid #334155', borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 120, padding: '6px 0', overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => {
                  if (item.actionType === 'screen' && item.targetScreenId) onAction(item.targetScreenId);
                  else if (item.actionType === 'workflow' && item.actionEvent) onAction(item.actionEvent);
                  else if (comp.actionEvent) onAction(comp.actionEvent);
                }}
              >
                {item.icon && <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a78bfa' }}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </details>
      );
    }

    default: return null;
  }
}
`;
