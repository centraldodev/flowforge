import { useState, useMemo } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode,
  FileJson,
  Server,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { analyzeEnvironment, generateProjectCode, type Graph } from '../../engine';
import {
  downloadGraph,
  downloadWorkflowScript,
  exportLanguages,
  exportProject,
  type ExportLanguage,
} from '../../export';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  errors: string[];
  onNotify: (message: string) => void;
};

export function ExportModal({ isOpen, onClose, graph, errors, onNotify }: Props) {
  const [lang, setLang] = useState<ExportLanguage>('typescript');
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copied, setCopied] = useState(false);

  const langInfo = exportLanguages[lang];
  const hasRealHttp = graph.nodes.some(
    (node) =>
      node.data.kind === 'httpConnection' ||
      (node.data.kind === 'api' && node.data.config.mode === 'real'),
  );
  const projectCode = generateProjectCode(graph);
  const envReport = useMemo(() => analyzeEnvironment(graph), [graph]);

  const handleExportZip = async () => {
    setBusy(true);
    try {
      await exportProject(graph, lang);
      onNotify('Projeto exportado em ZIP.');
    } catch (e) {
      onNotify('Falha ao exportar: ' + String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    downloadGraph(graph);
  };

  const handleExportWorkflowJs = () => {
    downloadWorkflowScript(graph);
    onNotify('Script executável workflow.js baixado.');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(projectCode);
      setCopied(true);
      onNotify('Código copiado para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Falha ao copiar código.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exportar projeto">
      <span className="modal-icon">
        <Code2 size={25} />
      </span>
      <div className="eyebrow">PRÓXIMA ETAPA: PRODUÇÃO & HOSPEDAGEM</div>
      <h2>Seu aplicativo em código real</h2>
      <p>
        Exporte uma base modular completa com frontend React, backend Node.js, contratos e deploy
        pronto.
      </p>

      <label className="field">
        Linguagem de destino
        <select value={lang} onChange={(e) => setLang(e.target.value as ExportLanguage)}>
          <option value="typescript">TypeScript (Full-stack Monorepo com Docker)</option>
          <option value="python">Python (Desktop Tkinter & Scripts)</option>
        </select>
      </label>

      <div className="export-detail">
        <strong>{langInfo.title}</strong>
        <p>{langInfo.description}</p>
        <span>
          <Check size={14} /> Frontend React + Backend API + Pacote de Contratos
        </span>
        {lang === 'typescript' && envReport.featuresDetected.hasDatabase && (
          <span>
            <Check size={14} /> PostgreSQL 16 + docker-compose.yml + Migrações SQL
          </span>
        )}
        {lang === 'typescript' && (
          <span>
            <Check size={14} /> Dockerfile multi-stage + Verificador de Ambiente
            (scripts/check-env.mjs)
          </span>
        )}
      </div>

      {lang === 'typescript' && (
        <div className="env-diagnostics-box">
          <button
            type="button"
            className="diagnostics-toggle-btn"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
          >
            <div className="diagnostics-toggle-left">
              <Server size={15} />
              <span>Diagnóstico de Ambiente e Infraestrutura</span>
            </div>
            {showDiagnostics ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showDiagnostics && (
            <div className="diagnostics-body">
              <div className="diag-meta-grid">
                <div className="diag-badge">
                  <ShieldCheck size={13} />
                  <span>Segurança: Segredos protegidos no backend</span>
                </div>
                {envReport.featuresDetected.hasDatabase && (
                  <div className="diag-badge highlight">
                    <Server size={13} />
                    <span>Banco: PostgreSQL requerido</span>
                  </div>
                )}
                {envReport.featuresDetected.hasAuth && (
                  <div className="diag-badge">
                    <span>Identidade: RBAC e Sessões seguras</span>
                  </div>
                )}
                {envReport.featuresDetected.hasPayments && (
                  <div className="diag-badge">
                    <span>Pagamentos: Stripe / PIX</span>
                  </div>
                )}
                {envReport.featuresDetected.hasRealtime && (
                  <div className="diag-badge">
                    <span>Tempo Real: Server-Sent Events (SSE)</span>
                  </div>
                )}
              </div>

              <div className="diag-vars-list">
                <strong>Variáveis de ambiente esperadas:</strong>
                <ul>
                  {envReport.requiredVariables.map((v) => (
                    <li key={v.name}>
                      <code>{v.name}</code>: {v.description}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="diag-cli-tip">
                <Terminal size={12} />
                <span>
                  Para verificar o ambiente após descompactar:{' '}
                  <code>node scripts/check-env.mjs</code>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && <p className="error-text">Corrija antes de exportar: {errors[0]}</p>}

      <button
        className="primary wide"
        disabled={busy || errors.length > 0 || (lang === 'python' && hasRealHttp)}
        onClick={handleExportZip}
      >
        <Download size={16} />
        {busy ? 'Gerando pacote...' : 'Baixar projeto completo (.zip)'}
      </button>

      {lang === 'python' && hasRealHttp && (
        <p className="error-text">
          HTTP real e integrações de servidor exigem exportação TypeScript.
        </p>
      )}

      <button className="wide text-button" disabled={hasRealHttp} onClick={handleExportWorkflowJs}>
        <FileCode size={14} /> Baixar script rápido para teste (workflow.js)
      </button>

      <button className="wide text-button" onClick={() => setShowCode(!showCode)}>
        {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
        {showCode ? 'Ocultar código compilado' : 'Visualizar código JavaScript gerado'}
      </button>

      {showCode && (
        <div className="code-preview-box">
          <div className="code-preview-header">
            <span>workflow.js ({graph.nodes.length} blocos compilados)</span>
            <button className="code-preview-copy-btn" onClick={handleCopyCode}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <pre className="code-preview-content">{projectCode}</pre>
        </div>
      )}

      <button className="wide text-button" onClick={handleExportJson}>
        <FileJson size={14} /> Baixar somente o fluxo JSON
      </button>
    </Modal>
  );
}
