import { useState, useMemo } from 'react';
import { Check, Code2, Copy, Download, FileCode, Layers } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { generateScreenCode, getBlocksForScreen, type Graph } from '../../engine';
import { downloadScreenScript } from '../../export';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  initialScreenId?: string;
  onNotify: (message: string) => void;
};

export function CodeViewerModal({ isOpen, onClose, graph, initialScreenId, onNotify }: Props) {
  const screens = useMemo(() => graph.nodes.filter((n) => n.data.kind === 'screen'), [graph.nodes]);

  const fallbackScreenId = screens[0]?.id || 'main';
  const [selectedScreenId, setSelectedScreenId] = useState<string>(
    initialScreenId && screens.some((s) => s.id === initialScreenId)
      ? initialScreenId
      : fallbackScreenId,
  );
  const [copied, setCopied] = useState(false);

  const activeScreenId = screens.some((s) => s.id === selectedScreenId)
    ? selectedScreenId
    : fallbackScreenId;

  const currentScreenNode = screens.find((s) => s.id === activeScreenId);
  const screenTitle = currentScreenNode?.data.label || activeScreenId;

  const screenBlocks = useMemo(
    () => getBlocksForScreen(graph, activeScreenId),
    [graph, activeScreenId],
  );

  const screenCode = useMemo(
    () => generateScreenCode(graph, activeScreenId),
    [graph, activeScreenId],
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(screenCode);
      setCopied(true);
      onNotify(`Código de "${screenTitle}" copiado para a área de transferência.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Falha ao copiar código.');
    }
  };

  const handleDownload = () => {
    downloadScreenScript(graph, activeScreenId);
    onNotify(`Arquivo ${activeScreenId}.js baixado com sucesso.`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Código Gerado da Tela"
      className="code-viewer-modal"
    >
      <div className="code-viewer-head">
        <span className="modal-icon">
          <Code2 size={24} />
        </span>
        <div className="eyebrow">CÓDIGO GERADO POR TELA</div>
        <h2>{screenTitle}.js</h2>
        <p>Arquivo de código exclusivo desta tela, agrupando seus blocos, regras e conexões.</p>
      </div>

      {screens.length > 1 && (
        <div className="screen-code-tabs" role="tablist">
          {screens.map((screen) => {
            const count = getBlocksForScreen(graph, screen.id).length;
            const isSelected = screen.id === activeScreenId;
            return (
              <button
                key={screen.id}
                role="tab"
                aria-selected={isSelected}
                className={`screen-code-tab ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedScreenId(screen.id);
                  setCopied(false);
                }}
              >
                <FileCode size={13} />
                <span>{screen.data.label || screen.id}.js</span>
                <span className="screen-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="code-viewer-panel">
        <div className="code-viewer-toolbar">
          <div className="code-viewer-meta">
            <span className="code-viewer-filepath">src/screens/{activeScreenId}.js</span>
            <span className="code-viewer-badge">
              <Layers size={11} /> {screenBlocks.length} blocos vinculados
            </span>
          </div>
          <div className="code-viewer-actions">
            <button
              className="code-viewer-btn"
              onClick={handleCopyCode}
              title="Copiar código desta tela"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              className="code-viewer-btn primary-btn"
              onClick={handleDownload}
              title="Baixar arquivo JavaScript desta tela"
            >
              <Download size={13} />
              Baixar .js
            </button>
          </div>
        </div>

        <pre className="code-viewer-pre">
          <code>{screenCode}</code>
        </pre>
      </div>
    </Modal>
  );
}
