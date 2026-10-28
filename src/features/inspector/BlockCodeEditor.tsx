import { useMemo, useState } from 'react';
import { Code, Edit3, Sparkles } from 'lucide-react';
import type { Connection } from '@xyflow/react';
import { catalog, type Block, type Graph } from '../../engine';

type Props = {
  block: Block;
  graph: Graph;
  onChangeConfig: (config: Record<string, string>) => void;
  onConnect?: (c: Connection & { data?: { callArg?: string } }) => void;
  onRemoveEdge?: (id: string) => void;
  onUpdateEdgeCallArg?: (edgeId: string, callArg: string) => void;
};

type CodeTemplate = {
  id: string;
  name: string;
  description: string;
  apply: () => Record<string, string>;
};

export function BlockCodeEditor({
  block,
  graph,
  onChangeConfig,
  onConnect,
  onRemoveEdge,
  onUpdateEdgeCallArg,
}: Props) {
  const [isManual, setIsManual] = useState(false);
  const config = block.data.config;
  const kind = block.data.kind;

  // Conexões de saída deste bloco
  const outEdges = graph.edges.filter((e) => e.source === block.id);

  // Outros nós disponíveis no grafo para onde se pode conectar (cabos - exclui blocos de interface)
  const otherBlocks = useMemo(() => {
    return graph.nodes.filter(
      (n) => n.id !== block.id && catalog[n.data.kind]?.category !== 'Interface',
    );
  }, [graph.nodes, block.id]);

  // Auxiliar para obter a conexão atual em uma porta de saída
  const getEdgeForHandle = (handle: string) => {
    return (
      outEdges.find((e) => e.sourceHandle === handle) ||
      (outEdges.length > 0 && !handle ? outEdges[0] : undefined)
    );
  };

  // Gerencia alteração no dropdown de destino (conectar / desconectar / trocar destino)
  const handleDestinationChange = (
    handle: string,
    newTargetId: string,
    fallbackArg: string = '',
  ) => {
    const existing = getEdgeForHandle(handle);

    if (!newTargetId) {
      if (existing && onRemoveEdge) {
        onRemoveEdge(existing.id);
      }
      return;
    }

    if (existing && existing.target === newTargetId) {
      return;
    }

    if (existing && onRemoveEdge) {
      onRemoveEdge(existing.id);
    }

    if (onConnect) {
      const currentArg = (existing?.data?.callArg as string) ?? fallbackArg;
      onConnect({
        source: block.id,
        target: newTargetId,
        sourceHandle: handle || null,
        targetHandle: null,
        data: {
          callArg: currentArg,
        },
      });
    }
  };

  // Gerencia edição no valor/argumento de uma conexão ou retorno
  const handleArgChange = (handle: string, newArg: string, configKey?: string) => {
    const existing = getEdgeForHandle(handle);
    if (existing && onUpdateEdgeCallArg) {
      onUpdateEdgeCallArg(existing.id, newArg);
    }
    if (configKey) {
      onChangeConfig({ [configKey]: newArg });
    }
  };

  // Templates pré-prontos baseados no tipo do bloco
  const templates: CodeTemplate[] = useMemo(() => {
    switch (kind) {
      case 'condition':
        return [
          {
            id: 'equals',
            name: 'Igualdade (===)',
            description: 'Compara se o valor é igual a outro',
            apply: () => ({
              operator: 'equals',
              compare: 'valor2',
              trueValue: 'valor3',
              falseValue: '"Texto que o usuario quiser"',
            }),
          },
          {
            id: 'greater',
            name: 'Maior que (>)',
            description: 'Compara valor numérico maior que',
            apply: () => ({
              operator: 'gt',
              compare: '10',
              trueValue: 'true',
              falseValue: 'false',
            }),
          },
          {
            id: 'truthy',
            name: 'Preenchido (Boolean)',
            description: 'Verifica se tem conteúdo ou é verdadeiro',
            apply: () => ({
              operator: 'truthy',
              compare: '',
              trueValue: 'valor',
              falseValue: '"Campo não preenchido"',
            }),
          },
          {
            id: 'not_equals',
            name: 'Diferente (!==)',
            description: 'Verifica se o valor é diferente de',
            apply: () => ({
              operator: 'not_equals',
              compare: '""',
              trueValue: 'valor',
              falseValue: 'null',
            }),
          },
        ];
      case 'function':
        return [
          {
            id: 'return_val',
            name: 'Retorno Simples',
            description: 'Retorna o dado recebido',
            apply: () => ({ code: 'return value;' }),
          },
          {
            id: 'calculate',
            name: 'Cálculo Numérico',
            description: 'Multiplica o valor por 2',
            apply: () => ({ code: 'return Number(value) * 2;' }),
          },
          {
            id: 'format_text',
            name: 'Formatar Texto',
            description: 'Limpa espaços e converte em maiúsculas',
            apply: () => ({ code: 'return String(value).trim().toUpperCase();' }),
          },
          {
            id: 'payload_obj',
            name: 'Montar JSON',
            description: 'Retorna um objeto estruturado',
            apply: () => ({ code: 'return { id: Date.now(), data: value };' }),
          },
        ];
      case 'auth':
        return [
          {
            id: 'email_login',
            name: 'Login por E-mail',
            description: 'Autenticação com e-mail e senha',
            apply: () => ({ provider: 'email', mode: 'login' }),
          },
          {
            id: 'email_register',
            name: 'Criar Conta',
            description: 'Cadastro de novo usuário',
            apply: () => ({ provider: 'email', mode: 'register' }),
          },
          {
            id: 'google_oauth',
            name: 'Login com Google',
            description: 'Autenticação via conta Google',
            apply: () => ({ provider: 'google', mode: 'login' }),
          },
        ];
      case 'validator':
        return [
          {
            id: 'required',
            name: 'Obrigatório',
            description: 'Não permite campo vazio',
            apply: () => ({ rule: 'required', param: '', message: 'Campo obrigatório' }),
          },
          {
            id: 'email',
            name: 'Formato de E-mail',
            description: 'Valida e-mail válido',
            apply: () => ({ rule: 'email', param: '', message: 'E-mail inválido' }),
          },
          {
            id: 'min_length',
            name: 'Tamanho Mínimo (6)',
            description: 'Mínimo de 6 caracteres',
            apply: () => ({ rule: 'min_length', param: '6', message: 'Mínimo de 6 caracteres' }),
          },
        ];
      case 'notify':
        return [
          {
            id: 'success',
            name: 'Toast Sucesso',
            description: 'Mensagem verde de sucesso',
            apply: () => ({
              type: 'success',
              message: 'Operação realizada com sucesso!',
              duration: '3000',
            }),
          },
          {
            id: 'error_toast',
            name: 'Toast Erro',
            description: 'Mensagem vermelha de erro',
            apply: () => ({
              type: 'error',
              message: 'Ocorreu um erro no processamento',
              duration: '4000',
            }),
          },
        ];
      default:
        return [];
    }
  }, [kind]);

  const handleApplyTemplate = (tmpl: CodeTemplate) => {
    onChangeConfig(tmpl.apply());
  };

  // Renderizador específico por tipo de bloco
  const renderGuidedCode = () => {
    switch (kind) {
      case 'condition': {
        const trueEdge = getEdgeForHandle('true');
        const falseEdge = getEdgeForHandle('false');
        const trueArg =
          (trueEdge?.data?.callArg as string) ??
          (config.trueValue !== undefined ? config.trueValue : 'valor3');
        const falseArg =
          (falseEdge?.data?.callArg as string) ??
          (config.falseValue !== undefined ? config.falseValue : '"Texto que o usuario quiser"');

        const isTrueNestedIf =
          trueEdge && otherBlocks.find((b) => b.id === trueEdge.target)?.data.kind === 'condition';
        const isFalseNestedIf =
          falseEdge &&
          otherBlocks.find((b) => b.id === falseEdge.target)?.data.kind === 'condition';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 60 }}
                value={config.paramName || 'valor'}
                placeholder="valor"
                onChange={(e) => onChangeConfig({ paramName: e.target.value })}
              />
              <span className="code-op"> = </span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 60 }}
                value={config.defaultValue !== undefined ? config.defaultValue : '""'}
                placeholder='""'
                onChange={(e) => onChangeConfig({ defaultValue: e.target.value })}
              />
              <span className="code-punc">) {'{'}</span>
            </div>

            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">isValid</span>
              <span className="code-op"> = </span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 60 }}
                value={config.paramName || 'valor'}
                placeholder="valor"
                onChange={(e) => onChangeConfig({ paramName: e.target.value })}
              />
              <span className="code-op">&nbsp;</span>
              <select
                className="code-inline-select"
                value={config.operator || 'equals'}
                onChange={(e) => onChangeConfig({ operator: e.target.value })}
              >
                <option value="equals">=== (igual)</option>
                <option value="not_equals">!== (diferente)</option>
                <option value="gt">&gt; (maior)</option>
                <option value="lt">&lt; (menor)</option>
                <option value="gte">&gt;= (maior ou igual)</option>
                <option value="lte">&lt;= (menor ou igual)</option>
                <option value="truthy">Boolean (preenchido)</option>
              </select>
              {config.operator !== 'truthy' && (
                <>
                  <span className="code-op">&nbsp;</span>
                  <input
                    type="text"
                    className="code-inline-input"
                    style={{ width: 85 }}
                    value={config.compare !== undefined ? config.compare : 'valor2'}
                    placeholder="valor2"
                    onChange={(e) => onChangeConfig({ compare: e.target.value })}
                  />
                </>
              )}
              <span className="code-punc">;</span>
            </div>

            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">if</span> <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 60 }}
                value={config.checkVar || 'isValid'}
                placeholder="isValid"
                onChange={(e) => onChangeConfig({ checkVar: e.target.value })}
              />
              <span className="code-punc">) {'{'}</span>
            </div>

            {/* Ramo True com Dropdown de Conexão */}
            <div className="code-line code-branch-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={trueEdge?.target || ''}
                title="Cabo de conexão: selecione para onde o fluxo segue quando a condição for verdadeira"
                onChange={(e) => handleDestinationChange('true', e.target.value, trueArg)}
              >
                <option value="">(Retornar valor)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.data.kind === 'condition' ? '🔀 ' : '📞 '}
                    {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ minWidth: 65, flex: 1 }}
                value={trueArg}
                placeholder="valor3"
                onChange={(e) => handleArgChange('true', e.target.value, 'trueValue')}
              />
              <span className="code-punc">);</span>
              {isTrueNestedIf && <span className="code-nested-tag">If dentro de If</span>}
            </div>

            <div className="code-line">
              <span className="line-num">5</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span> <span className="code-kw">else</span>{' '}
              <span className="code-punc">{'{'}</span>
            </div>

            {/* Ramo False com Dropdown de Conexão */}
            <div className="code-line code-branch-line">
              <span className="line-num">6</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={falseEdge?.target || ''}
                title="Cabo de conexão: selecione para onde o fluxo segue quando a condição for falsa"
                onChange={(e) => handleDestinationChange('false', e.target.value, falseArg)}
              >
                <option value="">(Retornar valor)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.data.kind === 'condition' ? '🔀 ' : '📞 '}
                    {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ minWidth: 90, flex: 1 }}
                value={falseArg}
                placeholder='"Texto que o usuario quiser"'
                onChange={(e) => handleArgChange('false', e.target.value, 'falseValue')}
              />
              <span className="code-punc">);</span>
              {isFalseNestedIf && <span className="code-nested-tag">If dentro de If</span>}
            </div>

            <div className="code-line">
              <span className="line-num">7</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span>
            </div>

            <div className="code-line">
              <span className="line-num">8</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'function': {
        const nextEdge = getEdgeForHandle('then') || getEdgeForHandle('next') || outEdges[0];
        const errorEdge = getEdgeForHandle('onError') || getEdgeForHandle('error');
        const nextArg = (nextEdge?.data?.callArg as string) ?? (config.returnExpr || 'value');
        const errorArg = (errorEdge?.data?.callArg as string) ?? 'error';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(value = "") {'{'}</span>
            </div>

            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">try</span> <span className="code-punc">{'{'}</span>
            </div>

            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">resultado</span>
              <span className="code-op"> = </span>
              <input
                type="text"
                className="code-inline-input"
                style={{ flex: 1 }}
                value={config.code || 'value'}
                placeholder="value"
                onChange={(e) => onChangeConfig({ code: e.target.value })}
              />
              <span className="code-punc">;</span>
            </div>

            {/* Chamada para o próximo bloco */}
            <div className="code-line code-branch-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={nextEdge?.target || ''}
                title="Cabo de conexão: próximo bloco a ser executado"
                onChange={(e) => handleDestinationChange('then', e.target.value, nextArg)}
              >
                <option value="">(Retornar resultado)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.data.kind === 'condition' ? '🔀 ' : '📞 '}
                    {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ minWidth: 70 }}
                value={nextArg}
                placeholder="resultado"
                onChange={(e) => handleArgChange('then', e.target.value, 'returnExpr')}
              />
              <span className="code-punc">);</span>
            </div>

            <div className="code-line">
              <span className="line-num">5</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span> <span className="code-kw">catch</span>{' '}
              <span className="code-punc">(error) {'{'}</span>
            </div>

            {/* Tratamento de erro */}
            <div className="code-line code-branch-line">
              <span className="line-num">6</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={errorEdge?.target || ''}
                title="Cabo de conexão: encaminhar erro para outro bloco"
                onChange={(e) => handleDestinationChange('onError', e.target.value, errorArg)}
              >
                <option value="">(throw error)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    🛡️ {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ minWidth: 60 }}
                value={errorArg}
                placeholder="error"
                onChange={(e) => handleArgChange('onError', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>

            <div className="code-line">
              <span className="line-num">7</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span>
            </div>

            <div className="code-line">
              <span className="line-num">8</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'button': {
        const clickEdge = getEdgeForHandle('onClick') || getEdgeForHandle('click') || outEdges[0];
        const clickArg = (clickEdge?.data?.callArg as string) ?? '';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">() {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-comment">// Disparado ao clicar no botão:</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={clickEdge?.target || ''}
                title="Cabo de conexão: bloco disparado ao clicar"
                onChange={(e) => handleDestinationChange('onClick', e.target.value, clickArg)}
              >
                <option value="">(Nenhum destino)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.data.kind === 'screen' ? '🚀 ' : '📞 '}
                    {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 80 }}
                value={clickArg}
                placeholder="vazio ou arg"
                onChange={(e) => handleArgChange('onClick', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">4</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'input': {
        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">() {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">tipo</span>
              <span className="code-op"> = </span>
              <select
                className="code-inline-select"
                value={config.field || 'text'}
                onChange={(e) => onChangeConfig({ field: e.target.value })}
              >
                <option value="text">"text"</option>
                <option value="email">"email"</option>
                <option value="password">"password"</option>
                <option value="number">"number"</option>
              </select>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">placeholder</span>
              <span className="code-op"> = </span>
              <span className="code-str">"</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ flex: 1 }}
                value={config.placeholder !== undefined ? config.placeholder : 'Digite aqui'}
                placeholder="Digite aqui"
                onChange={(e) => onChangeConfig({ placeholder: e.target.value })}
              />
              <span className="code-str">"</span>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">return</span> <span className="code-fn">read</span>
              <span className="code-punc">("{block.id}", "value", </span>
              <span className="code-str">"</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 80 }}
                value={config.value || ''}
                placeholder="valor inicial"
                onChange={(e) => onChangeConfig({ value: e.target.value })}
              />
              <span className="code-str">"</span>
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">5</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'auth': {
        const successEdge = getEdgeForHandle('onSuccess') || outEdges[0];
        const errorEdge = getEdgeForHandle('onError');
        const successArg = (successEdge?.data?.callArg as string) ?? 'user';
        const errorArg =
          (errorEdge?.data?.callArg as string) ?? 'new Error("Falha na autenticação")';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(credentials) {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">provedor</span>
              <span className="code-op"> = </span>
              <select
                className="code-inline-select"
                value={config.provider || 'email'}
                onChange={(e) => onChangeConfig({ provider: e.target.value })}
              >
                <option value="email">"email"</option>
                <option value="google">"google"</option>
              </select>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">if</span> <span className="code-punc">(user) {'{'}</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={successEdge?.target || ''}
                title="Cabo de conexão: destino ao autenticar com sucesso"
                onChange={(e) => handleDestinationChange('onSuccess', e.target.value, successArg)}
              >
                <option value="">(Retornar usuário)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.data.kind === 'screen' ? '🚀 ' : '📞 '}
                    {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 70 }}
                value={successArg}
                placeholder="user"
                onChange={(e) => handleArgChange('onSuccess', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">5</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span> <span className="code-kw">else</span>{' '}
              <span className="code-punc">{'{'}</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">6</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={errorEdge?.target || ''}
                title="Cabo de conexão: destino em caso de erro"
                onChange={(e) => handleDestinationChange('onError', e.target.value, errorArg)}
              >
                <option value="">(Retornar erro)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    🛡️ {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ flex: 1, minWidth: 80 }}
                value={errorArg}
                placeholder="new Error(...)"
                onChange={(e) => handleArgChange('onError', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">7</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">8</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'validator': {
        const validEdge = getEdgeForHandle('valid');
        const invalidEdge = getEdgeForHandle('invalid');
        const validArg = (validEdge?.data?.callArg as string) ?? 'payload';
        const invalidArg =
          (invalidEdge?.data?.callArg as string) ??
          `new Error("${config.message || 'Campo inválido'}")`;

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(payload) {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">regra</span>
              <span className="code-op"> = </span>
              <select
                className="code-inline-select"
                value={config.rule || 'required'}
                onChange={(e) => onChangeConfig({ rule: e.target.value })}
              >
                <option value="required">"required"</option>
                <option value="email">"email"</option>
                <option value="min_length">"min_length"</option>
                <option value="numeric">"numeric"</option>
              </select>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">mensagem</span>
              <span className="code-op"> = </span>
              <span className="code-str">"</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ flex: 1 }}
                value={config.message !== undefined ? config.message : 'Campo inválido'}
                placeholder="Mensagem de erro"
                onChange={(e) => onChangeConfig({ message: e.target.value })}
              />
              <span className="code-str">"</span>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">if</span> <span className="code-punc">(valido) {'{'}</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">5</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={validEdge?.target || ''}
                title="Cabo de conexão: quando a validação passar"
                onChange={(e) => handleDestinationChange('valid', e.target.value, validArg)}
              >
                <option value="">(Retornar payload)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    📞 {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 75 }}
                value={validArg}
                placeholder="payload"
                onChange={(e) => handleArgChange('valid', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">6</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span> <span className="code-kw">else</span>{' '}
              <span className="code-punc">{'{'}</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">7</span>
              <span className="code-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={invalidEdge?.target || ''}
                title="Cabo de conexão: quando a validação falhar"
                onChange={(e) => handleDestinationChange('invalid', e.target.value, invalidArg)}
              >
                <option value="">(Retornar erro)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    🛡️ {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ flex: 1, minWidth: 80 }}
                value={invalidArg}
                placeholder="new Error(...)"
                onChange={(e) => handleArgChange('invalid', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">8</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-punc">{'}'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">9</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'notify': {
        const nextEdge = getEdgeForHandle('next') || outEdges[0];
        const nextArg = (nextEdge?.data?.callArg as string) ?? 'payload';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(payload) {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-fn">notify</span>
              <span className="code-punc">({'{'} tipo: </span>
              <select
                className="code-inline-select"
                value={config.type || 'success'}
                onChange={(e) => onChangeConfig({ type: e.target.value })}
              >
                <option value="success">"success"</option>
                <option value="error">"error"</option>
                <option value="info">"info"</option>
                <option value="warning">"warning"</option>
              </select>
              <span className="code-punc">, mensagem: "</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ flex: 1 }}
                value={config.message || 'Mensagem'}
                placeholder="Mensagem"
                onChange={(e) => onChangeConfig({ message: e.target.value })}
              />
              <span className="code-punc">" {'}'});</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={nextEdge?.target || ''}
                title="Cabo de conexão: próximo bloco após notificar"
                onChange={(e) => handleDestinationChange('next', e.target.value, nextArg)}
              >
                <option value="">(Retornar payload)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    📞 {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 80 }}
                value={nextArg}
                placeholder="payload"
                onChange={(e) => handleArgChange('next', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">4</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      case 'database': {
        const nextEdge = getEdgeForHandle('next') || outEdges[0];
        const nextArg = (nextEdge?.data?.callArg as string) ?? 'resultado';

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">async function</span>{' '}
              <span className="code-fn">{block.id}</span>
              <span className="code-punc">(payload) {'{'}</span>
            </div>
            <div className="code-line">
              <span className="line-num">2</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">tabela</span>
              <span className="code-op"> = </span>
              <span className="code-str">"</span>
              <input
                type="text"
                className="code-inline-input"
                style={{ width: 100 }}
                value={config.table || 'usuarios'}
                placeholder="usuarios"
                onChange={(e) => onChangeConfig({ table: e.target.value })}
              />
              <span className="code-str">"</span>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line">
              <span className="line-num">3</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">const</span> <span className="code-var">operacao</span>
              <span className="code-op"> = </span>
              <select
                className="code-inline-select"
                value={config.operation || 'insert'}
                onChange={(e) => onChangeConfig({ operation: e.target.value })}
              >
                <option value="insert">"insert"</option>
                <option value="select">"select"</option>
                <option value="update">"update"</option>
                <option value="delete">"delete"</option>
              </select>
              <span className="code-punc">;</span>
            </div>
            <div className="code-line code-branch-line">
              <span className="line-num">4</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={nextEdge?.target || ''}
                title="Cabo de conexão: próximo bloco após banco"
                onChange={(e) => handleDestinationChange('next', e.target.value, nextArg)}
              >
                <option value="">(Retornar resultado)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    📞 {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 85 }}
                value={nextArg}
                placeholder="resultado"
                onChange={(e) => handleArgChange('next', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">5</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }

      default: {
        // Fallback genérico para qualquer outro bloco
        const nextEdge = outEdges[0];
        const nextArg = (nextEdge?.data?.callArg as string) ?? 'payload';
        const keys = Object.keys(config).filter((k) => !k.startsWith('__') && k !== 'routes');

        return (
          <>
            <div className="code-line">
              <span className="line-num">1</span>
              <span className="code-kw">function</span> <span className="code-fn">{block.id}</span>
              <span className="code-punc">(payload) {'{'}</span>
            </div>
            {keys.map((k, i) => (
              <div className="code-line" key={k}>
                <span className="line-num">{i + 2}</span>
                <span className="code-indent">&nbsp;&nbsp;</span>
                <span className="code-kw">const</span> <span className="code-var">{k}</span>
                <span className="code-op"> = </span>
                <input
                  type="text"
                  className="code-inline-input"
                  style={{ flex: 1 }}
                  value={config[k]}
                  placeholder={k}
                  onChange={(e) => onChangeConfig({ [k]: e.target.value })}
                />
                <span className="code-punc">;</span>
              </div>
            ))}
            <div className="code-line code-branch-line">
              <span className="line-num">{keys.length + 2}</span>
              <span className="code-indent">&nbsp;&nbsp;</span>
              <span className="code-kw">return</span>&nbsp;
              <select
                className="code-inline-dest-select"
                value={nextEdge?.target || ''}
                title="Cabo de conexão: próximo bloco"
                onChange={(e) => handleDestinationChange('next', e.target.value, nextArg)}
              >
                <option value="">(Retornar payload)</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    📞 {b.data.label} (#{b.id})
                  </option>
                ))}
              </select>
              <span className="code-punc">(</span>
              <input
                type="text"
                className="code-inline-input code-arg-input"
                style={{ width: 80 }}
                value={nextArg}
                placeholder="payload"
                onChange={(e) => handleArgChange('next', e.target.value)}
              />
              <span className="code-punc">);</span>
            </div>
            <div className="code-line">
              <span className="line-num">{keys.length + 3}</span>
              <span className="code-punc">{'}'}</span>
            </div>
          </>
        );
      }
    }
  };

  return (
    <div className="block-code-editor-root">
      {/* Barra de Ferramentas do Editor de Código */}
      <div className="code-toolbar">
        {templates.length > 0 && (
          <div className="code-templates-bar">
            <span className="templates-label">
              <Sparkles size={11} style={{ color: '#38bdf8' }} /> Modelos:
            </span>
            <div className="templates-pills-list">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  className="code-template-pill"
                  title={tmpl.description}
                  onClick={() => handleApplyTemplate(tmpl)}
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="code-mode-switch">
          <button
            type="button"
            className={`mode-toggle-btn ${!isManual ? 'active' : ''}`}
            onClick={() => setIsManual(false)}
          >
            <Code size={11} /> Código com Valores
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${isManual ? 'active' : ''}`}
            onClick={() => setIsManual(true)}
          >
            <Edit3 size={11} /> Manual Livre
          </button>
        </div>
      </div>

      {/* Janela de Código Estilo IDE */}
      <div className="code-editor-window">
        <div className="code-window-topbar">
          <div className="window-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="window-filename">
            backend/<strong>{block.id}.js</strong>
          </span>
          <span className="window-badge">{kind}</span>
        </div>

        <div className="code-window-content">
          {!isManual ? (
            <div className="code-lines-container">{renderGuidedCode()}</div>
          ) : (
            <div className="code-manual-container">
              <textarea
                className="code-manual-textarea"
                rows={10}
                value={config.code || ''}
                placeholder="// Escreva seu código JavaScript customizado para este bloco..."
                onChange={(e) => onChangeConfig({ code: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
