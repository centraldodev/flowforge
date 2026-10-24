import { useState } from 'react';
import { Database, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import type { Block } from '../../engine';

type UserRecord = {
  id?: number | string;
  nome?: string;
  email?: string;
  senha?: string;
  provider?: string;
  [key: string]: unknown;
};

type Props = {
  block: Block;
  onChange: (config: Record<string, string>) => void;
};

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 1,
    nome: 'Usuário Teste',
    email: 'demo@exemplo.com',
    senha: '123456',
    provider: 'email',
  },
  {
    id: 2,
    nome: 'Google Teste',
    email: 'google.teste@gmail.com',
    senha: 'google_oauth_pass',
    provider: 'google',
  },
];

export function DatabaseManager({ block, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newProvider, setNewProvider] = useState<'email' | 'google'>('email');

  const rawMock = block.data.config.mock || '[]';
  const tableName = block.data.config.table || 'usuarios';

  let records: UserRecord[] = [];
  let isInvalidJson = false;

  try {
    const parsed = JSON.parse(rawMock);
    if (Array.isArray(parsed)) {
      records = parsed;
    } else {
      isInvalidJson = true;
    }
  } catch {
    isInvalidJson = true;
  }

  function updateRecords(next: UserRecord[]) {
    onChange({ mock: JSON.stringify(next, null, 2) });
  }

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const newRecord: UserRecord = {
      id: records.length > 0 ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1,
      nome: newNome.trim() || newEmail.split('@')[0],
      email: newEmail.trim(),
      senha: newSenha.trim() || '123456',
      provider: newProvider,
    };

    updateRecords([...records, newRecord]);
    setNewEmail('');
    setNewSenha('');
    setNewNome('');
    setShowAdd(false);
  }

  function handleDelete(index: number) {
    const next = records.filter((_, i) => i !== index);
    updateRecords(next);
  }

  function handleResetDefault() {
    updateRecords(DEFAULT_USERS);
  }

  return (
    <div className="db-manager">
      <div className="db-manager-header">
        <div className="db-manager-title">
          <Database size={15} />
          <span>Tabela: {tableName}</span>
        </div>
        <span className="db-records-badge">{records.length} registro(s)</span>
      </div>

      {isInvalidJson && (
        <div className="db-warning">
          <span>O formato atual não é um array JSON válido.</span>
          <button type="button" onClick={handleResetDefault}>
            Inicializar tabela padrão
          </button>
        </div>
      )}

      {!isInvalidJson && (
        <>
          <div className="db-table-container">
            {records.length === 0 ? (
              <div className="db-empty">
                <span>Nenhum usuário cadastrado nesta tabela.</span>
              </div>
            ) : (
              <div className="db-record-list">
                {records.map((r, i) => (
                  <div key={i} className="db-record-item">
                    <div className="db-record-main">
                      <div className="db-record-top">
                        <strong className="db-record-email">{r.email || '(sem email)'}</strong>
                        <span className={`db-provider-badge provider-${r.provider || 'email'}`}>
                          {r.provider || 'email'}
                        </span>
                      </div>
                      <div className="db-record-sub">
                        <span>{r.nome || 'Sem nome'}</span>
                        <span className="db-record-pass" title="Senha de teste">
                          senha: {r.senha || '••••••'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="db-delete-btn"
                      title="Remover usuário"
                      aria-label="Remover usuário"
                      onClick={() => handleDelete(i)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAdd ? (
            <form onSubmit={handleAddUser} className="db-add-form">
              <div className="db-form-row">
                <input
                  type="email"
                  placeholder="E-mail teste"
                  value={newEmail}
                  required
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="db-form-row">
                <input
                  type="text"
                  placeholder="Senha"
                  value={newSenha}
                  onChange={(e) => setNewSenha(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Nome (opcional)"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                />
              </div>
              <div className="db-form-row db-form-actions">
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as 'email' | 'google')}
                >
                  <option value="email">E-mail</option>
                  <option value="google">Google OAuth</option>
                </select>
                <div className="db-btn-group">
                  <button type="button" className="secondary" onClick={() => setShowAdd(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary">
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="db-actions-bar">
              <button type="button" className="db-add-btn" onClick={() => setShowAdd(true)}>
                <UserPlus size={13} />
                <span>Novo usuário</span>
              </button>
              <button
                type="button"
                className="db-reset-btn"
                title="Restaurar dados de teste padrão"
                onClick={handleResetDefault}
              >
                <RotateCcw size={13} />
                <span>Restaurar demo</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
