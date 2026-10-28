import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  Box,
  Copy,
  FormInput,
  Grid2X2,
  Heading,
  LayoutDashboard,
  Layers,
  Magnet,
  Maximize2,
  Minus,
  MousePointer2,
  MousePointerClick,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Sun,
  Moon,
  Table as TableIcon,
  Tablet,
  ChevronDown,
  ToggleLeft,
  Trash2,
  Type,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Workflow,
  X,
} from 'lucide-react';
import type { UIMenuItem } from '../../compiler/ui';
import type { Graph } from '../../engine/types';
import {
  defaultVisualStyle,
  devices,
  snapVisualPosition,
  visualStyle,
  type Device,
  type VisualStyle,
} from '../../engine/visualDesign';
import {
  addVisualComponent,
  duplicateVisualComponent,
  prepareVisualScreen,
  removeVisualComponent,
  renameVisualComponent,
  screenComponents,
  updateComponentConfig,
  updateVisualScreen,
  updateVisualStyle,
  type VisualComponentKind,
} from './visualProject';

type Props = {
  graph: Graph;
  screenId: string;
  onSelectScreen: (id: string) => void;
  onAddScreen: () => void;
  commit: (update: (graph: Graph) => Graph) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenSettings?: () => void;
};

type DragState = {
  id: string;
  mode: 'move' | 'resize';
  handle?: 'se' | 'e' | 's';
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const GOOGLE_ICONS = [
  'home',
  'search',
  'settings',
  'person',
  'notifications',
  'add',
  'favorite',
  'arrow_back',
  'menu',
  'close',
  'shopping_cart',
  'mail',
  'chat',
  'share',
  'delete',
  'edit',
  'star',
  'visibility',
  'download',
  'upload',
  'folder',
  'check',
  'refresh',
  'help',
  'info',
  'lock',
  'event',
  'dashboard',
  'thumb_up',
  'filter_list',
  'bookmark',
  'account_circle',
  'camera_alt',
  'schedule',
  'location_on',
  'explore',
  'more_vert',
  'chevron_right',
  'arrow_forward',
  'logout',
  'tune',
  'call',
];

const deviceIcons = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: LayoutDashboard,
};

export function FrontendEditor({
  graph,
  screenId,
  onSelectScreen,
  onAddScreen,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  onOpenSettings,
}: Props) {
  const [device, setDevice] = useState<Device>('mobile');
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [guide, setGuide] = useState<{ x?: number; y?: number }>({});
  const [magnetEnabled, setMagnetEnabled] = useState(true);
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const hasInitializedPan = useRef(false);
  const [iconFilter, setIconFilter] = useState('');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Estados dos menus laterais no padrão do Fluxo (recolhidos com ícones e flyout modal ao passar o mouse ou clicar)
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [activeLeftFlyout, setActiveLeftFlyout] = useState<
    'components' | 'icons' | 'models' | 'layers' | null
  >(null);
  const leftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftFlyoutRef = useRef<HTMLDivElement>(null);

  const [rightExpanded, setRightExpanded] = useState(false);
  const [activeRightFlyout, setActiveRightFlyout] = useState<
    'inspector' | 'appearance' | 'layout' | 'typography' | 'menu' | null
  >(null);
  const rightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightFlyoutRef = useRef<HTMLDivElement>(null);

  // Estados para adicionar estilos CSS e controlar propriedades opcionais ativas
  const [isAddStyleOpen, setIsAddStyleOpen] = useState(false);
  const addStyleMenuRef = useRef<HTMLDivElement>(null);
  const [addedPropsMap, setAddedPropsMap] = useState<Record<string, string[]>>({});

  function cancelLeftClose() {
    if (leftTimer.current) {
      clearTimeout(leftTimer.current);
      leftTimer.current = null;
    }
  }

  function openLeftFlyout(type: 'components' | 'icons' | 'models' | 'layers') {
    cancelLeftClose();
    setActiveLeftFlyout(type);
  }

  function closeLeftSoon() {
    cancelLeftClose();
    leftTimer.current = setTimeout(() => setActiveLeftFlyout(null), 220);
  }

  function toggleLeftFlyout(type: 'components' | 'icons' | 'models' | 'layers') {
    cancelLeftClose();
    setActiveLeftFlyout((curr) => (curr === type ? null : type));
  }

  function cancelRightClose() {
    if (rightTimer.current) {
      clearTimeout(rightTimer.current);
      rightTimer.current = null;
    }
  }

  function openRightFlyout(type: 'inspector' | 'appearance' | 'layout' | 'typography' | 'menu') {
    cancelRightClose();
    setActiveRightFlyout(type);
  }

  function closeRightSoon() {
    cancelRightClose();
    rightTimer.current = setTimeout(() => setActiveRightFlyout(null), 220);
  }

  function toggleRightFlyout(type: 'inspector' | 'appearance' | 'layout' | 'typography' | 'menu') {
    cancelRightClose();
    setActiveRightFlyout((curr) => (curr === type ? null : type));
  }

  // Fecha flyouts ao expandir
  useEffect(() => {
    if (leftExpanded) setActiveLeftFlyout(null);
  }, [leftExpanded]);

  useEffect(() => {
    if (rightExpanded) setActiveRightFlyout(null);
  }, [rightExpanded]);

  // Limpeza de timers
  useEffect(() => {
    return () => {
      cancelLeftClose();
      cancelRightClose();
    };
  }, []);

  // Teclas de atalho (Ctrl+Z / Ctrl+Y / ESC) e clique fora
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      if ((e.metaKey || e.ctrlKey) && isZ) {
        const target = e.target as HTMLElement | null;
        const isTextInput =
          target &&
          (target.tagName === 'TEXTAREA' ||
            (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text'));
        if (!isTextInput) {
          e.preventDefault();
          if (e.shiftKey) {
            redo?.();
          } else {
            undo?.();
          }
          return;
        }
      } else if ((e.metaKey || e.ctrlKey) && isY) {
        const target = e.target as HTMLElement | null;
        const isTextInput =
          target &&
          (target.tagName === 'TEXTAREA' ||
            (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text'));
        if (!isTextInput) {
          e.preventDefault();
          redo?.();
          return;
        }
      }

      if (e.key === 'Escape') {
        setIsAddStyleOpen(false);
        setActiveLeftFlyout(null);
        setActiveRightFlyout(null);
      }
    };
    const handleOutsideClick = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node;
      if (addStyleMenuRef.current && !addStyleMenuRef.current.contains(target)) {
        setIsAddStyleOpen(false);
      }
      if (
        leftFlyoutRef.current &&
        !leftFlyoutRef.current.contains(target) &&
        !(e.target as Element).closest?.('.frontend-rail')
      ) {
        setActiveLeftFlyout(null);
      }
      if (
        rightFlyoutRef.current &&
        !rightFlyoutRef.current.contains(target) &&
        !(e.target as Element).closest?.('.frontend-inspector-rail')
      ) {
        setActiveRightFlyout(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick as unknown as EventListener);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick as unknown as EventListener);
    };
  }, [undo, redo]);

  const screens = graph.nodes.filter((node) => node.data.kind === 'screen');
  const components = useMemo(() => screenComponents(graph, screenId), [graph, screenId]);
  const design = useMemo(() => prepareVisualScreen(graph, screenId), [graph, screenId]);

  const filteredIcons = useMemo(() => {
    const query = iconFilter.trim().toLowerCase();
    if (!query) return GOOGLE_ICONS;
    return GOOGLE_ICONS.filter((name) => name.toLowerCase().includes(query));
  }, [iconFilter]);

  const currentDevice: Device = design.enabled.includes(device)
    ? device
    : design.enabled[0] || 'mobile';
  const dimension = devices[currentDevice];

  const scale = zoom;

  const chosen = components.find((item) => item.id === selected);
  const selectedIndex = components.findIndex((item) => item.id === selected);
  const style = chosen
    ? visualStyle(design, chosen.id, currentDevice, selectedIndex, chosen.type)
    : undefined;

  // Workflows para vincular ações
  const availableWorkflows = useMemo(() => {
    return graph.nodes
      .filter(
        (n) =>
          n.data.kind === 'function' ||
          n.data.kind === 'api' ||
          n.data.kind === 'subflow' ||
          n.data.kind === 'navigate',
      )
      .map((n) => ({ id: n.id, label: n.data.label || n.id }));
  }, [graph]);

  function changeStyle(patch: Partial<VisualStyle>) {
    if (chosen) {
      commit((g) => updateVisualStyle(g, screenId, chosen.id, currentDevice, patch));
    }
  }

  function addComponent(
    type: VisualComponentKind,
    options?: { iconName?: string; label?: string },
  ) {
    if (!screenId) return;
    const result = addVisualComponent(graph, screenId, type, options);
    commit(() => result.graph);
    setSelected(result.id);
  }

  function handleSelectGoogleIcon(iconName: string) {
    if (!screenId) return;
    if (
      chosen &&
      (chosen.type === 'icon' || chosen.type === 'button' || chosen.type === 'dropdown')
    ) {
      commit((g) => updateComponentConfig(g, screenId, chosen.id, { iconName }));
    } else {
      addComponent('icon', { iconName });
    }
  }

  function deleteSelected() {
    if (chosen) {
      commit((g) => removeVisualComponent(g, screenId, chosen.id));
      setSelected(null);
    }
  }

  function duplicateSelected() {
    if (chosen) {
      const res = duplicateVisualComponent(graph, screenId, chosen.id);
      if (res) {
        commit(() => res.graph);
        setSelected(res.id);
      }
    }
  }

  function copyStyleToAllDevices() {
    if (!chosen || !style) return;
    commit((g) =>
      updateVisualScreen(g, screenId, (screen) => {
        const items = { ...screen.items };
        const itemStyles = { ...items[chosen.id] };
        for (const d of screen.enabled) {
          itemStyles[d] = { ...(itemStyles[d] || style), ...style };
        }
        items[chosen.id] = itemStyles;
        return { ...screen, items };
      }),
    );
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || !chosen || !style) return;

    const deltaX = (event.clientX - drag.startX) / scale;
    const deltaY = (event.clientY - drag.startY) / scale;

    if (drag.mode === 'move') {
      const rawX = drag.x + deltaX;
      const rawY = drag.y + deltaY;

      if (magnetEnabled) {
        const others = components
          .filter((item) => item.id !== chosen.id)
          .map((item) =>
            visualStyle(design, item.id, currentDevice, components.indexOf(item), item.type),
          );
        const snapped = snapVisualPosition(rawX, rawY, style.width, style.height, others, 10);
        setGuide({ x: snapped.guideX, y: snapped.guideY });
        setDrag((prev) =>
          prev
            ? { ...prev, x: snapped.x, y: snapped.y, startX: event.clientX, startY: event.clientY }
            : null,
        );
      } else {
        setGuide({});
        setDrag((prev) =>
          prev ? { ...prev, x: rawX, y: rawY, startX: event.clientX, startY: event.clientY } : null,
        );
      }
    } else if (drag.mode === 'resize') {
      let newW = style.width;
      let newH = style.height;

      if (drag.handle === 'se' || drag.handle === 'e') {
        newW = Math.max(30, Math.round((drag.width + deltaX) / 5) * 5);
      }
      if (drag.handle === 'se' || drag.handle === 's') {
        newH = Math.max(24, Math.round((drag.height + deltaY) / 5) * 5);
      }

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              width: newW,
              height: newH,
              startX: event.clientX,
              startY: event.clientY,
            }
          : null,
      );
    }
  }

  function handlePointerUp() {
    if (!drag || !chosen || !style) return;

    if (drag.mode === 'move') {
      if (drag.x !== style.x || drag.y !== style.y) {
        changeStyle({ x: drag.x, y: drag.y });
      }
    } else if (drag.mode === 'resize') {
      if (drag.width !== style.width || drag.height !== style.height) {
        changeStyle({ width: drag.width, height: drag.height });
      }
    }

    setDrag(null);
    setGuide({});
  }

  // Centraliza o frame do dispositivo no espaço visível da área de edição
  const fitView = useCallback(() => {
    if (!workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const availableWidth = rect.width - 80;
    const availableHeight = rect.height - 80;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const targetZoom = Math.min(
      1.15,
      Math.max(
        0.25,
        Math.min(availableWidth / dimension.width, availableHeight / dimension.height),
      ),
    );

    const roundedZoom = Number(targetZoom.toFixed(2));
    const targetPanX = Math.round((rect.width - dimension.width * roundedZoom) / 2);
    const targetPanY = Math.max(24, Math.round((rect.height - dimension.height * roundedZoom) / 2));

    setZoom(roundedZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [dimension.width, dimension.height]);

  // Redimensionamento e carregamento inicial centralizado
  useEffect(() => {
    if (!workspaceRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        if (!hasInitializedPan.current) {
          fitView();
          hasInitializedPan.current = true;
        }
      }
    });
    ro.observe(workspaceRef.current);
    return () => ro.disconnect();
  }, [fitView]);

  // Recentraliza ao trocar o dispositivo ativo
  useEffect(() => {
    fitView();
  }, [currentDevice, fitView]);

  const zoomIn = () => {
    setZoom((curr) => {
      const next = Math.min(2.5, Number((curr + 0.1).toFixed(2)));
      if (workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setPan((prevPan) => {
          const wx = (cx - prevPan.x) / curr;
          const wy = (cy - prevPan.y) / curr;
          return {
            x: Math.round(cx - wx * next),
            y: Math.round(cy - wy * next),
          };
        });
      }
      return next;
    });
  };

  const zoomOut = () => {
    setZoom((curr) => {
      const next = Math.max(0.2, Number((curr - 0.1).toFixed(2)));
      if (workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setPan((prevPan) => {
          const wx = (cx - prevPan.x) / curr;
          const wy = (cy - prevPan.y) / curr;
          return {
            x: Math.round(cx - wx * next),
            y: Math.round(cy - wy * next),
          };
        });
      }
      return next;
    });
  };

  const setZoom100 = () => {
    const next = 1;
    if (workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setPan((prevPan) => {
        const wx = (cx - prevPan.x) / zoom;
        const wy = (cy - prevPan.y) / zoom;
        return {
          x: Math.round(cx - wx * next),
          y: Math.round(cy - wy * next),
        };
      });
    }
    setZoom(1);
  };

  // Zoom infinito pela roda do mouse ou trackpad (com zoom centrado na posição exata do cursor)
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      let zoomDelta = 0;
      if (e.ctrlKey || e.metaKey) {
        zoomDelta = -e.deltaY * 0.01;
      } else {
        zoomDelta = -e.deltaY * 0.0015;
      }

      setZoom((prevZoom) => {
        const factor = Math.exp(zoomDelta);
        const newZoom = Math.min(2.5, Math.max(0.2, Number((prevZoom * factor).toFixed(3))));
        if (newZoom === prevZoom) return prevZoom;

        setPan((prevPan) => {
          const worldX = (cursorX - prevPan.x) / prevZoom;
          const worldY = (cursorY - prevPan.y) / prevZoom;
          return {
            x: Math.round(cursorX - worldX * newZoom),
            y: Math.round(cursorY - worldY * newZoom),
          };
        });

        return newZoom;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Navegação Pan ao arrastar o fundo do canvas (igual no FlowCanvas)
  const handleWorkspacePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;

    if (
      target.closest('.frontend-floating-controls') ||
      target.closest('.frontend-resize-handle') ||
      target.closest('.frontend-item') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.frontend-flyout-panel')
    ) {
      return;
    }

    setSelected(null);
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  };

  const handleWorkspacePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    handlePointerMove(e);
  };

  const handleWorkspacePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    }
    handlePointerUp();
  };

  const elementText =
    chosen?.type === 'button' ||
    chosen?.type === 'input' ||
    chosen?.type === 'dropdown' ||
    chosen?.type === 'hamburger'
      ? chosen.label
      : chosen?.type === 'text' && typeof chosen.content === 'string'
        ? chosen.content
        : '';

  const renderUiComponents = () => (
    <div className="frontend-component-grid">
      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('button');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <MousePointerClick size={16} />
        </span>
        <span>Botão Padrão</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('submit');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <Send size={16} />
        </span>
        <span>Botão Submit</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('input');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <FormInput size={16} />
        </span>
        <span>Campo de Texto</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('textarea');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <AlignLeft size={16} />
        </span>
        <span>Área de Texto</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('heading');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <Heading size={16} />
        </span>
        <span>Título / Heading</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('text');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <Type size={16} />
        </span>
        <span>Texto Descritivo</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('card');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <Box size={16} />
        </span>
        <span>Card / Caixa</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('switch');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <ToggleLeft size={16} />
        </span>
        <span>Interruptor</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('table');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <TableIcon size={16} />
        </span>
        <span>Tabela de Dados</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('dropdown');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <ChevronDown size={16} />
        </span>
        <span>Botão Dropdown</span>
      </button>

      <button
        type="button"
        className="frontend-component-btn"
        disabled={!screenId}
        onClick={() => {
          addComponent('hamburger');
          setActiveLeftFlyout(null);
        }}
      >
        <span className="icon-badge">
          <Menu size={16} />
        </span>
        <span>Menu Hambúrguer</span>
      </button>
    </div>
  );

  const renderGoogleIcons = () => (
    <>
      <div className="frontend-icon-search">
        <Search size={14} />
        <input
          placeholder="Pesquisar ícones..."
          value={iconFilter}
          onChange={(e) => setIconFilter(e.target.value)}
        />
        {iconFilter && (
          <button
            type="button"
            className="clear-btn"
            title="Limpar busca"
            onClick={() => setIconFilter('')}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="frontend-icon-grid">
        {filteredIcons.map((name) => {
          const isCurrentIcon =
            chosen &&
            (('iconName' in chosen && chosen.iconName === name) ||
              (chosen.type === 'icon' && 'label' in chosen && chosen.label === name));
          return (
            <button
              key={name}
              type="button"
              className={`frontend-icon-btn ${isCurrentIcon ? 'active' : ''}`}
              title={name}
              disabled={!screenId}
              onClick={() => {
                handleSelectGoogleIcon(name);
                setActiveLeftFlyout(null);
              }}
            >
              <span className="material-symbols-outlined">{name}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderReadyModels = () => (
    <div className="frontend-model-list">
      <button
        type="button"
        className="frontend-model-card"
        disabled={!screenId}
        onClick={() => {
          addComponent('header_app');
          setActiveLeftFlyout(null);
        }}
      >
        <div className="frontend-model-badge">
          <span className="material-symbols-outlined">web_asset</span>
        </div>
        <div className="frontend-model-info">
          <strong>Header do Aplicativo</strong>
          <span>Barra superior com voltar, título e menu</span>
        </div>
      </button>

      <button
        type="button"
        className="frontend-model-card"
        disabled={!screenId}
        onClick={() => {
          addComponent('footer_instagram');
          setActiveLeftFlyout(null);
        }}
      >
        <div className="frontend-model-badge">
          <span className="material-symbols-outlined">bottom_navigation</span>
        </div>
        <div className="frontend-model-info">
          <strong>Footer Mobile (Instagram)</strong>
          <span>5 abas acessíveis no rodapé do dispositivo</span>
        </div>
      </button>

      <button
        type="button"
        className="frontend-model-card"
        disabled={!screenId}
        onClick={() => {
          addComponent('fab');
          setActiveLeftFlyout(null);
        }}
      >
        <div className="frontend-model-badge">
          <span className="material-symbols-outlined">add_circle</span>
        </div>
        <div className="frontend-model-info">
          <strong>Botão Flutuante (FAB +)</strong>
          <span>Botão circular com sombra elevada</span>
        </div>
      </button>

      <button
        type="button"
        className="frontend-model-card"
        disabled={!screenId}
        onClick={() => {
          addComponent('fab_extended');
          setActiveLeftFlyout(null);
        }}
      >
        <div className="frontend-model-badge">
          <span className="material-symbols-outlined">smart_button</span>
        </div>
        <div className="frontend-model-info">
          <strong>FAB Estendido (com texto)</strong>
          <span>Botão flutuante em pílula com ícone + ação</span>
        </div>
      </button>
    </div>
  );

  const renderLayers = () => (
    <div className="frontend-layers">
      {components.length === 0 ? (
        <p className="frontend-hint" style={{ textAlign: 'center', padding: '12px 0' }}>
          Nenhum elemento nesta tela ainda.
        </p>
      ) : (
        components.map((comp) => {
          const isSel = selected === comp.id;
          const label =
            'label' in comp && typeof comp.label === 'string'
              ? comp.label
              : 'content' in comp && typeof comp.content === 'string'
                ? comp.content
                : comp.type;
          return (
            <button
              type="button"
              key={comp.id}
              className={`frontend-layer-item ${isSel ? 'active' : ''}`}
              onClick={() => {
                setSelected(comp.id);
                setActiveLeftFlyout(null);
              }}
            >
              <Layers size={13} />
              <span>{label}</span>
              <button
                type="button"
                className="delete-btn"
                title="Excluir elemento"
                onClick={(e) => {
                  e.stopPropagation();
                  commit((g) => removeVisualComponent(g, screenId, comp.id));
                  if (selected === comp.id) setSelected(null);
                }}
              >
                <Trash2 size={13} />
              </button>
            </button>
          );
        })
      )}
    </div>
  );

  const userAddedProps = useMemo(() => {
    return new Set(chosen ? addedPropsMap[chosen.id] || [] : []);
  }, [chosen, addedPropsMap]);

  const disabledProps = useMemo(() => {
    return new Set(style?.disabledProps || []);
  }, [style?.disabledProps]);

  function isPropActive(propKey: string): boolean {
    if (!style) return false;
    if (disabledProps.has(propKey)) return false;

    switch (propKey) {
      case 'position':
      case 'left':
      case 'top':
      case 'width':
      case 'height':
      case 'content':
      case 'fontSize':
      case 'fontWeight':
      case 'textAlign':
      case 'background':
      case 'color':
      case 'borderWidth':
      case 'borderStyle':
      case 'borderColor':
      case 'borderRadius':
        return true;
      case 'display':
        return Boolean(style.flex);
      case 'flexDirection':
        return Boolean(style.flex);
      case 'justifyContent':
        return Boolean(style.flex);
      case 'alignItems':
        return Boolean(style.flex);
      case 'gap':
        return (
          Boolean(style.flex) ||
          (style.gap !== undefined && style.gap > 0) ||
          userAddedProps.has('gap')
        );
      case 'padding':
        return (style.padding !== undefined && style.padding > 0) || userAddedProps.has('padding');
      case 'margin':
        return (style.margin !== undefined && style.margin > 0) || userAddedProps.has('margin');
      case 'opacity':
        return (
          (style.opacity !== undefined && style.opacity < 100) || userAddedProps.has('opacity')
        );
      case 'boxShadow':
        return Boolean(style.shadow) || userAddedProps.has('boxShadow');
      case 'lineHeight':
        return Boolean(style.lineHeight) || userAddedProps.has('lineHeight');
      case 'zIndex':
        return style.zIndex !== undefined || userAddedProps.has('zIndex');
      case 'icon':
        return (
          Boolean(chosen && 'iconName' in chosen && chosen.iconName) || userAddedProps.has('icon')
        );
      case 'action':
        return (
          Boolean(chosen && 'actionEvent' in chosen && chosen.actionEvent) ||
          userAddedProps.has('action')
        );
      case 'placeholder':
        return (
          Boolean(chosen && 'placeholder' in chosen && chosen.placeholder) ||
          userAddedProps.has('placeholder')
        );
      default:
        return false;
    }
  }

  function addProp(propKey: string) {
    if (!chosen || !style) return;

    const nextDisabled = (style.disabledProps || []).filter((k) => k !== propKey);

    switch (propKey) {
      case 'position':
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'left':
        changeStyle({ x: style.x ?? 0, disabledProps: nextDisabled });
        break;
      case 'top':
        changeStyle({ y: style.y ?? 0, disabledProps: nextDisabled });
        break;
      case 'width':
        changeStyle({ width: style.width || 120, disabledProps: nextDisabled });
        break;
      case 'height':
        changeStyle({ height: style.height || 44, disabledProps: nextDisabled });
        break;
      case 'content':
        commit((g) => renameVisualComponent(g, screenId, chosen.id, 'Texto'));
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'fontSize':
        changeStyle({ fontSize: style.fontSize || 15, disabledProps: nextDisabled });
        break;
      case 'fontWeight':
        changeStyle({ fontWeight: style.fontWeight || 500, disabledProps: nextDisabled });
        break;
      case 'textAlign':
        changeStyle({ textAlign: style.textAlign || 'left', disabledProps: nextDisabled });
        break;
      case 'background':
        changeStyle({ background: style.background || '#7c3aed', disabledProps: nextDisabled });
        break;
      case 'color':
        changeStyle({ color: style.color || '#ffffff', disabledProps: nextDisabled });
        break;
      case 'borderWidth':
        changeStyle({ borderWidth: style.borderWidth || 1, disabledProps: nextDisabled });
        break;
      case 'borderStyle':
        changeStyle({ borderStyle: style.borderStyle || 'solid', disabledProps: nextDisabled });
        break;
      case 'borderColor':
        changeStyle({ borderColor: style.borderColor || '#7c3aed', disabledProps: nextDisabled });
        break;
      case 'borderRadius':
        changeStyle({ radius: style.radius ?? 8, disabledProps: nextDisabled });
        break;
      case 'display':
        changeStyle({
          flex: true,
          flexDirection: 'row',
          justify: 'center',
          align: 'center',
          gap: 8,
          disabledProps: nextDisabled,
        });
        break;
      case 'flexDirection':
        changeStyle({ flex: true, flexDirection: 'row', disabledProps: nextDisabled });
        break;
      case 'justifyContent':
        changeStyle({ flex: true, justify: 'center', disabledProps: nextDisabled });
        break;
      case 'alignItems':
        changeStyle({ flex: true, align: 'center', disabledProps: nextDisabled });
        break;
      case 'gap':
        changeStyle({ flex: true, gap: 8, disabledProps: nextDisabled });
        break;
      case 'padding':
        changeStyle({ padding: 12, disabledProps: nextDisabled });
        break;
      case 'margin':
        changeStyle({ margin: 8, disabledProps: nextDisabled });
        break;
      case 'opacity':
        changeStyle({ opacity: 90, disabledProps: nextDisabled });
        break;
      case 'boxShadow':
        changeStyle({
          shadow: true,
          shadowBlur: 14,
          shadowY: 4,
          shadowColor: 'rgba(0,0,0,0.2)',
          disabledProps: nextDisabled,
        });
        break;
      case 'lineHeight':
        changeStyle({ lineHeight: 24, disabledProps: nextDisabled });
        break;
      case 'zIndex':
        changeStyle({ zIndex: 3, disabledProps: nextDisabled });
        break;
      case 'icon':
        commit((g) => updateComponentConfig(g, screenId, chosen.id, { iconName: 'star' }));
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'action':
        commit((g) =>
          updateComponentConfig(g, screenId, chosen.id, {
            actionEvent: availableWorkflows[0]?.id || chosen.id,
          }),
        );
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'placeholder':
        commit((g) =>
          updateComponentConfig(g, screenId, chosen.id, {
            placeholder: 'Digite aqui...',
          }),
        );
        changeStyle({ disabledProps: nextDisabled });
        break;
    }
    setAddedPropsMap((prev) => ({
      ...prev,
      [chosen.id]: Array.from(new Set([...(prev[chosen.id] || []), propKey])),
    }));
    setIsAddStyleOpen(false);
  }

  function removeProp(propKey: string) {
    if (!chosen || !style) return;

    const currentDisabled = style.disabledProps || [];
    const nextDisabled = Array.from(new Set([...currentDisabled, propKey]));

    switch (propKey) {
      case 'display':
        changeStyle({ flex: false, disabledProps: nextDisabled });
        break;
      case 'boxShadow':
        changeStyle({ shadow: false, disabledProps: nextDisabled });
        break;
      case 'padding':
        changeStyle({
          padding: 0,
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
          disabledProps: nextDisabled,
        });
        break;
      case 'margin':
        changeStyle({ margin: 0, disabledProps: nextDisabled });
        break;
      case 'opacity':
        changeStyle({ opacity: 100, disabledProps: nextDisabled });
        break;
      case 'gap':
        changeStyle({ gap: 0, disabledProps: nextDisabled });
        break;
      case 'lineHeight':
        changeStyle({ lineHeight: undefined, disabledProps: nextDisabled });
        break;
      case 'zIndex':
        changeStyle({ zIndex: undefined, disabledProps: nextDisabled });
        break;
      case 'icon':
        commit((g) => updateComponentConfig(g, screenId, chosen.id, { iconName: undefined }));
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'action':
        commit((g) => updateComponentConfig(g, screenId, chosen.id, { actionEvent: undefined }));
        changeStyle({ disabledProps: nextDisabled });
        break;
      case 'placeholder':
        commit((g) => updateComponentConfig(g, screenId, chosen.id, { placeholder: undefined }));
        changeStyle({ disabledProps: nextDisabled });
        break;
      default:
        changeStyle({ disabledProps: nextDisabled });
        break;
    }
    setAddedPropsMap((prev) => ({
      ...prev,
      [chosen.id]: (prev[chosen.id] || []).filter((k) => k !== propKey),
    }));
  }

  const renderSelectionHeader = () => {
    if (!chosen) return null;
    return (
      <div className="frontend-selection-card">
        <div className="frontend-selection-row">
          <div className="frontend-selection-type">
            <div className="frontend-selection-badge">
              {chosen.type === 'button' ? (
                <MousePointerClick size={15} />
              ) : chosen.type === 'input' ? (
                <FormInput size={15} />
              ) : chosen.type === 'dropdown' || chosen.type === 'hamburger' ? (
                <Menu size={15} />
              ) : chosen.type === 'icon' ? (
                <Sparkles size={15} />
              ) : chosen.type === 'container' ? (
                <Box size={15} />
              ) : (
                <Type size={15} />
              )}
            </div>
            <div className="frontend-selection-meta">
              <strong>
                {chosen.type === 'button'
                  ? 'Botão'
                  : chosen.type === 'dropdown'
                    ? 'Botão Dropdown'
                    : chosen.type === 'hamburger'
                      ? 'Menu Hambúrguer'
                      : chosen.type === 'icon'
                        ? 'Ícone Google'
                        : chosen.type === 'container' &&
                            'variant' in chosen &&
                            chosen.variant === 'header'
                          ? 'Header do App'
                          : chosen.type === 'container' &&
                              'variant' in chosen &&
                              chosen.variant === 'footer'
                            ? 'Footer Mobile'
                            : chosen.type === 'input'
                              ? 'Campo'
                              : chosen.type}
              </strong>
              <div className="frontend-selection-tags">
                <code className="prop-id-badge">#{chosen.id}</code>
                <span className="prop-device-badge">
                  <Smartphone size={10} /> {dimension.label}
                </span>
              </div>
            </div>
          </div>
          <div className="frontend-selection-actions">
            <button type="button" title="Duplicar elemento" onClick={duplicateSelected}>
              <Copy size={13} />
            </button>
            <button
              type="button"
              className="danger"
              title="Excluir elemento"
              onClick={deleteSelected}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCssCodeBlock = (categoryFilter?: 'layout' | 'typography' | 'appearance') => {
    if (!chosen || !style) return null;

    const showLayout = !categoryFilter || categoryFilter === 'layout';
    const showTypography = !categoryFilter || categoryFilter === 'typography';
    const showAppearance = !categoryFilter || categoryFilter === 'appearance';

    return (
      <div className="css-code-editor-block">
        <div className="css-selector-header">
          <span>
            .{chosen.id} {'{'}
          </span>
          <span className="css-scope-badge">{dimension.label}</span>
        </div>

        {/* 1. LAYOUT / GEOMETRIA PADRÃO */}
        {showLayout && (
          <>
            {isPropActive('position') && (
              <div className="css-prop-row">
                <span className="css-prop-name">position</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <span className="css-keyword">absolute</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover position"
                  onClick={() => removeProp('position')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('left') && (
              <div className="css-prop-row">
                <span className="css-prop-name">left</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.x ?? 0)}
                    onChange={(e) => changeStyle({ x: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover left"
                  onClick={() => removeProp('left')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('top') && (
              <div className="css-prop-row">
                <span className="css-prop-name">top</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.y ?? 0)}
                    onChange={(e) => changeStyle({ y: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover top"
                  onClick={() => removeProp('top')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('width') && (
              <div className="css-prop-row">
                <span className="css-prop-name">width</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={10}
                    className="css-input-number"
                    value={Number(style.width ?? 0)}
                    onChange={(e) => changeStyle({ width: Math.max(10, Number(e.target.value)) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover width"
                  onClick={() => removeProp('width')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('height') && (
              <div className="css-prop-row">
                <span className="css-prop-name">height</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={10}
                    className="css-input-number"
                    value={Number(style.height ?? 0)}
                    onChange={(e) => changeStyle({ height: Math.max(10, Number(e.target.value)) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover height"
                  onClick={() => removeProp('height')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Opcionais de Layout */}
            {isPropActive('display') && (
              <div className="css-prop-row">
                <span className="css-prop-name">display</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <span className="css-keyword">flex</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover display: flex"
                  onClick={() => removeProp('display')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {style.flex && (
              <>
                {isPropActive('flexDirection') && (
                  <div className="css-prop-row">
                    <span className="css-prop-name">flex-direction</span>
                    <span className="css-colon">:</span>
                    <div className="css-prop-val-wrap">
                      <select
                        className="css-select-val"
                        value={style.flexDirection || 'row'}
                        onChange={(e) =>
                          changeStyle({ flexDirection: e.target.value as 'row' | 'column' })
                        }
                      >
                        <option value="row">row</option>
                        <option value="column">column</option>
                      </select>
                    </div>
                    <span className="css-semicolon">;</span>
                    <button
                      type="button"
                      className="css-del-prop-btn"
                      title="Remover flex-direction"
                      onClick={() => removeProp('flexDirection')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {isPropActive('justifyContent') && (
                  <div className="css-prop-row">
                    <span className="css-prop-name">justify-content</span>
                    <span className="css-colon">:</span>
                    <div className="css-prop-val-wrap">
                      <select
                        className="css-select-val"
                        value={style.justify || 'center'}
                        onChange={(e) =>
                          changeStyle({ justify: e.target.value as VisualStyle['justify'] })
                        }
                      >
                        <option value="center">center</option>
                        <option value="start">flex-start</option>
                        <option value="end">flex-end</option>
                        <option value="between">space-between</option>
                        <option value="around">space-around</option>
                      </select>
                    </div>
                    <span className="css-semicolon">;</span>
                    <button
                      type="button"
                      className="css-del-prop-btn"
                      title="Remover justify-content"
                      onClick={() => removeProp('justifyContent')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {isPropActive('alignItems') && (
                  <div className="css-prop-row">
                    <span className="css-prop-name">align-items</span>
                    <span className="css-colon">:</span>
                    <div className="css-prop-val-wrap">
                      <select
                        className="css-select-val"
                        value={style.align || 'center'}
                        onChange={(e) =>
                          changeStyle({ align: e.target.value as VisualStyle['align'] })
                        }
                      >
                        <option value="center">center</option>
                        <option value="start">flex-start</option>
                        <option value="end">flex-end</option>
                        <option value="stretch">stretch</option>
                      </select>
                    </div>
                    <span className="css-semicolon">;</span>
                    <button
                      type="button"
                      className="css-del-prop-btn"
                      title="Remover align-items"
                      onClick={() => removeProp('alignItems')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {isPropActive('gap') && (
                  <div className="css-prop-row">
                    <span className="css-prop-name">gap</span>
                    <span className="css-colon">:</span>
                    <div className="css-prop-val-wrap">
                      <input
                        type="number"
                        className="css-input-number"
                        value={Number(style.gap ?? 8)}
                        onChange={(e) => changeStyle({ gap: Number(e.target.value) })}
                      />
                      <span className="css-unit">px</span>
                    </div>
                    <span className="css-semicolon">;</span>
                    <button
                      type="button"
                      className="css-del-prop-btn"
                      title="Remover gap"
                      onClick={() => removeProp('gap')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </>
            )}

            {isPropActive('padding') && (
              <div className="css-prop-row">
                <span className="css-prop-name">padding</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.padding ?? 0)}
                    onChange={(e) => changeStyle({ padding: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover padding"
                  onClick={() => removeProp('padding')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('margin') && (
              <div className="css-prop-row">
                <span className="css-prop-name">margin</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.margin ?? 0)}
                    onChange={(e) => changeStyle({ margin: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover margin"
                  onClick={() => removeProp('margin')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('zIndex') && (
              <div className="css-prop-row">
                <span className="css-prop-name">z-index</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.zIndex ?? 1)}
                    onChange={(e) => changeStyle({ zIndex: Number(e.target.value) })}
                  />
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover z-index"
                  onClick={() => removeProp('zIndex')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </>
        )}

        {/* 2. TIPOGRAFIA & TEXTO */}
        {showTypography && (
          <>
            {isPropActive('content') &&
              !(
                chosen.type === 'container' &&
                'variant' in chosen &&
                chosen.variant === 'footer'
              ) && (
                <div className="css-prop-row">
                  <span className="css-prop-name">content</span>
                  <span className="css-colon">:</span>
                  <div className="css-prop-val-wrap">
                    <span className="css-quote">"</span>
                    <input
                      type="text"
                      className="css-input-text content-val"
                      value={
                        chosen.type === 'container' && 'title' in chosen && chosen.title
                          ? String(chosen.title)
                          : elementText
                      }
                      placeholder="Texto do elemento..."
                      onChange={(e) => {
                        commit((g) =>
                          renameVisualComponent(g, screenId, chosen.id, e.target.value),
                        );
                      }}
                    />
                    <span className="css-quote">"</span>
                  </div>
                  <span className="css-semicolon">;</span>
                  <button
                    type="button"
                    className="css-del-prop-btn"
                    title="Remover content"
                    onClick={() => removeProp('content')}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

            {isPropActive('fontSize') && (
              <div className="css-prop-row">
                <span className="css-prop-name">font-size</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={8}
                    max={120}
                    className="css-input-number"
                    value={Number(style.fontSize ?? 15)}
                    onChange={(e) => changeStyle({ fontSize: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover font-size"
                  onClick={() => removeProp('fontSize')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('fontWeight') && (
              <div className="css-prop-row">
                <span className="css-prop-name">font-weight</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <select
                    className="css-select-val"
                    value={style.fontWeight || 400}
                    onChange={(e) => changeStyle({ fontWeight: Number(e.target.value) })}
                  >
                    <option value={400}>400 (normal)</option>
                    <option value={500}>500 (medium)</option>
                    <option value={600}>600 (semibold)</option>
                    <option value={700}>700 (bold)</option>
                    <option value={800}>800 (extrabold)</option>
                  </select>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover font-weight"
                  onClick={() => removeProp('fontWeight')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('textAlign') && (
              <div className="css-prop-row">
                <span className="css-prop-name">text-align</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <select
                    className="css-select-val"
                    value={style.textAlign || 'left'}
                    onChange={(e) =>
                      changeStyle({ textAlign: e.target.value as VisualStyle['textAlign'] })
                    }
                  >
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                  </select>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover text-align"
                  onClick={() => removeProp('textAlign')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('lineHeight') && (
              <div className="css-prop-row">
                <span className="css-prop-name">line-height</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    className="css-input-number"
                    value={Number(style.lineHeight ?? 24)}
                    onChange={(e) => changeStyle({ lineHeight: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover line-height"
                  onClick={() => removeProp('lineHeight')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('placeholder') && (
              <div className="css-prop-row">
                <span className="css-prop-name">placeholder</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <span className="css-quote">"</span>
                  <input
                    type="text"
                    className="css-input-text content-val"
                    value={'placeholder' in chosen ? String(chosen.placeholder || '') : ''}
                    placeholder="Dica do campo..."
                    onChange={(e) => {
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, {
                          placeholder: e.target.value,
                        }),
                      );
                    }}
                  />
                  <span className="css-quote">"</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover placeholder"
                  onClick={() => removeProp('placeholder')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </>
        )}

        {/* 3. CORES, BORDAS & EFEITOS */}
        {showAppearance && (
          <>
            {isPropActive('background') && (
              <div className="css-prop-row">
                <span className="css-prop-name">background</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <div className="css-color-val">
                    <label className="css-color-swatch-label" title="Escolher cor de fundo">
                      <span
                        className="css-color-swatch"
                        style={{ backgroundColor: style.background || '#7c3aed' }}
                      />
                      <input
                        type="color"
                        className="css-color-native"
                        value={style.background || '#7c3aed'}
                        onChange={(e) => changeStyle({ background: e.target.value })}
                      />
                    </label>
                    <input
                      type="text"
                      className="css-color-hex-input"
                      value={style.background || '#7c3aed'}
                      onChange={(e) => changeStyle({ background: e.target.value })}
                    />
                  </div>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover background"
                  onClick={() => removeProp('background')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('color') && (
              <div className="css-prop-row">
                <span className="css-prop-name">color</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <div className="css-color-val">
                    <label className="css-color-swatch-label" title="Escolher cor do texto">
                      <span
                        className="css-color-swatch"
                        style={{ backgroundColor: style.color || '#ffffff' }}
                      />
                      <input
                        type="color"
                        className="css-color-native"
                        value={style.color || '#ffffff'}
                        onChange={(e) => changeStyle({ color: e.target.value })}
                      />
                    </label>
                    <input
                      type="text"
                      className="css-color-hex-input"
                      value={style.color || '#ffffff'}
                      onChange={(e) => changeStyle({ color: e.target.value })}
                    />
                  </div>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover color"
                  onClick={() => removeProp('color')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('borderWidth') && (
              <div className="css-prop-row">
                <span className="css-prop-name">border-width</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={0}
                    className="css-input-number"
                    value={Number(style.borderWidth ?? 1)}
                    onChange={(e) => changeStyle({ borderWidth: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover border-width"
                  onClick={() => removeProp('borderWidth')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('borderStyle') && (
              <div className="css-prop-row">
                <span className="css-prop-name">border-style</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <select
                    className="css-select-val"
                    value={style.borderStyle || 'solid'}
                    onChange={(e) =>
                      changeStyle({ borderStyle: e.target.value as VisualStyle['borderStyle'] })
                    }
                  >
                    <option value="solid">solid</option>
                    <option value="dashed">dashed</option>
                    <option value="dotted">dotted</option>
                    <option value="none">none</option>
                  </select>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover border-style"
                  onClick={() => removeProp('borderStyle')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('borderColor') && (
              <div className="css-prop-row">
                <span className="css-prop-name">border-color</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <div className="css-color-val">
                    <label className="css-color-swatch-label" title="Escolher cor da borda">
                      <span
                        className="css-color-swatch"
                        style={{ backgroundColor: style.borderColor || '#7c3aed' }}
                      />
                      <input
                        type="color"
                        className="css-color-native"
                        value={style.borderColor || '#7c3aed'}
                        onChange={(e) => changeStyle({ borderColor: e.target.value })}
                      />
                    </label>
                    <input
                      type="text"
                      className="css-color-hex-input"
                      value={style.borderColor || '#7c3aed'}
                      onChange={(e) => changeStyle({ borderColor: e.target.value })}
                    />
                  </div>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover border-color"
                  onClick={() => removeProp('borderColor')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('borderRadius') && (
              <div className="css-prop-row">
                <span className="css-prop-name">border-radius</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={0}
                    className="css-input-number"
                    value={Number(style.radius ?? 8)}
                    onChange={(e) => changeStyle({ radius: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover border-radius"
                  onClick={() => removeProp('borderRadius')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Opcionais de Aparência */}
            {isPropActive('opacity') && (
              <div className="css-prop-row">
                <span className="css-prop-name">opacity</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="css-input-number"
                    value={Number(style.opacity ?? 100)}
                    onChange={(e) => changeStyle({ opacity: Number(e.target.value) })}
                  />
                  <span className="css-unit">%</span>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover opacity"
                  onClick={() => removeProp('opacity')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('boxShadow') && (
              <div className="css-prop-row">
                <span className="css-prop-name">box-shadow</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <span className="css-unit">0</span>
                  <input
                    type="number"
                    className="css-input-number micro"
                    title="Deslocamento Y"
                    value={Number(style.shadowY ?? 4)}
                    onChange={(e) => changeStyle({ shadowY: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                  <input
                    type="number"
                    className="css-input-number micro"
                    title="Desfoque (Blur)"
                    value={Number(style.shadowBlur ?? 14)}
                    onChange={(e) => changeStyle({ shadowBlur: Number(e.target.value) })}
                  />
                  <span className="css-unit">px</span>
                  <label className="css-color-swatch-label" title="Cor da sombra">
                    <span
                      className="css-color-swatch"
                      style={{ backgroundColor: style.shadowColor || 'rgba(0,0,0,0.2)' }}
                    />
                    <input
                      type="color"
                      className="css-color-native"
                      value={style.shadowColor?.startsWith('#') ? style.shadowColor : '#000000'}
                      onChange={(e) => changeStyle({ shadowColor: e.target.value })}
                    />
                  </label>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover box-shadow"
                  onClick={() => removeProp('boxShadow')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('icon') && (
              <div className="css-prop-row">
                <span className="css-prop-name">icon</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <span className="material-symbols-outlined css-icon-preview">
                    {'iconName' in chosen && chosen.iconName ? String(chosen.iconName) : 'star'}
                  </span>
                  <input
                    type="text"
                    className="css-input-text"
                    placeholder="home, check, search..."
                    value={'iconName' in chosen && chosen.iconName ? String(chosen.iconName) : ''}
                    onChange={(e) => {
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, {
                          iconName: e.target.value.trim().toLowerCase(),
                        }),
                      );
                    }}
                  />
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover ícone"
                  onClick={() => removeProp('icon')}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isPropActive('action') && (
              <div className="css-prop-row">
                <span className="css-prop-name">action</span>
                <span className="css-colon">:</span>
                <div className="css-prop-val-wrap">
                  <select
                    className="css-select-val"
                    value={('actionEvent' in chosen && chosen.actionEvent) || chosen.id}
                    onChange={(e) => {
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, {
                          actionEvent: e.target.value,
                        }),
                      );
                    }}
                  >
                    <option value={chosen.id}>default({chosen.id})</option>
                    {availableWorkflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>
                        {wf.label} (#{wf.id})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="css-semicolon">;</span>
                <button
                  type="button"
                  className="css-del-prop-btn"
                  title="Remover ação"
                  onClick={() => removeProp('action')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </>
        )}

        {/* 4. BOTÃO ADICIONAR ESTILO COM MENU CATEGORIZADO */}
        <div className="css-add-style-container" ref={addStyleMenuRef}>
          <button
            type="button"
            className="css-add-style-btn"
            onClick={() => setIsAddStyleOpen((v) => !v)}
          >
            <Plus size={13} />
            <span>Adicionar Estilo</span>
            <ChevronDown size={13} />
          </button>

          {isAddStyleOpen && (
            <div className="css-add-style-dropdown">
              <div className="css-add-style-header">
                <span>Propriedades CSS Disponíveis</span>
                <button
                  type="button"
                  className="css-close-dropdown-btn"
                  onClick={() => setIsAddStyleOpen(false)}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="css-add-style-category">
                <span className="cat-title">📐 Layout & Flexbox</span>
                {!isPropActive('position') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('position')}
                  >
                    <code>position: absolute</code>
                    <span>Posicionamento absoluto</span>
                  </button>
                )}
                {!isPropActive('left') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('left')}
                  >
                    <code>left: {style.x ?? 0}px</code>
                    <span>Posição horizontal (eixo X)</span>
                  </button>
                )}
                {!isPropActive('top') && (
                  <button type="button" className="css-style-option" onClick={() => addProp('top')}>
                    <code>top: {style.y ?? 0}px</code>
                    <span>Posição vertical (eixo Y)</span>
                  </button>
                )}
                {!isPropActive('width') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('width')}
                  >
                    <code>width: {style.width ?? 120}px</code>
                    <span>Largura do elemento</span>
                  </button>
                )}
                {!isPropActive('height') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('height')}
                  >
                    <code>height: {style.height ?? 44}px</code>
                    <span>Altura do elemento</span>
                  </button>
                )}
                {!isPropActive('display') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('display')}
                  >
                    <code>display: flex</code>
                    <span>Ativar flexbox no elemento</span>
                  </button>
                )}
                {style.flex && !isPropActive('flexDirection') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('flexDirection')}
                  >
                    <code>flex-direction</code>
                    <span>Direção dos itens (row | column)</span>
                  </button>
                )}
                {style.flex && !isPropActive('justifyContent') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('justifyContent')}
                  >
                    <code>justify-content</code>
                    <span>Alinhamento horizontal (main axis)</span>
                  </button>
                )}
                {style.flex && !isPropActive('alignItems') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('alignItems')}
                  >
                    <code>align-items</code>
                    <span>Alinhamento vertical (cross axis)</span>
                  </button>
                )}
                {!isPropActive('gap') && (
                  <button type="button" className="css-style-option" onClick={() => addProp('gap')}>
                    <code>gap</code>
                    <span>Espaçamento interno entre itens</span>
                  </button>
                )}
                {!isPropActive('padding') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('padding')}
                  >
                    <code>padding</code>
                    <span>Espaçamento interno (padding)</span>
                  </button>
                )}
                {!isPropActive('margin') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('margin')}
                  >
                    <code>margin</code>
                    <span>Margem externa</span>
                  </button>
                )}
                {!isPropActive('zIndex') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('zIndex')}
                  >
                    <code>z-index</code>
                    <span>Ordem de sobreposição / camadas</span>
                  </button>
                )}
              </div>

              <div className="css-add-style-category">
                <span className="cat-title">🎨 Aparência & Efeitos</span>
                {!isPropActive('background') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('background')}
                  >
                    <code>background: {style.background || '#7c3aed'}</code>
                    <span>Cor de fundo do elemento</span>
                  </button>
                )}
                {!isPropActive('color') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('color')}
                  >
                    <code>color: {style.color || '#ffffff'}</code>
                    <span>Cor do texto / ícone</span>
                  </button>
                )}
                {!isPropActive('borderWidth') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('borderWidth')}
                  >
                    <code>border-width: {style.borderWidth ?? 1}px</code>
                    <span>Espessura da borda</span>
                  </button>
                )}
                {!isPropActive('borderStyle') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('borderStyle')}
                  >
                    <code>border-style: {style.borderStyle || 'solid'}</code>
                    <span>Estilo do traço da borda</span>
                  </button>
                )}
                {!isPropActive('borderColor') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('borderColor')}
                  >
                    <code>border-color: {style.borderColor || '#7c3aed'}</code>
                    <span>Cor da borda</span>
                  </button>
                )}
                {!isPropActive('borderRadius') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('borderRadius')}
                  >
                    <code>border-radius: {style.radius ?? 8}px</code>
                    <span>Arredondamento dos cantos</span>
                  </button>
                )}
                {!isPropActive('opacity') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('opacity')}
                  >
                    <code>opacity</code>
                    <span>Opacidade / transparência</span>
                  </button>
                )}
                {!isPropActive('boxShadow') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('boxShadow')}
                  >
                    <code>box-shadow</code>
                    <span>Sombra projetada (elevação)</span>
                  </button>
                )}
              </div>

              <div className="css-add-style-category">
                <span className="cat-title">🔤 Tipografia</span>
                {!isPropActive('content') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('content')}
                  >
                    <code>content: "{elementText}"</code>
                    <span>Texto do elemento</span>
                  </button>
                )}
                {!isPropActive('fontSize') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('fontSize')}
                  >
                    <code>font-size: {style.fontSize ?? 15}px</code>
                    <span>Tamanho da fonte</span>
                  </button>
                )}
                {!isPropActive('fontWeight') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('fontWeight')}
                  >
                    <code>font-weight: {style.fontWeight || 400}</code>
                    <span>Peso / espessura da fonte</span>
                  </button>
                )}
                {!isPropActive('textAlign') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('textAlign')}
                  >
                    <code>text-align: {style.textAlign || 'left'}</code>
                    <span>Alinhamento do texto</span>
                  </button>
                )}
                {!isPropActive('lineHeight') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('lineHeight')}
                  >
                    <code>line-height</code>
                    <span>Altura da linha de texto</span>
                  </button>
                )}
              </div>

              <div className="css-add-style-category">
                <span className="cat-title">⚡ Interação & Conteúdo</span>
                {!isPropActive('icon') && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('icon')}
                  >
                    <code>icon (material)</code>
                    <span>Ícone do Google (Material Symbols)</span>
                  </button>
                )}
                {!isPropActive('action') &&
                  (chosen.type === 'button' || chosen.type === 'icon') && (
                    <button
                      type="button"
                      className="css-style-option"
                      onClick={() => addProp('action')}
                    >
                      <code>action (fluxo)</code>
                      <span>Disparar fluxo ao clicar</span>
                    </button>
                  )}
                {!isPropActive('placeholder') && chosen.type === 'input' && (
                  <button
                    type="button"
                    className="css-style-option"
                    onClick={() => addProp('placeholder')}
                  >
                    <code>placeholder</code>
                    <span>Texto de dica para preenchimento</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="css-selector-footer">{'}'}</div>
      </div>
    );
  };

  const renderLayoutSection = () => renderCssCodeBlock('layout');
  const renderTypographySection = () => renderCssCodeBlock('typography');
  const renderAppearanceSection = () => renderCssCodeBlock('appearance');

  const renderMenuSection = () => {
    if (!chosen || (chosen.type !== 'dropdown' && chosen.type !== 'hamburger')) return null;
    return (
      <div className="property-full frontend-menu-manager">
        <div className="frontend-menu-manager-header">
          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={13} color="#38bdf8" /> Itens e Telas do Menu
          </strong>
          <button
            type="button"
            className="frontend-quick-action-btn"
            title="Adicionar todas as telas do projeto ao menu automaticamente"
            onClick={() => {
              const screenItems: UIMenuItem[] = screens.map((scr, idx) => ({
                id: `item_${scr.id || idx + 1}`,
                label: (scr.data.label as string) || `Tela ${idx + 1}`,
                icon: 'arrow_forward',
                actionType: 'screen' as const,
                targetScreenId: scr.id,
              }));
              commit((g) => updateComponentConfig(g, screenId, chosen.id, { items: screenItems }));
            }}
          >
            Sincronizar Telas
          </button>
        </div>

        <label className="property-full" style={{ margin: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#94a3b8',
            }}
          >
            <Workflow size={12} color="#a78bfa" /> Vincular Lista Dinâmica (Backend / Store / API)
          </span>
          <input
            placeholder="ex: categorias, produtos, itens_menu..."
            value={'itemsPath' in chosen && chosen.itemsPath ? String(chosen.itemsPath) : ''}
            onChange={(e) => {
              commit((g) =>
                updateComponentConfig(g, screenId, chosen.id, {
                  itemsPath: e.target.value.trim() || undefined,
                }),
              );
            }}
          />
          <small style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            Se preenchido, os itens serão carregados em tempo real dos dados do backend ou estado
            global.
          </small>
        </label>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>
            Opções Manuais (
            {'items' in chosen && Array.isArray(chosen.items) ? chosen.items.length : 0})
          </span>
          <button
            type="button"
            className="frontend-quick-action-btn"
            onClick={() => {
              const currentItems: UIMenuItem[] =
                'items' in chosen && Array.isArray(chosen.items) ? [...chosen.items] : [];
              const newItem: UIMenuItem = {
                id: `item_${Date.now().toString(36)}`,
                label: `Opção ${currentItems.length + 1}`,
                icon: 'label',
                actionType: 'screen',
                targetScreenId: screens[0]?.id || '',
              };
              commit((g) =>
                updateComponentConfig(g, screenId, chosen.id, {
                  items: [...currentItems, newItem],
                }),
              );
            }}
          >
            <Plus size={11} /> Adicionar Opção
          </button>
        </div>

        <div className="frontend-menu-items-list">
          {('items' in chosen && Array.isArray(chosen.items) ? chosen.items : []).map(
            (item: UIMenuItem, itemIdx: number) => (
              <div key={item.id || itemIdx} className="frontend-menu-item-card">
                <div className="frontend-menu-item-row">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: '#38bdf8', flexShrink: 0 }}
                  >
                    {item.icon || 'arrow_right'}
                  </span>
                  <input
                    type="text"
                    placeholder="Rótulo / Nome"
                    value={item.label}
                    style={{ flex: 1, minWidth: 0 }}
                    onChange={(e) => {
                      const updated = [...(chosen.items || [])];
                      updated[itemIdx] = { ...item, label: e.target.value };
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                      );
                    }}
                  />
                  <input
                    type="text"
                    placeholder="ícone"
                    title="Nome do ícone Material Symbols (ex: home, settings, star)"
                    value={item.icon || ''}
                    style={{ width: 62 }}
                    onChange={(e) => {
                      const updated = [...(chosen.items || [])];
                      updated[itemIdx] = {
                        ...item,
                        icon: e.target.value.trim().toLowerCase(),
                      };
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="del-item-btn"
                    title="Remover opção"
                    onClick={() => {
                      const updated = (chosen.items || []).filter(
                        (_: UIMenuItem, idx: number) => idx !== itemIdx,
                      );
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                      );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="frontend-menu-dest-badge">
                  <select
                    value={item.actionType || 'screen'}
                    style={{ width: 95, flex: 'none' }}
                    onChange={(e) => {
                      const newType = e.target.value as 'screen' | 'workflow' | 'value';
                      const updated = [...(chosen.items || [])];
                      updated[itemIdx] = {
                        ...item,
                        actionType: newType,
                        targetScreenId: newType === 'screen' ? screens[0]?.id || '' : undefined,
                        actionEvent:
                          newType === 'workflow' ? availableWorkflows[0]?.id || '' : undefined,
                        value: newType === 'value' ? item.value || item.label : undefined,
                      };
                      commit((g) =>
                        updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                      );
                    }}
                  >
                    <option value="screen">Tela</option>
                    <option value="workflow">Fluxo</option>
                    <option value="value">Valor/Texto</option>
                  </select>

                  {(!item.actionType || item.actionType === 'screen') && (
                    <select
                      value={item.targetScreenId || ''}
                      onChange={(e) => {
                        const updated = [...(chosen.items || [])];
                        updated[itemIdx] = { ...item, targetScreenId: e.target.value };
                        commit((g) =>
                          updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                        );
                      }}
                    >
                      <option value="">(Selecione a tela destino)</option>
                      {screens.map((scr) => (
                        <option key={scr.id} value={scr.id}>
                          Tela: {(scr.data.label as string) || scr.id}
                        </option>
                      ))}
                    </select>
                  )}

                  {item.actionType === 'workflow' && (
                    <select
                      value={item.actionEvent || ''}
                      onChange={(e) => {
                        const updated = [...(chosen.items || [])];
                        updated[itemIdx] = { ...item, actionEvent: e.target.value };
                        commit((g) =>
                          updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                        );
                      }}
                    >
                      <option value="">(Selecione o fluxo)</option>
                      {availableWorkflows.map((wf) => (
                        <option key={wf.id} value={wf.id}>
                          {wf.label} (#{wf.id})
                        </option>
                      ))}
                    </select>
                  )}

                  {item.actionType === 'value' && (
                    <input
                      type="text"
                      placeholder="ex: categorias, compras, perfil..."
                      value={item.value || ''}
                      onChange={(e) => {
                        const updated = [...(chosen.items || [])];
                        updated[itemIdx] = { ...item, value: e.target.value };
                        commit((g) =>
                          updateComponentConfig(g, screenId, chosen.id, { items: updated }),
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    );
  };

  const renderInspectorContent = () => {
    if (!chosen || !style) {
      return (
        <div className="frontend-property-empty">
          <AlignCenter size={28} />
          <p>Selecione um botão, campo ou elemento na tela para personalizar suas regras CSS.</p>
        </div>
      );
    }

    return (
      <>
        {renderSelectionHeader()}
        {renderCssCodeBlock()}
        {renderMenuSection()}

        <div className="css-actions-card">
          <button type="button" className="css-action-btn" onClick={copyStyleToAllDevices}>
            <Sparkles size={13} />
            <span>Replicar CSS para todos os dispositivos</span>
          </button>
          <button
            type="button"
            className="css-action-btn secondary"
            onClick={() => {
              changeStyle(defaultVisualStyle(selectedIndex, currentDevice, chosen.type));
            }}
          >
            <RotateCcw size={13} />
            <span>Resetar CSS para o padrão de {dimension.label}</span>
          </button>
        </div>

        <p className="frontend-hint" style={{ margin: 0 }}>
          Regras de estilo CSS aplicadas na tela de{' '}
          <strong>
            {dimension.label} ({dimension.width} px)
          </strong>
          .
        </p>
      </>
    );
  };

  return (
    <div className="frontend-editor">
      {/* 1. BARRA LATERAL ESQUERDA: COMPONENTES & CAMADAS (RECOLHÍVEL NO PADRÃO DO FLUXO) */}
      <aside
        className={`frontend-sidebar-shell ${leftExpanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-label="Biblioteca visual"
      >
        {leftExpanded ? (
          <div className="frontend-library">
            <div className="frontend-sidebar-heading">
              <button
                type="button"
                title="Recolher menu"
                aria-label="Recolher menu"
                onClick={() => setLeftExpanded(false)}
              >
                <PanelLeftClose size={18} />
              </button>
              <span>Interface Visual</span>
            </div>
            <div className="frontend-section-label">ELEMENTOS DE UI</div>
            {renderUiComponents()}
            <div className="frontend-divider" />
            <div className="frontend-section-label">ÍCONES DO GOOGLE (MATERIAL)</div>
            <p>Clique para adicionar na tela ou aplicar ao elemento selecionado.</p>
            {renderGoogleIcons()}
            <div className="frontend-divider" />
            <div className="frontend-section-label">MODELOS PRONTOS</div>
            <p>Modelos com propriedades pré-ajustadas para mobile e desktop.</p>
            {renderReadyModels()}
            <div className="frontend-divider" />
            <div className="frontend-section-label">CAMADAS NA TELA ({components.length})</div>
            {renderLayers()}
            <div className="frontend-tip">
              <Magnet size={15} />
              <span>Arraste os botões para ver as linhas magnéticas de alinhamento.</span>
            </div>
          </div>
        ) : (
          <>
            <nav className="frontend-rail" aria-label="Navegação visual">
              <button
                type="button"
                title="Expandir menu"
                aria-label="Expandir menu"
                onClick={() => setLeftExpanded(true)}
              >
                <PanelLeftOpen size={18} />
              </button>

              <span className="frontend-rail-separator" />

              <div
                className="frontend-rail-trigger"
                onMouseEnter={() => openLeftFlyout('components')}
                onMouseLeave={closeLeftSoon}
              >
                <button
                  type="button"
                  className={activeLeftFlyout === 'components' ? 'active' : ''}
                  title="Elementos de UI"
                  aria-label="Elementos de UI"
                  onClick={() => toggleLeftFlyout('components')}
                >
                  <MousePointerClick size={19} />
                </button>
              </div>

              <div
                className="frontend-rail-trigger"
                onMouseEnter={() => openLeftFlyout('icons')}
                onMouseLeave={closeLeftSoon}
              >
                <button
                  type="button"
                  className={activeLeftFlyout === 'icons' ? 'active' : ''}
                  title="Ícones do Google (Material)"
                  aria-label="Ícones do Google (Material)"
                  onClick={() => toggleLeftFlyout('icons')}
                >
                  <Sparkles size={19} />
                </button>
              </div>

              <div
                className="frontend-rail-trigger"
                onMouseEnter={() => openLeftFlyout('models')}
                onMouseLeave={closeLeftSoon}
              >
                <button
                  type="button"
                  className={activeLeftFlyout === 'models' ? 'active' : ''}
                  title="Modelos Prontos (Header, Footer, FAB)"
                  aria-label="Modelos Prontos (Header, Footer, FAB)"
                  onClick={() => toggleLeftFlyout('models')}
                >
                  <Palette size={19} />
                </button>
              </div>

              <div
                className="frontend-rail-trigger"
                onMouseEnter={() => openLeftFlyout('layers')}
                onMouseLeave={closeLeftSoon}
              >
                <button
                  type="button"
                  className={activeLeftFlyout === 'layers' ? 'active' : ''}
                  title={`Camadas na Tela (${components.length})`}
                  aria-label={`Camadas na Tela (${components.length})`}
                  onClick={() => toggleLeftFlyout('layers')}
                >
                  <Layers size={19} />
                  {components.length > 0 && (
                    <span className="frontend-rail-badge">{components.length}</span>
                  )}
                </button>
              </div>

              <div className="frontend-rail-bottom">
                {onOpenSettings && (
                  <button
                    type="button"
                    title="Configurações do Projeto"
                    aria-label="Configurações do Projeto"
                    onClick={onOpenSettings}
                  >
                    <Settings2 size={18} />
                  </button>
                )}
              </div>
            </nav>

            {/* Modal Flutuante ao Lado da Barra Esquerda */}
            {activeLeftFlyout && (
              <div
                ref={leftFlyoutRef}
                className="frontend-flyout-modal"
                role="dialog"
                aria-label={
                  activeLeftFlyout === 'components'
                    ? 'Elementos de UI'
                    : activeLeftFlyout === 'icons'
                      ? 'Ícones do Google'
                      : activeLeftFlyout === 'models'
                        ? 'Modelos Prontos'
                        : 'Camadas na Tela'
                }
                onMouseEnter={cancelLeftClose}
                onMouseLeave={closeLeftSoon}
              >
                <div className="frontend-flyout-header">
                  <div className="frontend-flyout-header-title">
                    <div className="modal-icon">
                      {activeLeftFlyout === 'components' ? (
                        <MousePointerClick size={18} />
                      ) : activeLeftFlyout === 'icons' ? (
                        <Sparkles size={18} />
                      ) : activeLeftFlyout === 'models' ? (
                        <Palette size={18} />
                      ) : (
                        <Layers size={18} />
                      )}
                    </div>
                    <div>
                      <h2>
                        {activeLeftFlyout === 'components'
                          ? 'Elementos de UI'
                          : activeLeftFlyout === 'icons'
                            ? 'Ícones do Google'
                            : activeLeftFlyout === 'models'
                              ? 'Modelos Prontos'
                              : `Camadas na Tela (${components.length})`}
                      </h2>
                      <p>
                        {activeLeftFlyout === 'components'
                          ? 'Clique em um componente para adicionar à tela'
                          : activeLeftFlyout === 'icons'
                            ? 'Pesquise e selecione um ícone para aplicar ou adicionar'
                            : activeLeftFlyout === 'models'
                              ? 'Adicione seções completas pré-configuradas'
                              : 'Gerencie seleção e exclusão de elementos'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="frontend-flyout-close-btn"
                    title="Fechar"
                    onClick={() => setActiveLeftFlyout(null)}
                  >
                    <X size={16} />
                  </button>
                </div>

                {activeLeftFlyout === 'components' && renderUiComponents()}
                {activeLeftFlyout === 'icons' && renderGoogleIcons()}
                {activeLeftFlyout === 'models' && renderReadyModels()}
                {activeLeftFlyout === 'layers' && renderLayers()}
              </div>
            )}
          </>
        )}
      </aside>

      {/* 2. ÁREA CENTRAL: TOOLBAR DE VIEWPORT + CANVAS */}
      <main className="frontend-center">
        <div className="frontend-toolbar">
          <div className="frontend-screen-picker">
            <label>
              Tela:
              <select
                aria-label="Tela da interface"
                value={screenId}
                onChange={(e) => {
                  onSelectScreen(e.target.value);
                  setSelected(null);
                }}
              >
                {screens.map((screen) => (
                  <option key={screen.id} value={screen.id}>
                    {screen.data.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onAddScreen} title="Adicionar tela">
              <Plus size={15} /> Nova Tela
            </button>
          </div>

          <div className="device-tabs" role="group" aria-label="Visualização por dispositivo">
            {design.enabled.map((id) => {
              const Icon = deviceIcons[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={currentDevice === id}
                  className={currentDevice === id ? 'active' : ''}
                  onClick={() => {
                    setDevice(id);
                    setDrag(null);
                    setGuide({});
                  }}
                >
                  <Icon size={14} />
                  <span>{devices[id].label}</span>
                  <small style={{ opacity: 0.6 }}>({devices[id].width}px)</small>
                </button>
              );
            })}
          </div>

          {graph.darkModeEnabled && (
            <div
              className="frontend-preview-theme-toggle"
              role="radiogroup"
              aria-label="Prévia do tema no dispositivo"
            >
              <button
                type="button"
                className={previewTheme === 'light' ? 'active' : ''}
                onClick={() => setPreviewTheme('light')}
                title="Testar tela em Modo Claro"
              >
                <Sun size={12} />
                <span>Claro</span>
              </button>
              <button
                type="button"
                className={previewTheme === 'dark' ? 'active' : ''}
                onClick={() => setPreviewTheme('dark')}
                title="Testar tela em Modo Escuro"
              >
                <Moon size={12} />
                <span>Escuro</span>
              </button>
            </div>
          )}

          <div className="frontend-quick-tools">
            <button
              type="button"
              disabled={!canUndo}
              title="Desfazer alterações (Ctrl+Z)"
              onClick={undo}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              title="Refazer alterações (Ctrl+Shift+Z / Ctrl+Y)"
              onClick={redo}
            >
              <RotateCw size={14} />
            </button>
            <button
              type="button"
              className={magnetEnabled ? 'active' : ''}
              title="Grade e Guia Magnética (Encaixe Automático)"
              onClick={() => setMagnetEnabled((v) => !v)}
            >
              <Magnet size={14} />
            </button>
            <button type="button" title="Diminuir zoom" onClick={zoomOut}>
              <Minus size={14} />
            </button>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                padding: '0 4px',
                userSelect: 'none',
              }}
              title="Nível de zoom atual"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" title="Aumentar zoom" onClick={zoomIn}>
              <Plus size={14} />
            </button>
            <button type="button" title="Ajustar dispositivo na tela" onClick={fitView}>
              <Maximize2 size={14} />
            </button>
            {onOpenSettings && (
              <button
                type="button"
                title="Configurações do Projeto (Dispositivos Ativos)"
                onClick={onOpenSettings}
              >
                <Settings2 size={14} />
              </button>
            )}
            <button
              type="button"
              disabled={!chosen}
              title="Duplicar selecionado (Ctrl+D)"
              onClick={duplicateSelected}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              disabled={!chosen}
              title="Excluir selecionado"
              onClick={deleteSelected}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Workspace e Viewport Interativo com Pan & Zoom infinito */}
        <div
          className={`frontend-workspace ${isPanning ? 'is-panning' : ''}`}
          ref={workspaceRef}
          style={{
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundSize: `${Math.round(24 * zoom)}px ${Math.round(24 * zoom)}px`,
          }}
          onPointerDown={handleWorkspacePointerDown}
          onPointerMove={handleWorkspacePointerMove}
          onPointerUp={handleWorkspacePointerUp}
        >
          {!screenId ? (
            <div className="frontend-empty">
              <MousePointer2 size={28} />
              <h3>Comece com uma tela</h3>
              <p>Crie uma tela para montar a interface do aplicativo.</p>
              <button className="primary" onClick={onAddScreen}>
                Criar tela
              </button>
            </div>
          ) : (
            <div
              className="frontend-canvas-viewport"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <div
                className="frontend-frame-wrap"
                style={{
                  width: dimension.width,
                  minHeight: dimension.height,
                }}
              >
                <div
                  className={`frontend-frame ${graph.darkModeEnabled && previewTheme === 'dark' ? 'device-dark-mode' : ''}`}
                  data-theme={graph.darkModeEnabled ? previewTheme : undefined}
                  style={{
                    width: dimension.width,
                    minHeight: dimension.height,
                  }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) setSelected(null);
                  }}
                >
                  {/* Simulação de status bar */}
                  <div className="frontend-device-bezel">
                    <span>09:41</span>
                    <span>
                      {dimension.label} ({dimension.width} × {dimension.height})
                    </span>
                    <span>100% 🔋</span>
                  </div>

                  {/* Itens posicionados no canvas */}
                  <div
                    style={{
                      position: 'relative',
                      marginTop: 26,
                      width: '100%',
                      minHeight: dimension.height - 26,
                    }}
                  >
                    {components.map((component, index) => {
                      const s = visualStyle(
                        design,
                        component.id,
                        currentDevice,
                        index,
                        component.type,
                      );
                      const isDraggingThis = drag?.id === component.id;
                      const curX = isDraggingThis && drag.mode === 'move' ? drag.x : s.x;
                      const curY = isDraggingThis && drag.mode === 'move' ? drag.y : s.y;
                      const curW = isDraggingThis && drag.mode === 'resize' ? drag.width : s.width;
                      const curH =
                        isDraggingThis && drag.mode === 'resize' ? drag.height : s.height;

                      const isSel = selected === component.id;

                      const disabled = new Set(s.disabledProps || []);
                      const itemStyle: CSSProperties = {
                        position: disabled.has('position') ? undefined : 'absolute',
                        left: disabled.has('left') ? undefined : curX,
                        top: disabled.has('top') ? undefined : curY,
                        width: disabled.has('width') ? undefined : curW,
                        height: disabled.has('height') ? undefined : curH,
                        zIndex:
                          !disabled.has('zIndex') &&
                          !disabled.has('z-index') &&
                          s.zIndex !== undefined
                            ? s.zIndex
                            : undefined,
                        fontSize:
                          disabled.has('fontSize') || disabled.has('font-size')
                            ? undefined
                            : s.fontSize,
                        fontWeight:
                          disabled.has('fontWeight') || disabled.has('font-weight')
                            ? undefined
                            : s.fontWeight,
                        padding: disabled.has('padding') ? 0 : s.padding,
                        background: disabled.has('background') ? 'transparent' : s.background,
                        color: disabled.has('color') ? 'inherit' : s.color,
                        border:
                          disabled.has('border') ||
                          disabled.has('borderWidth') ||
                          disabled.has('border-width') ||
                          s.borderWidth <= 0
                            ? 'none'
                            : `${s.borderWidth}px ${disabled.has('borderStyle') || disabled.has('border-style') ? 'solid' : s.borderStyle || 'solid'} ${disabled.has('borderColor') || disabled.has('border-color') ? 'transparent' : s.borderColor}`,
                        borderRadius:
                          disabled.has('radius') ||
                          disabled.has('borderRadius') ||
                          disabled.has('border-radius')
                            ? 0
                            : s.radius,
                        boxShadow:
                          disabled.has('boxShadow') || disabled.has('box-shadow') || !s.shadow
                            ? undefined
                            : `0 ${s.shadowY || 5}px ${s.shadowBlur || 14}px ${s.shadowColor || 'rgba(0,0,0,.18)'}`,
                        display: disabled.has('display') || !s.flex ? 'block' : 'flex',
                        flexDirection:
                          disabled.has('flexDirection') || disabled.has('flex-direction')
                            ? undefined
                            : s.flexDirection || 'row',
                        gap: disabled.has('gap') ? 0 : s.gap || 0,
                        justifyContent:
                          disabled.has('justifyContent') || disabled.has('justify-content')
                            ? undefined
                            : s.justify === 'between'
                              ? 'space-between'
                              : s.justify === 'around'
                                ? 'space-around'
                                : s.justify === 'start'
                                  ? 'flex-start'
                                  : s.justify === 'end'
                                    ? 'flex-end'
                                    : 'center',
                        alignItems:
                          disabled.has('alignItems') || disabled.has('align-items')
                            ? undefined
                            : s.align === 'start'
                              ? 'flex-start'
                              : s.align === 'end'
                                ? 'flex-end'
                                : s.align === 'stretch'
                                  ? 'stretch'
                                  : 'center',
                        opacity: disabled.has('opacity') ? 1 : (s.opacity ?? 100) / 100,
                        textAlign:
                          disabled.has('textAlign') || disabled.has('text-align')
                            ? 'inherit'
                            : s.textAlign || 'inherit',
                      };

                      const label =
                        'label' in component && typeof component.label === 'string'
                          ? component.label
                          : 'content' in component && typeof component.content === 'string'
                            ? component.content
                            : component.type;

                      return (
                        <div
                          key={component.id}
                          className={`frontend-item ${isSel ? 'selected' : ''}`}
                          style={itemStyle}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelected(component.id);
                            setDrag({
                              id: component.id,
                              mode: 'move',
                              startX: e.clientX,
                              startY: e.clientY,
                              x: s.x,
                              y: s.y,
                              width: s.width,
                              height: s.height,
                            });
                          }}
                        >
                          {/* Conteúdo visual específico */}
                          {component.type === 'icon' ? (
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: s.fontSize,
                                color: s.color,
                                lineHeight: 1,
                                userSelect: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {'iconName' in component && component.iconName
                                ? component.iconName
                                : 'star'}
                            </span>
                          ) : component.type === 'button' ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: s.gap || 6,
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              {'iconName' in component && component.iconName && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: component.label
                                      ? Math.max(16, s.fontSize + 2)
                                      : s.fontSize,
                                    lineHeight: 1,
                                  }}
                                >
                                  {component.iconName}
                                </span>
                              )}
                              {component.label && <span>{component.label}</span>}
                            </div>
                          ) : component.type === 'container' &&
                            'variant' in component &&
                            component.variant === 'header' ? (
                            <div
                              className="frontend-header-mock"
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 22, opacity: 0.9 }}
                                >
                                  arrow_back
                                </span>
                                <span style={{ fontWeight: 600, fontSize: s.fontSize || 16 }}>
                                  {'title' in component && component.title
                                    ? component.title
                                    : label}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 20, opacity: 0.8 }}
                                >
                                  search
                                </span>
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 20, opacity: 0.8 }}
                                >
                                  more_vert
                                </span>
                              </div>
                            </div>
                          ) : component.type === 'container' &&
                            'variant' in component &&
                            component.variant === 'footer' ? (
                            <div
                              className="frontend-footer-mock"
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-around',
                              }}
                            >
                              {('navItems' in component && Array.isArray(component.navItems)
                                ? component.navItems
                                : [
                                    { id: 'home', label: 'Início', icon: 'home' },
                                    { id: 'projects', label: 'Projetos', icon: 'folder' },
                                    { id: 'add', label: 'Novo', icon: 'add_box' },
                                    { id: 'activity', label: 'Atividade', icon: 'favorite' },
                                    { id: 'settings', label: 'Perfil', icon: 'person' },
                                  ]
                              ).map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className={`frontend-footer-item ${idx === 0 ? 'active' : idx === 2 ? 'accent' : ''}`}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 2,
                                    fontSize: s.fontSize || 10,
                                    color:
                                      idx === 0 ? '#a78bfa' : idx === 2 ? '#38bdf8' : 'inherit',
                                    opacity: idx === 0 || idx === 2 ? 1 : 0.75,
                                  }}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize:
                                        idx === 2
                                          ? (s.fontSize || 11) + 14
                                          : (s.fontSize || 11) + 10,
                                    }}
                                  >
                                    {item.icon}
                                  </span>
                                  <span style={{ fontSize: s.fontSize || 10, letterSpacing: -0.2 }}>
                                    {item.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : component.type === 'dropdown' ? (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  height: '100%',
                                  gap: 8,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {'iconName' in component &&
                                    component.iconName &&
                                    component.iconName !== 'arrow_drop_down' && (
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: 18, color: '#a78bfa' }}
                                      >
                                        {component.iconName}
                                      </span>
                                    )}
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      fontSize: s.fontSize,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {label}
                                  </span>
                                </div>
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 20, opacity: 0.7 }}
                                >
                                  arrow_drop_down
                                </span>
                              </div>
                              {/* Preview dos itens do dropdown quando selecionado */}
                              {isSel && (
                                <div
                                  className="frontend-dropdown-preview"
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    left: 0,
                                    right: 0,
                                    background: '#181b22',
                                    border: '1px solid #334155',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    zIndex: 50,
                                    padding: '4px 0',
                                    fontSize: 12,
                                  }}
                                >
                                  {'itemsPath' in component && component.itemsPath ? (
                                    <div
                                      style={{
                                        padding: '6px 10px',
                                        color: '#38bdf8',
                                        fontSize: 11,
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      Lista dinâmica: <code>{component.itemsPath}</code>
                                    </div>
                                  ) : 'items' in component &&
                                    Array.isArray(component.items) &&
                                    component.items.length > 0 ? (
                                    component.items.map((item, idx) => (
                                      <div
                                        key={item.id || idx}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '6px 10px',
                                          color: '#e2e8f0',
                                          borderBottom:
                                            idx < component.items.length - 1
                                              ? '1px solid rgba(255,255,255,0.04)'
                                              : 'none',
                                        }}
                                      >
                                        <span
                                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                          {item.icon && (
                                            <span
                                              className="material-symbols-outlined"
                                              style={{ fontSize: 14, color: '#a78bfa' }}
                                            >
                                              {item.icon}
                                            </span>
                                          )}
                                          <span>{item.label}</span>
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 9.5,
                                            opacity: 0.6,
                                            background: 'rgba(255,255,255,0.08)',
                                            padding: '2px 5px',
                                            borderRadius: 4,
                                          }}
                                        >
                                          {item.actionType === 'screen'
                                            ? 'Tela'
                                            : item.actionType === 'workflow'
                                              ? 'Fluxo'
                                              : 'Valor'}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '6px 10px', color: '#94a3b8' }}>
                                      Sem itens configurados
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : component.type === 'hamburger' ? (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: s.fontSize || 24, color: s.color }}
                              >
                                {'iconName' in component && component.iconName
                                  ? component.iconName
                                  : 'menu'}
                              </span>
                              {/* Preview do drawer de navegação quando selecionado */}
                              {isSel && (
                                <div
                                  className="frontend-hamburger-preview"
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    left: 0,
                                    minWidth: 190,
                                    background: '#181b22',
                                    border: '1px solid #334155',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    zIndex: 50,
                                    padding: '6px 0',
                                    fontSize: 12,
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: '4px 10px 6px',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: '#94a3b8',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.5,
                                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    {label} (
                                    {'items' in component && Array.isArray(component.items)
                                      ? component.items.length
                                      : 0}{' '}
                                    telas)
                                  </div>
                                  {'itemsPath' in component && component.itemsPath ? (
                                    <div
                                      style={{
                                        padding: '6px 10px',
                                        color: '#38bdf8',
                                        fontSize: 11,
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      Lista dinâmica: <code>{component.itemsPath}</code>
                                    </div>
                                  ) : 'items' in component &&
                                    Array.isArray(component.items) &&
                                    component.items.length > 0 ? (
                                    component.items.map((item, idx) => (
                                      <div
                                        key={item.id || idx}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: '6px 10px',
                                          color: '#e2e8f0',
                                        }}
                                      >
                                        <span
                                          className="material-symbols-outlined"
                                          style={{ fontSize: 16, color: '#a78bfa' }}
                                        >
                                          {item.icon || 'web_asset'}
                                        </span>
                                        <span
                                          style={{
                                            flex: 1,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {item.label}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '6px 10px', color: '#94a3b8' }}>
                                      Nenhuma tela vinculada
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : component.type === 'input' ? (
                            <div className="frontend-input-mock">
                              <small>{label}</small>
                              <span>
                                {'placeholder' in component
                                  ? String(component.placeholder)
                                  : 'Digite aqui...'}
                              </span>
                            </div>
                          ) : component.type === 'textarea' ? (
                            <div className="frontend-input-mock">
                              <small>{label}</small>
                              <span>Área de texto multi-linhas...</span>
                            </div>
                          ) : component.type === 'table' ? (
                            <table className="frontend-table-mock">
                              <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Nome</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>#01</td>
                                  <td>Exemplo A</td>
                                  <td>Ativo</td>
                                </tr>
                                <tr>
                                  <td>#02</td>
                                  <td>Exemplo B</td>
                                  <td>Pendente</td>
                                </tr>
                              </tbody>
                            </table>
                          ) : component.type === 'container' ? (
                            <div className="frontend-card-mock">
                              <strong>{label}</strong>
                              <small style={{ opacity: 0.6 }}>Conteúdo do Cartão</small>
                            </div>
                          ) : (
                            label
                          )}

                          {/* Dimensões em tooltip e resize handles ao selecionar */}
                          {isSel && (
                            <>
                              <div className="frontend-dim-badge">
                                {Math.round(curW)} × {Math.round(curH)} px (X:{Math.round(curX)}, Y:
                                {Math.round(curY)})
                              </div>
                              <div
                                className="frontend-resize-handle se"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setDrag({
                                    id: component.id,
                                    mode: 'resize',
                                    handle: 'se',
                                    startX: e.clientX,
                                    startY: e.clientY,
                                    x: s.x,
                                    y: s.y,
                                    width: s.width,
                                    height: s.height,
                                  });
                                }}
                              />
                              <div
                                className="frontend-resize-handle e"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setDrag({
                                    id: component.id,
                                    mode: 'resize',
                                    handle: 'e',
                                    startX: e.clientX,
                                    startY: e.clientY,
                                    x: s.x,
                                    y: s.y,
                                    width: s.width,
                                    height: s.height,
                                  });
                                }}
                              />
                              <div
                                className="frontend-resize-handle s"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setDrag({
                                    id: component.id,
                                    mode: 'resize',
                                    handle: 's',
                                    startX: e.clientX,
                                    startY: e.clientY,
                                    x: s.x,
                                    y: s.y,
                                    width: s.width,
                                    height: s.height,
                                  });
                                }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Linhas Magnéticas de Alinhamento (Horizontal e Vertical) */}
                  {guide.x !== undefined && (
                    <div className="frontend-guide vertical" style={{ left: guide.x }} />
                  )}
                  {guide.y !== undefined && (
                    <div className="frontend-guide horizontal" style={{ top: guide.y + 26 }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Controles Flutuantes de Zoom e Ajuste */}
          <div className="frontend-floating-controls" role="toolbar" aria-label="Controles de zoom">
            <button
              type="button"
              title="Diminuir zoom (Roda do mouse para baixo)"
              onClick={zoomOut}
            >
              <Minus size={14} />
            </button>
            <span className="frontend-zoom-badge" title="Nível de zoom atual">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" title="Aumentar zoom (Roda do mouse para cima)" onClick={zoomIn}>
              <Plus size={14} />
            </button>
            <button type="button" title="Redefinir para 100%" onClick={setZoom100}>
              100%
            </button>
            <button type="button" title="Ajustar dispositivo ao centro da tela" onClick={fitView}>
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Rodapé de Status */}
        <div className="frontend-status">
          <span>
            <Grid2X2 size={13} /> Grade Magnética 10 px {magnetEnabled ? '• Ativa' : '• Desativada'}
          </span>
          <span>
            {dimension.width} × {dimension.height} px • Zoom: {Math.round(scale * 100)}%
          </span>
        </div>
      </main>

      {/* 3. BARRA LATERAL DIREITA: INSPETOR VISUAL DE PROPRIEDADES (RECOLHÍVEL NO PADRÃO DO FLUXO) */}
      <aside
        className={`frontend-inspector-shell ${rightExpanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-label="Inspetor de propriedades"
      >
        {rightExpanded ? (
          <div className="frontend-properties">
            <div className="frontend-inspector-heading">
              <button
                type="button"
                title="Recolher painel"
                aria-label="Recolher painel"
                onClick={() => setRightExpanded(false)}
              >
                <PanelRightClose size={18} />
              </button>
              <span>Inspetor Visual</span>
            </div>
            {renderInspectorContent()}
          </div>
        ) : (
          <>
            <nav className="frontend-inspector-rail" aria-label="Inspetor de propriedades">
              <button
                type="button"
                title="Expandir painel direito"
                aria-label="Expandir painel direito"
                onClick={() => setRightExpanded(true)}
              >
                <PanelRightOpen size={18} />
              </button>

              <span className="frontend-inspector-rail-separator" />

              {chosen && style ? (
                <>
                  <div
                    className="frontend-inspector-rail-trigger"
                    onMouseEnter={() => openRightFlyout('inspector')}
                    onMouseLeave={closeRightSoon}
                  >
                    <button
                      type="button"
                      className={activeRightFlyout === 'inspector' ? 'active' : ''}
                      title={`Inspetor Completo (#${chosen.id})`}
                      aria-label={`Inspetor Completo (#${chosen.id})`}
                      onClick={() => toggleRightFlyout('inspector')}
                    >
                      <SlidersHorizontal size={19} />
                    </button>
                  </div>

                  <div
                    className="frontend-inspector-rail-trigger"
                    onMouseEnter={() => openRightFlyout('appearance')}
                    onMouseLeave={closeRightSoon}
                  >
                    <button
                      type="button"
                      className={activeRightFlyout === 'appearance' ? 'active' : ''}
                      title="Aparência, Cores e Bordas"
                      aria-label="Aparência, Cores e Bordas"
                      onClick={() => toggleRightFlyout('appearance')}
                    >
                      <Palette size={19} />
                    </button>
                  </div>

                  <div
                    className="frontend-inspector-rail-trigger"
                    onMouseEnter={() => openRightFlyout('layout')}
                    onMouseLeave={closeRightSoon}
                  >
                    <button
                      type="button"
                      className={activeRightFlyout === 'layout' ? 'active' : ''}
                      title="Posição e Dimensões em px"
                      aria-label="Posição e Dimensões em px"
                      onClick={() => toggleRightFlyout('layout')}
                    >
                      <Box size={19} />
                    </button>
                  </div>

                  <div
                    className="frontend-inspector-rail-trigger"
                    onMouseEnter={() => openRightFlyout('typography')}
                    onMouseLeave={closeRightSoon}
                  >
                    <button
                      type="button"
                      className={activeRightFlyout === 'typography' ? 'active' : ''}
                      title="Texto e Tipografia"
                      aria-label="Texto e Tipografia"
                      onClick={() => toggleRightFlyout('typography')}
                    >
                      <Type size={19} />
                    </button>
                  </div>

                  {(chosen.type === 'dropdown' || chosen.type === 'hamburger') && (
                    <div
                      className="frontend-inspector-rail-trigger"
                      onMouseEnter={() => openRightFlyout('menu')}
                      onMouseLeave={closeRightSoon}
                    >
                      <button
                        type="button"
                        className={activeRightFlyout === 'menu' ? 'active' : ''}
                        title="Itens de Menu e Telas Vinculadas"
                        aria-label="Itens de Menu e Telas Vinculadas"
                        onClick={() => toggleRightFlyout('menu')}
                      >
                        <Menu size={19} />
                      </button>
                    </div>
                  )}

                  <div className="frontend-inspector-rail-bottom">
                    <button
                      type="button"
                      title="Duplicar elemento"
                      aria-label="Duplicar elemento"
                      onClick={duplicateSelected}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      title="Excluir elemento"
                      aria-label="Excluir elemento"
                      onClick={deleteSelected}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  title="Selecione um elemento na tela"
                  aria-label="Selecione um elemento na tela"
                  disabled
                >
                  <MousePointerClick size={19} />
                </button>
              )}
            </nav>

            {/* Modal Flutuante ao Lado da Barra Direita */}
            {activeRightFlyout && chosen && style && (
              <div
                ref={rightFlyoutRef}
                className="frontend-inspector-flyout"
                role="dialog"
                aria-label="Inspetor de propriedades"
                onMouseEnter={cancelRightClose}
                onMouseLeave={closeRightSoon}
              >
                <div className="frontend-flyout-header">
                  <div className="frontend-flyout-header-title">
                    <div className="modal-icon">
                      {activeRightFlyout === 'appearance' ? (
                        <Palette size={18} />
                      ) : activeRightFlyout === 'layout' ? (
                        <Box size={18} />
                      ) : activeRightFlyout === 'typography' ? (
                        <Type size={18} />
                      ) : activeRightFlyout === 'menu' ? (
                        <Menu size={18} />
                      ) : (
                        <SlidersHorizontal size={18} />
                      )}
                    </div>
                    <div>
                      <h2>
                        {activeRightFlyout === 'appearance'
                          ? 'Aparência e Cores'
                          : activeRightFlyout === 'layout'
                            ? 'Posição e Dimensões'
                            : activeRightFlyout === 'typography'
                              ? 'Texto e Tipografia'
                              : activeRightFlyout === 'menu'
                                ? 'Itens de Menu'
                                : `Propriedades #${chosen.id}`}
                      </h2>
                      <p>
                        {chosen.type} • {dimension.label}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="frontend-flyout-close-btn"
                    title="Fechar"
                    onClick={() => setActiveRightFlyout(null)}
                  >
                    <X size={16} />
                  </button>
                </div>

                {activeRightFlyout === 'inspector' && renderInspectorContent()}
                {activeRightFlyout === 'appearance' && (
                  <>
                    {renderSelectionHeader()}
                    {renderAppearanceSection()}
                  </>
                )}
                {activeRightFlyout === 'layout' && (
                  <>
                    {renderSelectionHeader()}
                    {renderLayoutSection()}
                  </>
                )}
                {activeRightFlyout === 'typography' && (
                  <>
                    {renderSelectionHeader()}
                    {renderTypographySection()}
                  </>
                )}
                {activeRightFlyout === 'menu' && (
                  <>
                    {renderSelectionHeader()}
                    {renderMenuSection()}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
