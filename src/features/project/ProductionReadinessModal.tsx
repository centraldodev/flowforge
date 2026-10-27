import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  RefreshCw,
  Rocket,
  Server,
  ShieldCheck,
  TestTube,
  XCircle,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { auditProductionReadiness, type Graph, type ReadinessCheck } from '../../engine';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph;
  onOpenTests?: () => void;
  onOpenExport?: () => void;
};

export function ProductionReadinessModal({
  isOpen,
  onClose,
  graph,
  onOpenTests,
  onOpenExport,
}: Props) {
  const [report, setReport] = useState(() => auditProductionReadiness(graph));

  const handleRefresh = () => {
    setReport(auditProductionReadiness(graph));
  };

  const getCategoryIcon = (category: ReadinessCheck['category']) => {
    switch (category) {
      case 'security':
        return <ShieldCheck size={18} className="text-emerald-400" />;
      case 'database':
        return <Database size={18} className="text-blue-400" />;
      case 'integrations':
        return <Server size={18} className="text-purple-400" />;
      case 'tests':
        return <TestTube size={18} className="text-amber-400" />;
      case 'devops':
        return <Rocket size={18} className="text-cyan-400" />;
      case 'documentation':
        return <FileCode2 size={18} className="text-indigo-400" />;
      default:
        return <ShieldCheck size={18} />;
    }
  };

  const getStatusBadge = (status: ReadinessCheck['status']) => {
    if (status === 'pass') {
      return (
        <span className="badge badge-pass">
          <CheckCircle2 size={13} /> Aprovado
        </span>
      );
    }
    if (status === 'warn') {
      return (
        <span className="badge badge-warn">
          <AlertTriangle size={13} /> Atenção
        </span>
      );
    }
    return (
      <span className="badge badge-fail">
        <XCircle size={13} /> Pendente
      </span>
    );
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A') return '#10b981';
    if (grade === 'B') return '#3b82f6';
    if (grade === 'C') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🚀 Prontidão de Produção (Release v1.0.0)">
      <div className="test-runner-container">
        {/* Banner de Prontidão */}
        <div
          className="readiness-score-card"
          style={{
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '18px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#0f172a',
                border: `3px solid ${getGradeColor(report.grade)}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              <span style={{ fontSize: '18px', color: getGradeColor(report.grade) }}>
                {report.score}%
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Classe {report.grade}</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                {report.status === 'ready'
                  ? 'Pronto para Produção Enterprise'
                  : report.status === 'needs_review'
                    ? 'Requer Pequenos Ajustes'
                    : 'Ajustes Críticos Pendentes'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                {report.summary.passed} verificações aprovadas · {report.summary.warnings} aviso(s)
                · {report.summary.failures} falha(s)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary" onClick={handleRefresh} title="Reavaliar checklist">
              <RefreshCw size={14} /> Atualizar
            </button>
            {onOpenExport && (
              <button
                className="primary"
                onClick={() => {
                  onClose();
                  onOpenExport();
                }}
              >
                <Rocket size={14} /> Exportar Monorepo
              </button>
            )}
          </div>
        </div>

        {/* Lista de Verificações */}
        <div className="test-scenarios-list" style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {report.checks.map((chk) => (
            <div
              key={chk.id}
              className="scenario-card"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getCategoryIcon(chk.category)}
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '14px' }}>
                    {chk.title}
                  </span>
                </div>
                {getStatusBadge(chk.status)}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#cbd5e1' }}>{chk.message}</p>
              {chk.details && (
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '12px',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  💡 {chk.details}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Rodapé com Dicas Operacionais */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            OpenAPI 3.0 disponível em <code>/api/docs</code> no backend exportado.
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            {onOpenTests && (
              <button
                className="secondary"
                onClick={() => {
                  onClose();
                  onOpenTests();
                }}
              >
                <TestTube size={14} /> Executar Testes E2E
              </button>
            )}
            <button className="primary" onClick={onClose}>
              Concluir
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
