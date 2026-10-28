import { migrateScreenToUI, type UIComponent, type UIMenuItem } from '../../compiler/ui';
import type { Graph } from '../../engine/types';
import {
  defaultVisualStyle,
  type Device,
  type VisualScreen,
  type VisualStyle,
} from '../../engine/visualDesign';

export function screenComponents(graph: Graph, screenId: string): UIComponent[] {
  const screen = graph.nodes.find((node) => node.id === screenId && node.data.kind === 'screen');
  if (!screen) return [];
  const root = migrateScreenToUI(screen, graph).root;
  return root.type === 'container' ? root.children : [root];
}

export function prepareVisualScreen(graph: Graph, screenId: string): VisualScreen {
  const current = graph.visualDesign?.[screenId];
  const result: VisualScreen = {
    enabled: current?.enabled?.length ? [...current.enabled] : ['mobile', 'tablet', 'desktop'],
    items: { ...current?.items },
  };
  screenComponents(graph, screenId).forEach((component, index) => {
    const previous = result.items[component.id] || {};
    result.items[component.id] = { ...previous };
    for (const device of ['mobile', 'tablet', 'desktop'] as Device[])
      if (!previous[device])
        result.items[component.id][device] = defaultVisualStyle(index, device, component.type);
  });
  return result;
}

export function updateVisualScreen(
  graph: Graph,
  screenId: string,
  update: (screen: VisualScreen) => VisualScreen,
): Graph {
  return {
    ...graph,
    visualDesign: {
      ...graph.visualDesign,
      [screenId]: update(prepareVisualScreen(graph, screenId)),
    },
  };
}

export function updateVisualStyle(
  graph: Graph,
  screenId: string,
  itemId: string,
  device: Device,
  patch: Partial<VisualStyle>,
): Graph {
  return updateVisualScreen(graph, screenId, (screen) => ({
    ...screen,
    items: {
      ...screen.items,
      [itemId]: {
        ...screen.items[itemId],
        [device]: { ...screen.items[itemId][device]!, ...patch },
      },
    },
  }));
}

function saveComponents(graph: Graph, screenId: string, components: UIComponent[]): Graph {
  const screen = graph.nodes.find((node) => node.id === screenId && node.data.kind === 'screen');
  if (!screen) return graph;
  const ui = migrateScreenToUI(screen, graph);
  const root =
    ui.root.type === 'container'
      ? { ...ui.root, children: components }
      : { id: `${screenId}_root`, type: 'container' as const, children: components };
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === screenId
        ? {
            ...node,
            data: {
              ...node.data,
              config: { ...node.data.config, screenUI: JSON.stringify({ ...ui, root }) },
            },
          }
        : node,
    ),
  };
}

export type VisualComponentKind =
  | 'button'
  | 'submit'
  | 'input'
  | 'textarea'
  | 'text'
  | 'heading'
  | 'container'
  | 'card'
  | 'table'
  | 'switch'
  | 'select'
  | 'icon'
  | 'fab'
  | 'fab_extended'
  | 'header_app'
  | 'footer_instagram'
  | 'dropdown'
  | 'hamburger';

export function addVisualComponent(
  graph: Graph,
  screenId: string,
  type: VisualComponentKind,
  options?: { iconName?: string; label?: string },
): { graph: Graph; id: string } {
  const used = new Set(graph.nodes.map((node) => node.id));
  const prefix =
    type === 'submit'
      ? 'btn_submit'
      : type === 'heading'
        ? 'title'
        : type === 'card'
          ? 'card'
          : type === 'header_app'
            ? 'header'
            : type === 'footer_instagram'
              ? 'footer'
              : type === 'fab_extended'
                ? 'fab_ext'
                : type === 'hamburger'
                  ? 'nav_menu'
                  : type;
  let sequence = 1;
  while (used.has(`${prefix}_${sequence}`)) sequence++;
  const id = `${prefix}_${sequence}`;

  let label = options?.label || 'Elemento';
  let component: UIComponent;

  if (type === 'button') {
    label = options?.label || 'Botão';
    component = {
      id,
      type: 'button',
      label,
      iconName: options?.iconName,
      actionEvent: id,
    };
  } else if (type === 'submit') {
    label = options?.label || 'Enviar';
    component = { id, type: 'button', label, variant: 'primary', actionEvent: id };
  } else if (type === 'fab') {
    label = options?.label || '';
    component = {
      id,
      type: 'button',
      label,
      iconName: options?.iconName || 'add',
      variant: 'primary',
      actionEvent: id,
      accessibility: { role: 'button', ariaLabel: 'Ação rápida (FAB)' },
    };
  } else if (type === 'fab_extended') {
    label = options?.label || 'Criar Novo';
    component = {
      id,
      type: 'button',
      label,
      iconName: options?.iconName || 'add',
      variant: 'primary',
      actionEvent: id,
      accessibility: { role: 'button', ariaLabel: 'Criar Novo' },
    };
  } else if (type === 'icon') {
    const iconName = options?.iconName || 'star';
    label = options?.label || iconName;
    component = {
      id,
      type: 'icon',
      iconName,
      label,
      size: 26,
      color: '#a78bfa',
      actionEvent: id,
    };
  } else if (type === 'header_app') {
    label = options?.label || 'Meu Aplicativo';
    component = {
      id,
      type: 'container',
      variant: 'header',
      title: label,
      layout: { type: 'flex', direction: 'row', justify: 'between', align: 'center', gap: 12 },
      children: [],
      accessibility: { role: 'banner', ariaLabel: 'Cabeçalho do Aplicativo' },
    };
  } else if (type === 'footer_instagram') {
    label = options?.label || 'Menu Inferior (Instagram)';
    component = {
      id,
      type: 'container',
      variant: 'footer',
      title: 'Navegação Inferior',
      layout: { type: 'flex', direction: 'row', justify: 'around', align: 'center', gap: 4 },
      navItems: [
        { id: `${id}_home`, label: 'Início', icon: 'home' },
        { id: `${id}_projects`, label: 'Projetos', icon: 'folder' },
        { id: `${id}_add`, label: 'Novo', icon: 'add_box' },
        { id: `${id}_activity`, label: 'Atividade', icon: 'favorite' },
        { id: `${id}_settings`, label: 'Perfil', icon: 'person' },
      ],
      children: [],
      accessibility: { role: 'navigation', ariaLabel: 'Barra de navegação inferior' },
    };
  } else if (type === 'dropdown') {
    label = options?.label || 'Menu Opções';
    const allScreens = graph.nodes.filter((n) => n.data.kind === 'screen');
    const targetScreen = allScreens.find((n) => n.id !== screenId) || allScreens[0];
    const items: UIMenuItem[] = [];
    if (targetScreen) {
      items.push({
        id: `${id}_screen_${targetScreen.id}`,
        label: targetScreen.data.label ? `Ir para ${targetScreen.data.label}` : 'Ir para Tela',
        icon: 'web_asset',
        actionType: 'screen',
        targetScreenId: targetScreen.id,
      });
    }
    items.push(
      {
        id: `${id}_item_1`,
        label: 'Opção 1',
        icon: 'label',
        actionType: 'value',
        value: 'opcao_1',
      },
      {
        id: `${id}_item_2`,
        label: 'Categorias',
        icon: 'category',
        actionType: 'value',
        value: 'categorias',
      },
    );
    component = {
      id,
      type: 'dropdown',
      label,
      iconName: options?.iconName || 'arrow_drop_down',
      items,
      itemsPath: '',
      bindingPath: id,
      actionEvent: id,
    };
  } else if (type === 'hamburger') {
    label = options?.label || 'Menu';
    const screens = graph.nodes.filter((n) => n.data.kind === 'screen');
    const items: UIMenuItem[] = screens.map((s) => ({
      id: `${id}_screen_${s.id}`,
      label: s.data.label || s.id,
      icon: 'web_asset',
      actionType: 'screen',
      targetScreenId: s.id,
    }));
    if (items.length <= 1) {
      items.push({
        id: `${id}_categ`,
        label: 'Categorias',
        icon: 'category',
        actionType: 'value',
        value: 'todas',
      });
    }
    items.push({
      id: `${id}_settings`,
      label: 'Configurações',
      icon: 'settings',
      actionType: 'workflow',
      actionEvent: 'open_settings',
    });
    component = {
      id,
      type: 'hamburger',
      label,
      iconName: options?.iconName || 'menu',
      items,
      itemsPath: '',
      bindingPath: id,
      actionEvent: id,
    };
  } else if (type === 'input') {
    label = 'Campo de texto';
    component = {
      id,
      type: 'input',
      label,
      inputType: 'text',
      placeholder: 'Digite algo...',
      bindingPath: id,
    };
  } else if (type === 'textarea') {
    label = 'Mensagem';
    component = {
      id,
      type: 'textarea',
      label,
      placeholder: 'Digite seu texto aqui...',
      rows: 3,
      bindingPath: id,
    };
  } else if (type === 'heading') {
    label = 'Título da Seção';
    component = { id, type: 'text', content: label, style: 'heading' };
  } else if (type === 'text') {
    label = 'Texto descritivo';
    component = { id, type: 'text', content: label, style: 'body' };
  } else if (type === 'container' || type === 'card') {
    label = type === 'card' ? 'Cartão' : 'Container';
    component = {
      id,
      type: 'container',
      layout: { type: 'flex', direction: 'column', gap: 12 },
      children: [],
    };
  } else if (type === 'switch') {
    label = 'Ativar opção';
    component = { id, type: 'checkbox', label, defaultChecked: false, bindingPath: id };
  } else if (type === 'select') {
    label = 'Selecione uma opção';
    component = {
      id,
      type: 'select',
      label,
      options: [
        { label: 'Opção 1', value: '1' },
        { label: 'Opção 2', value: '2' },
        { label: 'Opção 3', value: '3' },
      ],
      bindingPath: id,
    };
  } else if (type === 'table') {
    label = 'Tabela de Dados';
    component = {
      id,
      type: 'table',
      itemsPath: 'items',
      columns: [
        { key: 'id', label: 'ID', width: '80px' },
        { key: 'nome', label: 'Nome' },
        { key: 'status', label: 'Status' },
        { key: 'valor', label: 'Valor' },
      ],
    };
  } else {
    label = 'Elemento';
    component = { id, type: 'text', content: label };
  }

  const existingCount = screenComponents(graph, screenId).length;
  const components = [...screenComponents(graph, screenId), component];
  const withScreen = saveComponents(graph, screenId, components);

  // Inicializa estilo para todos os dispositivos
  const updatedGraph = updateVisualScreen(withScreen, screenId, (screen) => {
    const items = { ...screen.items };
    items[id] = {};
    for (const device of screen.enabled) {
      items[id][device] = defaultVisualStyle(existingCount, device, type);
    }
    return { ...screen, items };
  });

  return { graph: updatedGraph, id };
}

export function removeVisualComponent(graph: Graph, screenId: string, id: string): Graph {
  const components = screenComponents(graph, screenId).filter((component) => component.id !== id);
  const updatedNodes = graph.nodes.filter((node) => node.id !== id);
  const withScreen = saveComponents({ ...graph, nodes: updatedNodes }, screenId, components);
  return updateVisualScreen(withScreen, screenId, (screen) => {
    const items = { ...screen.items };
    delete items[id];
    return { ...screen, items };
  });
}

export function duplicateVisualComponent(
  graph: Graph,
  screenId: string,
  id: string,
): { graph: Graph; id: string } | null {
  const current = screenComponents(graph, screenId).find((c) => c.id === id);
  if (!current) return null;

  const used = new Set(graph.nodes.map((node) => node.id));
  let sequence = 2;
  while (used.has(`${current.id}_copy_${sequence}`)) sequence++;
  const newId = `${current.id}_copy_${sequence}`;

  // Clona objeto de componente com novo ID
  const clone: UIComponent = JSON.parse(JSON.stringify(current));
  clone.id = newId;
  if ('label' in clone && typeof clone.label === 'string') clone.label += ' (Cópia)';
  if ('content' in clone && typeof clone.content === 'string') clone.content += ' (Cópia)';
  if ('actionEvent' in clone) clone.actionEvent = newId;

  const components = [...screenComponents(graph, screenId), clone];
  const withScreen = saveComponents(graph, screenId, components);

  const updatedGraph = updateVisualScreen(withScreen, screenId, (screen) => {
    const items = { ...screen.items };
    const originalStyle = items[id] || {};
    items[newId] = {};
    for (const device of screen.enabled) {
      const orig = originalStyle[device];
      if (orig) {
        items[newId][device] = {
          ...orig,
          x: orig.x + 15,
          y: orig.y + 15,
        };
      } else {
        items[newId][device] = defaultVisualStyle(components.length, device, current.type);
      }
    }
    return { ...screen, items };
  });

  return { graph: updatedGraph, id: newId };
}

export function updateComponentConfig(
  graph: Graph,
  screenId: string,
  id: string,
  patch: Partial<UIComponent> & {
    placeholder?: string;
    rows?: number;
    inputType?: string;
    actionEvent?: string;
    iconName?: string;
    title?: string;
    color?: string;
    size?: number;
    items?: UIMenuItem[];
    itemsPath?: string;
    bindingPath?: string;
  },
): Graph {
  const components = screenComponents(graph, screenId).map((component): UIComponent => {
    if (component.id !== id) return component;
    return { ...component, ...patch } as UIComponent;
  });

  const updatedNodes = graph.nodes.map((node) => {
    if (node.id !== id) return node;
    const label =
      'label' in patch && typeof patch.label === 'string'
        ? patch.label
        : 'title' in patch && typeof patch.title === 'string'
          ? patch.title
          : node.data.label;
    return { ...node, data: { ...node.data, label } };
  });

  return saveComponents({ ...graph, nodes: updatedNodes }, screenId, components);
}

export function renameVisualComponent(
  graph: Graph,
  screenId: string,
  id: string,
  label: string,
): Graph {
  const components = screenComponents(graph, screenId).map((component): UIComponent => {
    if (component.id !== id) return component;
    if (
      component.type === 'button' ||
      component.type === 'input' ||
      component.type === 'textarea' ||
      component.type === 'checkbox' ||
      component.type === 'select' ||
      component.type === 'dropdown' ||
      component.type === 'hamburger'
    ) {
      return { ...component, label };
    }
    if (component.type === 'text') return { ...component, content: label };
    if (component.type === 'icon') return { ...component, label, iconName: label };
    if (component.type === 'container' && component.variant === 'header') {
      return { ...component, title: label };
    }
    return component;
  });
  const updated = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === id
        ? {
            ...node,
            data: {
              ...node.data,
              label,
              config:
                node.data.kind === 'text' ? { ...node.data.config, text: label } : node.data.config,
            },
          }
        : node,
    ),
  };
  return saveComponents(updated, screenId, components);
}
