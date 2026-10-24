/**
 * Árvore declarativa de interface (ScreenUI / ComponentTree).
 * Separa a estrutura, propriedades, layout e bindings da UI do grafo de comportamento.
 */

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
