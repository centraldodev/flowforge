import { useState } from 'react';
import { FilePlus2, Plus, ShoppingBag, ListChecks, Users, Sparkles, Check } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { ProjectTemplateId } from '../../app/useEditorActions';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateId?: ProjectTemplateId) => void;
};

interface TemplateOption {
  id: ProjectTemplateId;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof FilePlus2;
  color: string;
  tags: string[];
  defaultName: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'empty',
    title: 'Projeto em Branco',
    subtitle: 'Comece do zero',
    description:
      'Um canvas limpo para você modelar suas telas, lógica e regras do seu próprio jeito.',
    icon: Sparkles,
    color: '#818cf8',
    tags: ['Canvas Livre', 'Sem Código'],
    defaultName: 'Meu Novo Aplicativo',
  },
  {
    id: 'tasks',
    title: 'App de tarefas',
    subtitle: 'Lista com cadastro e edição',
    description: 'Cadastro, login e gerenciamento de tarefas com PostgreSQL configurável.',
    icon: ListChecks,
    color: '#10b981',
    tags: ['PostgreSQL', 'Auth', 'CRUD'],
    defaultName: 'Minhas Tarefas',
  },
  {
    id: 'store',
    title: 'Loja virtual — catálogo',
    subtitle: 'Cadastro de produtos',
    description:
      'Gerencie produtos com login e banco real. Checkout e pagamentos ainda não estão incluídos.',
    icon: ShoppingBag,
    color: '#f59e0b',
    tags: ['Produtos', 'PostgreSQL', 'CRUD'],
    defaultName: 'Catálogo de Produtos',
  },
  {
    id: 'social',
    title: 'Rede social — mural',
    subtitle: 'Publicações com login',
    description:
      'Crie e gerencie publicações. Perfis, curtidas e comentários ainda não estão incluídos.',
    icon: Users,
    color: '#ec4899',
    tags: ['Publicações', 'PostgreSQL', 'CRUD'],
    defaultName: 'Mural de Publicações',
  },
];

export function NewProjectModal({ isOpen, onClose, onCreate }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateId>('empty');
  const [projectName, setProjectName] = useState('Meu Novo Aplicativo');

  const handleSelectTemplate = (tmpl: TemplateOption) => {
    setSelectedTemplate(tmpl.id);
    setProjectName(tmpl.defaultName);
  };

  const handleCreate = () => {
    const trimmed = projectName.trim();
    if (trimmed) {
      onCreate(trimmed, selectedTemplate);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo projeto" className="new-project-modal">
      <span className="modal-icon">
        <FilePlus2 size={24} />
      </span>
      <h2>Criar novo aplicativo</h2>
      <p>
        Escolha um modelo e configure sua conexão PostgreSQL e credenciais antes de executar. Os
        modelos usam dados compartilhados entre usuários autenticados.
      </p>

      <div className="template-selector-section">
        <span className="eyebrow">MODELOS DE APLICATIVO</span>
        <div className="template-grid">
          {TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            const isSelected = selectedTemplate === tmpl.id;
            return (
              <button
                type="button"
                key={tmpl.id}
                className={`template-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectTemplate(tmpl)}
              >
                <div className="template-card-header">
                  <div
                    className="template-icon"
                    style={{ backgroundColor: `${tmpl.color}18`, color: tmpl.color }}
                  >
                    <Icon size={18} />
                  </div>
                  {isSelected && (
                    <span className="template-check-badge">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <div className="template-card-body">
                  <strong>{tmpl.title}</strong>
                  <small className="template-subtitle">{tmpl.subtitle}</small>
                  <p>{tmpl.description}</p>
                </div>
                <div className="template-card-footer">
                  {tmpl.tags.map((tag) => (
                    <span key={tag} className="template-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <label className="field" style={{ marginTop: 18 }}>
        Nome do aplicativo
        <input
          autoFocus
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
          placeholder="Ex: Minha Empresa App"
        />
      </label>

      <button className="primary wide" disabled={!projectName.trim()} onClick={handleCreate}>
        <Plus size={16} />
        Criar aplicativo
      </button>
    </Modal>
  );
}
