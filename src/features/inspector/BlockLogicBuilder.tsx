import { useMemo, useState } from 'react';
import { AlertTriangle, Code, Plus, Sparkles, X } from 'lucide-react';
import {
  analyzeBlockIntentAndDiagnostics,
  catalog,
  getLogicTemplateById,
  getLogicTemplatesForKind,
  LOGIC_CATEGORIES,
  toSafeFunctionName,
  type Block,
  type BlockLogicTemplate,
  type Graph,
  type Kind,
  type LogicRecommendation,
  type LogicVariableSlot,
} from '../../engine';

type Props = {
  block: Block;
  graph: Graph;
  onChangeConfig: (config: Record<string, string>) => void;
  onCreateAndBindBlock?: (
    targetKind: Kind,
    options: {
      slotKey?: string;
      sourceHandle?: string;
      targetHandle?: string;
      defaultConfig?: Record<string, string>;
      defaultArg?: string;
    },
  ) => void;
  onApplyRecommendation?: (rec: LogicRecommendation) => void;
};

export function BlockLogicBuilder({
  block,
  graph,
  onChangeConfig,
  onCreateAndBindBlock,
  onApplyRecommendation,
}: Props) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const kind = block.data.kind;
  const config = block.data.config;
  const blockDef = catalog[kind];
  const fnName = toSafeFunctionName(block.id);

  // Análise enxuta de template ativo, erros e sugestões
  const analysis = useMemo(() => analyzeBlockIntentAndDiagnostics(graph, block), [graph, block]);

  // Lista de funções pré-montadas agrupadas por categoria
  const groupedTemplates = useMemo(
    () => getLogicTemplatesForKind(kind, showAllCategories),
    [kind, showAllCategories],
  );

  const availableCategories = useMemo(
    () => LOGIC_CATEGORIES.filter((cat) => groupedTemplates[cat]?.length > 0),
    [groupedTemplates],
  );

  const otherBlocks = useMemo(
    () => graph.nodes.filter((n) => n.id !== block.id),
    [graph.nodes, block.id],
  );

  const inputBlocks = useMemo(
    () => graph.nodes.filter((n) => n.data.kind === 'input'),
    [graph.nodes],
  );

  const screenBlocks = useMemo(
    () => graph.nodes.filter((n) => n.data.kind === 'screen'),
    [graph.nodes],
  );

  const outEdges = useMemo(
    () => graph.edges.filter((e) => e.source === block.id),
    [graph.edges, block.id],
  );

  const handleSelectTemplate = (tmpl: BlockLogicTemplate) => {
    onChangeConfig({
      ...tmpl.configPatch,
      logicTemplateId: tmpl.id,
    });
    setIsPickerOpen(false);
  };

  const getSlotEffectiveValue = (slot: LogicVariableSlot): string => {
    if (config[slot.key] !== undefined && config[slot.key] !== '') {
      return config[slot.key];
    }
    if (slot.edgeBinding && slot.edgeBinding.direction === 'outgoing') {
      const handle = slot.edgeBinding.sourceHandle || 'next';
      const existingEdge = outEdges.find((e) => (e.sourceHandle || 'next') === handle);
      if (existingEdge) return existingEdge.target;
    }
    return slot.defaultValue ?? '';
  };

  const handleSlotChange = (slot: LogicVariableSlot, rawVal: string) => {
    if (rawVal.startsWith('__CREATE__:')) {
      const targetKind = rawVal.replace('__CREATE__:', '') as Kind;
      if (onCreateAndBindBlock) {
        onCreateAndBindBlock(targetKind, {
          slotKey: slot.key,
          sourceHandle: slot.edgeBinding?.sourceHandle,
          targetHandle: slot.edgeBinding?.targetHandle,
          defaultArg: slot.edgeBinding?.defaultArg,
        });
      }
      return;
    }
    onChangeConfig({ [slot.key]: rawVal });
  };

  const activeTemplate = analysis.activeTemplate;

  // Monta os valores efetivos para gerar o trecho de código em tempo real
  const liveValues = useMemo(() => {
    const map: Record<string, string> = { ...config };
    if (activeTemplate) {
      for (const slot of activeTemplate.variables) {
        map[slot.key] = getSlotEffectiveValue(slot);
      }
    }
    return map;
  }, [config, activeTemplate, outEdges]);

  const liveCodeSnippet = useMemo(() => {
    if (!activeTemplate) return `function ${fnName}(value) {\n  return value;\n}`;
    const body = activeTemplate.buildCodeSnippet(liveValues, block.id);
    return `function ${fnName}(value) {\n  ${body.split('\n').join('\n  ')}\n}`;
  }, [activeTemplate, liveValues, block.id, fnName]);

  const isExplicitlyIncompatible =
    config.logicTemplateId &&
    getLogicTemplateById(config.logicTemplateId) &&
    !getLogicTemplateById(config.logicTemplateId)!.compatibleKinds.includes(kind);

  return (
    <div className="logic-builder-root">
      {/* 1. Barra Direta: Função Atual + Botão "+ Função / Lógica" */}
      <div className="logic-compact-bar">
        <div className="logic-compact-current">
          <span className="material-symbols-outlined logic-compact-icon">
            {activeTemplate?.icon || blockDef?.icon || 'functions'}
          </span>
          <div className="logic-compact-titles">
            <small>{activeTemplate?.category || 'Lógica do Bloco'}</small>
            <strong>{activeTemplate?.name || 'Padrão'}</strong>
          </div>
        </div>
        <button
          type="button"
          className="btn-open-logic-picker"
          onClick={() => setIsPickerOpen((prev) => !prev)}
        >
          <Plus size={12} />
          <span>{isPickerOpen ? 'Fechar' : 'Trocar Lógica'}</span>
        </button>
      </div>

      {/* 2. Seletor Direto de Lógicas por Categoria (quando aberto) */}
      {isPickerOpen && (
        <div className="logic-picker-drawer" role="dialog" aria-label="Escolher Função ou Lógica">
          <div className="logic-picker-header">
            <strong>Escolha uma Lógica ({blockDef?.name})</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="logic-show-all-toggle" title="Exibir lógicas de outros blocos">
                <input
                  type="checkbox"
                  checked={showAllCategories}
                  onChange={(e) => setShowAllCategories(e.target.checked)}
                />
                <span>Todos os tipos</span>
              </label>
              <button
                type="button"
                className="logic-picker-close"
                onClick={() => setIsPickerOpen(false)}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="logic-picker-categories">
            {availableCategories.map((cat) => (
              <div key={cat} className="logic-category-group">
                <div className="logic-category-heading">
                  <span>{cat}</span>
                </div>
                <div className="logic-templates-list">
                  {groupedTemplates[cat].map((tmpl) => {
                    const isCompatible = tmpl.compatibleKinds.includes(kind);
                    const isSelected = activeTemplate?.id === tmpl.id;

                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        className={`logic-template-option ${isSelected ? 'selected' : ''} ${!isCompatible ? 'incompatible' : ''}`}
                        onClick={() => handleSelectTemplate(tmpl)}
                      >
                        <span className="material-symbols-outlined logic-tmpl-icon">
                          {tmpl.icon}
                        </span>
                        <div className="logic-tmpl-info">
                          <div className="logic-tmpl-title-row">
                            <strong>{tmpl.name}</strong>
                            {!isCompatible && <span className="compat-tag warn">Incompatível</span>}
                          </div>
                          <code className="logic-tmpl-code-hint">
                            {tmpl.buildCodeSnippet(tmpl.configPatch, block.id).split('\n')[0]}
                          </code>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Alertas Diretos de Erro / Incompatibilidade */}
      {analysis.diagnostics.length > 0 && (
        <div className="logic-diagnostics-list" role="alert">
          {analysis.diagnostics.map((diag, idx) => (
            <div key={`${diag.code}-${idx}`} className={`logic-diagnostic-item ${diag.severity}`}>
              <AlertTriangle size={13} className="diag-icon" />
              <div className="diag-body">
                <span className="diag-msg">{diag.message}</span>
                {diag.remediationLabel && diag.fixConfigPatch && (
                  <button
                    type="button"
                    className="diag-fix-btn"
                    onClick={() => onChangeConfig(diag.fixConfigPatch!)}
                  >
                    {diag.remediationLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Campos Diretos da Lógica (Variáveis e Blocos Chamados) */}
      {activeTemplate && activeTemplate.variables.length > 0 && (
        <div className={`logic-slots-grid ${isExplicitlyIncompatible ? 'has-error' : ''}`}>
          {activeTemplate.variables.map((slot) => {
            const currentVal = getSlotEffectiveValue(slot);

            if (slot.type === 'block_ref') {
              const recommendedNodes = otherBlocks.filter(
                (n) => !slot.allowedKinds || slot.allowedKinds.includes(n.data.kind),
              );
              const otherNodes = otherBlocks.filter(
                (n) => slot.allowedKinds && !slot.allowedKinds.includes(n.data.kind),
              );

              return (
                <div key={slot.key} className="logic-slot-field span-full">
                  <div className="logic-slot-label-row">
                    <label>{slot.label}</label>
                    {slot.edgeBinding && (
                      <code className="slot-code-badge">
                        .{slot.edgeBinding.sourceHandle || 'next'} ➔{' '}
                        {currentVal ? `${toSafeFunctionName(currentVal)}()` : '...'}
                      </code>
                    )}
                  </div>
                  <select
                    className="logic-slot-select block-ref-select"
                    value={currentVal}
                    onChange={(e) => handleSlotChange(slot, e.target.value)}
                  >
                    <option value="">-- Nenhum bloco selecionado --</option>
                    {recommendedNodes.length > 0 && (
                      <optgroup label="Blocos Compatíveis">
                        {recommendedNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.data.label} → {toSafeFunctionName(n.id)}()
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {slot.allowedKinds && onCreateAndBindBlock && (
                      <optgroup label="Criar Novo Bloco Automaticamente">
                        {slot.allowedKinds.map((k) => (
                          <option key={`create-${k}`} value={`__CREATE__:${k}`}>
                            + Criar {catalog[k]?.name || k} e conectar
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherNodes.length > 0 && (
                      <optgroup label="Outros Blocos (Incompatíveis)">
                        {otherNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            ⚠️ {n.data.label} (#{n.id})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            }

            if (slot.type === 'screen_ref') {
              return (
                <div key={slot.key} className="logic-slot-field span-full">
                  <div className="logic-slot-label-row">
                    <label>{slot.label}</label>
                    <code className="slot-code-badge">navigateTo('{currentVal || '...'}')</code>
                  </div>
                  <select
                    className="logic-slot-select"
                    value={currentVal}
                    onChange={(e) => handleSlotChange(slot, e.target.value)}
                  >
                    <option value="">-- Escolha a Tela --</option>
                    {screenBlocks.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.data.label} (#{s.id})
                      </option>
                    ))}
                    {onCreateAndBindBlock && (
                      <option value="__CREATE__:screen">+ Criar Nova Tela</option>
                    )}
                  </select>
                </div>
              );
            }

            if (slot.type === 'input_ref') {
              return (
                <div key={slot.key} className="logic-slot-field span-full">
                  <div className="logic-slot-label-row">
                    <label>{slot.label}</label>
                    <code className="slot-code-badge">read('{currentVal || 'value'}')</code>
                  </div>
                  <select
                    className="logic-slot-select"
                    value={currentVal}
                    onChange={(e) => handleSlotChange(slot, e.target.value)}
                  >
                    <option value="">Entrada padrão (value)</option>
                    {inputBlocks.map((inp) => (
                      <option key={inp.id} value={inp.id}>
                        {inp.data.label} (#{inp.id})
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (slot.type === 'select' && slot.options) {
              return (
                <div key={slot.key} className="logic-slot-field">
                  <label>{slot.label}</label>
                  <select
                    className="logic-slot-select"
                    value={currentVal}
                    onChange={(e) => handleSlotChange(slot, e.target.value)}
                  >
                    {slot.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={slot.key} className="logic-slot-field">
                <label>{slot.label}</label>
                <input
                  type={slot.type === 'number' ? 'number' : 'text'}
                  className="logic-slot-input"
                  value={currentVal}
                  placeholder={slot.placeholder || slot.defaultValue || ''}
                  onChange={(e) => handleSlotChange(slot, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Código Vivo (Mostra exatamente o que as opções escolhidas estão executando) */}
      <div className="logic-live-code-box">
        <div className="logic-live-code-header">
          <span>
            <Code size={11} /> Código da Lógica
          </span>
          <code>{fnName}()</code>
        </div>
        <pre className="logic-live-code-pre">
          <code>{liveCodeSnippet}</code>
        </pre>
      </div>

      {/* 6. Sugestões Rápidas em Pílulas (1 Clique) */}
      {analysis.recommendations.length > 0 && onApplyRecommendation && (
        <div className="logic-quick-suggestions">
          <span className="quick-sug-label">Sugestão:</span>
          <div className="quick-sug-pills">
            {analysis.recommendations.map((rec, idx) => {
              const targetDef = catalog[rec.targetKind];
              return (
                <button
                  key={`${rec.targetKind}-${rec.sourceHandle}-${idx}`}
                  type="button"
                  className="quick-sug-pill"
                  onClick={() => onApplyRecommendation(rec)}
                  title={rec.reason}
                >
                  <Sparkles size={10} />
                  <span>
                    + {targetDef?.name || rec.targetKind} (<code>.{rec.sourceHandle}</code>)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
