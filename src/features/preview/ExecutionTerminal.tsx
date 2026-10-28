import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square, TerminalSquare } from 'lucide-react';
import type { Simulation } from '../../state/useSimulation';

type Filter = 'all' | 'error';
const stateLabels: Record<string, string> = {
  idle: 'Aguardando',
  running: 'Executando',
  paused: 'Pausado',
  stopped: 'Interrompido',
  completed: 'Concluído',
  error: 'Erro',
};

export function ExecutionTerminal({ simulation }: { simulation: Simulation }) {
  const [filter, setFilter] = useState<Filter>('all');
  const end = useRef<HTMLDivElement>(null);
  const { terminal, clearTerminal, debuggerState, isExecuting } = simulation;
  const entries =
    filter === 'error'
      ? terminal.filter((item) => item.level === 'error' || item.level === 'warning')
      : terminal;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [terminal.length, filter]);
  return (
    <section className="playground-terminal" aria-label="Terminal de execução">
      <div className="terminal-title">
        <div>
          <TerminalSquare size={16} />
          <strong>Terminal de execução</strong>
        </div>
        <span className={`terminal-status status-${debuggerState.status}`}>
          {stateLabels[debuggerState.status] || debuggerState.status}
        </span>
      </div>
      <div className="terminal-toolbar">
        <label>
          Exibir{' '}
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            <option value="all">Todos os eventos</option>
            <option value="error">Erros e avisos</option>
          </select>
        </label>
        {isExecuting && debuggerState.status === 'running' && (
          <button type="button" onClick={simulation.debugPause} title="Pausar no próximo bloco">
            <Pause size={14} /> Pausar
          </button>
        )}
        {isExecuting && debuggerState.status === 'paused' && (
          <>
            <button type="button" onClick={simulation.debugContinue}>
              <Play size={14} /> Continuar
            </button>
            <button type="button" onClick={simulation.debugStep}>
              Próximo passo
            </button>
          </>
        )}
        {isExecuting &&
          (debuggerState.status === 'running' || debuggerState.status === 'paused') && (
            <button
              type="button"
              onClick={simulation.debugStop}
              title="Interromper no próximo bloco"
            >
              <Square size={13} /> Parar
            </button>
          )}
        <button type="button" onClick={clearTerminal} title="Limpar terminal">
          <RotateCcw size={14} /> Limpar
        </button>
      </div>
      <div className="terminal-log" role="log" aria-label="Eventos da execução" aria-live="polite">
        {entries.length ? (
          entries.map((entry, index) => (
            <div
              className={`terminal-line level-${entry.level}`}
              key={`${entry.timestamp}-${index}`}
            >
              <time>{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</time>
              <span className="terminal-level">
                {entry.level === 'error'
                  ? 'ERRO'
                  : entry.level === 'warning'
                    ? 'AVISO'
                    : entry.level === 'success'
                      ? 'OK'
                      : 'INFO'}
              </span>
              <span>
                {entry.message}
                {entry.blockId && <small> · #{entry.blockId}</small>}
              </span>
            </div>
          ))
        ) : (
          <p className="terminal-empty">
            {filter === 'error'
              ? 'Nenhum erro ou aviso registrado.'
              : 'Aguardando uma ação. Clique em um botão do aplicativo para acompanhar os blocos.'}
          </p>
        )}
        <div ref={end} />
      </div>
      <p className="terminal-note">
        Mostra os blocos, decisões e integrações executados. Valores de entrada e credenciais não
        são exibidos.
      </p>
    </section>
  );
}
