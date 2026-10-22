import { useState } from 'react';
import { Globe, Monitor, RotateCcw, Smartphone, Workflow } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { Graph } from '../../engine';
import type { Simulation } from '../../state/useSimulation';
import { screenOptions } from '../inspector/blockFields';
import { ScreenFields } from './ScreenFields';

type Platform = 'mobile' | 'web' | 'desktop';

const platforms = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, hint: 'Celular · 310 px' },
  { id: 'web', label: 'Web', icon: Globe, hint: 'Navegador · layout adaptável' },
  { id: 'desktop', label: 'Desktop', icon: Monitor, hint: 'Desktop · janela de aplicativo' },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  simulation: Simulation;
};

export function PreviewModal({ isOpen, onClose, graph, simulation }: Props) {
  const [platform, setPlatform] = useState<Platform>('mobile');

  const { trace, clearTrace, screen, setScreen, values, setValue, messages, execute } = simulation;

  const currentScreenNode = graph.nodes.find((n) => n.id === screen);
  const screenTitle =
    currentScreenNode?.data.label ||
    currentScreenNode?.data.config.title ||
    'Adicione uma tela';
  const pages = screenOptions(graph).filter((p) => p.value);

  const surfaceClass =
    platform === 'mobile' ? 'phone' : platform === 'web' ? 'web-window' : 'desktop-window';

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
        <p>Integrações simuladas · demo@exemplo.com / 123456</p>
      </div>

      <div className="platform-picker" role="group" aria-label="Plataforma da simulação">
        {platforms.map((item) => (
          <button
            key={item.id}
            aria-pressed={platform === item.id}
            className={platform === item.id ? 'active' : ''}
            onClick={() => setPlatform(item.id)}
          >
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
        <span>{platforms.find((p) => p.id === platform)?.hint}</span>
      </div>

      <div className="preview-grid">
        <div className={`preview-surface ${surfaceClass}`}>
          <div className="phone-top">
            9:41 <span>● ▰</span>
          </div>

          {platform !== 'mobile' && (
            <div className="window-chrome">
              <span className="window-dots">● ● ●</span>
              <span className="window-name">{platform === 'web' ? windowUrl : graph.name}</span>
              <span>{platform === 'web' ? <Globe size={13} /> : <Monitor size={13} />}</span>
            </div>
          )}

          <div className="phone-content">
            <div className="app-mark">
              <Workflow size={24} />
            </div>
            <h2>{screenTitle}</h2>
            <p className="phone-sub">Seu aplicativo está tomando forma.</p>
            <ScreenFields
              graph={graph}
              screen={screen}
              values={values}
              onChange={setValue}
              onAction={execute}
            />
            {messages.map((m, i) => (
              <div className="preview-message" role="status" key={i}>
                {m}
              </div>
            ))}
          </div>
          <div className="phone-bottom" />
        </div>

        <div className="execution">
          <div className="section-title">
            <h3>Execução do fluxo</h3>
            <button title="Limpar registro" onClick={clearTrace}>
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="trace-list">
            {trace.length ? (
              trace.map((t, i) => (
                <div key={i} className="trace-item">
                  <span>{i + 1}</span>
                  <div>
                    <strong>{t.label}</strong>
                    <p>{t.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="subtle">
                Preencha os campos e clique em um botão. Cada passo executado aparece aqui.
              </p>
            )}
          </div>

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
              Os registros e cadastros são mantidos apenas nesta simulação. Os campos de entrada
              conectados fornecem dados; o botão inicia a execução.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
