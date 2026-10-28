import type { Graph } from './types';

export type Device = 'mobile' | 'tablet' | 'desktop';
export const devices: Record<Device, { label: string; width: number; height: number }> = {
  mobile: { label: 'Celular', width: 375, height: 812 },
  tablet: { label: 'Tablet', width: 768, height: 1024 },
  desktop: { label: 'Desktop', width: 1280, height: 800 },
};

export type VisualStyle = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  padding: number;
  radius: number;
  borderWidth: number;
  background: string;
  color: string;
  borderColor: string;
  shadow: boolean;
  flex: boolean;
  justify: 'start' | 'center' | 'end' | 'between' | 'around';
  align: 'start' | 'center' | 'end' | 'stretch';
  // Parâmetros visuais avançados
  flexDirection?: 'row' | 'column';
  gap?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  hasBorder?: boolean;
  opacity?: number;
  shadowBlur?: number;
  shadowY?: number;
  shadowColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  margin?: number;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  zIndex?: number;
  disabledProps?: string[];
};

export type VisualScreen = {
  enabled: Device[];
  items: Record<string, Partial<Record<Device, VisualStyle>>>;
};
export type VisualDesign = Record<string, VisualScreen>;

export function defaultVisualStyle(index: number, device: Device, type: string): VisualStyle {
  const screenW = devices[device].width;
  const screenH = devices[device].height;

  // 1. Modelos específicos com geometria ancorada e visual pré-configurado
  if (type === 'header' || type === 'header_app') {
    return {
      x: 0,
      y: 0,
      width: screenW,
      height: 56,
      fontSize: 16,
      fontWeight: 600,
      padding: 14,
      paddingTop: 14,
      paddingBottom: 14,
      paddingLeft: 16,
      paddingRight: 16,
      radius: 0,
      borderWidth: 1,
      background: '#181b22',
      color: '#ffffff',
      borderColor: '#282c37',
      borderStyle: 'solid',
      hasBorder: true,
      shadow: true,
      shadowY: 3,
      shadowBlur: 10,
      shadowColor: 'rgba(0,0,0,0.25)',
      flex: true,
      flexDirection: 'row',
      justify: 'between',
      align: 'center',
      gap: 12,
      opacity: 100,
      textAlign: 'left',
    };
  }

  if (type === 'footer' || type === 'footer_instagram') {
    return {
      x: 0,
      y: screenH - 64,
      width: screenW,
      height: 64,
      fontSize: 11,
      fontWeight: 500,
      padding: 6,
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 8,
      paddingRight: 8,
      radius: 0,
      borderWidth: 1,
      background: '#12141a',
      color: '#94a3b8',
      borderColor: '#282c37',
      borderStyle: 'solid',
      hasBorder: true,
      shadow: true,
      shadowY: -3,
      shadowBlur: 14,
      shadowColor: 'rgba(0,0,0,0.35)',
      flex: true,
      flexDirection: 'row',
      justify: 'around',
      align: 'center',
      gap: 4,
      opacity: 100,
      textAlign: 'center',
    };
  }

  if (type === 'fab') {
    return {
      x: screenW - 76,
      y: screenH - 148,
      width: 56,
      height: 56,
      fontSize: 28,
      fontWeight: 600,
      padding: 0,
      radius: 999,
      borderWidth: 0,
      background: '#7c3aed',
      color: '#ffffff',
      borderColor: '#7c3aed',
      borderStyle: 'none',
      hasBorder: false,
      shadow: true,
      shadowY: 6,
      shadowBlur: 20,
      shadowColor: 'rgba(124, 58, 237, 0.45)',
      flex: true,
      flexDirection: 'row',
      justify: 'center',
      align: 'center',
      gap: 0,
      opacity: 100,
      textAlign: 'center',
    };
  }

  if (type === 'fab_extended') {
    return {
      x: screenW - 165,
      y: screenH - 140,
      width: 145,
      height: 48,
      fontSize: 14,
      fontWeight: 600,
      padding: 12,
      radius: 999,
      borderWidth: 0,
      background: '#7c3aed',
      color: '#ffffff',
      borderColor: '#7c3aed',
      borderStyle: 'none',
      hasBorder: false,
      shadow: true,
      shadowY: 6,
      shadowBlur: 16,
      shadowColor: 'rgba(124, 58, 237, 0.4)',
      flex: true,
      flexDirection: 'row',
      justify: 'center',
      align: 'center',
      gap: 8,
      opacity: 100,
      textAlign: 'center',
    };
  }

  if (type === 'icon') {
    return {
      x: 30,
      y: 35 + index * 60,
      width: 44,
      height: 44,
      fontSize: 26,
      fontWeight: 400,
      padding: 0,
      radius: 8,
      borderWidth: 0,
      background: 'transparent',
      color: '#a78bfa',
      borderColor: 'transparent',
      borderStyle: 'none',
      hasBorder: false,
      shadow: false,
      shadowY: 0,
      shadowBlur: 0,
      shadowColor: 'transparent',
      flex: true,
      flexDirection: 'row',
      justify: 'center',
      align: 'center',
      gap: 0,
      opacity: 100,
      textAlign: 'center',
    };
  }

  if (type === 'dropdown') {
    return {
      x: 30,
      y: 35 + index * 72,
      width: device === 'mobile' ? 220 : 250,
      height: 46,
      fontSize: 14,
      fontWeight: 500,
      padding: 12,
      radius: 8,
      borderWidth: 1,
      background: '#1e222b',
      color: '#f8fafc',
      borderColor: '#334155',
      borderStyle: 'solid',
      hasBorder: true,
      shadow: true,
      shadowY: 3,
      shadowBlur: 10,
      shadowColor: 'rgba(0,0,0,0.2)',
      flex: true,
      flexDirection: 'row',
      justify: 'between',
      align: 'center',
      gap: 8,
      opacity: 100,
      textAlign: 'left',
    };
  }

  if (type === 'hamburger') {
    return {
      x: 20,
      y: 20,
      width: 44,
      height: 44,
      fontSize: 24,
      fontWeight: 500,
      padding: 8,
      radius: 8,
      borderWidth: 1,
      background: '#1e222b',
      color: '#f8fafc',
      borderColor: '#334155',
      borderStyle: 'solid',
      hasBorder: true,
      shadow: true,
      shadowY: 2,
      shadowBlur: 8,
      shadowColor: 'rgba(0,0,0,0.2)',
      flex: true,
      flexDirection: 'row',
      justify: 'center',
      align: 'center',
      gap: 0,
      opacity: 100,
      textAlign: 'center',
    };
  }

  // 2. Elementos padrão da interface
  const width = device === 'mobile' ? 315 : device === 'tablet' ? 420 : 460;
  const isSubmit = type === 'submit' || type === 'button';
  const isCard = type === 'container' || type === 'card' || type === 'form';
  const isHeading = type === 'heading';
  const isTable = type === 'table';
  const isInput = type === 'input' || type === 'textarea' || type === 'select';

  let height = 48;
  if (isTable) height = 180;
  else if (isCard) height = 160;
  else if (isInput) height = 56;
  else if (isHeading) height = 36;

  return {
    x: 30,
    y: 35 + index * 72,
    width: isCard ? (device === 'mobile' ? 335 : device === 'tablet' ? 460 : 540) : width,
    height,
    fontSize: isHeading ? 22 : 15,
    fontWeight: isHeading ? 700 : isSubmit ? 600 : 400,
    padding: isCard ? 18 : 10,
    radius: 8,
    borderWidth: 1,
    background: isSubmit ? '#7c3aed' : isCard ? '#1e222b' : '#ffffff',
    color: isSubmit ? '#ffffff' : isCard ? '#f1f5f9' : '#182333',
    borderColor: isSubmit ? '#7c3aed' : isCard ? '#334155' : '#cbd5e1',
    shadow: isCard,
    flex: isCard,
    justify: isSubmit ? 'center' : 'start',
    align: 'center',
    flexDirection: 'row',
    gap: 8,
    borderStyle: 'solid',
    hasBorder: true,
    opacity: 100,
    shadowBlur: 14,
    shadowY: 5,
    shadowColor: 'rgba(0,0,0,0.18)',
    textAlign: isSubmit ? 'center' : 'left',
  };
}

export function visualStyle(
  screen: VisualScreen | undefined,
  id: string,
  device: Device,
  index: number,
  type: string,
): VisualStyle {
  return { ...defaultVisualStyle(index, device, type), ...screen?.items?.[id]?.[device] };
}

function number(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function color(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (value === 'transparent') return 'transparent';
  if (/^#[0-9a-f]{3,8}$/i.test(value) || value.startsWith('rgba(') || value.startsWith('rgb(')) {
    return value;
  }
  return fallback;
}

function safeStyle(input: Partial<VisualStyle>, fallback: VisualStyle): VisualStyle {
  return {
    x: number(input.x, 0, 5000, fallback.x),
    y: number(input.y, 0, 10000, fallback.y),
    width: number(input.width, 20, 5000, fallback.width),
    height: number(input.height, 20, 5000, fallback.height),
    fontSize: number(input.fontSize, 8, 200, fallback.fontSize),
    fontWeight: number(input.fontWeight, 100, 900, fallback.fontWeight),
    padding: number(input.padding, 0, 300, fallback.padding),
    radius: number(input.radius, 0, 500, fallback.radius),
    borderWidth: number(input.borderWidth, 0, 50, fallback.borderWidth),
    background: color(input.background, fallback.background),
    color: color(input.color, fallback.color),
    borderColor: color(input.borderColor, fallback.borderColor),
    shadow: input.shadow === true,
    flex: input.flex === true,
    justify: ['start', 'center', 'end', 'between', 'around'].includes(String(input.justify))
      ? (input.justify as VisualStyle['justify'])
      : fallback.justify,
    align: ['start', 'center', 'end', 'stretch'].includes(String(input.align))
      ? (input.align as VisualStyle['align'])
      : fallback.align,
    flexDirection: input.flexDirection === 'column' ? 'column' : 'row',
    gap: number(input.gap, 0, 100, fallback.gap ?? 8),
    borderStyle: ['solid', 'dashed', 'dotted', 'none'].includes(String(input.borderStyle))
      ? (input.borderStyle as VisualStyle['borderStyle'])
      : (fallback.borderStyle ?? 'solid'),
    hasBorder: input.hasBorder ?? true,
    opacity: number(input.opacity, 0, 100, fallback.opacity ?? 100),
    shadowBlur: number(input.shadowBlur, 0, 100, fallback.shadowBlur ?? 14),
    shadowY: number(input.shadowY, 0, 50, fallback.shadowY ?? 5),
    shadowColor: String(input.shadowColor || fallback.shadowColor || 'rgba(0,0,0,0.18)'),
    paddingTop:
      input.paddingTop !== undefined
        ? number(input.paddingTop, 0, 300, input.padding ?? fallback.padding)
        : undefined,
    paddingBottom:
      input.paddingBottom !== undefined
        ? number(input.paddingBottom, 0, 300, input.padding ?? fallback.padding)
        : undefined,
    paddingLeft:
      input.paddingLeft !== undefined
        ? number(input.paddingLeft, 0, 300, input.padding ?? fallback.padding)
        : undefined,
    paddingRight:
      input.paddingRight !== undefined
        ? number(input.paddingRight, 0, 300, input.padding ?? fallback.padding)
        : undefined,
    margin: number(input.margin, 0, 200, fallback.margin ?? 0),
    textAlign: ['left', 'center', 'right'].includes(String(input.textAlign))
      ? (input.textAlign as VisualStyle['textAlign'])
      : (fallback.textAlign ?? 'left'),
    lineHeight:
      input.lineHeight !== undefined
        ? number(input.lineHeight, 10, 200, fallback.lineHeight ?? 24)
        : undefined,
    zIndex:
      input.zIndex !== undefined
        ? number(input.zIndex, -999, 9999, fallback.zIndex ?? 1)
        : undefined,
    disabledProps: Array.isArray(input.disabledProps)
      ? input.disabledProps.filter((p) => typeof p === 'string')
      : (fallback.disabledProps ?? []),
  };
}

/** Produz CSS estático sem interpolar valores arbitrários do projeto. */
export function generateVisualCss(
  design: VisualDesign | undefined,
  darkModeEnabled = false,
): string {
  if (!design || typeof design !== 'object') return '';
  const rules: string[] = [];
  for (const [screenId, screen] of Object.entries(design)) {
    if (
      !screen ||
      !Array.isArray(screen.enabled) ||
      !screen.items ||
      typeof screen.items !== 'object'
    )
      continue;
    const scope = `.ff-design-frame[data-screen-id=${JSON.stringify(screenId)}]`;
    rules.push(`${scope} { container-type: inline-size; width: 100%; }`);
    for (const device of ['mobile', 'tablet', 'desktop'] as Device[]) {
      if (!screen.enabled.includes(device)) continue;
      const query =
        device === 'mobile'
          ? '(max-width: 599px)'
          : device === 'tablet'
            ? '(min-width: 600px) and (max-width: 1023px)'
            : '(min-width: 1024px)';
      const entries: string[] = [];
      let minHeight = devices[device].height;
      for (const [id, byDevice] of Object.entries(screen.items)) {
        const raw = byDevice?.[device];
        if (!raw) continue;
        const s = safeStyle(raw, defaultVisualStyle(0, device, 'button'));
        minHeight = Math.max(minHeight, s.y + s.height + 20);
        const target = `${scope} .screen-ui-root [id=${JSON.stringify(id)}]:not(input):not(textarea):not(select), ${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}]`;

        const disabled = new Set(s.disabledProps || []);

        const paddingCss = disabled.has('padding')
          ? '0px'
          : s.paddingTop !== undefined ||
              s.paddingRight !== undefined ||
              s.paddingBottom !== undefined ||
              s.paddingLeft !== undefined
            ? `${s.paddingTop ?? s.padding}px ${s.paddingRight ?? s.padding}px ${s.paddingBottom ?? s.padding}px ${s.paddingLeft ?? s.padding}px`
            : `${s.padding}px`;

        const shadowCss =
          disabled.has('boxShadow') || disabled.has('box-shadow') || !s.shadow
            ? 'none'
            : `0 ${s.shadowY || 5}px ${s.shadowBlur || 14}px ${s.shadowColor || 'rgba(0,0,0,.18)'}`;

        const flexCss =
          disabled.has('display') || !s.flex
            ? ''
            : `display:flex; ${disabled.has('flexDirection') || disabled.has('flex-direction') ? '' : `flex-direction:${s.flexDirection || 'row'};`} gap:${disabled.has('gap') ? 0 : s.gap || 0}px; ${
                disabled.has('justifyContent') || disabled.has('justify-content')
                  ? ''
                  : `justify-content:${
                      s.justify === 'between'
                        ? 'space-between'
                        : s.justify === 'around'
                          ? 'space-around'
                          : s.justify === 'start'
                            ? 'flex-start'
                            : s.justify === 'end'
                              ? 'flex-end'
                              : 'center'
                    };`
              } ${
                disabled.has('alignItems') || disabled.has('align-items')
                  ? ''
                  : `align-items:${
                      s.align === 'start'
                        ? 'flex-start'
                        : s.align === 'end'
                          ? 'flex-end'
                          : s.align === 'stretch'
                            ? 'stretch'
                            : 'center'
                    };`
              }`;

        const borderCss =
          disabled.has('border') ||
          disabled.has('borderWidth') ||
          disabled.has('border-width') ||
          s.hasBorder === false ||
          s.borderWidth <= 0
            ? 'border:none;'
            : `border:${s.borderWidth}px ${disabled.has('borderStyle') || disabled.has('border-style') ? 'solid' : s.borderStyle || 'solid'} ${disabled.has('borderColor') || disabled.has('border-color') ? 'transparent' : s.borderColor};`;

        const zIndexCss =
          !disabled.has('zIndex') && !disabled.has('z-index') && s.zIndex !== undefined
            ? `z-index:${s.zIndex} !important; `
            : '';

        const positionCss = disabled.has('position') ? '' : 'position:absolute !important;';
        const leftCss = disabled.has('left') ? '' : `left:${s.x}px;`;
        const topCss = disabled.has('top') ? '' : `top:${s.y}px;`;
        const widthCss = disabled.has('width') ? '' : `width:${s.width}px !important;`;
        const heightCss = disabled.has('height') ? '' : `height:${s.height}px !important;`;
        const marginCss = disabled.has('margin')
          ? 'margin:0px !important;'
          : `margin:${s.margin || 0}px !important;`;
        const fontSizeCss =
          disabled.has('fontSize') || disabled.has('font-size')
            ? ''
            : `font-size:${s.fontSize}px !important;`;
        const fontWeightCss =
          disabled.has('fontWeight') || disabled.has('font-weight')
            ? ''
            : `font-weight:${s.fontWeight} !important;`;
        const textAlignCss =
          disabled.has('textAlign') || disabled.has('text-align')
            ? ''
            : `text-align:${s.textAlign || 'inherit'};`;
        const radiusCss =
          disabled.has('radius') || disabled.has('borderRadius') || disabled.has('border-radius')
            ? 'border-radius:0px;'
            : `border-radius:${s.radius}px;`;
        const bgCss = disabled.has('background')
          ? 'background:transparent !important;'
          : `background:${s.background} !important;`;
        const colorCss = disabled.has('color')
          ? 'color:inherit !important;'
          : `color:${s.color} !important;`;
        const opacityCss = disabled.has('opacity')
          ? 'opacity:1;'
          : `opacity:${(s.opacity ?? 100) / 100};`;

        entries.push(
          `${target} { ${positionCss} ${leftCss} ${topCss} ${widthCss} ${heightCss} ${zIndexCss}box-sizing:border-box; ${marginCss} ${fontSizeCss} ${fontWeightCss} ${textAlignCss} padding:${paddingCss}; ${borderCss} ${radiusCss} ${bgCss} ${colorCss} ${opacityCss} box-shadow:${shadowCss}; ${flexCss} }`,
        );
        entries.push(
          `${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] { display:flex !important; flex-direction:column !important; justify-content:center !important; cursor:text; overflow:hidden; gap:2px !important; }`,
        );
        entries.push(
          `${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] .ff-input-label { font-size:11px !important; font-weight:600 !important; color:#475569 !important; margin:0 0 2px 0 !important; line-height:1.2 !important; user-select:none; pointer-events:none; }`,
        );
        entries.push(
          `${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] input, ${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] textarea, ${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] select { background:transparent !important; border:none !important; box-shadow:none !important; outline:none !important; padding:0 !important; margin:0 !important; width:100% !important; min-width:0 !important; color:inherit !important; font-size:13px !important; font-family:inherit !important; border-radius:0 !important; height:auto !important; min-height:0 !important; line-height:normal !important; }`,
        );
        entries.push(
          `${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] input::placeholder, ${scope} .screen-ui-root [id=${JSON.stringify('label_' + id)}] textarea::placeholder { color:#94a3b8 !important; opacity:1 !important; }`,
        );
      }
      rules.push(
        `@container ${query} { ${scope} .screen-ui-root { position:relative; min-height:${minHeight}px; width:100%; } ${entries.join('\n')} }`,
      );
      const deviceScope = `${scope}[data-device="${device}"]`;
      rules.push(
        `${deviceScope} .screen-ui-root { position:relative; min-height:${minHeight}px; width:100%; }`,
      );
      for (const entry of entries) {
        rules.push(entry.replaceAll(scope, deviceScope));
      }
    }
  }

  if (darkModeEnabled) {
    rules.push(`
/* Suporte ao Modo Noturno no Projeto */
[data-theme="dark"] .screen-ui-root,
.device-dark-mode .screen-ui-root {
  background: #0f1117;
  color: #f8fafc;
}
[data-theme="dark"] .screen-ui-root .ff-input-label,
.device-dark-mode .screen-ui-root .ff-input-label {
  color: #94a3b8 !important;
}
[data-theme="dark"] .screen-ui-root [id^="label_"],
.device-dark-mode .screen-ui-root [id^="label_"] {
  background: #1e222b !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}
[data-theme="dark"] .screen-ui-root .ui-dropdown summary,
.device-dark-mode .screen-ui-root .ui-dropdown summary {
  background: #1e222b !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}
[data-theme="dark"] .screen-ui-root .ui-dropdown-menu,
.device-dark-mode .screen-ui-root .ui-dropdown-menu {
  background: #15181f !important;
  border-color: #334155 !important;
}
`);
  }

  return rules.join('\n');
}

export function designForScreen(graph: Graph, screenId: string): VisualScreen | undefined {
  return graph.visualDesign?.[screenId];
}

/** Encaixa bordas e centros vizinhos ou, na ausência deles, os pontos da grade. */
export function snapVisualPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  others: VisualStyle[],
  grid = 10,
): { x: number; y: number; guideX?: number; guideY?: number } {
  let px = Math.max(0, Math.round(x / grid) * grid);
  let py = Math.max(0, Math.round(y / grid) * grid);
  let guideX: number | undefined;
  let guideY: number | undefined;
  let bestX = 8;
  let bestY = 8;

  for (const other of others) {
    // Alinhamentos horizontais: esquerda, centro, direita
    for (const target of [other.x, other.x + other.width / 2, other.x + other.width]) {
      for (const offset of [0, width / 2, width]) {
        const diff = Math.abs(x + offset - target);
        if (diff < bestX && target - offset >= 0) {
          bestX = diff;
          px = Math.round(target - offset);
          guideX = target;
        }
      }
    }

    // Alinhamentos verticais: topo, centro, base
    for (const target of [other.y, other.y + other.height / 2, other.y + other.height]) {
      for (const offset of [0, height / 2, height]) {
        const diff = Math.abs(y + offset - target);
        if (diff < bestY && target - offset >= 0) {
          bestY = diff;
          py = Math.round(target - offset);
          guideY = target;
        }
      }
    }
  }

  return { x: px, y: py, guideX, guideY };
}
