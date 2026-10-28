import { useState } from 'react';
import { Monitor, Moon, Settings2, Smartphone, Sun, Tablet } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { Graph } from '../../engine';
import { devices, type Device } from '../../engine/visualDesign';
import { prepareVisualScreen, updateVisualScreen } from '../frontend/visualProject';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  onEnvironmentChange: (environment: 'development' | 'production') => void;
  currentScreenId?: string;
  onCommit?: (updater: (g: Graph) => Graph) => void;
  appTheme?: 'light' | 'system' | 'dark';
  onAppThemeChange?: (theme: 'light' | 'system' | 'dark') => void;
};

const deviceIcons: Record<Device, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export function SettingsModal({
  isOpen,
  onClose,
  graph,
  onEnvironmentChange,
  currentScreenId,
  onCommit,
  appTheme,
  onAppThemeChange,
}: Props) {
  const screens = graph.nodes.filter((node) => node.type === 'screen');
  const [selectedScreenId, setSelectedScreenId] = useState<string>(
    currentScreenId && screens.some((s) => s.id === currentScreenId)
      ? currentScreenId
      : screens[0]?.id || '',
  );

  const activeTargetId = screens.some((s) => s.id === selectedScreenId)
    ? selectedScreenId
    : screens[0]?.id || '';

  const visualScreen = activeTargetId ? prepareVisualScreen(graph, activeTargetId) : null;
  const enabledDevices = visualScreen?.enabled || ['mobile', 'tablet', 'desktop'];

  const toggleDevice = (deviceId: Device) => {
    if (!onCommit || !activeTargetId) return;
    const isEnabled = enabledDevices.includes(deviceId);
    let newDevices: Device[];
    if (isEnabled) {
      if (enabledDevices.length <= 1) return;
      newDevices = enabledDevices.filter((d) => d !== deviceId);
    } else {
      newDevices = [...enabledDevices, deviceId];
    }

    onCommit((prev) =>
      updateVisualScreen(prev, activeTargetId, (s) => ({ ...s, enabled: newDevices })),
    );
  };

  const applyToAllScreens = () => {
    if (!onCommit) return;
    onCommit((prev) => {
      let updated = prev;
      for (const scr of screens) {
        updated = updateVisualScreen(updated, scr.id, (s) => ({ ...s, enabled: enabledDevices }));
      }
      return updated;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações" className="settings-modal">
      <span className="modal-icon">
        <Settings2 size={24} />
      </span>
      <h2>Configurações do Projeto</h2>
      <p>
        Configure ambientes de execução, credenciais seguras e dispositivos ativos para o frontend
        responsivo.
      </p>

      <div className="settings-content">
        <label className="field">
          Ambiente das conexões HTTP
          <select
            value={graph.httpEnvironment || 'development'}
            onChange={(event) =>
              onEnvironmentChange(event.target.value as 'development' | 'production')
            }
          >
            <option value="development">Desenvolvimento</option>
            <option value="production">Produção</option>
          </select>
        </label>
        <p className="settings-note">
          As URLs são configuradas nos blocos Conexão HTTP. No servidor exportado, FLOWFORGE_ENV
          pode selecionar o ambiente da implantação.
        </p>
        <p className="settings-note">
          Credenciais ficam no ambiente do servidor. Nos blocos, informe apenas referências como
          FLOWFORGE_SECRET_API_TOKEN.
        </p>

        <hr className="modal-divider" />

        <div className="settings-section-head">
          <span className="eyebrow">DISPOSITIVOS ATIVOS (FRONTEND)</span>
          <p className="settings-note">
            Habilite quais dispositivos (telas) devem ter estilos responsivos próprios na edição e
            na prévia.
          </p>
        </div>

        {screens.length > 0 ? (
          <div className="device-selection-wrapper">
            {screens.length > 1 && (
              <label className="field" style={{ margin: 0 }}>
                Configurar para a tela:
                <select
                  value={activeTargetId}
                  onChange={(e) => setSelectedScreenId(e.target.value)}
                >
                  {screens.map((scr) => (
                    <option key={scr.id} value={scr.id}>
                      {(scr.data.label as string) || scr.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="device-checkbox-list">
              {(Object.keys(devices) as Device[]).map((id) => {
                const Icon = deviceIcons[id];
                const isChecked = enabledDevices.includes(id);
                const isOnlyOne = isChecked && enabledDevices.length === 1;
                return (
                  <label className="device-check" key={id}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isOnlyOne || !onCommit}
                      onChange={() => toggleDevice(id)}
                    />
                    <Icon size={15} className="device-check-icon" />
                    <span className="device-check-label">{devices[id].label}</span>
                    <small className="device-check-dims">
                      {devices[id].width} × {devices[id].height} px
                    </small>
                  </label>
                );
              })}
            </div>

            {screens.length > 1 && onCommit && (
              <button type="button" className="secondary apply-all-btn" onClick={applyToAllScreens}>
                Aplicar estes dispositivos a todas as telas
              </button>
            )}
          </div>
        ) : (
          <p className="settings-empty-msg">
            Nenhuma tela encontrada no projeto para configurar dispositivos.
          </p>
        )}

        <hr className="modal-divider" />

        <div className="settings-section-head">
          <span className="eyebrow">TEMA & MODO NOTURNO DO APLICATIVO</span>
          <p className="settings-note">
            Configure o suporte a modo escuro no aplicativo exportado e a aparência da interface do
            editor.
          </p>
        </div>

        <label className="device-check" style={{ cursor: 'pointer', margin: '8px 0' }}>
          <input
            type="checkbox"
            checked={Boolean(graph.darkModeEnabled)}
            disabled={!onCommit}
            onChange={() => onCommit?.((g) => ({ ...g, darkModeEnabled: !g.darkModeEnabled }))}
          />
          <Moon size={16} className="device-check-icon" />
          <span className="device-check-label">Habilitar Suporte a Modo Noturno no Aplicativo</span>
          <small className="device-check-dims">
            {graph.darkModeEnabled ? 'Ativado (inclui estilos dark)' : 'Desativado'}
          </small>
        </label>

        {onAppThemeChange && (
          <div style={{ marginTop: 14 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Aparência do FlowForge (IDE / Editor)
            </span>
            <div className="app-theme-switcher" role="radiogroup" aria-label="Tema do editor">
              <button
                type="button"
                className={appTheme === 'light' ? 'active' : ''}
                onClick={() => onAppThemeChange('light')}
                title="Modo Claro"
              >
                <Sun size={13} />
                <span>Claro</span>
              </button>
              <button
                type="button"
                className={appTheme === 'system' ? 'active' : ''}
                onClick={() => onAppThemeChange('system')}
                title="Tema do Sistema"
              >
                <Monitor size={13} />
                <span>Sistema</span>
              </button>
              <button
                type="button"
                className={appTheme === 'dark' ? 'active' : ''}
                onClick={() => onAppThemeChange('dark')}
                title="Modo Escuro"
              >
                <Moon size={13} />
                <span>Escuro</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
