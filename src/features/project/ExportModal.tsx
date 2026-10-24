import { useState } from 'react';
import { Check, Code2, Copy, Download, Eye, EyeOff, FileCode, FileJson } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { generateProjectCode, type Graph } from '../../engine';
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
  const [copied, setCopied] = useState(false);

  const langInfo = exportLanguages[lang];
  const projectCode = generateProjectCode(graph);

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
      <div className="eyebrow">PRÓXIMA ETAPA: SEU EDITOR</div>
      <h2>Seu fluxo, em código.</h2>
      <p>Exporte uma base editável com telas, regras e conexões do seu projeto.</p>
      <label className="field">
        Linguagem de destino
        <select value={lang} onChange={(e) => setLang(e.target.value as ExportLanguage)}>
          <option value="typescript">typescript</option>
          <option value="python">python</option>
        </select>
      </label>
      <div className="export-detail">
        <strong>{langInfo.title}</strong>
        <p>{langInfo.description}</p>
        <span>
          <Check size={14} /> Código-fonte + grafo JSON + workflow.js funcional
        </span>
      </div>
      <div className="info-box">
        O arquivo <strong>workflow.js</strong> contém as funções JavaScript reais dos blocos
        conectados, com runner em memória e simulação de banco de dados e rotas.
      </div>
      {errors.length > 0 && <p className="error-text">Corrija antes de exportar: {errors[0]}</p>}
      <button
        className="primary wide"
        disabled={busy || errors.length > 0}
        onClick={handleExportZip}
      >
        <Download size={16} />
        {busy ? 'Gerando projeto...' : 'Baixar projeto .zip'}
      </button>

      <button className="wide text-button" onClick={handleExportWorkflowJs}>
        <FileCode size={14} /> Baixar script executável (workflow.js)
      </button>

      <button className="wide text-button" onClick={() => setShowCode(!showCode)}>
        {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
        {showCode ? 'Ocultar código gerado' : 'Visualizar código JavaScript gerado'}
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
