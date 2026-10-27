import { useState } from 'react';

/** Configuração local temporária: o valor nunca entra no grafo nem no armazenamento do navegador. */
export function HttpSecretForm({ name }: { name: string }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const response = await fetch('/__flowforge/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value }),
      });
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error('Inicie o editor local com npm run dev.');
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || 'Não foi possível configurar a credencial.');
      setValue('');
      setMessage('Credencial configurada no servidor local até ele ser reiniciado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao configurar credencial.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="field">
        Valor de {name || 'credencial'} no servidor local
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !value || !/^FLOWFORGE_SECRET_[A-Z0-9_]+$/.test(name)}
        onClick={() => void save()}
      >
        {busy ? 'Configurando…' : 'Configurar credencial local'}
      </button>
      <p role="status">{message}</p>
      <p>
        No projeto exportado, configure essa referência no ambiente do backend. O valor não
        acompanha o ZIP.
      </p>
    </div>
  );
}
