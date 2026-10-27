import { Modal } from '../../components/Modal';
import type { Graph } from '../../engine';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  onEnvironmentChange: (environment: 'development' | 'production') => void;
};

export function SettingsModal({ isOpen, onClose, graph, onEnvironmentChange }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
      <div className="settings-empty">
        <h2>Configurações</h2>
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
        <p>
          As URLs são configuradas nos blocos Conexão HTTP. No servidor exportado, FLOWFORGE_ENV
          pode selecionar o ambiente da implantação.
        </p>
        <p>
          Credenciais ficam no ambiente do servidor. Nos blocos, informe apenas referências como
          FLOWFORGE_SECRET_API_TOKEN.
        </p>
      </div>
    </Modal>
  );
}
