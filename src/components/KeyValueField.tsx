import { parseHttpEntries, type HttpEntries } from '../engine/http';

type Props = { label: string; value: string; onChange: (value: string) => void };
export function KeyValueField({ label, value, onChange }: Props) {
  let rows: HttpEntries;
  try {
    rows = parseHttpEntries(value);
  } catch {
    rows = [];
  }
  // Linhas vazias devem continuar editáveis enquanto o usuário preenche o nome.
  try {
    const raw = JSON.parse(value || '[]');
    if (
      Array.isArray(raw) &&
      raw.every((row) => row && typeof row.key === 'string' && typeof row.value === 'string')
    )
      rows = raw;
  } catch {
    /* configuração inválida é diagnosticada pelo compilador */
  }
  function update(index: number, field: 'key' | 'value', next: string) {
    onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, [field]: next } : row))));
  }
  return (
    <fieldset className="http-pairs">
      <legend>{label}</legend>
      {rows.map((row, index) => (
        <div className="http-pair" key={index}>
          <input
            aria-label={`${label}: nome ${index + 1}`}
            placeholder="Nome"
            value={row.key}
            onChange={(event) => update(index, 'key', event.target.value)}
          />
          <input
            aria-label={`${label}: valor ${index + 1}`}
            placeholder="Valor"
            value={row.value}
            onChange={(event) => update(index, 'value', event.target.value)}
          />
          <button
            type="button"
            aria-label={`Remover ${label} ${index + 1}`}
            onClick={() => onChange(JSON.stringify(rows.filter((_, i) => i !== index)))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => onChange(JSON.stringify([...rows, { key: '', value: '' }]))}
      >
        Adicionar opção
      </button>
    </fieldset>
  );
}
