import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';

type Props = {
  onSubmit: (name: string, direction: 'input' | 'output') => void;
};

/** Botão que expande um formulário para criar porta com nome e direção livres. */
export function CustomPortForm({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'input' | 'output'>('output');

  function close() {
    setOpen(false);
    setName('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, direction);
    close();
  }

  if (!open) {
    return (
      <button type="button" className="custom-port-toggle-btn" onClick={() => setOpen(true)}>
        <Plus size={13} /> Conexão personalizada...
      </button>
    );
  }

  return (
    <form className="custom-port-form" onSubmit={handleSubmit}>
      <div className="direction-toggle-group">
        <button
          type="button"
          className={`toggle-dir-btn ${direction === 'output' ? 'active' : ''}`}
          onClick={() => setDirection('output')}
        >
          Saída (OUT)
        </button>
        <button
          type="button"
          className={`toggle-dir-btn ${direction === 'input' ? 'active' : ''}`}
          onClick={() => setDirection('input')}
        >
          Entrada (IN)
        </button>
      </div>
      <div className="custom-input-row">
        <input
          type="text"
          placeholder="Nome (ex: email, result, a, b)"
          aria-label="Nome da conexão"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button type="submit" className="primary" disabled={!name.trim()}>
          Adicionar
        </button>
        <button type="button" className="secondary" onClick={close}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
