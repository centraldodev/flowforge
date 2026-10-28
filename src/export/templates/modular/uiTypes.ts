export const uiTypesSource = `export type UIBinding =
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

export type UIMenuItem = {
  id: string;
  label: string;
  icon?: string;
  actionType?: 'screen' | 'workflow' | 'value';
  targetScreenId?: string;
  actionEvent?: string;
  value?: string;
};

export type UIComponent =
  | {
      id: string;
      type: 'container';
      layout?: UILayout;
      children: UIComponent[];
      variant?: 'default' | 'card' | 'header' | 'footer';
      title?: string;
      iconName?: string;
      navItems?: Array<{ id: string; label: string; icon: string; actionEvent?: string }>;
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
      iconName?: string;
      actionEvent: string;
      disabled?: UIBinding;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'icon';
      iconName: string;
      label?: string;
      size?: number;
      color?: string;
      actionEvent?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'dropdown';
      label: string;
      iconName?: string;
      items: UIMenuItem[];
      itemsPath?: string;
      bindingPath?: string;
      defaultValue?: string;
      actionEvent?: string;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'hamburger';
      label?: string;
      iconName?: string;
      items: UIMenuItem[];
      itemsPath?: string;
      bindingPath?: string;
      actionEvent?: string;
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
      type: 'table';
      itemsPath: string;
      columns: Array<{
        key: string;
        label: string;
        width?: string;
        sortable?: boolean;
      }>;
      actions?: Array<{
        label: string;
        actionEvent: string;
        variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
      }>;
      pageSize?: number;
      emptyState?: UIComponent;
      visible?: UIBinding;
      accessibility?: UIAccessibility;
    }
  | {
      id: string;
      type: 'form';
      children: UIComponent[];
      submitLabel?: string;
      submitEvent?: string;
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
  route?: string;
  params?: string[];
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

`;
