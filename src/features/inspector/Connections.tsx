import { Plus } from 'lucide-react';
import {
  ensureBlockPorts,
  type Block,
  type CustomPort,
  type Graph,
  type ScreenRoute,
} from '../../engine';
import { CustomPortForm } from './CustomPortForm';
import { EdgeList } from './EdgeList';
import { PortList } from './PortList';
import { portPresets, uniquePortId, type PortPreset } from './portPresets';
import { ScreenTransitions } from './ScreenTransitions';

type Props = {
  graph: Graph;
  chosen: Block | undefined;
  onUpdateRoutes: (routes: ScreenRoute[]) => void;
  onRemoveEdge: (id: string) => void;
  onAddPort: (port: CustomPort) => void;
  onRemovePort: (portId: string) => void;
};

/** Painel de conexões do bloco: portas, sugestões, portas personalizadas, transições e fios. */
export function Connections({
  graph,
  chosen,
  onUpdateRoutes,
  onRemoveEdge,
  onAddPort,
  onRemovePort,
}: Props) {
  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  const ports = ensureBlockPorts(chosen);
  const portIds = ports.map((p) => p.id);
  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);
  const presets = portPresets[chosen.data.kind] ?? [];

  function addPreset({ name, direction, type }: PortPreset) {
    onAddPort({ id: uniquePortId(name, portIds), name, direction, type });
  }

  function addCustom(name: string, direction: 'input' | 'output') {
    const base = name.toLowerCase().replace(/\s+/g, '_');
    onAddPort({ id: uniquePortId(base, portIds), name, direction });
  }

  return (
    <div className="connections-manager">
      <div className="section-title">
        <strong>Portas de Conexão</strong>
        <span className="badge-count">{ports.length}</span>
      </div>

      <p className="subtle">
        Conecte o Lado A (Eventos: <code>onClick</code>, <code>then</code>, <code>onSuccess</code>)
        ao Lado B (Ouvintes: <code>trigger</code>, <code>execute</code>, <code>onEnter</code>).
      </p>

      <PortList block={chosen} ports={ports} edges={blockEdges} onRemovePort={onRemovePort} />

      <div className="add-ports-section">
        <span className="section-label">Conexões sugeridas para este bloco:</span>
        <div className="quick-port-buttons">
          {presets.map((preset) => (
            <button
              key={`${preset.direction}-${preset.name}`}
              type="button"
              className={`chip-btn ${preset.direction}`}
              title={preset.title}
              onClick={() => addPreset(preset)}
            >
              <Plus size={12} /> {preset.name}
              {preset.type ? `: ${preset.type}` : ''} ({preset.direction === 'input' ? 'in' : 'out'}
              )
            </button>
          ))}
        </div>

        <CustomPortForm onSubmit={addCustom} />
      </div>

      {chosen.data.kind === 'screen' && (
        <ScreenTransitions graph={graph} screen={chosen} onChange={onUpdateRoutes} />
      )}

      <EdgeList graph={graph} block={chosen} edges={blockEdges} onRemoveEdge={onRemoveEdge} />
    </div>
  );
}
