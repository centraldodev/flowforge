import { useState } from 'react';
import { Check, CheckCircle2, FlaskConical, Play, Plus, Trash2, XCircle } from 'lucide-react';
import { Modal } from '../../components/Modal';
import {
  runAllScenarios,
  runScenario,
  type AssertionKind,
  type Graph,
  type ScenarioResult,
  type TestAssertion,
  type TestScenario,
  type TestSuiteResult,
} from '../../engine';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  onUpdateGraph: (updater: (g: Graph) => Graph) => void;
};

export function TestRunnerModal({ isOpen, onClose, graph, onUpdateGraph }: Props) {
  const scenarios = graph.tests || [];
  const [suiteResult, setSuiteResult] = useState<TestSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResult>>({});

  // Formulário para novo cenário
  const [isAdding, setIsAdding] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newEntryBlockId, setNewEntryBlockId] = useState(graph.nodes[0]?.id || '');
  const [newAssertionKind, setNewAssertionKind] = useState<AssertionKind>('notification_emitted');
  const [newAssertionTarget, setNewAssertionTarget] = useState('');
  const [newAssertionExpected, setNewAssertionExpected] = useState('');

  const handleRunAll = async () => {
    setRunning(true);
    try {
      const res = await runAllScenarios(graph);
      setSuiteResult(res);
      const resultMap: Record<string, ScenarioResult> = {};
      for (const sc of res.scenarios) {
        resultMap[sc.scenarioId] = sc;
      }
      setScenarioResults(resultMap);
    } finally {
      setRunning(false);
    }
  };

  const handleRunSingle = async (scenario: TestScenario) => {
    setRunning(true);
    try {
      const res = await runScenario(scenario, graph);
      setScenarioResults((prev) => ({ ...prev, [scenario.id]: res }));
    } finally {
      setRunning(false);
    }
  };

  const handleAddScenario = () => {
    if (!newScenarioName.trim() || !newEntryBlockId) return;

    const newAssertion: TestAssertion = {
      id: 'a_' + Date.now(),
      kind: newAssertionKind,
      target: newAssertionTarget || undefined,
      expectedValue: newAssertionExpected,
      message: `Asserção ${newAssertionKind}: ${newAssertionExpected}`,
    };

    const newScenario: TestScenario = {
      id: 'test_' + Date.now(),
      name: newScenarioName.trim(),
      description: newScenarioDesc.trim() || undefined,
      entryBlockId: newEntryBlockId,
      initialInputs: {},
      assertions: [newAssertion],
    };

    onUpdateGraph((g) => ({
      ...g,
      tests: [...(g.tests || []), newScenario],
    }));

    setNewScenarioName('');
    setNewScenarioDesc('');
    setNewAssertionExpected('');
    setNewAssertionTarget('');
    setIsAdding(false);
  };

  const handleDeleteScenario = (id: string) => {
    onUpdateGraph((g) => ({
      ...g,
      tests: (g.tests || []).filter((t) => t.id !== id),
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cenários de Teste E2E (Sem Código)">
      <div className="test-runner-container">
        <div className="test-runner-header">
          <div className="test-runner-summary">
            <span className="summary-title">
              <FlaskConical size={16} />
              <strong>{scenarios.length} cenários de teste</strong>
            </span>
            {suiteResult && (
              <div className="suite-badges">
                <span className="badge pass">
                  <Check size={12} /> {suiteResult.passed} aprovados
                </span>
                {suiteResult.failed > 0 && (
                  <span className="badge fail">
                    <XCircle size={12} /> {suiteResult.failed} falhas
                  </span>
                )}
                <span className="badge duration">{suiteResult.durationMs}ms</span>
              </div>
            )}
          </div>

          <div className="test-runner-actions">
            <button
              type="button"
              className="test-btn primary"
              onClick={handleRunAll}
              disabled={running || scenarios.length === 0}
            >
              <Play size={13} />
              <span>{running ? 'Executando...' : 'Executar Todos'}</span>
            </button>
            <button
              type="button"
              className="test-btn secondary"
              onClick={() => setIsAdding((v) => !v)}
            >
              <Plus size={13} />
              <span>Novo Cenário</span>
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="new-scenario-card">
            <h4>Adicionar Novo Cenário de Teste</h4>
            <div className="scenario-form-grid">
              <label className="form-field">
                Nome do Cenário:
                <input
                  type="text"
                  placeholder="Ex: Cadastro com CEP Válido"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                />
              </label>

              <label className="form-field">
                Bloco Gatilho de Entrada:
                <select
                  value={newEntryBlockId}
                  onChange={(e) => setNewEntryBlockId(e.target.value)}
                >
                  {graph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.label || n.id} (#{n.id} - {n.data.kind})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-field">
              Descrição (Objetivo do Teste):
              <input
                type="text"
                placeholder="Ex: Garante que o endereço é preenchido e salvo no banco"
                value={newScenarioDesc}
                onChange={(e) => setNewScenarioDesc(e.target.value)}
              />
            </label>

            <div className="assertion-form-row">
              <label className="form-field">
                Tipo de Asserção:
                <select
                  value={newAssertionKind}
                  onChange={(e) => setNewAssertionKind(e.target.value as AssertionKind)}
                >
                  <option value="notification_emitted">Notificação emitida contém</option>
                  <option value="screen_equals">Navega para tela</option>
                  <option value="trace_contains">Bloco executado</option>
                  <option value="store_contains">Memória (Store) contém</option>
                  <option value="output_equals">Saída do bloco igual a</option>
                </select>
              </label>

              <label className="form-field">
                Alvo (opcional):
                <input
                  type="text"
                  placeholder="Chave do store ou bloco"
                  value={newAssertionTarget}
                  onChange={(e) => setNewAssertionTarget(e.target.value)}
                />
              </label>

              <label className="form-field">
                Valor Esperado:
                <input
                  type="text"
                  placeholder="Ex: Sucesso"
                  value={newAssertionExpected}
                  onChange={(e) => setNewAssertionExpected(e.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="test-btn confirm"
                onClick={handleAddScenario}
                disabled={!newScenarioName.trim()}
              >
                Salvar Cenário
              </button>
              <button type="button" className="test-btn cancel" onClick={() => setIsAdding(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="scenarios-list">
          {scenarios.length === 0 ? (
            <div className="empty-scenarios">
              <FlaskConical size={32} />
              <p>Nenhum cenário de teste cadastrado neste projeto.</p>
              <p className="empty-hint">
                Crie cenários para validar fluxos, telas e integrações sem precisar testar
                manualmente.
              </p>
            </div>
          ) : (
            scenarios.map((sc) => {
              const result = scenarioResults[sc.id];
              return (
                <div
                  key={sc.id}
                  className={`scenario-card ${result ? (result.passed ? 'passed' : 'failed') : ''}`}
                >
                  <div className="scenario-card-header">
                    <div className="scenario-title-area">
                      {result ? (
                        result.passed ? (
                          <CheckCircle2 size={16} className="status-icon pass" />
                        ) : (
                          <XCircle size={16} className="status-icon fail" />
                        )
                      ) : (
                        <FlaskConical size={16} className="status-icon idle" />
                      )}
                      <div>
                        <strong>{sc.name}</strong>
                        {sc.description && <p className="scenario-desc">{sc.description}</p>}
                      </div>
                    </div>

                    <div className="scenario-card-actions">
                      <span className="trigger-tag" title="Gatilho de entrada">
                        #{sc.entryBlockId}
                      </span>
                      <button
                        type="button"
                        className="test-btn icon"
                        onClick={() => handleRunSingle(sc)}
                        disabled={running}
                        title="Executar este cenário"
                      >
                        <Play size={12} />
                      </button>
                      <button
                        type="button"
                        className="test-btn icon danger"
                        onClick={() => handleDeleteScenario(sc.id)}
                        title="Excluir cenário"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Asserções */}
                  <div className="assertions-container">
                    {sc.assertions.map((a) => {
                      const aRes = result?.assertions.find((r) => r.id === a.id);
                      return (
                        <div
                          key={a.id}
                          className={`assertion-item ${
                            aRes ? (aRes.passed ? 'passed' : 'failed') : ''
                          }`}
                        >
                          <span className="assertion-kind">{a.kind}</span>
                          <span className="assertion-message">
                            {a.message || String(a.expectedValue)}
                          </span>
                          {aRes && !aRes.passed && (
                            <span className="assertion-error">
                              Esperado: {JSON.stringify(aRes.expected)} · Obtido:{' '}
                              {JSON.stringify(aRes.actual)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {result?.error && (
                    <div className="scenario-fatal-error">
                      <strong>Erro na Execução:</strong> {result.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
