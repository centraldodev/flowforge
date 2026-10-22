import { Modal } from '../../components/Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsModal({ isOpen, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
      <div className="settings-empty">
        <h2>Configurações</h2>
      </div>
    </Modal>
  );
}
