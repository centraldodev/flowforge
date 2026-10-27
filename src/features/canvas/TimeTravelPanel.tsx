import { useState } from 'react';
import { ChevronRight, Database, FastForward, Layers, X, Variable } from 'lucide-react';
import type { Simulation } from '../../state/useSimulation';

type Props = {
  simulation: Simulation;
  onClose: () => void;
};

export function TimeTravelPanel({ simulation, onClose }: Props) {
  const { debuggerState, activeFrame } = simulation;
  const [activeTab, setActiveTab] = useState<'payloads' | 'store' | 'variables'>('payloads');
  const frames = debuggerState.frames;

  const handleSeek = (index: number) => {
    simulation.debugSeekFrame(index);
  };

  const handleReturnToCurrent = () => {
    simulation.debugSeekFrame(null);
  };

  const isTimeTraveling =
    debuggerState.selectedFrameIndex !== null &&
    debuggerState.selectedFrameIndex !== frames.length - 1;

  return (
    <div className="time-travel-panel" role="region" aria-label="Painel de Time-Travel e Inspeção">
      <div className="time-travel-header">
        <div className="time-travel-title">
          <Layers size={14} />
          <strong>Linha do Tempo (Time-Travel Trace)</strong>
          <span className="frame-count-badge">
            {frames.length} {frames.length === 1 ? 'passo gravado' : 'passos gravados'}
          </span>
          {isTimeTraveling && (
            <span className="travel-warning-badge">
              Inspecionando passado (Passo {(debuggerState.selectedFrameIndex ?? 0) + 1})
            </span>
          )}
        </div>

        <div className="time-travel-header-actions">
          {isTimeTraveling && (
            <button
              type="button"
              className="time-travel-btn return-btn"
              onClick={handleReturnToCurrent}
              title="Voltar ao último passo gravado"
            >
              <FastForward size={12} />
              <span>Ir para o presente</span>
            </button>
          )}

          <button
            type="button"
            className="time-travel-close-btn"
            onClick={onClose}
            title="Fechar painel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Linha do tempo horizontal */}
      <div className="time-travel-timeline">
        {frames.map((f, idx) => {
          const isSelected =
            debuggerState.selectedFrameIndex === idx ||
            (debuggerState.selectedFrameIndex === null && idx === frames.length - 1);

          return (
            <button
              key={`${f.stepIndex}-${f.phase}-${idx}`}
              type="button"
              className={`timeline-chip ${isSelected ? 'selected' : ''} phase-${f.phase}`}
              onClick={() => handleSeek(idx)}
              title={`${f.blockLabel || f.blockId} (${f.phase.toUpperCase()})`}
            >
              <span className="chip-step">#{idx + 1}</span>
              <span className="chip-name">{f.blockLabel || f.blockId}</span>
              <span className={`chip-phase ${f.phase}`}>{f.phase === 'before' ? 'IN' : 'OUT'}</span>
            </button>
          );
        })}
      </div>

      {/* Área de Inspeção de Payloads e Memória */}
      <div className="time-travel-content">
        <div className="inspector-tabs-bar">
          <button
            type="button"
            className={`inspector-tab ${activeTab === 'payloads' ? 'active' : ''}`}
            onClick={() => setActiveTab('payloads')}
          >
            <ChevronRight size={12} />
            <span>Payloads do Bloco</span>
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <Database size={12} />
            <span>Estado Global (Store)</span>
          </button>
          <button
            type="button"
            className={`inspector-tab ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => setActiveTab('variables')}
          >
            <Variable size={12} />
            <span>Variáveis de Escopo</span>
          </button>
        </div>

        <div className="inspector-body">
          {activeFrame ? (
            activeTab === 'payloads' ? (
              <div className="payloads-grid">
                <div className="payload-column">
                  <h4>Entradas no Passo (Inputs)</h4>
                  {Object.keys(activeFrame.inputs).length === 0 ? (
                    <p className="empty-text">Nenhuma entrada direta registrada.</p>
                  ) : (
                    <pre className="code-block">{JSON.stringify(activeFrame.inputs, null, 2)}</pre>
                  )}
                </div>

                <div className="payload-column">
                  <h4>Saídas Acumuladas (Outputs)</h4>
                  {Object.keys(activeFrame.outputs).length === 0 ? (
                    <p className="empty-text">Nenhuma saída gerada até este passo.</p>
                  ) : (
                    <pre className="code-block">{JSON.stringify(activeFrame.outputs, null, 2)}</pre>
                  )}
                </div>
              </div>
            ) : activeTab === 'store' ? (
              <div className="store-view">
                <h4>Memória Compartilhada do Projeto (Store)</h4>
                {Object.keys(activeFrame.store).length === 0 ? (
                  <p className="empty-text">Store de memória vazio no momento deste frame.</p>
                ) : (
                  <pre className="code-block">{JSON.stringify(activeFrame.store, null, 2)}</pre>
                )}
              </div>
            ) : (
              <div className="variables-view">
                <h4>Variáveis Locais de Execução</h4>
                {Object.keys(activeFrame.variables).length === 0 ? (
                  <p className="empty-text">Nenhuma variável local no escopo deste frame.</p>
                ) : (
                  <pre className="code-block">{JSON.stringify(activeFrame.variables, null, 2)}</pre>
                )}
              </div>
            )
          ) : (
            <p className="empty-text">Selecione um passo na linha do tempo para inspecionar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
