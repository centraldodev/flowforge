import type { Block, Graph } from '../../engine/types';
import type { ScreenUI, UIComponent } from './types';

/**
 * Migra automaticamente blocos associados a uma tela no formato legado para uma ScreenUI declarativa.
 * Garante que qualquer tela existente continue renderizando sem depender de coordenadas físicas (x, y).
 */
export function migrateScreenToUI(screenBlock: Block, graph: Graph): ScreenUI {
  const screenId = screenBlock.id;
  const screenTitle = (screenBlock.data.config.title as string) || screenBlock.data.label || 'Tela';

  // Se a tela já possuir uma definição JSON de ScreenUI declarativa no config, usa ela
  if (screenBlock.data.config.screenUI) {
    try {
      const parsed = JSON.parse(screenBlock.data.config.screenUI);
      if (parsed && typeof parsed === 'object' && parsed.root) {
        return {
          screenId,
          title: parsed.title || screenTitle,
          root: parsed.root,
          states: parsed.states,
        };
      }
    } catch {
      // Fallback para migração automática
    }
  }

  // Coleta os blocos vinculados a esta tela
  const screenBlocks = graph.nodes.filter((n) => n.data.config.screenId === screenId);

  const children: UIComponent[] = [];

  for (const n of screenBlocks) {
    const d = n.data;
    const c = d.config;

    switch (d.kind) {
      case 'input': {
        const inputType =
          c.field === 'email' || c.field === 'password' || c.field === 'number' ? c.field : 'text';
        children.push({
          id: n.id,
          type: 'input',
          inputType,
          label: d.label || 'Campo',
          placeholder: c.placeholder,
          defaultValue: c.value,
          bindingPath: n.id,
          accessibility: {
            ariaLabel: d.label,
          },
        });
        break;
      }

      case 'button': {
        children.push({
          id: n.id,
          type: 'button',
          label: d.label || 'Botão',
          variant: 'primary',
          actionEvent: n.id,
          accessibility: {
            ariaLabel: d.label,
            role: 'button',
          },
        });
        break;
      }

      case 'text': {
        const style =
          c.style === 'title' || c.style === 'heading' || c.style === 'caption' ? c.style : 'body';
        children.push({
          id: n.id,
          type: 'text',
          content: c.text || '',
          style,
          accessibility: {
            role: style === 'title' || style === 'heading' ? 'heading' : undefined,
          },
        });
        break;
      }

      default:
        break;
    }
  }

  // Cria o container raiz em coluna flexível (single-column layout)
  const rootContainer: UIComponent = {
    id: `${screenId}_root`,
    type: 'container',
    layout: {
      type: 'flex',
      direction: 'column',
      gap: 12,
      align: 'stretch',
    },
    children,
  };

  return {
    screenId,
    title: screenTitle,
    root: rootContainer,
  };
}

/**
 * Migra todas as telas de um grafo para um dicionário de ScreenUI por ID da tela.
 */
export function migrateAllScreens(graph: Graph): Record<string, ScreenUI> {
  const result: Record<string, ScreenUI> = {};
  const screenNodes = graph.nodes.filter((n) => n.data.kind === 'screen');

  for (const scr of screenNodes) {
    result[scr.id] = migrateScreenToUI(scr, graph);
  }

  return result;
}
