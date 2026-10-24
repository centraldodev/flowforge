import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { CustomPort, PortCardinality, PortMode } from '../../engine';

type Props = {
  onSubmit: (port: CustomPort) => void;
};

/** Formulário para criar porta personalizada com modo, cardinalidade e tipo formal. */
export function CustomPortForm({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'input' | 'output'>('output');
  const [mode, setMode] = useState<PortMode>('control');
  const [cardinality, setCardinality] = useState<PortCardinality>('many');
  const [dataType, setDataType] = useState('string');

  function close() {
    setOpen(false);
    setName('');
    setMode('control');
    setCardinality('many');
    setDataType('string');
  }

  function handleModeChange(newMode: PortMode) {
    setMode(newMode);
    if (newMode === 'data') {
      setCardinality(direction === 'input' ? 'one' : 'many');
    } else {
      setCardinality('many');
    }
  }

  function handleDirectionChange(newDir: 'input' | 'output') {
    setDirection(newDir);
    if (mode === 'data') {
      setCardinality(newDir === 'input' ? 'one' : 'many');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === 'data' && !dataType.trim()) return;

    onSubmit({
      id: trimmed.toLowerCase().replace(/\s+/g, '_'),
      name: trimmed,
      direction,
      mode,
      cardinality,
      type: mode === 'data' ? dataType.trim() : undefined,
    });
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
          onClick={() => handleDirectionChange('output')}
        >
          Saída (OUT)
        </button>
        <button
          type="button"
          className={`toggle-dir-btn ${direction === 'input' ? 'active' : ''}`}
          onClick={() => handleDirectionChange('input')}
        >
          Entrada (IN)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', margin: '6px 0' }}>
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as PortMode)}
          aria-label="Modo da porta"
          style={{ flex: 1, padding: '4px', fontSize: '12px' }}
        >
          <option value="control">Controle (Execução)</option>
          <option value="data">Dados (Valor)</option>
          <option value="error">Erro (Exceção)</option>
        </select>

        <select
          value={cardinality}
          onChange={(e) => setCardinality(e.target.value as PortCardinality)}
          aria-label="Cardinalidade da porta"
          style={{ flex: 1, padding: '4px', fontSize: '12px' }}
        >
          <option value="one">1 Conexão (one)</option>
          <option value="many">Múltiplas (many)</option>
        </select>
      </div>

      {mode === 'data' && (
        <div style={{ margin: '4px 0' }}>
          <input
            type="text"
            placeholder="Tipo do dado (ex: string, number, User, any)"
            aria-label="Tipo do dado"
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            style={{ width: '100%', padding: '4px 6px', fontSize: '12px' }}
          />
        </div>
      )}

      <div className="custom-input-row">
        <input
          type="text"
          placeholder="Nome (ex: email, resultado)"
          aria-label="Nome da conexão"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className="primary"
          disabled={!name.trim() || (mode === 'data' && !dataType.trim())}
        >
          Adicionar
        </button>
        <button type="button" className="secondary" onClick={close}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
