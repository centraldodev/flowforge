import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Tablet,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { Graph } from '../../engine';
import type { Device } from '../../engine/visualDesign';
import type { Simulation } from '../../state/useSimulation';
import { screenOptions } from '../inspector/blockFields';
import { ScreenFields } from './ScreenFields';
import { ExecutionTerminal } from './ExecutionTerminal';
import { playgroundLoginFields } from './terminal';
import { PLAYGROUND_ACCOUNT } from '../../engine/playgroundCredentials';

type Platform = Device;

const DEVICE_SPECS: Record<
  Device,
  {
    viewportWidth: number;
    viewportHeight: number;
    frameWidth: number;
    frameChromeHeight: number;
    label: string;
    hint: string;
  }
> = {
  mobile: {
    viewportWidth: 375,
    viewportHeight: 812,
    frameWidth: 395, // 375px + 20px bordas
    frameChromeHeight: 72, // 32px top + 20px bottom + 20px bordas
    label: 'Celular',
    hint: 'Mobile · 375 × 812 px',
  },
  tablet: {
    viewportWidth: 768,
    viewportHeight: 1024,
    frameWidth: 770, // 768px + 2px bordas
    frameChromeHeight: 42, // 40px chrome + 2px bordas
    label: 'Tablet',
    hint: 'Tablet · 768 × 1024 px',
  },
  desktop: {
    viewportWidth: 1280,
    viewportHeight: 800,
    frameWidth: 1282, // 1280px + 2px bordas
    frameChromeHeight: 42, // 40px chrome + 2px bordas
    label: 'Desktop',
    hint: 'Desktop · 1280 × 800 px',
  },
};

const platforms = [
  { id: 'mobile' as const, label: 'Celular', icon: Smartphone },
  { id: 'tablet' as const, label: 'Tablet', icon: Tablet },
  { id: 'desktop' as const, label: 'Desktop', icon: Monitor },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  simulation: Simulation;
};

export function PreviewModal({ isOpen, onClose, graph, simulation }: Props) {
  const [platform, setPlatform] = useState<Platform>('mobile');
  const [zoomMode, setZoomMode] = useState<'fit' | '100%' | number>('fit');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const { screen, setScreen, values, setValue, messages, execute } = simulation;

  useEffect(() => {
    if (!isOpen) return;
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen, platform]);

  const currentScreenNode = graph.nodes.find((n) => n.id === screen);
  const screenTitle =
    currentScreenNode?.data.label || currentScreenNode?.data.config.title || 'Adicione uma tela';
  const pages = screenOptions(graph).filter((p) => p.value);
  const login = playgroundLoginFields(graph, screen);

  const visualScreen = screen ? graph.visualDesign?.[screen] : undefined;
  const isVisualScreen = Boolean(
    screen && visualScreen?.items && Object.keys(visualScreen.items).length > 0,
  );

  const spec = DEVICE_SPECS[platform];

  // Calcula a altura real de conteúdo necessária na tela
  const contentHeight = useMemo(() => {
    if (!visualScreen?.items) return spec.viewportHeight;
    let maxBottom = spec.viewportHeight;
    for (const itemStyles of Object.values(visualScreen.items)) {
      const s = itemStyles[platform];
      if (s && typeof s.y === 'number' && typeof s.height === 'number') {
        const bottom = s.y + s.height + 20;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }
    return maxBottom;
  }, [visualScreen, platform, spec.viewportHeight]);

  const targetW = spec.frameWidth;
  const targetH = contentHeight + spec.frameChromeHeight;

  // Medição da área disponível para calcular auto-escala (modo Ajustar)
  const availW = Math.max(120, (stageSize.width || (platform === 'mobile' ? 440 : 860)) - 28);
  const availH = Math.max(120, (stageSize.height || 620) - 28);

  const rawFitScale = Math.min(availW / targetW, availH / targetH);
  const fitScale = Math.max(0.25, Math.min(1.0, Number(rawFitScale.toFixed(3))));

  const activeScale =
    zoomMode === 'fit'
      ? fitScale
      : zoomMode === '100%'
        ? 1.0
        : typeof zoomMode === 'number'
          ? zoomMode
          : fitScale;

  const scaledW = Math.round(targetW * activeScale);
  const scaledH = Math.round(targetH * activeScale);

  const surfaceClass =
    platform === 'mobile' ? 'phone' : platform === 'tablet' ? 'tablet-window' : 'desktop-window';

  const windowUrl =
    'https://prototipo.local/' +
    (currentScreenNode?.data.label || 'inicio').toLowerCase().replaceAll(' ', '-');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simular aplicativo"
      className={`preview-modal platform-${platform}`}
    >
      <div className="preview-head">
        <span className="eyebrow">PLAYGROUND</span>
        <h2>Teste o seu caminho.</h2>
        <p>Acompanhe o fluxo enquanto testa a interface em tempo real.</p>
      </div>

      <div className="platform-picker" role="group" aria-label="Plataforma da simulação">
        <div className="platform-tabs">
          {platforms.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={platform === item.id}
              className={platform === item.id ? 'active' : ''}
              onClick={() => {
                setPlatform(item.id);
                setZoomMode('fit');
              }}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {graph.darkModeEnabled && (
          <div className="preview-theme-toggle" role="radiogroup" aria-label="Tema da prévia">
            <button
              type="button"
              className={previewTheme === 'light' ? 'active' : ''}
              onClick={() => setPreviewTheme('light')}
              title="Pré-visualizar em Modo Claro"
            >
              <Sun size={12} />
              <span>Claro</span>
            </button>
            <button
              type="button"
              className={previewTheme === 'dark' ? 'active' : ''}
              onClick={() => setPreviewTheme('dark')}
              title="Pré-visualizar em Modo Escuro"
            >
              <Moon size={12} />
              <span>Escuro</span>
            </button>
          </div>
        )}

        <div className="platform-zoom-controls">
          <span className="platform-hint">{spec.hint}</span>
          <div className="zoom-btn-group">
            <button
              type="button"
              className={zoomMode === 'fit' ? 'active' : ''}
              title="Ajustar automaticamente ao tamanho da tela (sem scroll)"
              onClick={() => setZoomMode('fit')}
            >
              <Maximize2 size={12} />
              <span>Ajustar à tela</span>
            </button>
            <button
              type="button"
              className={
                zoomMode === '100%' || (typeof zoomMode === 'number' && zoomMode === 1)
                  ? 'active'
                  : ''
              }
              title="Tamanho real 1:1 (100%)"
              onClick={() => setZoomMode('100%')}
            >
              <span>100%</span>
            </button>
            <div className="zoom-stepper">
              <button
                type="button"
                title="Diminuir zoom (-10%)"
                onClick={() => {
                  const current = activeScale;
                  setZoomMode(Math.max(0.2, Number((current - 0.1).toFixed(2))));
                }}
              >
                <ZoomOut size={12} />
              </button>
              <span className="zoom-badge">{Math.round(activeScale * 100)}%</span>
              <button
                type="button"
                title="Aumentar zoom (+10%)"
                onClick={() => {
                  const current = activeScale;
                  setZoomMode(Math.min(2.0, Number((current + 0.1).toFixed(2))));
                }}
              >
                <ZoomIn size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="preview-grid">
        <div className="preview-stage" ref={stageRef}>
          <div
            className="preview-scaler-wrap"
            style={{
              width: scaledW,
              height: scaledH,
            }}
          >
            <div
              className={`preview-scaler ${surfaceClass} ${isVisualScreen ? 'has-visual' : ''} ${graph.darkModeEnabled && previewTheme === 'dark' ? 'device-dark-mode' : ''}`}
              data-theme={graph.darkModeEnabled ? previewTheme : undefined}
              style={{
                width: targetW,
                height: targetH,
                transform: `scale(${activeScale})`,
                transformOrigin: 'top left',
              }}
            >
              {platform === 'mobile' && (
                <div className="phone-top">
                  <span>09:41</span>
                  <span>100% 🔋</span>
                </div>
              )}

              {platform !== 'mobile' && (
                <div className="window-chrome">
                  <span className="window-dots">● ● ●</span>
                  <span className="window-name" title={windowUrl}>
                    {screenTitle} • {spec.label} ({spec.viewportWidth} × {spec.viewportHeight})
                  </span>
                  <span>
                    {platform === 'tablet' ? <Tablet size={13} /> : <Monitor size={13} />}
                  </span>
                </div>
              )}

              <div
                className="phone-content"
                style={{
                  width: spec.viewportWidth,
                  height: contentHeight,
                  minHeight: contentHeight,
                }}
              >
                {!isVisualScreen && (
                  <>
                    <div className="app-mark">
                      <Workflow size={24} />
                    </div>
                    <h2>{screenTitle}</h2>
                    <p className="phone-sub">Seu aplicativo está tomando forma.</p>
                  </>
                )}
                <ScreenFields
                  graph={graph}
                  screen={screen}
                  device={platform}
                  values={values}
                  store={simulation.store}
                  onChange={setValue}
                  onAction={execute}
                />
                {messages.map((m, i) => (
                  <div className="preview-message" role="status" key={i}>
                    {m}
                  </div>
                ))}
              </div>
              {platform === 'mobile' && <div className="phone-bottom" />}
            </div>
          </div>
        </div>

        <div className="execution">
          {login && (
            <div className="playground-credentials">
              <strong>Conta de teste do playground</strong>
              <div>
                E-mail: <code>{PLAYGROUND_ACCOUNT.email}</code>
              </div>
              <div>
                Senha: <code>{PLAYGROUND_ACCOUNT.password}</code>
              </div>
              <small>
                Somente na prévia local; esta conta não é criada no aplicativo exportado.
              </small>
              {login.emailId && login.passwordId && (
                <button
                  type="button"
                  onClick={() =>
                    simulation.setValues((current) => ({
                      ...current,
                      [login.emailId!]: PLAYGROUND_ACCOUNT.email,
                      [login.passwordId!]: PLAYGROUND_ACCOUNT.password,
                    }))
                  }
                >
                  Preencher campos de login
                </button>
              )}
            </div>
          )}
          <ExecutionTerminal simulation={simulation} />

          <div className="execution-footer">
            <label className="field">
              Inspecionar tela
              <select value={screen} onChange={(e) => setScreen(e.target.value)}>
                {pages.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle">
              A autenticação e o banco da prévia usam serviços locais de teste; chamadas HTTP reais
              podem acessar serviços externos. Para verificar o aplicativo completo, teste também o
              projeto exportado.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
