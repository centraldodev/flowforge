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
          {comp.label}
        </button>
      );
    }

    default: return null;
  }
}
`;
