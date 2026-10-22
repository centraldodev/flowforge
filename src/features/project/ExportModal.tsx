import { useState } from 'react';
import { Check, Code2, Download, FileJson } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { Graph } from '../../engine';
import { downloadGraph, exportLanguages, exportProject, type ExportLanguage } from '../../export';

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

  const langInfo = exportLanguages[lang];

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
          <Check size={14} /> Código-fonte + grafo JSON + instruções
        </span>
      </div>
      <div className="info-box">
        Integrações são simuladas. Cada nova linguagem precisa de um gerador próprio; esta versão
        oferece TypeScript e Python.
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
      <button className="wide text-button" onClick={handleExportJson}>
        <FileJson size={14} /> Baixar somente o fluxo JSON
      </button>
    </Modal>
  );
}
