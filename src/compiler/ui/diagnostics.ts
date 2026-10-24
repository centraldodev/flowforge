import type { ScreenUI, UIComponent } from './types';

export type UIDiagnostic = {
  screenId: string;
  componentId: string;
  componentType: string;
  code: string;
  message: string;
  severity: 'warning' | 'error';
};

/**
 * Valida a árvore de UI para compatibilidade com a plataforma alvo (ex: Tkinter),
 * emitindo avisos/diagnósticos claros sobre propriedades não suportadas fielmente.
 */
export function validateUIForPlatform(
  screen: ScreenUI,
  platform: 'react' | 'tkinter',
): UIDiagnostic[] {
  const diagnostics: UIDiagnostic[] = [];

  if (platform === 'react') {
    // React suporta todas as propriedades declaradas via CSS moderno / flex / grid
    return diagnostics;
  }

  function checkComponent(comp: UIComponent) {
    switch (comp.type) {
      case 'container':
        if (comp.layout?.type === 'flex' && comp.layout.wrap) {
          diagnostics.push({
            screenId: screen.screenId,
            componentId: comp.id,
            componentType: 'container',
            code: 'TKINTER_FLEX_WRAP_UNSUPPORTED',
            message: `Componente "${comp.id}": Tkinter pack não suporta flex-wrap nativamente. O layout será exibido em linha contínua.`,
            severity: 'warning',
          });
        }
        if (comp.layout?.type === 'grid' && typeof comp.layout.columns === 'string') {
          diagnostics.push({
            screenId: screen.screenId,
            componentId: comp.id,
            componentType: 'container',
            code: 'TKINTER_COMPLEX_GRID_LIMITATION',
            message: `Componente "${comp.id}": Tkinter grid suporta apenas colunas numéricas fixas, não strings de template CSS ("${comp.layout.columns}").`,
            severity: 'warning',
          });
        }
        for (const child of comp.children) {
          checkComponent(child);
        }
        break;

      case 'image':
        if (
          typeof comp.src === 'string' &&
          (comp.src.startsWith('http://') || comp.src.startsWith('https://'))
        ) {
          diagnostics.push({
            screenId: screen.screenId,
            componentId: comp.id,
            componentType: 'image',
            code: 'TKINTER_REMOTE_IMAGE_UNSUPPORTED',
            message: `Imagem "${comp.id}": Tkinter PhotoImage não faz download direto de URLs HTTP/HTTPS sem a biblioteca Pillow.`,
            severity: 'warning',
          });
        }
        break;

      case 'modal':
        diagnostics.push({
          screenId: screen.screenId,
          componentId: comp.id,
          componentType: 'modal',
          code: 'TKINTER_MODAL_TOPLEVEL_FALLBACK',
          message: `Modal "${comp.id}": Renderizado como janela Toplevel separada no Tkinter (sem efeito de backdrop blur CSS).`,
          severity: 'warning',
        });
        for (const child of comp.children) {
          checkComponent(child);
        }
        break;

      case 'list':
        checkComponent(comp.template);
        if (comp.emptyState) {
          checkComponent(comp.emptyState);
        }
        break;

      default:
        break;
    }
  }

  checkComponent(screen.root);
  return diagnostics;
}

/**
 * Valida todas as telas de uma aplicação para uma plataforma.
 */
export function validateAllScreensForPlatform(
  screens: Record<string, ScreenUI>,
  platform: 'react' | 'tkinter',
): UIDiagnostic[] {
  const all: UIDiagnostic[] = [];
  for (const scr of Object.values(screens)) {
    all.push(...validateUIForPlatform(scr, platform));
  }
  return all;
}
