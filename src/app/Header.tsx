import { ChevronRight, Code2, Play, Workflow } from 'lucide-react';

type Props = {
  projectName: string;
  onRenameProject: (name: string) => void;
  onSimulate: () => void;
  onViewCode: () => void;
};

export function Header({ projectName, onRenameProject, onSimulate, onViewCode }: Props) {
  return (
    <header>
      <div className="brand">
        <span className="brand-symbol">
          <Workflow size={23} />
        </span>
        flowforge<span className="beta">BETA</span>
      </div>
      <div className="project-breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={14} />
        <input
          aria-label="Nome do projeto"
          value={projectName}
          onChange={(e) => onRenameProject(e.target.value)}
        />
        <span className="saved">
          <span /> Salvo localmente
        </span>
      </div>
      <div className="top-actions">
        <button className="secondary" onClick={onViewCode} title="Visualizar código por tela">
          <Code2 size={15} /> Ver Código
        </button>
        <button className="secondary" onClick={onSimulate}>
          <Play size={15} /> Simular
        </button>
      </div>
    </header>
  );
}
