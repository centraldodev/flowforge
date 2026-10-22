import { useState } from 'react';
import { FilePlus2, Plus } from 'lucide-react';
import { Modal } from '../../components/Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export function NewProjectModal({ isOpen, onClose, onCreate }: Props) {
  const [projectName, setProjectName] = useState('Novo aplicativo');

  const handleCreate = () => {
    const trimmed = projectName.trim();
    if (trimmed) {
      onCreate(trimmed);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo projeto">
      <span className="modal-icon">
        <FilePlus2 size={25} />
      </span>
      <h2>Novo projeto</h2>
      <p>
        Comece com um canvas vazio. Você pode desfazer a criação para recuperar o fluxo anterior.
      </p>
      <label className="field">
        Nome do novo projeto
        <input
          autoFocus
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
      </label>
      <button className="primary wide" disabled={!projectName.trim()} onClick={handleCreate}>
        <Plus size={16} />
        Criar projeto
      </button>
    </Modal>
  );
}
