import { useState, type FormEvent } from 'react';
import { Plus, Trash2, X, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  ensureBlockPorts,
  getPortType,
  type Block,
  type CustomPort,
  type Graph,
  type ScreenRoute,
} from '../../engine';
import { ScreenTransitions } from './ScreenTransitions';

type Props = {
  graph: Graph;
  chosen: Block | undefined;
  onUpdateRoutes: (routes: ScreenRoute[]) => void;
  onRemoveEdge: (id: string) => void;
  onAddPort: (port: CustomPort) => void;
  onRemovePort: (portId: string) => void;
};

export function Connections({
  graph,
  chosen,
  onUpdateRoutes,
  onRemoveEdge,
  onAddPort,
  onRemovePort,
}: Props) {
  const [customName, setCustomName] = useState('');
  const [customDirection, setCustomDirection] = useState<'input' | 'output'>('output');
  const [showCustomForm, setShowCustomForm] = useState(false);

  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  const portsList = ensureBlockPorts(chosen);
  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);

  function handleAddPreset(name: string, direction: 'input' | 'output', type?: string) {
    if (!chosen) return;
    let id = name;
    let counter = 2;
    while (portsList.some((p) => p.id === id)) {
      id = `${name}_${counter++}`;
    }
    onAddPort({ id, name, direction, type });
  }

  function handleAddCustom(e: FormEvent) {
    e.preventDefault();
    if (!customName.trim() || !chosen) return;
    const name = customName.trim();
    let id = name.toLowerCase().replace(/\s+/g, '_');
    let counter = 2;
    while (portsList.some((p) => p.id === id)) {
      id = `${name}_${counter++}`;
    }
    onAddPort({ id, name, direction: customDirection });
    setCustomName('');
    setShowCustomForm(false);
  }

  return (
    <div className="connections-manager">
      <div className="section-title">
        <strong>Portas de Conexão</strong>
        <span className="badge-count">{portsList.length}</span>
      </div>

      <p className="subtle">
        Conecte o Lado A (Eventos: <code>onClick</code>, <code>then</code>, <code>onSuccess</code>)
        ao Lado B (Ouvintes: <code>trigger</code>, <code>execute</code>, <code>onEnter</code>).
      </p>

      {/* Lista de portas configuradas */}
      <div className="ports-list">
        {portsList.length === 0 ? (
          <div className="no-ports-notice">
            Bloco vazio sem conexões. Adicione portas abaixo para conectá-lo no canvas.
          </div>
        ) : (
          portsList.map((port) => {
            const edgeCount = blockEdges.filter(
              (e) =>
                (port.direction === 'output' &&
                  e.source === chosen.id &&
                  e.sourceHandle === port.id) ||
                (port.direction === 'input' &&
                  e.target === chosen.id &&
                  e.targetHandle === port.id),
            ).length;

            return (
              <div className="port-chip-row" key={port.id}>
                <div className="port-chip-info">
                  <span className={`direction-tag ${port.direction}`}>
                    {port.direction === 'input' ? (
                      <ArrowRight size={10} />
                    ) : (
                      <ArrowLeft size={10} />
                    )}
                    {port.direction === 'input' ? 'IN' : 'OUT'}
                  </span>
                  <strong className="port-name">{port.name}</strong>
                  {(port.type || getPortType(port.id)) && (
                    <span className="port-type-tag">:{port.type || getPortType(port.id)}</span>
                  )}
                  {edgeCount > 0 ? (
                    <span className="port-edge-count">{edgeCount} fio(s)</span>
                  ) : (
                    <span className="port-idle-status">livre</span>
                  )}
                </div>
                <button
                  type="button"
                  className="port-remove-btn"
                  title={`Remover porta ${port.name}`}
                  aria-label={`Remover porta ${port.name}`}
                  onClick={() => onRemovePort(port.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Ações rápidas recomendadas para o bloco selecionado */}
      <div className="add-ports-section">
        <label className="section-label">Conexões sugeridas para este bloco:</label>
        <div className="quick-port-buttons">
          {chosen.data.kind === 'button' && (
            <>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Evento de clique do botão"
                onClick={() => handleAddPreset('onClick', 'output', 'Event')}
              >
                <Plus size={12} /> onClick: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Desativa o botão quando verdadeiro"
                onClick={() => handleAddPreset('disabled', 'input', 'boolean')}
              >
                <Plus size={12} /> disabled: boolean (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Texto ou valor associado ao botão"
                onClick={() => handleAddPreset('value', 'output', 'string')}
              >
                <Plus size={12} /> value (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'input' && (
            <>
              <button
                type="button"
                className="chip-btn output"
                title="Valor de texto digitado no campo"
                onClick={() => handleAddPreset('value', 'output', 'string')}
              >
                <Plus size={12} /> value: string (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Evento disparado quando o valor muda"
                onClick={() => handleAddPreset('onChange', 'output', 'Event')}
              >
                <Plus size={12} /> onChange: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Desativa o campo quando verdadeiro"
                onClick={() => handleAddPreset('disabled', 'input', 'boolean')}
              >
                <Plus size={12} /> disabled: boolean (in)
              </button>
            </>
          )}

          {chosen.data.kind === 'function' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Executar a função"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: mensagem recebida pela função"
                onClick={() => handleAddPreset('message', 'input', 'string')}
              >
                <Plus size={12} /> message: string (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dados / argumentos passados para a função"
                onClick={() => handleAddPreset('value', 'input', 'string')}
              >
                <Plus size={12} /> value (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Evento de dispensa ou finalização"
                onClick={() => handleAddPreset('onDismiss', 'output', 'Event')}
              >
                <Plus size={12} /> onDismiss: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Continuação após execução (promise then)"
                onClick={() => handleAddPreset('then', 'output', 'Event')}
              >
                <Plus size={12} /> then: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Resultado / retorno retornado pela função"
                onClick={() => handleAddPreset('result', 'output', 'any')}
              >
                <Plus size={12} /> result (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'condition' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Disparar avaliação da condição"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Valor de entrada a ser comparado"
                onClick={() => handleAddPreset('value', 'input', 'string')}
              >
                <Plus size={12} /> value (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Ramo executado quando a condição for verdadeira"
                onClick={() => handleAddPreset('true', 'output', 'Event')}
              >
                <Plus size={12} /> true: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Ramo executado quando a condição for falsa"
                onClick={() => handleAddPreset('false', 'output', 'Event')}
              >
                <Plus size={12} /> false: Event (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'error' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Dispara o alerta ou tratamento do erro"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: mensagem personalizada de erro recebida"
                onClick={() => handleAddPreset('message', 'input', 'string')}
              >
                <Plus size={12} /> message: string (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: objeto do erro lançado"
                onClick={() => handleAddPreset('error', 'input', 'Error')}
              >
                <Plus size={12} /> error: Error (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Evento disparado ao dispensar/fechar o erro"
                onClick={() => handleAddPreset('onDismiss', 'output', 'Event')}
              >
                <Plus size={12} /> onDismiss: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Evento para tentar novamente a operação"
                onClick={() => handleAddPreset('retry', 'output', 'Event')}
              >
                <Plus size={12} /> retry: Event (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'auth' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Dispara o fluxo de autenticação (ex: via onClick)"
                onClick={() => handleAddPreset('trigger', 'input', 'Event')}
              >
                <Plus size={12} /> trigger: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: e-mail do usuário"
                onClick={() => handleAddPreset('email', 'input', 'string')}
              >
                <Plus size={12} /> email: string (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: senha do usuário"
                onClick={() => handleAddPreset('password', 'input', 'string')}
              >
                <Plus size={12} /> password: string (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Sucesso na autenticação"
                onClick={() => handleAddPreset('onSuccess', 'output', 'Event')}
              >
                <Plus size={12} /> onSuccess: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Falha na autenticação"
                onClick={() => handleAddPreset('onError', 'output', 'Error')}
              >
                <Plus size={12} /> onError: Error (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Dado: sessão ou dados do usuário autenticado"
                onClick={() => handleAddPreset('user', 'output', 'User')}
              >
                <Plus size={12} /> user: User (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'api' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Disparador da requisição HTTP"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: corpo ou parâmetros da requisição"
                onClick={() => handleAddPreset('body', 'input', 'object')}
              >
                <Plus size={12} /> body: object (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Resposta HTTP 2xx de sucesso"
                onClick={() => handleAddPreset('onSuccess', 'output', 'Event')}
              >
                <Plus size={12} /> onSuccess: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Erro HTTP ou falha de rede"
                onClick={() => handleAddPreset('onError', 'output', 'Error')}
              >
                <Plus size={12} /> onError: Error (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Dado: dados JSON retornados pela API"
                onClick={() => handleAddPreset('response', 'output', 'object')}
              >
                <Plus size={12} /> response: object (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'database' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Executa query ou insert"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: registro a ser inserido ou filtrado"
                onClick={() => handleAddPreset('value', 'input', 'object')}
              >
                <Plus size={12} /> value: object (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Operação no banco concluída com sucesso"
                onClick={() => handleAddPreset('onSuccess', 'output', 'Event')}
              >
                <Plus size={12} /> onSuccess: Event (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Erro na operação do banco"
                onClick={() => handleAddPreset('onError', 'output', 'Error')}
              >
                <Plus size={12} /> onError: Error (out)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Dado: registros retornados pelo banco"
                onClick={() => handleAddPreset('data', 'output', 'object')}
              >
                <Plus size={12} /> data: object (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'navigate' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Acionar navegação"
                onClick={() => handleAddPreset('execute', 'input', 'Event')}
              >
                <Plus size={12} /> execute: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: rota de destino"
                onClick={() => handleAddPreset('route', 'input', 'string')}
              >
                <Plus size={12} /> route: string (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Navegação concluída"
                onClick={() => handleAddPreset('onComplete', 'output', 'Event')}
              >
                <Plus size={12} /> onComplete: Event (out)
              </button>
            </>
          )}

          {chosen.data.kind === 'screen' && (
            <>
              <button
                type="button"
                className="chip-btn input"
                title="Lado B: Ouvinte disparado ao carregar/abrir a tela"
                onClick={() => handleAddPreset('onEnter', 'input', 'Event')}
              >
                <Plus size={12} /> onEnter: Event (in)
              </button>
              <button
                type="button"
                className="chip-btn input"
                title="Dado: dados do usuário recebidos pela tela"
                onClick={() => handleAddPreset('user', 'input', 'User')}
              >
                <Plus size={12} /> user: User (in)
              </button>
              <button
                type="button"
                className="chip-btn output"
                title="Lado A: Rotas e transições da tela"
                onClick={() => handleAddPreset('routes', 'output')}
              >
                <Plus size={12} /> routes (out)
              </button>
            </>
          )}
        </div>

        {/* Botão e formulário para porta personalizada */}
        {!showCustomForm ? (
          <button
            type="button"
            className="custom-port-toggle-btn"
            onClick={() => setShowCustomForm(true)}
          >
            <Plus size={13} /> Conexão personalizada...
          </button>
        ) : (
          <form className="custom-port-form" onSubmit={handleAddCustom}>
            <div className="direction-toggle-group">
              <button
                type="button"
                className={`toggle-dir-btn ${customDirection === 'output' ? 'active' : ''}`}
                onClick={() => setCustomDirection('output')}
              >
                Saída (OUT)
              </button>
              <button
                type="button"
                className={`toggle-dir-btn ${customDirection === 'input' ? 'active' : ''}`}
                onClick={() => setCustomDirection('input')}
              >
                Entrada (IN)
              </button>
            </div>
            <div className="custom-input-row">
              <input
                type="text"
                placeholder="Nome (ex: email, result, a, b)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="primary" disabled={!customName.trim()}>
                Adicionar
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomName('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Transições de tela (quando bloco é tela) */}
      {chosen.data.kind === 'screen' && (
        <ScreenTransitions graph={graph} screen={chosen} onChange={onUpdateRoutes} />
      )}

      {/* Ligações ativas no Canvas */}
      <div className="active-edges-section">
        <div className="section-title">
          <strong>Ligações no Canvas</strong>
          <span className="badge-count">{blockEdges.length}</span>
        </div>

        {blockEdges.length === 0 ? (
          <p className="subtle">Nenhum fio conectado a este bloco no momento.</p>
        ) : (
          blockEdges.map((e) => {
            const isSource = e.source === chosen.id;
            const otherId = isSource ? e.target : e.source;
            const otherNode = graph.nodes.find((n) => n.id === otherId);
            const otherLabel = otherNode?.data.label || 'Bloco';

            return (
              <div className="connection-row" key={e.id}>
                <span>
                  <strong>{otherLabel}</strong>
                  <small>
                    {isSource ? 'saída' : 'entrada'}:{' '}
                    <code>{isSource ? e.sourceHandle : e.targetHandle}</code> →{' '}
                    <code>{isSource ? e.targetHandle : e.sourceHandle}</code>
                  </small>
                </span>
                <button
                  type="button"
                  title="Desconectar fio"
                  aria-label={'Desconectar de ' + otherLabel}
                  onClick={() => onRemoveEdge(e.id)}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
