export const fieldsSource = `import React from 'react';
import type { UIComponent, EvaluationScope } from '@flowforge/contracts/ui';
import { evaluateBinding, isComponentVisible, evaluateListItems } from './bindings';
import type { RenderComponent } from './types';
export function renderFields(comp: UIComponent, scope: EvaluationScope, values: Record<string, string>, onChange: (id: string, value: string) => void, onAction: (id: string) => void, renderComponent: RenderComponent): React.ReactNode {
  const a11yProps = { role: comp.accessibility?.role, 'aria-label': comp.accessibility?.ariaLabel, 'aria-live': comp.accessibility?.ariaLive };
  switch (comp.type) {
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

    default: return null;
  }
}
`;
