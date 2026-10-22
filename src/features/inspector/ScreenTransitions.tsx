import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { PropertyField } from '../../components/PropertyField';
import {
  screenRoutes,
  reachableActions,
  type Block,
  type Graph,
  type ScreenRoute,
} from '../../engine';
export function ScreenTransitions({
  graph,
  screen,
  onChange,
}: {
  graph: Graph;
  screen: Block;
  onChange: (routes: ScreenRoute[]) => void;
}) {
  const routes = screenRoutes(screen);
  const actions = reachableActions(graph, screen.id);
  const pages = graph.nodes.filter((n) => n.data.kind === 'screen' && n.id !== screen.id);
  const update = (id: string, change: Partial<ScreenRoute>) =>
    onChange(routes.map((r) => (r.id === id ? { ...r, ...change } : r)));
  return (
    <section className="screen-transitions">
      <div className="form-separator">NAVEGAÇÃO ENTRE TELAS</div>
      <p className="subtle">
        Quando um bloco deste fluxo terminar com o resultado escolhido, abrir a tela de destino e
        encerrar o fluxo atual.
      </p>
      {routes.map((r, index) => (
        <div className="transition-card" key={r.id}>
          <div className="section-title">
            <strong>Transição {index + 1}</strong>
            <button
              aria-label={'Remover transição ' + (index + 1)}
              onClick={() => onChange(routes.filter((t) => t.id !== r.id))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <PropertyField
            id={'route-trigger-' + r.id}
            label="Após executar"
            value={r.trigger}
            options={[
              { value: '', label: 'Selecione um bloco' },
              ...actions.map((n) => ({ value: n.id, label: n.data.label })),
            ]}
            onChange={(value) => update(r.id, { trigger: value })}
          />
          <PropertyField
            id={'route-result-' + r.id}
            label="Resultado"
            value={r.when}
            options={[
              { value: 'true', label: 'Verdadeiro (true)' },
              { value: 'false', label: 'Falso (false)' },
              { value: 'always', label: 'Sempre que executar' },
            ]}
            onChange={(value) => update(r.id, { when: value as ScreenRoute['when'] })}
          />
          <PropertyField
            id={'route-target-' + r.id}
            label="Ir para a tela"
            value={r.target}
            options={[
              { value: '', label: 'Selecione uma tela' },
              ...pages.map((n) => ({ value: n.id, label: n.data.label })),
            ]}
            onChange={(value) => update(r.id, { target: value })}
          />
          <div className="transition-caption">
            <ArrowRight size={12} />
            {graph.nodes.find((n) => n.id === r.target)?.data.label || 'Escolha um destino'}
          </div>
        </div>
      ))}
      <button
        className="secondary wide"
        disabled={!actions.length || !pages.length}
        onClick={() =>
          onChange([
            ...routes,
            {
              id: crypto.randomUUID(),
              trigger:
                actions.find((n) =>
                  ['auth', 'logout', 'condition', 'validation'].includes(n.data.kind),
                )?.id || actions[0].id,
              when: 'true',
              target: pages[0].id,
            },
          ])
        }
      >
        <Plus size={14} /> Adicionar transição
      </button>
      {!pages.length ? (
        <p className="subtle">Adicione outra tela para configurar um destino.</p>
      ) : !actions.length ? (
        <p className="subtle">Adicione um botão nesta tela e conecte-o às ações do fluxo.</p>
      ) : (
        !routes.length && (
          <p className="subtle">
            Exemplo: validar acesso → true → Página inicial. Logout → sempre → Login.
          </p>
        )
      )}
    </section>
  );
}
