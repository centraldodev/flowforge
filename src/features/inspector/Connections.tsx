import { useMemo, useState } from 'react';
import { Code, GitBranch, Plus, Sparkles, X } from 'lucide-react';
import type { Connection } from '@xyflow/react';
import {
  catalog,
  ensureBlockPorts,
  toSafeFunctionName,
  type Block,
  type CustomPort,
  type Graph,
  type Kind,
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
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
  onConnect?: (c: Connection & { data?: { callArg?: string } }) => void;
};

type PremadeTemplate = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  targetKind?: Kind;
  getArg: (sourceKind: Kind, sourceHandle: string, config: Record<string, string>) => string;
};

const PREMADE_TEMPLATES: PremadeTemplate[] = [
  {
    id: 'direct_call',
    name: 'Chamar Função / Bloco',
    icon: 'call_made',
    desc: 'Encaminha o fluxo executando o próximo bloco',
    getArg: (_, __, c) => c.trueValue || 'value',
  },
  {
    id: 'nested_if',
    name: 'Condição Aninhada (If dentro de If)',
    icon: 'alt_route',
    desc: 'Cria uma condição subsequente aninhada dentro do branch',
    targetKind: 'condition',
    getArg: (_, handle, c) =>
      handle === 'true' ? c.trueValue || 'valor3' : c.falseValue || '"Texto que o usuario quiser"',
  },
  {
    id: 'error_handler',
    name: 'Tratamento de Erro',
    icon: 'error',
    desc: 'Trata falhas ou dados inválidos em bloco de erro',
    targetKind: 'error',
    getArg: (_, __, c) => c.falseValue || 'new Error("Falha na validação")',
  },
  {
    id: 'navigate_screen',
    name: 'Navegar para Tela',
    icon: 'web_asset',
    desc: 'Redireciona para outra tela do projeto',
    targetKind: 'screen',
    getArg: () => '',
  },
  {
    id: 'save_database',
    name: 'Salvar no Banco',
    icon: 'database',
    desc: 'Envia dados para serem persistidos no banco',
    targetKind: 'database',
    getArg: () => 'payload',
  },
];

/** Painel de conexões do bloco: portas, sugestões, conexões como código real e fios. */
export function Connections({
  graph,
  chosen,
  onUpdateRoutes,
  onRemoveEdge,
  onAddPort,
  onRemovePort,
  onUpdateEdgeCallArg,
  onConnect,
}: Props) {
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('direct_call');
  const [targetId, setTargetId] = useState<string>('');
  const [sourceHandle, setSourceHandle] = useState<string>('');
  const [targetHandle, setTargetHandle] = useState<string>('');
  const [customArg, setCustomArg] = useState<string>('');

  const availableTargetNodes = useMemo(() => {
    if (!chosen) return [];
    return graph.nodes.filter(
      (n) => n.id !== chosen.id && catalog[n.data.kind]?.category !== 'Interface',
    );
  }, [graph.nodes, chosen]);

  const activeTemplate =
    PREMADE_TEMPLATES.find((t) => t.id === selectedTemplate) ?? PREMADE_TEMPLATES[0];

  // Filtra ou prioriza nós compatíveis com o modelo
  const filteredTargets = useMemo(() => {
    if (!chosen) return [];
    if (!activeTemplate.targetKind) return availableTargetNodes;
    const matched = availableTargetNodes.filter((n) => n.data.kind === activeTemplate.targetKind);
    return matched.length > 0 ? matched : availableTargetNodes;
  }, [chosen, availableTargetNodes, activeTemplate]);

  // Define nó de destino selecionado
  const activeTargetNode =
    filteredTargets.find((n) => n.id === targetId) || filteredTargets[0] || null;

  // Portas de entrada do nó de destino
  const targetInputPorts = useMemo(() => {
    if (!activeTargetNode) return [];
    return ensureBlockPorts(activeTargetNode).filter((p) => p.direction === 'input');
  }, [activeTargetNode]);

  // Argumento efetivo pré-preenchido
  const activeSourceHandle = sourceHandle || (chosen?.data.kind === 'condition' ? 'true' : 'next');
  const effectiveArg =
    customArg !== ''
      ? customArg
      : chosen
        ? activeTemplate.getArg(chosen.data.kind, activeSourceHandle, chosen.data.config)
        : '';

  // Prévia do código gerado pela conexão
  const codePreview = useMemo(() => {
    if (!activeTargetNode) return '// Selecione um bloco de destino';
    const targetFn = toSafeFunctionName(activeTargetNode.id);
    if (activeTargetNode.data.kind === 'screen') {
      return `// Navega para tela:\nreturn navigateTo('${activeTargetNode.id}');`;
    }
    if (activeTargetNode.data.kind === 'condition') {
      return `// Condição Aninhada (If dentro de If) -> ${activeTargetNode.data.label || activeTargetNode.id}:\nreturn ${targetFn}(${effectiveArg});`;
    }
    return `// Chama ${activeTargetNode.data.label || activeTargetNode.id}:\nreturn ${targetFn}(${effectiveArg});`;
  }, [activeTargetNode, effectiveArg]);

  if (!chosen) {
    return <p className="subtle">Selecione um bloco.</p>;
  }

  const ports = ensureBlockPorts(chosen);
  const portIds = ports.map((p) => p.id);
  const outputPorts = ports.filter((p) => p.direction === 'output');
  const blockEdges = graph.edges.filter((e) => e.source === chosen.id || e.target === chosen.id);
  const presets = portPresets[chosen.data.kind] ?? [];
  const activeTargetHandle = targetHandle || targetInputPorts[0]?.id || null;

  function addPreset({ name, direction, type }: PortPreset) {
    onAddPort({ id: uniquePortId(name, portIds), name, direction, type });
  }

  function addCustom(port: CustomPort) {
    onAddPort({
      ...port,
      id: uniquePortId(port.id, portIds),
    });
  }

  function handleCreateCodeConnection() {
    if (!onConnect || !activeTargetNode) return;
    onConnect({
      source: chosen!.id,
      target: activeTargetNode.id,
      sourceHandle: activeSourceHandle || null,
      targetHandle: activeTargetHandle || null,
      data: {
        callArg: effectiveArg,
      },
    });
    setIsCreatorOpen(false);
    setCustomArg('');
  }

  return (
    <div className="connections-manager">
      {/* Botão de Criação de Conexão com Código Pré-Pronto */}
      {onConnect && availableTargetNodes.length > 0 && (
        <div className="premade-connection-wrapper">
          {!isCreatorOpen ? (
            <button
              type="button"
              className="btn-open-code-connection"
              onClick={() => {
                setIsCreatorOpen(true);
                if (chosen.data.kind === 'condition' && !sourceHandle) {
                  setSourceHandle('true');
                }
              }}
            >
              <Sparkles size={14} style={{ color: '#38bdf8' }} />
              <strong>+ Adicionar Conexão como Código Real</strong>
            </button>
          ) : (
            <div className="premade-connection-panel">
              <div className="premade-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Code size={14} style={{ color: '#38bdf8' }} />
                  <strong>Adicionar Código & Conexão Pré-Pronta</strong>
                </div>
                <button
                  type="button"
                  className="close-panel-btn"
                  onClick={() => setIsCreatorOpen(false)}
                >
                  <X size={13} />
                </button>
              </div>

              {/* 1. Seleção do Modelo de Conexão */}
              <div className="premade-field-group">
                <label>Modelo de Conexão:</label>
                <div className="template-pills">
                  {PREMADE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      className={`template-pill ${selectedTemplate === tmpl.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTemplate(tmpl.id);
                        setCustomArg('');
                      }}
                      title={tmpl.desc}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                        {tmpl.icon}
                      </span>
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Porta de Saída do Bloco Atual */}
              <div className="premade-field-row">
                <label>Saída deste bloco:</label>
                <select
                  value={activeSourceHandle}
                  onChange={(e) => {
                    setSourceHandle(e.target.value);
                    setCustomArg('');
                  }}
                >
                  {outputPorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id} ({p.id})
                    </option>
                  ))}
                  {outputPorts.length === 0 && <option value="next">Próximo (next)</option>}
                </select>
              </div>

              {/* 3. Bloco de Destino */}
              <div className="premade-field-row">
                <label>Conectar ao bloco:</label>
                <select
                  value={activeTargetNode?.id ?? ''}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setTargetHandle('');
                  }}
                >
                  {filteredTargets.map((n) => {
                    const d = catalog[n.data.kind];
                    return (
                      <option key={n.id} value={n.id}>
                        {d?.name || n.data.kind}: {n.data.label || n.id} (#{n.id})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 4. Porta de Entrada de Destino */}
              {targetInputPorts.length > 0 && (
                <div className="premade-field-row">
                  <label>Entrada do destino:</label>
                  <select
                    value={activeTargetHandle ?? ''}
                    onChange={(e) => setTargetHandle(e.target.value)}
                  >
                    {targetInputPorts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 5. Argumento / Valor passado na chamada */}
              <div className="premade-field-row">
                <label title="Valor que será passado nos parênteses da função ou retornado">
                  Valor / Argumento:
                </label>
                <input
                  type="text"
                  value={effectiveArg}
                  placeholder="ex: valor3, 'Texto', payload"
                  onChange={(e) => setCustomArg(e.target.value)}
                />
              </div>

              {/* 6. Prévia do Código que será Injetado */}
              <div className="premade-code-preview">
                <div className="code-preview-header">
                  <span>Código que será adicionado:</span>
                  <span className="code-lang-tag">JS</span>
                </div>
                <pre>
                  <code>{codePreview}</code>
                </pre>
              </div>

              {/* 7. Botão de Conectar */}
              <button
                type="button"
                className="btn-confirm-code-connection primary"
                disabled={!activeTargetNode}
                onClick={handleCreateCodeConnection}
              >
                <GitBranch size={13} />
                Conectar e Injetar Código
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista de Conexões Ativas e Código Real Gerado */}
      <EdgeList
        graph={graph}
        block={chosen}
        edges={blockEdges}
        onRemoveEdge={onRemoveEdge}
        onUpdateEdgeCallArg={onUpdateEdgeCallArg}
      />

      <div className="section-title" style={{ marginTop: 14 }}>
        <strong>Portas de Conexão</strong>
        <span className="badge-count">{ports.length}</span>
      </div>

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
    </div>
  );
}
