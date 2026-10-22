import { useState, type FormEvent } from 'react';
import { Plus, Trash2, X, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  ensureBlockPorts,
  type Block,
  type CustomPort,
  type Graph,
  type ScreenRoute,
} from '../../engine';
import { ScreenTransitions } from './ScreenTransitions';

type Props = {
  graph: Graph;
  chosen: Block | undefined;
  onUpdateRoutes: (routes: ScreenRoute[]) => void;
  onRemoveEdge: (id: string) => void;
  onAddPort: (port: CustomPort) => void;
  onRemovePort: (portId: string) => void;
};

export function Connections({
  graph,
  chosen,
  onUpdateRoutes,
  onRemoveEdge,
  onAddPort,
  onRemovePort,
}: Props) {
  const [customName, setCustomName] = useState('');
  const [customDirection, setCustomDirection] = useState<'input' | 'output'>('output');
  const [showCustomForm, setShowCustomForm] = useState(false);

  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  const portsList = ensureBlockPorts(chosen);
  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);

  function handleAddPreset(name: string, direction: 'input' | 'output') {
    if (!chosen) return;
    let id = name;
    let counter = 2;
    while (portsList.some((p) => p.id === id)) {
      id = `${name}_${counter++}`;
    }
    onAddPort({ id, name, direction });
  }

  function handleAddCustom(e: FormEvent) {
    e.preventDefault();
    if (!customName.trim() || !chosen) return;
    const name = customName.trim();
    let id = name.toLowerCase().replace(/\s+/g, '_');
    let counter = 2;
    while (portsList.some((p) => p.id === id)) {
      id = `${name}_${counter++}`;
    }
    onAddPort({ id, name, direction: customDirection });
    setCustomName('');
    setShowCustomForm(false);
  }

  return (
    <div className="connections-manager">
      <div className="section-title">
        <strong>Portas de Conexão</strong>
        <span className="badge-count">{portsList.length}</span>
      </div>

      <p className="subtle">
        Crie as conexões deste bloco. Conectores em inglês: <code>exec</code>, <code>next</code>,{' '}
        <code>value</code>, <code>true</code>, <code>false</code>.
      </p>

      {/* Lista de portas configuradas */}
      <div className="ports-list">
        {portsList.length === 0 ? (
          <div className="no-ports-notice">
            Bloco vazio sem conexões. Adicione portas abaixo para conectá-lo no canvas.
          </div>
        ) : (
          portsList.map((port) => {
            const edgeCount = blockEdges.filter(
              (e) =>
                (port.direction === 'output' &&
                  e.source === chosen.id &&
                  e.sourceHandle === port.id) ||
                (port.direction === 'input' &&
                  e.target === chosen.id &&
                  e.targetHandle === port.id),
            ).length;

            return (
              <div className="port-chip-row" key={port.id}>
                <div className="port-chip-info">
                  <span className={`direction-tag ${port.direction}`}>
                    {port.direction === 'input' ? (
                      <ArrowRight size={10} />
                    ) : (
                      <ArrowLeft size={10} />
                    )}
                    {port.direction === 'input' ? 'IN' : 'OUT'}
                  </span>
                  <strong className="port-name">{port.name}</strong>
                  {edgeCount > 0 ? (
                    <span className="port-edge-count">{edgeCount} fio(s)</span>
                  ) : (
                    <span className="port-idle-status">livre</span>
                  )}
                </div>
                <button
                  type="button"
                  className="port-remove-btn"
                  title={`Remover porta ${port.name}`}
                  aria-label={`Remover porta ${port.name}`}
                  onClick={() => onRemovePort(port.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Ações rápidas para adicionar conexões padrão */}
      <div className="add-ports-section">
        <label className="section-label">Adicionar conexão rápida:</label>
        <div className="quick-port-buttons">
          <button
            type="button"
            className="chip-btn output"
            title="Adicionar saída next (continua fluxo)"
            onClick={() => handleAddPreset('next', 'output')}
          >
            <Plus size={12} /> next (out)
          </button>
          <button
            type="button"
            className="chip-btn output"
            title="Adicionar saída value (dados)"
            onClick={() => handleAddPreset('value', 'output')}
          >
            <Plus size={12} /> value (out)
          </button>
          <button
            type="button"
            className="chip-btn output"
            title="Adicionar saída true (condição sim)"
            onClick={() => handleAddPreset('true', 'output')}
          >
            <Plus size={12} /> true (out)
          </button>
          <button
            type="button"
            className="chip-btn output"
            title="Adicionar saída false (condição não)"
            onClick={() => handleAddPreset('false', 'output')}
          >
            <Plus size={12} /> false (out)
          </button>
          <button
            type="button"
            className="chip-btn input"
            title="Adicionar entrada exec (executar ação)"
            onClick={() => handleAddPreset('exec', 'input')}
          >
            <Plus size={12} /> exec (in)
          </button>
          <button
            type="button"
            className="chip-btn input"
            title="Adicionar entrada value (dados de entrada)"
            onClick={() => handleAddPreset('value', 'input')}
          >
            <Plus size={12} /> value (in)
          </button>
          {chosen.data.kind === 'screen' && (
            <button
              type="button"
              className="chip-btn output"
              title="Adicionar saída routes para telas"
              onClick={() => handleAddPreset('routes', 'output')}
            >
              <Plus size={12} /> routes (out)
            </button>
          )}
        </div>

        {/* Botão e formulário para porta personalizada */}
        {!showCustomForm ? (
          <button
            type="button"
            className="custom-port-toggle-btn"
            onClick={() => setShowCustomForm(true)}
          >
            <Plus size={13} /> Conexão personalizada...
          </button>
        ) : (
          <form className="custom-port-form" onSubmit={handleAddCustom}>
            <div className="direction-toggle-group">
              <button
                type="button"
                className={`toggle-dir-btn ${customDirection === 'output' ? 'active' : ''}`}
                onClick={() => setCustomDirection('output')}
              >
                Saída (OUT)
              </button>
              <button
                type="button"
                className={`toggle-dir-btn ${customDirection === 'input' ? 'active' : ''}`}
                onClick={() => setCustomDirection('input')}
              >
                Entrada (IN)
              </button>
            </div>
            <div className="custom-input-row">
              <input
                type="text"
                placeholder="Nome (ex: email, result, a, b)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="primary" disabled={!customName.trim()}>
                Adicionar
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomName('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Transições de tela (quando bloco é tela) */}
      {chosen.data.kind === 'screen' && (
        <ScreenTransitions graph={graph} screen={chosen} onChange={onUpdateRoutes} />
      )}

      {/* Ligações ativas no Canvas */}
      <div className="active-edges-section">
        <div className="section-title">
          <strong>Ligações no Canvas</strong>
          <span className="badge-count">{blockEdges.length}</span>
        </div>

        {blockEdges.length === 0 ? (
          <p className="subtle">Nenhum fio conectado a este bloco no momento.</p>
        ) : (
          blockEdges.map((e) => {
            const isSource = e.source === chosen.id;
            const otherId = isSource ? e.target : e.source;
            const otherNode = graph.nodes.find((n) => n.id === otherId);
            const otherLabel = otherNode?.data.label || 'Bloco';

            return (
              <div className="connection-row" key={e.id}>
                <span>
                  <strong>{otherLabel}</strong>
                  <small>
                    {isSource ? 'saída' : 'entrada'}:{' '}
                    <code>{isSource ? e.sourceHandle : e.targetHandle}</code> →{' '}
                    <code>{isSource ? e.targetHandle : e.sourceHandle}</code>
                  </small>
                </span>
                <button
                  type="button"
                  title="Desconectar fio"
                  aria-label={'Desconectar de ' + otherLabel}
                  onClick={() => onRemoveEdge(e.id)}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
