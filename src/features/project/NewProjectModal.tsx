import { useState } from 'react';
import {
  FilePlus2,
  Plus,
  ShoppingBag,
  CalendarCheck,
  ShieldCheck,
  Sparkles,
  Check,
} from 'lucide-react';
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
    id: 'customerOrders',
    title: 'Gestor de Clientes e Pedidos',
    subtitle: 'App de Referência 1',
    description:
      'Login real, CRUD em PostgreSQL, cálculo de itens, transações e consumo de API externa.',
    icon: ShoppingBag,
    color: '#10b981',
    tags: ['PostgreSQL', 'Auth', 'API', 'Transações'],
    defaultName: 'Gestor de Clientes e Pedidos',
  },
  {
    id: 'scheduling',
    title: 'Agendamento sem Conflito',
    subtitle: 'App de Referência 2',
    description:
      'Regras visuais de negócios para validação de conflitos de horários e alertas automáticos.',
    icon: CalendarCheck,
    color: '#f59e0b',
    tags: ['Regras de Negócio', 'Validação', 'Notificações'],
    defaultName: 'Sistema de Agendamentos',
  },
  {
    id: 'roleApproval',
    title: 'Portal de Aprovação por Papéis',
    subtitle: 'App de Referência 3',
    description:
      'Controle de acesso baseado em funções (RBAC), telas protegidas e políticas de segurança.',
    icon: ShieldCheck,
    color: '#ec4899',
    tags: ['RBAC', 'Políticas', 'Segurança'],
    defaultName: 'Portal de Aprovações',
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
    <Modal isOpen={isOpen} onClose={onClose} title="Novo projeto">
      <span className="modal-icon">
        <FilePlus2 size={25} />
      </span>
      <h2>Criar novo aplicativo</h2>
      <p>
        Escolha começar em branco ou acelere seu desenvolvimento com um dos nossos apps de
        referência canônicos testados de ponta a ponta.
      </p>

      <div className="template-selector-section">
        <span className="eyebrow">MODELO OU APP DE REFERÊNCIA</span>
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
