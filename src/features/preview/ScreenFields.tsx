import type { Graph } from '../../engine';

type Props = {
  graph: Graph;
  screen?: string;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onAction: (id: string) => void;
};

/** Renderiza os elementos de uma tela. Compartilhado pela prévia e pelo app React exportado. */
export function ScreenFields({ graph, screen, values, onChange, onAction }: Props) {
  return (
    <>
      {graph.nodes
        .filter((n) => n.data.config.screenId === screen)
        .map((n) => {
          const c = n.data.config;
          const value = values[n.id] ?? c.value ?? '';
          switch (n.data.kind) {
            case 'button':
              return (
                <button className="primary wide" key={n.id} onClick={() => onAction(n.id)}>
                  {n.data.label}
                </button>
              );
            case 'input':
              return (
                <label className="field" key={n.id}>
                  {n.data.label}
                  <input
                    type={c.field || 'text'}
                    placeholder={c.placeholder}
                    value={value}
                    onChange={(e) => onChange(n.id, e.target.value)}
                  />
                </label>
              );
            default:
              return null;
          }
        })}
    </>
  );
}
