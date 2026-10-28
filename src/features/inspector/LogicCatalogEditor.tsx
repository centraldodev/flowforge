import { useState } from 'react';
import type { Block } from '../../engine';
import {
  localLogicCatalog,
  logicDefinition,
  selectedLogicVersion,
} from '../../engine/catalogo/logicCatalog';

export function LogicCatalogEditor({
  block,
  onChange,
}: {
  block: Block;
  onChange: (config: Record<string, string>) => void;
}) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [base, setBase] = useState('');
  const [message, setMessage] = useState('');
  const kind = block.data.kind;
  if (kind !== 'condition' && kind !== 'validator') return null;
  let definition;
  try {
    definition = logicDefinition(kind, selectedLogicVersion(block.data.config));
  } catch {
    return <p>Não é possível criar uma opção: a versão selecionada não está disponível.</p>;
  }
  const current = definition;
  function publish() {
    try {
      const original = current.options.find((option) => option.value === base);
      if (!original) throw new Error('Escolha uma operação existente como base.');
      const next =
        Math.max(
          0,
          ...localLogicCatalog
            .listPublished()
            .filter((record) => record.definition.id === kind)
            .map((record) => record.definition.version),
        ) + 1;
      localLogicCatalog.publish(
        {
          ...current,
          version: next,
          options: [
            ...current.options,
            { value: key.trim(), label: label.trim(), operation: original.operation },
          ],
        },
        'editor local',
      );
      onChange({ catalogVersion: String(next), [current.operationField]: key.trim() });
      setLabel('');
      setKey('');
      setBase('');
      setMessage(`Versão ${next} publicada neste navegador.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível publicar.');
    }
  }
  return (
    <details>
      <summary>Adicionar opção ao catálogo local</summary>
      <p>Cria uma nova versão usando uma operação existente. Disponível neste navegador.</p>
      <label>
        Nome exibido
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label>
        Identificador (letras e números)
        <input value={key} onChange={(event) => setKey(event.target.value)} />
      </label>
      <label>
        Comportamento
        <select value={base} onChange={(event) => setBase(event.target.value)}>
          <option value="">Selecione uma operação</option>
          {current.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={publish}>
        Publicar nova versão
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
