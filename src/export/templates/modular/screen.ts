export const renderTypesSource = `import type React from 'react';
import type { UIComponent, EvaluationScope } from '@flowforge/contracts/ui';
export type RenderComponent = (component: UIComponent, scope: EvaluationScope, values: Record<string, string>, onChange: (id: string, value: string) => void, onAction: (id: string) => void) => React.ReactNode;
`;
export const rendererSource = `import { isComponentVisible } from './bindings';
import { renderFields } from './fields';
import { renderContent } from './content';
import { renderLayout } from './layout';
import type { RenderComponent } from './types';
export const renderComponent: RenderComponent = (comp, scope, values, onChange, onAction) => {
  if (!isComponentVisible(comp, scope)) return null;
  const render = ['container', 'list', 'modal', 'table', 'form'].includes(comp.type) ? renderLayout : ['input', 'textarea', 'select', 'checkbox', 'radio'].includes(comp.type) ? renderFields : renderContent;
  return render(comp, scope, values, onChange, onAction, renderComponent);
};
`;
export const screenViewSource = `import type { ScreenUI, EvaluationScope } from '@flowforge/contracts/ui';
import { evaluateScreenState } from './bindings';
import { renderComponent } from './Renderer';
export type ScreenProps = { values: Record<string, string>; store: Record<string, unknown>; onChange: (id: string, value: string) => void; onAction: (id: string) => void };
export function ScreenView({ definition, ...props }: ScreenProps & { definition: ScreenUI }) {
  const scope: EvaluationScope = { store: props.store, inputs: props.values, variables: {} };
  const state = evaluateScreenState(definition, scope);
  const component = state === 'ready' ? definition.root : definition.states?.[state] || definition.root;
  return <div className="ff-design-frame" data-screen-id={definition.screenId}><div className="screen-ui-root">{renderComponent(component, scope, props.values, props.onChange, props.onAction)}</div></div>;
}
`;
