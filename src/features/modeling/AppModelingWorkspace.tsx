import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Download,
  Eye,
  GitBranch,
  HelpCircle,
  Layers,
  ListChecks,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Scale,
  Sparkles,
  Trash2,
  Unlink,
  Workflow,
  X,
} from 'lucide-react';
import type { Graph } from '../../engine';
import {
  MODELING_STEPS,
  analyzeElementDeletionImpact,
  applyAppModelingToGraph,
  buildTraceabilityMatrix,
  createOrderApprovalReferenceModeling,
  detachGeneratedArtifact,
  ensureAppModeling,
  evaluateBusinessRule,
  executeModeledOperation,
  generateAppSpecificationMarkdown,
  validateAppModeling,
  type AcceptanceScenarioSpec,
  type ApiContractSpec,
  type AppModeling,
  type AppRequirement,
  type AppSpecification,
  type DecisionHitPolicy,
  type DecisionRow,
  type LifecycleSpec,
  type ModelingStepId,
  type OperationSpec,
  type PermissionPolicySpec,
  type PermissionScope,
  type ReconciliationSummary,
  type RuleComparisonOperator,
  type UseCaseSpec,
} from '../../engine/appModeling';
import type { Simulation } from '../../state/useSimulation';
import { DataModelEditor } from '../datamodel/DataModelEditor';
import { InlineIssues, ModelingSection } from './ModelingSection';

type Props = {
  graph: Graph;
  commit: (update: (graph: Graph) => Graph) => void;
  notify: (msg: string) => void;
  simulation: Simulation;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  initialStepId?: ModelingStepId;
  onNavigateToFlows: (filterFlowId?: string | null, selectBlockId?: string | null) => void;
};

type OverlayTool =
  | 'changes'
  | 'blocks'
  | 'simulator'
  | 'docs'
  | 'architecture'
  | 'adrs'
  | 'quality'
  | 'traceability'
  | null;

export function AppModelingWorkspace({
  graph,
  commit,
  notify,
  simulation,
  undo,
  redo,
  canUndo,
  canRedo,
  initialStepId,
  onNavigateToFlows,
}: Props) {
  const [modeling, setModeling] = useState<AppModeling>(() => ensureAppModeling(graph));
  const [activeStepId, setActiveStepId] = useState<ModelingStepId>(initialStepId || 'vision');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [stageDetailsOpen, setStageDetailsOpen] = useState(false);
  const [overlayTool, setOverlayTool] = useState<OverlayTool>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [lastReconciliation, setLastReconciliation] = useState<ReconciliationSummary | null>(null);

  // Estado de simulação interativa de cenário/operação
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [scenarioRunResult, setScenarioRunResult] = useState<ReturnType<
    typeof executeModeledOperation
  > | null>(null);

  // Modal de análise de impacto antes de exclusão (Seção 7, Regra 6)
  const [pendingDeletion, setPendingDeletion] = useState<{
    elementType: 'requirement' | 'rule' | 'policy' | 'lifecycle' | 'operation';
    elementId: string;
    elementName: string;
    dependents: Array<{ kind: string; id: string; name: string }>;
    onConfirmCascade: () => void;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayTool) return;
    const previousFocus = document.activeElement;
    const fallbackFocus = moreMenuRef.current?.querySelector<HTMLButtonElement>('button');
    overlayRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      } else {
        fallbackFocus?.focus();
      }
    };
  }, [overlayTool]);

  useEffect(() => {
    setModeling(ensureAppModeling(graph));
  }, [graph]);

  useEffect(() => {
    if (initialStepId) {
      setActiveStepId(initialStepId);
    }
  }, [initialStepId]);

  // Escuta evento global quando o usuário clica em "Modelado · Editar" num bloco do canvas
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ stepId?: ModelingStepId }>).detail;
      if (detail?.stepId) {
        setActiveStepId(detail.stepId);
      }
    };
    window.addEventListener('flowforge:open-modeling-step', handler);
    return () => window.removeEventListener('flowforge:open-modeling-step', handler);
  }, []);

  // Fecha menus ao clicar fora ou pressionar Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setMoreMenuOpen(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const validation = useMemo(() => validateAppModeling(graph, modeling), [graph, modeling]);

  const currentStepStatus = useMemo(
    () =>
      validation.stepStatuses.find((s) => s.stepId === activeStepId) || validation.stepStatuses[0],
    [validation.stepStatuses, activeStepId],
  );

  const traceabilityMatrix = useMemo(
    () => buildTraceabilityMatrix(modeling.draft, modeling.generation),
    [modeling.draft, modeling.generation],
  );

  // Atualiza rascunho sem alterar blocos executáveis do grafo (Seção 3.3)
  const updateDraft = (updater: (prev: AppSpecification) => AppSpecification) => {
    setModeling((prev) => {
      const nextDraft = updater(prev.draft);
      const nextSteps = prev.steps.map((s) =>
        s.stepId === activeStepId && s.fillStatus === 'not_started'
          ? { ...s, fillStatus: 'editing' as const, lastSavedAt: new Date().toISOString() }
          : s,
      );
      const nextModeling: AppModeling = {
        ...prev,
        draft: nextDraft,
        steps: nextSteps,
      };
      commit((g) => ({
        ...g,
        appModeling: nextModeling,
      }));
      return nextModeling;
    });
  };

  // Salvar rascunho explícito (Seção 3.2)
  const handleSaveDraft = () => {
    const now = new Date().toISOString();
    setModeling((prev) => {
      const nextSteps = prev.steps.map((s) =>
        s.stepId === activeStepId
          ? {
              ...s,
              fillStatus: s.fillStatus === 'not_started' ? ('editing' as const) : s.fillStatus,
              lastSavedAt: now,
            }
          : s,
      );
      const next: AppModeling = { ...prev, steps: nextSteps };
      commit((g) => ({ ...g, appModeling: next }));
      return next;
    });
    const msg = `Rascunho da etapa "${currentStepStatus.meta.shortTitle}" salvo sem alterar o grafo executável.`;
    setLiveAnnouncement(msg);
    notify(msg);
  };

  // Concluir etapa e aplicar geração incremental (Seções 3.2, 6.2 e 7)
  const handleCompleteStep = (forceOverwrite = false) => {
    if (!currentStepStatus.canComplete) {
      const errMsg = `Não é possível concluir "${currentStepStatus.meta.shortTitle}": resolva as ${currentStepStatus.pendingIssuesCount} pendências primeiro.`;
      setLiveAnnouncement(errMsg);
      notify(errMsg);
      return;
    }

    const result = applyAppModelingToGraph(graph, modeling, {
      stepId: activeStepId,
      forceOverwriteConflicts: forceOverwrite,
    });

    setLastReconciliation(result.summary);
    commit(() => result.graph);
    if (result.graph.appModeling) {
      setModeling(result.graph.appModeling);
    }

    const msg = currentStepStatus.meta.generatesBlocks
      ? `Etapa "${currentStepStatus.meta.shortTitle}" concluída! Criados: ${result.summary.createdBlocks.length}, Atualizados: ${result.summary.updatedBlocks.length}.`
      : `Etapa "${currentStepStatus.meta.shortTitle}" concluída e especificações registradas!`;
    setLiveAnnouncement(msg);
    notify(msg);
  };

  // Marcar etapa opcional como "Não se aplica" (Seção 3.3)
  const handleMarkNotApplicable = () => {
    if (!currentStepStatus.meta.optional) return;
    setModeling((prev) => {
      const nextSteps = prev.steps.map((s) =>
        s.stepId === activeStepId
          ? {
              ...s,
              fillStatus:
                s.fillStatus === 'not_applicable'
                  ? ('editing' as const)
                  : ('not_applicable' as const),
              notApplicableReason: 'Dispensada pelo arquiteto do projeto.',
            }
          : s,
      );
      const next: AppModeling = { ...prev, steps: nextSteps };
      commit((g) => ({ ...g, appModeling: next }));
      return next;
    });
  };

  // Carregar Cenário de Referência Obrigatório (Seção 11: Aprovação de Pedidos por Organização)
  const handleLoadOrderApprovalReference = () => {
    const refModeling = createOrderApprovalReferenceModeling();
    const res = applyAppModelingToGraph(graph, refModeling);
    setModeling(res.graph.appModeling!);
    setLastReconciliation(res.summary);
    commit(() => res.graph);
    notify(
      'Cenário de Referência "Aprovação de Pedidos por Organização (R$ 5.000)" carregado e sincronizado!',
    );
  };

  const handleNextStep = () => {
    const idx = MODELING_STEPS.findIndex((s) => s.id === activeStepId);
    if (idx >= 0 && idx + 1 < MODELING_STEPS.length) {
      setActiveStepId(MODELING_STEPS[idx + 1].id);
    }
  };

  const handleExportMarkdownSpec = () => {
    const md = generateAppSpecificationMarkdown(graph);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-arquitetura.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Especificação arquitetural (.md) exportada com sucesso!');
  };

  // Executa exclusão protegida com análise de impacto (Seção 7, Regra 6)
  const requestSafeDelete = (
    elementType: 'requirement' | 'rule' | 'policy' | 'lifecycle' | 'operation',
    elementId: string,
    elementName: string,
    onDeleteClean: () => void,
  ) => {
    const impact = analyzeElementDeletionImpact(modeling.draft, elementType, elementId);
    if (impact.canDeleteDirectly) {
      onDeleteClean();
      return;
    }
    setPendingDeletion({
      elementType,
      elementId,
      elementName,
      dependents: impact.dependents,
      onConfirmCascade: () => {
        onDeleteClean();
        setPendingDeletion(null);
      },
    });
  };

  const focusIssue = (elementId: string | undefined, issueId: string) => {
    setStageDetailsOpen(false);
    requestAnimationFrame(() => {
      const exact = document.getElementById(`field-${issueId}`);
      const target =
        exact ||
        (elementId
          ? [...document.querySelectorAll<HTMLElement>('[data-model-element-id]')].find(
              (node) => node.dataset.modelElementId === elementId,
            )
          : document.getElementById(`target-${issueId}`) ||
            document.querySelector<HTMLElement>('.modeling-step-content'));
      if (!target) return;
      let parent: HTMLElement | null = target;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      const field =
        exact ||
        target.querySelector<HTMLElement>('[aria-invalid="true"]') ||
        target.querySelector<HTMLElement>('input, select, textarea, button');
      (field || target).scrollIntoView({ block: 'center', behavior: 'smooth' });
      field?.focus({ preventScroll: true });
    });
  };

  const spec = modeling.draft;
  const generatedBlocksForCurrentStep = modeling.generation.artifacts.filter(
    (a) => a.sourceStep === activeStepId && a.artifactKind === 'block',
  );

  return (
    <div className={`app-modeling-workspace ${activeStepId === 'data' ? 'is-data-step' : ''}`}>
      {/* Região ARIA Live para anúncio de validações a tecnologias assistivas (Seção 3.1) */}
      <div className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* 1. Barra de Ferramentas Principal da Modelagem (Seção 3.1) */}
      <div className="modeling-workspace-heading">
        <div>
          <span className="modeling-workspace-eyebrow">PLANEJAMENTO DO APLICATIVO</span>
          <h1>Modelagem</h1>
          <p>Defina as regras e a estrutura do aplicativo.</p>
        </div>
        <div className="modeling-progress">
          <span>
            {validation.completedValidCount} de {validation.applicableStepsCount} etapas concluídas
          </span>
          <progress
            value={validation.completedValidCount}
            max={validation.applicableStepsCount || 1}
            aria-label="Progresso da modelagem"
          />
        </div>
      </div>
      <div
        className="modeling-toolbar"
        role="toolbar"
        aria-label="Barra de ferramentas da Modelagem"
      >
        <div className="modeling-toolbar-left">
          {/* Dropdown de Etapas: [Etapas: X/9 concluídas ▾] */}
          <div className="modeling-steps-dropdown-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="modeling-steps-trigger"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <Compass size={15} />
              <span className="modeling-step-selection">
                <span className="steps-counter-badge">
                  Etapa {currentStepStatus.meta.number} de 9
                </span>
                <span className="current-step-pill">{currentStepStatus.meta.shortTitle}</span>
              </span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div
                className="modeling-steps-dropdown-menu"
                role="listbox"
                aria-label="Etapas da Modelagem de Aplicativo"
              >
                <div className="dropdown-menu-header">
                  <span>ETAPAS DA MODELAGEM</span>
                  <small>
                    {validation.isModelingReady
                      ? '✓ Modelagem pronta'
                      : 'Preencha na ordem desejada'}
                  </small>
                </div>
                {validation.stepStatuses.map((st) => {
                  const isSelected = st.stepId === activeStepId;
                  return (
                    <button
                      key={st.stepId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`modeling-step-option ${isSelected ? 'active' : ''} status-${st.consistencyStatus}`}
                      onClick={() => {
                        setActiveStepId(st.stepId);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="step-option-main">
                        <span className="step-option-title">{st.meta.title}</span>
                        <span className={`step-option-state state-${st.consistencyStatus}`}>
                          {st.statusLabel}
                        </span>
                      </div>
                      <div className="step-option-meta">
                        {st.pendingIssuesCount > 0 ? (
                          <span className="step-pending-badge">
                            {st.pendingIssuesCount} pendência(s)
                          </span>
                        ) : (
                          <span className="step-ok-badge">Sem pendências</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <>
            <span
              className={`step-status-pill state-${currentStepStatus.consistencyStatus}`}
              title={currentStepStatus.meta.description}
            >
              {currentStepStatus.statusLabel}
            </span>
            <button
              type="button"
              className={`secondary modeling-tool-btn ${stageDetailsOpen ? 'active' : ''}`}
              aria-expanded={stageDetailsOpen}
              aria-controls="modeling-stage-details"
              onClick={() => setStageDetailsOpen((open) => !open)}
            >
              <HelpCircle size={14} /> Detalhes da etapa
            </button>
          </>

          {currentStepStatus.issues.length > 0 && (
            <button
              type="button"
              className="modeling-pending-trigger"
              onClick={() => {
                setStageDetailsOpen(true);
                requestAnimationFrame(() =>
                  document
                    .getElementById('modeling-stage-issues')
                    ?.scrollIntoView({ block: 'nearest' }),
                );
              }}
            >
              <AlertTriangle size={14} />
              {currentStepStatus.issues.length} pendências
            </button>
          )}
          {/* Botão Validar */}
          <button
            type="button"
            className="secondary modeling-tool-btn"
            onClick={() => {
              const errCount = validation.issues.filter((i) => i.severity === 'error').length;
              const warnCount = validation.issues.filter((i) => i.severity === 'warning').length;
              const msg =
                errCount === 0 && warnCount === 0
                  ? 'Validação concluída: todas as 9 etapas estão consistentes e sem erros!'
                  : `Validação: ${errCount} erro(s) impeditivo(s) e ${warnCount} aviso(s) encontrados.`;
              setLiveAnnouncement(msg);
              notify(msg);
            }}
          >
            <CheckCircle2 size={14} />
            <span>Validar</span>
            {validation.issues.length > 0 && (
              <span className="modeling-badge-count">{validation.issues.length}</span>
            )}
          </button>

          <div className="modeling-more-wrap" ref={moreMenuRef}>
            <button
              type="button"
              className="secondary modeling-tool-btn"
              aria-label="Ferramentas de modelagem"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={15} />
              <span>Ferramentas</span>
            </button>
            {moreMenuOpen && (
              <div className="modeling-more-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('changes');
                    setMoreMenuOpen(false);
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Ver alterações</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('blocks');
                    setMoreMenuOpen(false);
                  }}
                >
                  <Workflow size={14} />
                  <span>Ver blocos</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (!selectedScenarioId && spec.scenarios[0])
                      setSelectedScenarioId(spec.scenarios[0].id);
                    setOverlayTool('simulator');
                    setMoreMenuOpen(false);
                  }}
                >
                  <Play size={14} />
                  <span>Simular cenário</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('docs');
                    setMoreMenuOpen(false);
                  }}
                >
                  <BookOpen size={14} />
                  <span>Documentação</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('architecture');
                    setMoreMenuOpen(false);
                  }}
                >
                  <Layers size={14} />
                  <span>Visualizar Arquitetura (C4 & UML)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('traceability');
                    setMoreMenuOpen(false);
                  }}
                >
                  <GitBranch size={14} />
                  <span>Matriz de Rastreabilidade</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('adrs');
                    setMoreMenuOpen(false);
                  }}
                >
                  <Scale size={14} />
                  <span>Decisões Arquiteturais (ADRs)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverlayTool('quality');
                    setMoreMenuOpen(false);
                  }}
                >
                  <Activity size={14} />
                  <span>Metas de Qualidade e Evidências</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportMarkdownSpec();
                    setMoreMenuOpen(false);
                  }}
                >
                  <Download size={14} />
                  <span>Exportar Especificação (.md)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleLoadOrderApprovalReference();
                    setMoreMenuOpen(false);
                  }}
                >
                  <Sparkles size={14} />
                  <span>Carregar Exemplo: Aprovação de Pedidos (R$ 5.000)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Indicadores de Revisão e Desfazer/Refazer (Seção 3.1 e 3.3) */}
        <div className="modeling-toolbar-right">
          <span
            className={`revision-status-pill ${modeling.applied ? 'applied' : 'draft-only'}`}
            title="A simulação e exportação utilizam sempre a última revisão aplicada"
          >
            {modeling.applied
              ? `Revisão Aplicada #${modeling.generation.appliedRevision}`
              : 'Rascunho · não aplicado'}
          </span>
          {activeStepId !== 'data' && (
            <>
              <button
                type="button"
                className="secondary icon-btn"
                onClick={undo}
                disabled={!canUndo}
                title={canUndo ? 'Desfazer alteração' : 'Nada para desfazer'}
                aria-label="Desfazer"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                className="secondary icon-btn"
                onClick={redo}
                disabled={!canRedo}
                title={canRedo ? 'Refazer alteração' : 'Nada para refazer'}
                aria-label="Refazer"
              >
                <RotateCw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Painel Overlay de Ferramentas Complementares (quando aberto na barra) */}
      {overlayTool && (
        <>
          <div
            className="modeling-overlay-backdrop"
            onClick={() => setOverlayTool(null)}
            aria-hidden="true"
          />
          <div
            ref={overlayRef}
            className="modeling-overlay-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Ferramenta da Modelagem"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setOverlayTool(null);
              }
            }}
          >
            <div className="overlay-drawer-header">
              <strong>
                {overlayTool === 'changes' && 'Plano de Alterações e Reconciliação Incremental'}
                {overlayTool === 'blocks' && 'Blocos Gerados e Vínculo com o Canvas de Fluxos'}
                {overlayTool === 'simulator' &&
                  'Simulador de Operações e Cenários (Mesma Semântica do Servidor)'}
                {overlayTool === 'docs' && 'Especificação Arquitetural Viva'}
                {overlayTool === 'architecture' &&
                  'Visões Derivadas: Arquitetura C4 e UML (Sequência / Estados)'}
                {overlayTool === 'traceability' &&
                  'Matriz de Rastreabilidade Bidirecional (Requisito → Caso de Uso → Regra → Operação → Blocos → Teste)'}
                {overlayTool === 'adrs' && 'Registros de Decisões Arquiteturais (ADRs)'}
                {overlayTool === 'quality' && 'Requisitos de Qualidade, Auditoria e Medição'}
              </strong>
              <button
                type="button"
                className="secondary icon-btn"
                onClick={() => setOverlayTool(null)}
                aria-label="Fechar painel"
              >
                <X size={15} />
              </button>
            </div>

            <div className="overlay-drawer-body">
              {overlayTool === 'changes' && (
                <div className="reconciliation-panel">
                  <p>
                    Hash semântico do rascunho atual vs revisão aplicada #
                    {modeling.generation.appliedRevision}:{' '}
                    <code>{modeling.generation.specSemanticHash}</code>
                  </p>
                  {lastReconciliation ? (
                    <div className="reconcile-stats-grid">
                      <div className="reconcile-stat-card">
                        <span>Criados na última aplicação</span>
                        <strong>{lastReconciliation.createdBlocks.length}</strong>
                        <small>{lastReconciliation.createdBlocks.join(', ') || 'Nenhum'}</small>
                      </div>
                      <div className="reconcile-stat-card">
                        <span>Atualizados sem duplicar</span>
                        <strong>{lastReconciliation.updatedBlocks.length}</strong>
                        <small>{lastReconciliation.updatedBlocks.join(', ') || 'Nenhum'}</small>
                      </div>
                      <div className="reconcile-stat-card">
                        <span>Desvinculados / Manuais preservados</span>
                        <strong>{lastReconciliation.preservedManualBlocks.length}</strong>
                        <small>
                          {lastReconciliation.preservedManualBlocks.join(', ') || 'Nenhum'}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <p className="muted-note">
                      Clique em <strong>Concluir etapa</strong> ou{' '}
                      <strong>Aplicar alterações</strong> no rodapé para reconciliar o rascunho com
                      o grafo executável.
                    </p>
                  )}

                  {lastReconciliation && lastReconciliation.conflicts.length > 0 && (
                    <div className="conflicts-alert-box">
                      <h4>
                        <AlertTriangle size={15} /> Conflitos Semânticos Detectados (3 vias)
                      </h4>
                      <ul>
                        {lastReconciliation.conflicts.map((c, idx) => (
                          <li key={idx}>
                            Bloco <code>#{c.artifactId}</code> ({c.field}): valor manual{' '}
                            <code>{c.currentManualValue}</code> diverge do modelo{' '}
                            <code>{c.proposedModelValue}</code>.
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleCompleteStep(true)}
                      >
                        Priorizar Modelo e Atualizar Blocos
                      </button>
                    </div>
                  )}
                </div>
              )}

              {overlayTool === 'blocks' && (
                <div className="generated-blocks-list">
                  {modeling.generation.artifacts.filter((a) => a.artifactKind === 'block')
                    .length === 0 ? (
                    <p className="muted-note">
                      Nenhum bloco gerado ainda. Conclua uma etapa executável (Dados, Permissões,
                      Regras, Operações ou APIs) para gerar blocos determinísticos.
                    </p>
                  ) : (
                    <table className="modeling-table">
                      <thead>
                        <tr>
                          <th>ID do Bloco</th>
                          <th>Etapa de Origem</th>
                          <th>Papel Semântico</th>
                          <th>Controle</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modeling.generation.artifacts
                          .filter((a) => a.artifactKind === 'block')
                          .map((art) => (
                            <tr key={art.artifactId}>
                              <td>
                                <code>#{art.artifactId}</code>
                              </td>
                              <td>{art.sourceStep}</td>
                              <td>{art.role}</td>
                              <td>
                                {art.detached ? (
                                  <span className="badge-warn">Manual (Desvinculado)</span>
                                ) : (
                                  <span className="badge-ok">Gerenciado pelo Modelo</span>
                                )}
                              </td>
                              <td className="table-actions-cell">
                                <button
                                  type="button"
                                  className="secondary small-btn"
                                  onClick={() => onNavigateToFlows(null, art.artifactId)}
                                >
                                  <Eye size={12} /> Abrir no Canvas
                                </button>
                                {!art.detached && (
                                  <button
                                    type="button"
                                    className="secondary small-btn"
                                    title="Passa este bloco para controle manual sem sobrescrevê-lo nas próximas gerações"
                                    onClick={() => {
                                      commit((g) => detachGeneratedArtifact(g, art.artifactId));
                                      notify(
                                        `Bloco #${art.artifactId} desvinculado da geração automática.`,
                                      );
                                    }}
                                  >
                                    <Unlink size={12} /> Desvincular
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {overlayTool === 'simulator' && (
                <div className="scenario-simulator-panel">
                  <div className="simulator-controls-row">
                    <label>
                      Cenário cadastrado:
                      <select
                        value={selectedScenarioId}
                        onChange={(e) => {
                          setSelectedScenarioId(e.target.value);
                          setScenarioRunResult(null);
                        }}
                      >
                        {spec.scenarios.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.code} — {sc.name} ({sc.category})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        const sc =
                          spec.scenarios.find((s) => s.id === selectedScenarioId) ||
                          spec.scenarios[0];
                        if (!sc) return;
                        const res = executeModeledOperation(spec, {
                          operationId: sc.operationId,
                          actor: {
                            userId: sc.actorUserId,
                            role: sc.actorRole,
                            orgId: sc.actorOrgId,
                            authenticated: Boolean(sc.actorUserId),
                          },
                          payload: sc.inputPayload,
                          existingRecord: sc.initialRecordState || null,
                        });
                        setScenarioRunResult(res);
                      }}
                    >
                      <Play size={14} /> Executar Cenário no Motor de Regras
                    </button>
                  </div>

                  {scenarioRunResult && (
                    <div
                      className={`scenario-result-card ${scenarioRunResult.ok ? 'res-ok' : 'res-fail'}`}
                    >
                      <div className="scenario-result-header">
                        <strong>
                          Status HTTP {scenarioRunResult.status} —{' '}
                          {scenarioRunResult.ok ? 'PERMITIDO / SUCESSO' : 'BLOQUEADO / ERRO'}
                        </strong>
                        {scenarioRunResult.outcome && (
                          <span className="outcome-pill">Decisão: {scenarioRunResult.outcome}</span>
                        )}
                        {scenarioRunResult.error && (
                          <span className="error-code-pill">
                            {scenarioRunResult.error.code}: {scenarioRunResult.error.message}
                          </span>
                        )}
                      </div>
                      <div className="scenario-trace-list">
                        <small>Trilha de auditoria do servidor (Dados Simulados):</small>
                        <ol>
                          {scenarioRunResult.trace.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {overlayTool === 'docs' && (
                <div className="docs-preview-panel">
                  <pre className="markdown-preview-box">
                    {generateAppSpecificationMarkdown(graph)}
                  </pre>
                </div>
              )}

              {overlayTool === 'architecture' && (
                <div className="architecture-views-grid">
                  <div className="arch-diagram-card">
                    <h4>Arquitetura C4 — Contexto e Containers (Derivado da Revisão)</h4>
                    <p className="muted-note">
                      Visão conceitual derivada dos contratos locais e sistemas externos declarados.
                    </p>
                    <div className="c4-visual-boxes">
                      <div className="c4-box actor">
                        <small>Atores ({spec.actors.length})</small>
                        <strong>{spec.actors.map((a) => a.name).join(', ') || 'Usuários'}</strong>
                      </div>
                      <ArrowRight size={18} />
                      <div className="c4-box system">
                        <small>Aplicação & Gateway Backend</small>
                        <strong>{graph.name}</strong>
                        <span>
                          {spec.operations.length} Operações · {spec.policies.length} Políticas ·{' '}
                          {spec.rules.length} Regras
                        </span>
                      </div>
                      <ArrowRight size={18} />
                      <div className="c4-box db">
                        <small>Persistência Transacional</small>
                        <strong>{(graph.dataModel?.dialect || 'postgres').toUpperCase()}</strong>
                        <span>
                          {spec.entityGovernance.map((g) => g.tableName).join(', ') || 'pedidos'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="arch-diagram-card">
                    <h4>UML — Máquina de Estados e Sequência Síncrona</h4>
                    {spec.lifecycles.map((lc) => (
                      <div key={lc.id} className="uml-lifecycle-strip">
                        <div className="uml-strip-title">
                          <strong>{lc.name}</strong>
                          <span className="uml-entity-tag">
                            {lc.targetEntity}.{lc.stateField}
                          </span>
                        </div>
                        <div className="state-pills-flow">
                          {lc.states.map((st, idx) => (
                            <div key={st} className="state-flow-step">
                              <span
                                className={`state-node-pill ${st === lc.initialState ? 'is-initial' : ''} ${lc.finalStates.includes(st) ? 'is-final' : ''}`}
                              >
                                {st}
                              </span>
                              {idx < lc.states.length - 1 && (
                                <span className="state-flow-arrow">→</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="uml-sequence-strip">
                      <strong>Sequência Padrão do Servidor:</strong>
                      <div className="uml-sequence-timeline">
                        {[
                          'Entrada',
                          'Autenticação',
                          'Política',
                          'Validação',
                          'Regra',
                          'Transação DB',
                          'Resultado',
                        ].map((step, idx) => (
                          <div key={step} className="uml-seq-step">
                            <span className="uml-seq-number">{idx + 1}</span>
                            <span className="uml-seq-label">{step}</span>
                            {idx < 6 && <span className="uml-seq-arrow">→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {overlayTool === 'traceability' && (
                <div className="traceability-table-wrap">
                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Requisito</th>
                        <th>Casos de Uso</th>
                        <th>Políticas & Regras</th>
                        <th>Operações</th>
                        <th>Blocos</th>
                        <th>Cenários de Teste</th>
                        <th>Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traceabilityMatrix.map((row) => (
                        <tr key={row.requirement.id}>
                          <td>
                            <strong>{row.requirement.code}</strong> — {row.requirement.title}
                          </td>
                          <td>{row.useCases.map((u) => u.code).join(', ') || '—'}</td>
                          <td>
                            {[
                              ...row.rules.map((r) => r.code),
                              ...row.policies.map((p) => p.name),
                            ].join(', ') || '—'}
                          </td>
                          <td>{row.operations.map((o) => o.code).join(', ') || '—'}</td>
                          <td>{row.generatedBlockIds.length} bloco(s)</td>
                          <td>{row.scenarios.map((s) => s.code).join(', ') || '—'}</td>
                          <td>
                            {row.isFullyCovered ? (
                              <span className="badge-ok">Coberto</span>
                            ) : (
                              <span className="badge-warn">Incompleto</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {overlayTool === 'adrs' && (
                <div className="adrs-panel">
                  <div className="section-header-inline">
                    <span>Decisões Arquiteturais Registradas ({spec.adrs.length})</span>
                    <button
                      type="button"
                      className="secondary small-btn"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          adrs: [
                            ...prev.adrs,
                            {
                              id: `adr_${Date.now()}`,
                              code: `ADR-00${prev.adrs.length + 1}`,
                              title: 'Nova Decisão Arquitetural',
                              status: 'accepted',
                              context: 'Contexto técnico e de negócio.',
                              decision: 'Decisão adotada.',
                              alternatives: ['Alternativa A'],
                              consequences: 'Impacto esperado.',
                              owner: 'Equipe',
                            },
                          ],
                        }))
                      }
                    >
                      <Plus size={12} /> Adicionar ADR
                    </button>
                  </div>
                  <div className="adr-cards-list">
                    {spec.adrs.map((adr) => (
                      <div key={adr.id} className="adr-item-card">
                        <strong>
                          {adr.code}: {adr.title} ({adr.status})
                        </strong>
                        <p>
                          <em>Contexto:</em> {adr.context}
                        </p>
                        <p>
                          <em>Decisão:</em> {adr.decision}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overlayTool === 'quality' && (
                <div className="quality-panel">
                  <p className="muted-note">
                    Uma meta cadastrada não equivale a uma garantia implementada; evidência e
                    medição são registradas separadamente.
                  </p>
                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Métrica</th>
                        <th>Alvo</th>
                        <th>Método de Verificação</th>
                        <th>Estado da Evidência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.qualityTargets.map((qt) => (
                        <tr key={qt.id}>
                          <td>{qt.category.toUpperCase()}</td>
                          <td>{qt.metricName}</td>
                          <td>
                            <code>{qt.targetValue}</code>
                          </td>
                          <td>{qt.verificationMethod}</td>
                          <td>
                            <span
                              className={
                                qt.evidenceStatus === 'verified' ? 'badge-ok' : 'badge-warn'
                              }
                            >
                              {qt.evidenceStatus === 'verified'
                                ? 'Verificado por Cenários'
                                : 'Apenas Declarado (Sem medição)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 3. Corpo Principal da Etapa (Formulário/Tabela/Diagrama Central + Painel Contextual Direito) */}
      <div className="modeling-main-layout">
        <div className="modeling-stage-center">
          {/* Conteúdo Específico de Cada uma das 9 Etapas */}
          <div className="modeling-step-content" key={activeStepId}>
            <InlineIssues
              issues={currentStepStatus.issues.filter(
                (issue) => !issue.elementId && issue.id !== 'vis_problem',
              )}
            />
            {/* ETAPA 1: VISÃO E ESCOPO */}
            {activeStepId === 'vision' && (
              <div className="step-form-sections">
                <ModelingSection
                  title={<>Problema, Público-Alvo e Limites do MVP</>}
                  summary={
                    spec.vision.problemStatement.trim() ? 'Problema descrito' : 'A preencher'
                  }
                >
                  <div className="form-grid-2">
                    <label className="modeling-field">
                      <span>Problema de negócio a resolver *</span>
                      <textarea
                        rows={3}
                        value={spec.vision.problemStatement}
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            vision: { ...prev.vision, problemStatement: e.target.value },
                          }))
                        }
                        id="field-vis_problem"
                        aria-invalid={currentStepStatus.issues.some(
                          (issue) => issue.id === 'vis_problem',
                        )}
                        aria-describedby={
                          currentStepStatus.issues.some((issue) => issue.id === 'vis_problem')
                            ? 'issue-vis_problem'
                            : undefined
                        }
                      />
                      <InlineIssues
                        issues={currentStepStatus.issues.filter(
                          (issue) => issue.id === 'vis_problem',
                        )}
                      />
                    </label>
                    <label className="modeling-field">
                      <span>Público-alvo e organizações *</span>
                      <textarea
                        rows={3}
                        value={spec.vision.targetAudience}
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            vision: { ...prev.vision, targetAudience: e.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>
                </ModelingSection>

                <ModelingSection
                  title={<>Requisitos Funcionais e Critérios de Aceitação Verificáveis</>}
                  summary={`${spec.vision.requirements.length} requisitos`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>
                        Cada requisito possui um ID estável que será rastreado até os casos de uso,
                        regras, blocos e testes.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const nextNum = spec.vision.requirements.length + 1;
                        const newReq: AppRequirement = {
                          id: `req_${Date.now()}`,
                          code: `REQ-0${nextNum}`,
                          title: `Novo Requisito ${nextNum}`,
                          description: 'Descreva o comportamento exigido.',
                          priority: 'must',
                          acceptanceCriteria: [
                            {
                              id: `crit_${Date.now()}`,
                              description: 'Critério de aceitação verificável.',
                              verifiable: true,
                            },
                          ],
                        };
                        updateDraft((prev) => ({
                          ...prev,
                          vision: {
                            ...prev.vision,
                            requirements: [...prev.vision.requirements, newReq],
                          },
                        }));
                      }}
                    >
                      <Plus size={14} /> Adicionar Requisito
                    </button>
                  </div>

                  <div className="items-stack">
                    {spec.vision.requirements.map((req) => (
                      <div
                        key={req.id}
                        className="structured-item-box"
                        data-model-element-id={req.id}
                      >
                        <div className="structured-item-header">
                          <input
                            className="code-input"
                            aria-label="Código do requisito"
                            value={req.code}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                vision: {
                                  ...prev.vision,
                                  requirements: prev.vision.requirements.map((r) =>
                                    r.id === req.id ? { ...r, code: e.target.value } : r,
                                  ),
                                },
                              }))
                            }
                          />
                          <input
                            className="title-input"
                            aria-label="Título do requisito"
                            value={req.title}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                vision: {
                                  ...prev.vision,
                                  requirements: prev.vision.requirements.map((r) =>
                                    r.id === req.id ? { ...r, title: e.target.value } : r,
                                  ),
                                },
                              }))
                            }
                          />
                          <select
                            aria-label="Prioridade"
                            value={req.priority}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                vision: {
                                  ...prev.vision,
                                  requirements: prev.vision.requirements.map((r) =>
                                    r.id === req.id
                                      ? {
                                          ...r,
                                          priority: e.target.value as AppRequirement['priority'],
                                        }
                                      : r,
                                  ),
                                },
                              }))
                            }
                          >
                            <option value="must">Obrigatório (Must)</option>
                            <option value="should">Importante (Should)</option>
                            <option value="could">Desejável (Could)</option>
                          </select>
                          <button
                            type="button"
                            className="secondary danger-icon-btn"
                            title="Excluir requisito (com análise de impacto)"
                            onClick={() =>
                              requestSafeDelete(
                                'requirement',
                                req.id,
                                `${req.code} - ${req.title}`,
                                () =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    vision: {
                                      ...prev.vision,
                                      requirements: prev.vision.requirements.filter(
                                        (r) => r.id !== req.id,
                                      ),
                                    },
                                  })),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={req.description}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              vision: {
                                ...prev.vision,
                                requirements: prev.vision.requirements.map((r) =>
                                  r.id === req.id ? { ...r, description: e.target.value } : r,
                                ),
                              },
                            }))
                          }
                        />
                        <div className="criteria-list">
                          <small>Critérios de aceitação:</small>
                          {req.acceptanceCriteria.map((c) => (
                            <div key={c.id} className="criterion-row">
                              <Check size={13} />
                              <input
                                value={c.description}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    vision: {
                                      ...prev.vision,
                                      requirements: prev.vision.requirements.map((r) =>
                                        r.id === req.id
                                          ? {
                                              ...r,
                                              acceptanceCriteria: r.acceptanceCriteria.map((cr) =>
                                                cr.id === c.id
                                                  ? { ...cr, description: e.target.value }
                                                  : cr,
                                              ),
                                            }
                                          : r,
                                      ),
                                    },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <InlineIssues
                          issues={currentStepStatus.issues.filter(
                            (issue) => issue.elementId === req.id,
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </ModelingSection>
              </div>
            )}

            {/* ETAPA 2: DOMÍNIOS E CASOS DE USO */}
            {activeStepId === 'domains' && (
              <div className="step-form-sections">
                <ModelingSection
                  title={<>Atores e Papéis de Negócio</>}
                  summary={`${spec.actors.length} atores`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>Quem interage com os módulos e operações do sistema.</small>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          actors: [
                            ...prev.actors,
                            {
                              id: `act_${Date.now()}`,
                              name: 'Novo Ator',
                              roleKey: 'user',
                              description: 'Papel operacional',
                            },
                          ],
                        }))
                      }
                    >
                      <Plus size={14} /> Adicionar Ator
                    </button>
                  </div>
                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Ator</th>
                        <th>Papel Técnico (Role)</th>
                        <th>Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.actors.map((act) => (
                        <tr key={act.id}>
                          <td>
                            <input
                              value={act.name}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  actors: prev.actors.map((a) =>
                                    a.id === act.id ? { ...a, name: e.target.value } : a,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={act.roleKey}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  actors: prev.actors.map((a) =>
                                    a.id === act.id ? { ...a, roleKey: e.target.value } : a,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={act.description}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  actors: prev.actors.map((a) =>
                                    a.id === act.id ? { ...a, description: e.target.value } : a,
                                  ),
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ModelingSection>

                <ModelingSection
                  title={<>Catálogo de Casos de Uso (Vinculados aos Requisitos)</>}
                  summary={`${spec.useCases.length} casos de uso`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>
                        Contratos preliminares com ator, entradas, resultado e exceções.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const idx = spec.useCases.length + 1;
                        const newUc: UseCaseSpec = {
                          id: `uc_${Date.now()}`,
                          code: `UC-0${idx}`,
                          name: `Novo Caso de Uso ${idx}`,
                          domainId: spec.domains[0]?.id || 'dom_comercial',
                          actorId: spec.actors[0]?.id || 'act_vendedor',
                          requirementIds: spec.vision.requirements[0]
                            ? [spec.vision.requirements[0].id]
                            : [],
                          actionSummary: 'Descrição da interação principal.',
                          inputs: [{ name: 'id', type: 'string', required: true }],
                          expectedResult: 'Resultado esperado após execução.',
                          exceptions: ['Acesso negado'],
                        };
                        updateDraft((prev) => ({
                          ...prev,
                          useCases: [...prev.useCases, newUc],
                        }));
                      }}
                    >
                      <Plus size={14} /> Adicionar Caso de Uso
                    </button>
                  </div>

                  <div className="items-stack">
                    {spec.useCases.map((uc) => (
                      <div
                        key={uc.id}
                        className="structured-item-box"
                        data-model-element-id={uc.id}
                      >
                        <div className="structured-item-header">
                          <input
                            className="code-input"
                            value={uc.code}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                useCases: prev.useCases.map((item) =>
                                  item.id === uc.id ? { ...item, code: e.target.value } : item,
                                ),
                              }))
                            }
                          />
                          <input
                            className="title-input"
                            value={uc.name}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                useCases: prev.useCases.map((item) =>
                                  item.id === uc.id ? { ...item, name: e.target.value } : item,
                                ),
                              }))
                            }
                          />
                          <select
                            aria-label="Requisito vinculado"
                            value={uc.requirementIds[0] || ''}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                useCases: prev.useCases.map((item) =>
                                  item.id === uc.id
                                    ? {
                                        ...item,
                                        requirementIds: e.target.value ? [e.target.value] : [],
                                      }
                                    : item,
                                ),
                              }))
                            }
                            id={`field-${`dom_uc_req_${uc.id}`}`}
                            aria-invalid={currentStepStatus.issues.some(
                              (issue) => issue.id === `dom_uc_req_${uc.id}`,
                            )}
                            aria-describedby={
                              currentStepStatus.issues.some(
                                (issue) => issue.id === `dom_uc_req_${uc.id}`,
                              )
                                ? `issue-${`dom_uc_req_${uc.id}`}`
                                : undefined
                            }
                          >
                            <option value="">Vincular Requisito...</option>
                            {spec.vision.requirements.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.code} — {r.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-grid-2">
                          <label className="modeling-field">
                            <span>Ação e fluxo principal</span>
                            <input
                              value={uc.actionSummary}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  useCases: prev.useCases.map((item) =>
                                    item.id === uc.id
                                      ? { ...item, actionSummary: e.target.value }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="modeling-field">
                            <span>Resultado esperado</span>
                            <input
                              value={uc.expectedResult}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  useCases: prev.useCases.map((item) =>
                                    item.id === uc.id
                                      ? { ...item, expectedResult: e.target.value }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </div>
                        <InlineIssues
                          issues={currentStepStatus.issues.filter(
                            (issue) => issue.elementId === uc.id,
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </ModelingSection>
              </div>
            )}

            {/* ETAPA 3: DADOS (Integra o editor conceitual/lógico/SQL/CRUD + Governança Multi-Tenant) */}
            {activeStepId === 'data' && (
              <div className="step-data-integrated">
                <div className="embedded-datamodel-wrapper">
                  <DataModelEditor
                    graph={graph}
                    commit={commit}
                    notify={notify}
                    simulation={simulation}
                    undo={undo}
                    redo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                  />
                </div>
              </div>
            )}

            {/* ETAPA 4: IDENTIDADE E PERMISSÕES */}
            {activeStepId === 'permissions' && (
              <div className="step-form-sections">
                <ModelingSection
                  title={<>Matriz de Políticas de Acesso, Escopo de Organização e Segregação</>}
                  summary={`${spec.policies.length} políticas`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>
                        Toda operação declara acesso público ou uma política explícita. A ausência
                        de política bloqueia o acesso por padrão no gateway.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const newPol: PermissionPolicySpec = {
                          id: `pol_${Date.now()}`,
                          name: 'Nova Política de Acesso',
                          actorRoles: ['manager', 'admin'],
                          resource: 'pedidos',
                          actions: ['update'],
                          scope: 'organization',
                          ownerField: 'vendedor_id',
                          organizationField: 'org_id',
                          forbidSelfApproval: true,
                          errorMessage: 'Acesso negado pela política de segurança.',
                          requirementIds: spec.vision.requirements[0]
                            ? [spec.vision.requirements[0].id]
                            : [],
                        };
                        updateDraft((prev) => ({
                          ...prev,
                          policies: [...prev.policies, newPol],
                        }));
                      }}
                    >
                      <Plus size={14} /> Nova Política
                    </button>
                  </div>

                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Nome da Política</th>
                        <th>Papéis Permitidos</th>
                        <th>Recurso</th>
                        <th>Ações</th>
                        <th>Escopo de Isolamento</th>
                        <th>Segregação (Sem Autoaprovação)</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.policies.map((pol) => (
                        <tr key={pol.id}>
                          <td>
                            <input
                              value={pol.name}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  policies: prev.policies.map((p) =>
                                    p.id === pol.id ? { ...p, name: e.target.value } : p,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={pol.actorRoles.join(', ')}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  policies: prev.policies.map((p) =>
                                    p.id === pol.id
                                      ? {
                                          ...p,
                                          actorRoles: e.target.value
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean),
                                        }
                                      : p,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={pol.resource}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  policies: prev.policies.map((p) =>
                                    p.id === pol.id ? { ...p, resource: e.target.value } : p,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <code>{pol.actions.join(', ')}</code>
                          </td>
                          <td>
                            <select
                              value={pol.scope}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  policies: prev.policies.map((p) =>
                                    p.id === pol.id
                                      ? { ...p, scope: e.target.value as PermissionScope }
                                      : p,
                                  ),
                                }))
                              }
                            >
                              <option value="own">Próprio (Owner)</option>
                              <option value="team">Equipe</option>
                              <option value="organization">Mesma Organização (Tenant)</option>
                              <option value="global">Global</option>
                              <option value="public">Público</option>
                            </select>
                          </td>
                          <td>
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={Boolean(pol.forbidSelfApproval)}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    policies: prev.policies.map((p) =>
                                      p.id === pol.id
                                        ? { ...p, forbidSelfApproval: e.target.checked }
                                        : p,
                                    ),
                                  }))
                                }
                              />
                              <span>Proibir solicitante de aprovar</span>
                            </label>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary danger-icon-btn"
                              onClick={() =>
                                requestSafeDelete('policy', pol.id, pol.name, () =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    policies: prev.policies.filter((p) => p.id !== pol.id),
                                  })),
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ModelingSection>
              </div>
            )}

            {/* ETAPA 5: REGRAS DE NEGÓCIO E TABELAS DE DECISÃO */}
            {activeStepId === 'rules' && (
              <div className="step-form-sections">
                {spec.rules.map((rule) => (
                  <ModelingSection
                    key={rule.id}
                    data-model-element-id={rule.id}
                    title={
                      <>
                        {rule.code} — {rule.name}
                      </>
                    }
                    summary={`${rule.rows.length} condições · ${rule.examples.length} exemplos`}
                  >
                    <div className="card-header-row">
                      <div>
                        <small>{rule.explanation}</small>
                      </div>
                      <div className="rule-header-controls">
                        <label className="inline-select-label">
                          Estratégia da Tabela:
                          <select
                            value={rule.hitPolicy}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, hitPolicy: e.target.value as DecisionHitPolicy }
                                    : r,
                                ),
                              }))
                            }
                          >
                            <option value="first_match">
                              Primeira Correspondência (First Match)
                            </option>
                            <option value="unique">Resultado Único (Unique)</option>
                            <option value="multiple">Múltiplos Resultados</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="secondary danger-icon-btn"
                          onClick={() =>
                            requestSafeDelete('rule', rule.id, `${rule.code} - ${rule.name}`, () =>
                              updateDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.filter((r) => r.id !== rule.id),
                              })),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Tabela de Decisão Estruturada */}
                    <table className="modeling-table decision-table">
                      <thead>
                        <tr>
                          <th>Prioridade</th>
                          <th>Descrição da Regra / Alçada</th>
                          <th>Campo</th>
                          <th>Operador</th>
                          <th>Valor Limite (R$ / Número)</th>
                          <th>Exato em Centavos</th>
                          <th>Decisão Resultante (Outcome)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rule.rows.map((row: DecisionRow) => {
                          const comp = row.condition.kind === 'comparison' ? row.condition : null;
                          return (
                            <tr key={row.id}>
                              <td>#{row.priority}</td>
                              <td>
                                <input
                                  value={row.label}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r) =>
                                        r.id === rule.id
                                          ? {
                                              ...r,
                                              rows: r.rows.map((rw) =>
                                                rw.id === row.id
                                                  ? { ...rw, label: e.target.value }
                                                  : rw,
                                              ),
                                            }
                                          : r,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  value={comp?.leftField || 'total'}
                                  onChange={(e) =>
                                    comp &&
                                    updateDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r) =>
                                        r.id === rule.id
                                          ? {
                                              ...r,
                                              rows: r.rows.map((rw) =>
                                                rw.id === row.id &&
                                                rw.condition.kind === 'comparison'
                                                  ? {
                                                      ...rw,
                                                      condition: {
                                                        ...rw.condition,
                                                        leftField: e.target.value,
                                                      },
                                                    }
                                                  : rw,
                                              ),
                                            }
                                          : r,
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  value={comp?.operator || 'lte'}
                                  onChange={(e) =>
                                    comp &&
                                    updateDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r) =>
                                        r.id === rule.id
                                          ? {
                                              ...r,
                                              rows: r.rows.map((rw) =>
                                                rw.id === row.id &&
                                                rw.condition.kind === 'comparison'
                                                  ? {
                                                      ...rw,
                                                      condition: {
                                                        ...rw.condition,
                                                        operator: e.target
                                                          .value as RuleComparisonOperator,
                                                      },
                                                    }
                                                  : rw,
                                              ),
                                            }
                                          : r,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="lte">&lt;= (Menor ou igual)</option>
                                  <option value="gt">&gt; (Maior que)</option>
                                  <option value="gte">&gt;= (Maior ou igual)</option>
                                  <option value="lt">&lt; (Menor que)</option>
                                  <option value="eq">== (Igual a)</option>
                                  <option value="neq">!= (Diferente de)</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  aria-label={`Valor limite para ${row.label}`}
                                  value={String(comp?.rightValue ?? '')}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    updateDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r) =>
                                        r.id === rule.id
                                          ? {
                                              ...r,
                                              rows: r.rows.map((rw) =>
                                                rw.id === row.id &&
                                                rw.condition.kind === 'comparison'
                                                  ? {
                                                      ...rw,
                                                      condition: {
                                                        ...rw.condition,
                                                        rightValue: val,
                                                      },
                                                    }
                                                  : rw,
                                              ),
                                            }
                                          : r,
                                      ),
                                    }));
                                  }}
                                />
                              </td>
                              <td>
                                <code>{comp?.useExactCents ? 'Sim (Centavos)' : 'Padrão'}</code>
                              </td>
                              <td>
                                <select
                                  value={row.outcome}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r) =>
                                        r.id === rule.id
                                          ? {
                                              ...r,
                                              rows: r.rows.map((rw) =>
                                                rw.id === row.id
                                                  ? { ...rw, outcome: e.target.value }
                                                  : rw,
                                              ),
                                            }
                                          : r,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="auto_approved">
                                    auto_approved (Caminho Normal)
                                  </option>
                                  <option value="requires_manager_approval">
                                    requires_manager_approval (Exige Gerente)
                                  </option>
                                  <option value="rejected">rejected (Rejeitado)</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Exemplos Verificáveis da Regra */}
                    <div className="rule-examples-strip">
                      <strong>Exemplos Verificáveis em Tempo Real:</strong>
                      <div className="examples-badges-row">
                        {rule.examples.map((ex) => {
                          const liveEval = evaluateBusinessRule(rule, ex.inputs);
                          const matches = liveEval.primaryOutcome === ex.expectedOutcome;
                          return (
                            <span
                              key={ex.id}
                              className={`example-check-pill ${matches ? 'pass' : 'fail'}`}
                            >
                              {matches ? '✓' : '⚠'} {ex.description}: obtido{' '}
                              <code>{liveEval.primaryOutcome}</code> (esperado{' '}
                              <code>{ex.expectedOutcome}</code>)
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <InlineIssues
                      issues={currentStepStatus.issues.filter(
                        (issue) => issue.elementId === rule.id,
                      )}
                    />
                  </ModelingSection>
                ))}
              </div>
            )}

            {/* ETAPA 6: ESTADOS E CICLO DE VIDA */}
            {activeStepId === 'lifecycle' && (
              <div className="step-form-sections">
                {spec.lifecycles.map((lc: LifecycleSpec) => (
                  <ModelingSection
                    key={lc.id}
                    data-model-element-id={lc.id}
                    title={
                      <>
                        {lc.name} — Entidade: <code>{lc.targetEntity}</code> (Campo:{' '}
                        <code>{lc.stateField}</code>)
                      </>
                    }
                    summary={`${lc.states.length} estados · ${lc.transitions.length} transições`}
                  >
                    <div className="card-header-row">
                      <div>
                        <small>
                          Estado Inicial: <strong>{lc.initialState}</strong> | Estados Finais:{' '}
                          <strong>{lc.finalStates.join(', ')}</strong> | Controle de Versão:{' '}
                          <code>{lc.versionField || 'versao'}</code>
                        </small>
                      </div>
                    </div>

                    {/* Diagrama Visual de Estados */}
                    <div className="lifecycle-diagram-box">
                      {lc.states.map((st, idx) => (
                        <div key={st} className="lifecycle-state-item">
                          <div
                            className={`lifecycle-state-card ${
                              st === lc.initialState
                                ? 'initial'
                                : lc.finalStates.includes(st)
                                  ? 'final'
                                  : ''
                            }`}
                          >
                            <small>
                              {st === lc.initialState
                                ? 'INICIAL'
                                : lc.finalStates.includes(st)
                                  ? 'FINAL'
                                  : 'INTERMEDIÁRIO'}
                            </small>
                            <strong>{st}</strong>
                          </div>
                          {idx < lc.states.length - 1 && <ArrowRight size={18} />}
                        </div>
                      ))}
                    </div>

                    <table className="modeling-table">
                      <thead>
                        <tr>
                          <th>Transição</th>
                          <th>De (Estado Atual)</th>
                          <th>Para (Novo Estado)</th>
                          <th>Papéis Permitidos</th>
                          <th>Versão Otimista (Concorrência)</th>
                          <th>Segregação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lc.transitions.map((tr) => (
                          <tr key={tr.id}>
                            <td>
                              <strong>{tr.name}</strong>
                            </td>
                            <td>
                              <code>{tr.fromState}</code>
                            </td>
                            <td>
                              <code>{tr.toState}</code>
                            </td>
                            <td>{tr.allowedActorRoles.join(', ')}</td>
                            <td>
                              {tr.requireVersionMatch ? (
                                <span className="badge-ok">Exige Versão Atômica</span>
                              ) : (
                                'Padrão'
                              )}
                            </td>
                            <td>
                              {tr.forbidSelfTransitionByCreator
                                ? 'Proíbe Criador'
                                : 'Sem restrição'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <InlineIssues
                      issues={currentStepStatus.issues.filter((issue) => issue.elementId === lc.id)}
                    />
                  </ModelingSection>
                ))}
              </div>
            )}

            {/* ETAPA 7: OPERAÇÕES E PROCESSOS */}
            {activeStepId === 'operations' && (
              <div className="step-form-sections">
                {spec.operations.map((op: OperationSpec) => (
                  <ModelingSection
                    key={op.id}
                    data-model-element-id={op.id}
                    title={
                      <>
                        {op.code} — {op.name}
                      </>
                    }
                    summary={`${op.activities.length} atividades`}
                  >
                    <div className="card-header-row">
                      <div>
                        <small>{op.outputSummary}</small>
                      </div>
                      <span className="badge-ok">
                        Transacional: {op.transactional ? 'Sim (BEGIN/COMMIT)' : 'Não'}
                      </span>
                    </div>

                    <div className="form-grid-3">
                      <label className="modeling-field">
                        <span>Política de Acesso Obrigatória</span>
                        <select
                          id={`field-op_pol_${op.id}`}
                          aria-invalid={currentStepStatus.issues.some(
                            (issue) => issue.id === `op_pol_${op.id}`,
                          )}
                          aria-describedby={
                            currentStepStatus.issues.some((issue) => issue.id === `op_pol_${op.id}`)
                              ? `issue-op_pol_${op.id}`
                              : undefined
                          }
                          value={op.policyId || ''}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              operations: prev.operations.map((item) =>
                                item.id === op.id ? { ...item, policyId: e.target.value } : item,
                              ),
                            }))
                          }
                        >
                          <option value="">Selecione uma política...</option>
                          {spec.policies.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="modeling-field">
                        <span>Entidade Alvo</span>
                        <input
                          value={op.targetEntity}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              operations: prev.operations.map((item) =>
                                item.id === op.id
                                  ? { ...item, targetEntity: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          id={`field-${`op_ent_${op.id}`}`}
                          aria-invalid={currentStepStatus.issues.some(
                            (issue) => issue.id === `op_ent_${op.id}`,
                          )}
                          aria-describedby={
                            currentStepStatus.issues.some((issue) => issue.id === `op_ent_${op.id}`)
                              ? `issue-${`op_ent_${op.id}`}`
                              : undefined
                          }
                        />
                      </label>

                      <label className="modeling-field">
                        <span>Controle de Concorrência</span>
                        <select
                          value={op.concurrencyControl}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              operations: prev.operations.map((item) =>
                                item.id === op.id
                                  ? {
                                      ...item,
                                      concurrencyControl: e.target
                                        .value as OperationSpec['concurrencyControl'],
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          <option value="optimistic_version">
                            Versão Otimista (Impede dupla aprovação)
                          </option>
                          <option value="conditional_state">Condição de Estado</option>
                          <option value="none">Padrão</option>
                        </select>
                      </label>
                    </div>

                    {/* Cadeia Síncrona do Processo no Servidor */}
                    <div className="process-pipeline-strip">
                      <small>Ordem de Execução no Servidor:</small>
                      <div className="activities-flow-row">
                        {op.activities.map((act, i) => (
                          <div key={act.id} className="activity-step-chip">
                            <span className="act-num">{act.order}</span>
                            <span>{act.label}</span>
                            {i < op.activities.length - 1 && <ArrowRight size={13} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <InlineIssues
                      issues={currentStepStatus.issues.filter((issue) => issue.elementId === op.id)}
                    />
                  </ModelingSection>
                ))}
              </div>
            )}

            {/* ETAPA 8: APIS, EVENTOS E INTEGRAÇÕES */}
            {activeStepId === 'apis' && (
              <div className="step-form-sections">
                <ModelingSection
                  title={<>Contratos de API, Idempotência e Bindings de Operação</>}
                  summary={`${spec.apiContracts.length} contratos`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>
                        O OpenAPI exportado reflete apenas rotas efetivamente vinculadas às
                        operações aplicadas.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const newApi: ApiContractSpec = {
                          id: `api_${Date.now()}`,
                          name: 'Novo Endpoint de Operação',
                          method: 'POST',
                          path: '/api/operations/nova-operacao',
                          operationId: spec.operations[0]?.id || '',
                          authRequired: true,
                          idempotencyKeyHeader: 'Idempotency-Key',
                          timeoutMs: 5000,
                          retryPolicy: { maxAttempts: 2, backoffMs: 500 },
                          requestSchemaSummary: '{ id: string }',
                          responseSchemaSummary: '{ ok: boolean }',
                        };
                        updateDraft((prev) => ({
                          ...prev,
                          apiContracts: [...prev.apiContracts, newApi],
                        }));
                      }}
                    >
                      <Plus size={14} /> Novo Contrato de API
                    </button>
                  </div>

                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Rota (Path)</th>
                        <th>Operação de Servidor Vinculada</th>
                        <th>Autenticação</th>
                        <th>Cabeçalho de Idempotência</th>
                        <th>Timeout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.apiContracts.map((api) => (
                        <tr key={api.id} data-model-element-id={api.id}>
                          <td>
                            <select
                              value={api.method}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  apiContracts: prev.apiContracts.map((a) =>
                                    a.id === api.id
                                      ? {
                                          ...a,
                                          method: e.target.value as ApiContractSpec['method'],
                                        }
                                      : a,
                                  ),
                                }))
                              }
                            >
                              <option value="POST">POST</option>
                              <option value="GET">GET</option>
                              <option value="PUT">PUT</option>
                              <option value="PATCH">PATCH</option>
                              <option value="DELETE">DELETE</option>
                            </select>
                            <InlineIssues
                              issues={currentStepStatus.issues.filter(
                                (issue) => issue.elementId === api.id,
                              )}
                            />
                          </td>
                          <td>
                            <input
                              value={api.path}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  apiContracts: prev.apiContracts.map((a) =>
                                    a.id === api.id ? { ...a, path: e.target.value } : a,
                                  ),
                                }))
                              }
                              id={`field-${`api_path_${api.id}`}`}
                              aria-invalid={currentStepStatus.issues.some(
                                (issue) => issue.id === `api_path_${api.id}`,
                              )}
                              aria-describedby={
                                currentStepStatus.issues.some(
                                  (issue) => issue.id === `api_path_${api.id}`,
                                )
                                  ? `issue-${`api_path_${api.id}`}`
                                  : undefined
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={api.operationId}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  apiContracts: prev.apiContracts.map((a) =>
                                    a.id === api.id ? { ...a, operationId: e.target.value } : a,
                                  ),
                                }))
                              }
                              id={`field-${`api_op_${api.id}`}`}
                              aria-invalid={currentStepStatus.issues.some(
                                (issue) => issue.id === `api_op_${api.id}`,
                              )}
                              aria-describedby={
                                currentStepStatus.issues.some(
                                  (issue) => issue.id === `api_op_${api.id}`,
                                )
                                  ? `issue-${`api_op_${api.id}`}`
                                  : undefined
                              }
                            >
                              {spec.operations.map((op) => (
                                <option key={op.id} value={op.id}>
                                  {op.code} — {op.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{api.authRequired ? 'Bearer / Sessão' : 'Pública'}</td>
                          <td>
                            <code>{api.idempotencyKeyHeader || 'Idempotency-Key'}</code>
                          </td>
                          <td>{api.timeoutMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ModelingSection>
              </div>
            )}

            {/* ETAPA 9: CENÁRIOS DE ACEITAÇÃO E REVISÃO */}
            {activeStepId === 'scenarios' && (
              <div className="step-form-sections">
                <ModelingSection
                  title={<>Cenários de Aceitação e Verificação de Regressão</>}
                  summary={`${spec.scenarios.length} cenários`}
                >
                  <div className="card-header-row">
                    <div>
                      <small>
                        Cobre casos positivos, limites de alçada (R$ 5.000), outra organização,
                        autoaprovação proibida e concorrência.
                      </small>
                    </div>
                  </div>

                  <table className="modeling-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Cenário</th>
                        <th>Categoria</th>
                        <th>Ator / Org</th>
                        <th>Entrada</th>
                        <th>Esperado</th>
                        <th>Verificação Atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.scenarios.map((sc: AcceptanceScenarioSpec) => {
                        const liveRes = executeModeledOperation(spec, {
                          operationId: sc.operationId,
                          actor: {
                            userId: sc.actorUserId,
                            role: sc.actorRole,
                            orgId: sc.actorOrgId,
                            authenticated: Boolean(sc.actorUserId),
                          },
                          payload: sc.inputPayload,
                          existingRecord: sc.initialRecordState || null,
                        });
                        const passed =
                          liveRes.ok === sc.expectedAllowed &&
                          (!sc.expectedOutcome || liveRes.outcome === sc.expectedOutcome);

                        return (
                          <tr key={sc.id} data-model-element-id={sc.id}>
                            <td>
                              <strong>{sc.code}</strong>
                              <InlineIssues
                                issues={currentStepStatus.issues.filter(
                                  (issue) => issue.elementId === sc.id,
                                )}
                              />
                            </td>
                            <td>{sc.name}</td>
                            <td>
                              <code>{sc.category}</code>
                            </td>
                            <td>
                              {sc.actorRole} ({sc.actorOrgId})
                            </td>
                            <td>
                              <code>{JSON.stringify(sc.inputPayload)}</code>
                            </td>
                            <td>
                              HTTP {sc.expectedStatus}{' '}
                              {sc.expectedOutcome ? `(${sc.expectedOutcome})` : ''}
                            </td>
                            <td>
                              {passed ? (
                                <span className="badge-ok">
                                  ✓ Passou (HTTP {liveRes.status}{' '}
                                  {liveRes.outcome ? `· ${liveRes.outcome}` : ''})
                                </span>
                              ) : (
                                <span className="badge-warn">
                                  ⚠ Divergente (Obtido: {liveRes.outcome || liveRes.error?.code})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ModelingSection>
              </div>
            )}
          </div>
        </div>

        {/* 4. Painel Contextual Direito: Ajuda, Dependências, Referências e Pendências (Seção 3.2) */}
        {stageDetailsOpen && (
          <aside
            id="modeling-stage-details"
            className="modeling-context-sidebar"
            aria-label="Contexto e pendências da etapa"
          >
            <div className="modeling-details-heading">
              <strong>Detalhes da etapa</strong>
              <button
                type="button"
                className="secondary icon-btn"
                aria-label="Fechar detalhes da etapa"
                onClick={() => setStageDetailsOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="context-section">
              <h4>{currentStepStatus.meta.shortTitle}</h4>
              <small className="muted-note">{currentStepStatus.meta.description}</small>
              {currentStepStatus.meta.optional && (
                <button
                  type="button"
                  className="secondary small-btn"
                  onClick={handleMarkNotApplicable}
                >
                  {currentStepStatus.fillStatus === 'not_applicable'
                    ? 'Reativar Etapa'
                    : 'Marcar como Não se aplica'}
                </button>
              )}
            </div>
            {activeStepId === 'data' && (
              <details className="modeling-card governance-bar-card">
                <summary>
                  <span>Propriedade e isolamento dos dados</span>
                  <span className="governance-summary-count">
                    {spec.entityGovernance.length} tabelas
                  </span>
                  <ChevronDown size={15} />
                </summary>
                <div className="governance-items-row">
                  {spec.entityGovernance.map((gov) => (
                    <div key={gov.entityId} className="governance-pill-card">
                      <strong>Tabela: {gov.tableName}</strong>
                      <span>
                        Proprietário: <code>{gov.ownerField || 'vendedor_id'}</code>
                      </span>
                      <span>
                        Organização: <code>{gov.organizationField || 'org_id'}</code>
                      </span>
                      <span>
                        Versão: <code>{gov.versionField || 'versao'}</code>
                      </span>
                      <span>
                        Escopo: <strong>{gov.isolationScope}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="context-section">
              <h4>
                <HelpCircle size={14} /> Estado da Etapa
              </h4>
              <small className="muted-note">
                {currentStepStatus.meta.generatesBlocks
                  ? 'Ao concluir, os blocos desta etapa serão criados ou atualizados no fluxo.'
                  : 'Estas definições documentam o negócio e orientam as próximas etapas.'}
              </small>
            </div>

            <div className="context-section" id="modeling-stage-issues">
              <h4>
                <AlertTriangle size={14} /> O que falta resolver ({currentStepStatus.issues.length})
              </h4>
              {currentStepStatus.issues.length === 0 ? (
                <p className="context-ok-msg">
                  <Check size={14} /> Nenhuma pendência nesta etapa.
                </p>
              ) : (
                <ul className="context-issues-list">
                  {currentStepStatus.issues.map((iss) => (
                    <li key={iss.id} className={`issue-item severity-${iss.severity}`}>
                      <strong>{iss.severity === 'error' ? 'Impeditivo:' : 'Aviso:'}</strong>{' '}
                      {iss.message}
                      <button
                        type="button"
                        className="modeling-issue-link"
                        onClick={() => focusIssue(iss.elementId, iss.id)}
                      >
                        Ir ao campo <ArrowRight size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="context-section context-disclosure">
              <summary>
                <Workflow size={14} /> Blocos desta etapa ({generatedBlocksForCurrentStep.length})
                <ChevronDown size={14} />
              </summary>
              {generatedBlocksForCurrentStep.length === 0 ? (
                <small className="muted-note">
                  {currentStepStatus.meta.generatesBlocks
                    ? 'Clique em "Concluir etapa" para gerar os blocos desta etapa.'
                    : 'Esta etapa gera documentação e vínculos de rastreabilidade.'}
                </small>
              ) : (
                <div className="context-blocks-chips">
                  {generatedBlocksForCurrentStep.map((b) => (
                    <button
                      key={b.artifactId}
                      type="button"
                      className="context-block-chip"
                      onClick={() => onNavigateToFlows(null, b.artifactId)}
                    >
                      <code>#{b.artifactId}</code>
                      <ArrowRight size={11} />
                    </button>
                  ))}
                </div>
              )}
            </details>

            <details className="context-section context-disclosure">
              <summary>
                <ListChecks size={14} /> Resumo do projeto <ChevronDown size={14} />
              </summary>
              <ul className="project-indicators-list">
                <li>
                  <span>Modelagem concluída:</span>
                  <strong>{validation.isModelingReady ? 'Sim' : 'Em andamento'}</strong>
                </li>
                <li>
                  <span>Revisão aplicada:</span>
                  <strong>
                    {modeling.applied ? `#${modeling.generation.appliedRevision}` : 'Nenhuma'}
                  </strong>
                </li>
                <li>
                  <span>Destino Backend:</span>
                  <strong>TypeScript + Node (Suportado)</strong>
                </li>
              </ul>
            </details>
          </aside>
        )}
      </div>

      {/* 5. Rodapé da Área de Modelagem (Seção 3.2) */}
      <footer className="modeling-footer">
        <div className="modeling-footer-left">
          <button
            type="button"
            className="secondary"
            onClick={handleSaveDraft}
            title="Salva a especificação sem gerar ou atualizar blocos"
          >
            <Save size={14} />
            <span>Salvar rascunho</span>
          </button>

          {currentStepStatus.fillStatus === 'completed' && (
            <button type="button" className="secondary" onClick={() => setOverlayTool('blocks')}>
              <Eye size={14} />
              <span>Ver blocos gerados ({generatedBlocksForCurrentStep.length})</span>
            </button>
          )}
        </div>

        <div className="modeling-action-explanation">
          {currentStepStatus.meta.generatesBlocks
            ? 'Concluir valida a etapa e gera ou atualiza seus blocos.'
            : 'Concluir valida e registra as definições desta etapa.'}
        </div>
        <div className="modeling-footer-right">
          <button
            type="button"
            className="primary"
            disabled={!currentStepStatus.canComplete}
            title={
              currentStepStatus.canComplete
                ? 'Valida, reconcilia artefatos e conclui esta etapa em uma única transação'
                : 'Resolva as pendências impeditivas antes de concluir a etapa'
            }
            onClick={() => handleCompleteStep(false)}
          >
            <Check size={14} />
            <span>
              {currentStepStatus.fillStatus === 'completed'
                ? currentStepStatus.meta.generatesBlocks
                  ? 'Atualizar blocos e etapa'
                  : 'Atualizar etapa'
                : currentStepStatus.meta.generatesBlocks
                  ? 'Concluir e gerar blocos'
                  : 'Concluir etapa'}
            </span>
          </button>

          <button type="button" className="secondary" onClick={handleNextStep}>
            <span>Próxima etapa</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </footer>

      {/* Modal de Análise de Impacto antes de Exclusão (Seção 7, Regra 6) */}
      {pendingDeletion && (
        <div className="modeling-modal-backdrop" role="dialog" aria-modal="true">
          <div className="modeling-impact-modal">
            <h3>
              <AlertTriangle size={18} /> Análise de Impacto antes de Excluir
            </h3>
            <p>
              O elemento <strong>{pendingDeletion.elementName}</strong> possui{' '}
              <strong>{pendingDeletion.dependents.length} dependente(s)</strong> ativo(s) na
              modelagem:
            </p>
            <ul>
              {pendingDeletion.dependents.map((dep) => (
                <li key={dep.id}>
                  <strong>{dep.kind}:</strong> {dep.name} (<code>{dep.id}</code>)
                </li>
              ))}
            </ul>
            <p className="muted-note">
              Para não deixar conexões quebradas, você pode cancelar a exclusão ou confirmar a
              remoção atualizando os dependentes para revisão.
            </p>
            <div className="modal-actions-row">
              <button type="button" className="secondary" onClick={() => setPendingDeletion(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary danger-btn"
                onClick={pendingDeletion.onConfirmCascade}
              >
                Excluir e Marcar Dependentes para Revisão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
