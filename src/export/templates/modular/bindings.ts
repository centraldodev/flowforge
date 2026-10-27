export const bindingsSource = `import type { ScreenUI, UIBinding, UIComponent, EvaluationScope } from '@flowforge/contracts/ui';
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

export function evaluateTableItems(
  comp: Extract<UIComponent, { type: 'table' }>,
  scope: EvaluationScope,
): unknown[] {
  const items = resolvePath(scope, comp.itemsPath);
  return Array.isArray(items) ? items : [];
}
`;
