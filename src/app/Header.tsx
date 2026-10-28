import {
  Bug,
  ChevronRight,
  Clock,
  Code2,
  Database,
  FlaskConical,
  LayoutDashboard,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Square,
  StepForward,
  Workflow,
} from 'lucide-react';
import type { DebuggerStatus } from '../compiler/interpreter/debuggerTypes';

type Props = {
  workspaceMode: 'flow' | 'frontend' | 'datamodel';
  onWorkspaceMode: (mode: 'flow' | 'frontend' | 'datamodel') => void;
  projectName: string;
  onRenameProject: (name: string) => void;
  onSimulate: () => void;
  onViewCode: () => void;
  onOpenTests?: () => void;
  testCount?: number;
  onOpenReadiness?: () => void;
  // Controles do depurador visual
  debuggerStatus?: DebuggerStatus;
  debuggerCurrentBlockId?: string | null;
  debuggerFrameCount?: number;
  isTimeTravelOpen?: boolean;
  onStartDebug?: () => void;
  onContinueDebug?: () => void;
  onPauseDebug?: () => void;
  onStepDebug?: () => void;
  onStopDebug?: () => void;
  onResetDebug?: () => void;
  onToggleTimeTravel?: () => void;
};

export function Header({
  workspaceMode,
  onWorkspaceMode,
  projectName,
  onRenameProject,
  onSimulate,
  onViewCode,
  onOpenTests,
  testCount,
  onOpenReadiness,
  debuggerStatus,
  debuggerCurrentBlockId,
  debuggerFrameCount = 0,
  isTimeTravelOpen = false,
  onStartDebug,
  onContinueDebug,
  onPauseDebug,
  onStepDebug,
  onStopDebug,
  onResetDebug,
  onToggleTimeTravel,
}: Props) {
  const isPaused = debuggerStatus === 'paused';
  const isRunning = debuggerStatus === 'running';

  return (
    <header>
      <div className="brand">
        <span className="brand-symbol">
          <Workflow size={23} />
        </span>
        flowforge<span className="beta">BETA</span>
        <span
          className="saved-dot"
          title="Salvo localmente no navegador (IndexedDB)"
          aria-label="Status: Salvo localmente no navegador"
        />
      </div>
      <div className="project-breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={14} />
        <input
          aria-label="Nome do projeto"
          value={projectName}
          onChange={(e) => onRenameProject(e.target.value)}
        />
      </div>
      <div className="top-actions">
        <div className="workspace-mode" role="group" aria-label="Área de trabalho">
          <button
            type="button"
            aria-pressed={workspaceMode === 'flow'}
            className={workspaceMode === 'flow' ? 'active' : ''}
            onClick={() => onWorkspaceMode('flow')}
          >
            <Workflow size={14} />
            <span>Fluxos</span>
          </button>
          <button
            type="button"
            aria-pressed={workspaceMode === 'frontend'}
            className={workspaceMode === 'frontend' ? 'active' : ''}
            onClick={() => onWorkspaceMode('frontend')}
          >
            <LayoutDashboard size={14} />
            <span>Interface</span>
          </button>
          <button
            type="button"
            aria-pressed={workspaceMode === 'datamodel'}
            className={workspaceMode === 'datamodel' ? 'active' : ''}
            onClick={() => onWorkspaceMode('datamodel')}
          >
            <Database size={14} />
            <span>Modelagem de Dados</span>
          </button>
        </div>
        {/* Controles de Depuração Visual */}
        {onStartDebug && (
          <>
            {isPaused ? (
              <button
                type="button"
                className="secondary debug-btn success"
                onClick={onContinueDebug}
                title={`Continuar Execução (Pausado em #${debuggerCurrentBlockId || 'bloco'})`}
                aria-label="Continuar Execução"
              >
                <Play size={16} />
              </button>
            ) : isRunning ? (
              <button
                type="button"
                className="secondary debug-btn warning"
                onClick={onPauseDebug}
                title="Pausar Execução do Fluxo"
                aria-label="Pausar Execução"
              >
                <Pause size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="secondary debug-btn"
                onClick={onStartDebug}
                title="Iniciar Depuração Passo a Passo"
                aria-label="Iniciar Depuração"
              >
                <Bug size={16} />
              </button>
            )}

            <button
              type="button"
              className="secondary debug-btn"
              onClick={onStepDebug}
              disabled={!isPaused && debuggerStatus !== 'idle'}
              title="Avançar 1 Passo (Step Over)"
              aria-label="Avançar Passo"
            >
              <StepForward size={16} />
            </button>

            <button
              type="button"
              className="secondary debug-btn danger"
              onClick={onStopDebug}
              disabled={!debuggerStatus || debuggerStatus === 'idle'}
              title="Parar Depuração"
              aria-label="Parar Depuração"
            >
              <Square size={16} />
            </button>

            <button
              type="button"
              className="secondary debug-btn"
              onClick={onResetDebug}
              title="Reiniciar Depurador"
              aria-label="Reiniciar Depurador"
            >
              <RotateCcw size={16} />
            </button>

            <button
              type="button"
              className={`secondary debug-btn ${isTimeTravelOpen ? 'active' : ''}`}
              onClick={onToggleTimeTravel}
              disabled={debuggerFrameCount === 0}
              title={`Linha do Tempo e Time-Travel Trace (${debuggerFrameCount} frames)`}
              aria-label="Linha do Tempo e Time-Travel"
            >
              <Clock size={16} />
              {debuggerFrameCount > 0 && <span className="icon-badge">{debuggerFrameCount}</span>}
            </button>

            <div className="header-divider" />
          </>
        )}

        {/* Ferramentas do Projeto */}
        {onOpenTests && (
          <button
            type="button"
            className="secondary"
            onClick={onOpenTests}
            title={`Cenários de Teste E2E${testCount !== undefined ? ` (${testCount})` : ''}`}
            aria-label="Cenários de Teste E2E"
          >
            <FlaskConical size={16} />
            {testCount !== undefined && testCount > 0 && (
              <span className="icon-badge">{testCount}</span>
            )}
          </button>
        )}
        {onOpenReadiness && (
          <button
            type="button"
            className="secondary"
            onClick={onOpenReadiness}
            title="Checklist de Prontidão de Produção (Release v1.0.0)"
            aria-label="Checklist de Prontidão de Produção"
          >
            <Rocket size={16} />
          </button>
        )}

        <button
          type="button"
          className="secondary"
          onClick={onViewCode}
          title="Visualizar Código Gerado por Tela"
          aria-label="Visualizar Código Gerado por Tela"
        >
          <Code2 size={16} />
        </button>
        <button
          type="button"
          className="primary"
          onClick={onSimulate}
          title="Simular Execução do App"
          aria-label="Simular Execução do App"
        >
          <Play size={16} />
        </button>
      </div>
    </header>
  );
}
