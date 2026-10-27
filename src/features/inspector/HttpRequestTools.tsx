import { useState } from 'react';
import { buildHttpManifest, httpConfigurationIssues, httpConnection } from '../../engine/http';
import type { Block, Graph } from '../../engine';
import { HttpSecretForm } from './HttpSecretForm';

export function HttpRequestTools({
  block,
  graph,
  onChangeConfig,
}: {
  block: Block;
  graph: Graph;
  onChangeConfig: (config: Record<string, string>) => void;
}) {
  const [result, setResult] = useState<{ fingerprint: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const fingerprint = JSON.stringify([graph.httpEnvironment, graph.nodes, graph.edges]);
  const issues = httpConfigurationIssues(graph);
  const resource = httpConnection(graph, block.id);
  const related = issues.filter(
    (issue) => issue.nodeId === block.id || issue.nodeId === resource?.id,
  );
  const isApi = block.data.kind === 'api';
  const status = related.length ? 'Não configurada' : 'Configurada';
  async function test() {
    const method = block.data.config.method || 'GET';
    if (
      method !== 'GET' &&
      !window.confirm(`Executar ${method} no serviço real? Essa operação pode alterar dados.`)
    )
      return;
    setBusy(true);
    try {
      const response = await fetch('/__flowforge/http', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: block.id,
          manifest: buildHttpManifest({
            ...graph,
            nodes: graph.nodes.filter((node) => node.id === block.id || node.id === resource?.id),
          }),
        }),
      });
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'Backend indisponível. Inicie o editor com npm run dev para executar integrações reais.',
        );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Falha na requisição.');
      setResult({
        fingerprint,
        message: `Testada — HTTP ${data.status} — ${new Date().toLocaleTimeString('pt-BR')}`,
      });
    } catch (error) {
      setResult({
        fingerprint,
        message: `Falha — ${error instanceof Error ? error.message : 'Erro na integração.'}`,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="info-box">
      {isApi ? (
        <>
          <label className="field">
            Predefinição de requisição
            <select
              defaultValue=""
              onChange={(event) => {
                const presets: Record<string, Record<string, string>> = {
                  list: {
                    mode: 'real',
                    method: 'GET',
                    url: '/items',
                    responseType: 'json',
                    query: '[{"key":"limit","value":"10"}]',
                    bodyFields: '[]',
                  },
                  create: {
                    mode: 'real',
                    method: 'POST',
                    url: '/items',
                    responseType: 'json',
                    query: '[]',
                    bodyFields: '[{"key":"name","value":""}]',
                  },
                  custom: {
                    mode: 'real',
                    method: 'GET',
                    url: '/',
                    responseType: 'json',
                    query: '[]',
                    bodyFields: '[]',
                  },
                };
                if (presets[event.target.value]) onChangeConfig(presets[event.target.value]);
                event.target.value = '';
              }}
            >
              <option value="">Escolher predefinição…</option>
              <option value="list">Listar registros</option>
              <option value="create">Criar registro</option>
              <option value="custom">Personalizada</option>
            </select>
          </label>
          {block.data.config.mode === 'real' && (
            <>
              <p role="status">{result?.fingerprint === fingerprint ? result.message : status}</p>
              {related.map((issue) => (
                <p key={issue.field} className="error-text">
                  {issue.message}
                </p>
              ))}
              <button
                type="button"
                disabled={busy || related.length > 0}
                onClick={() => void test()}
              >
                {busy ? 'Executando…' : `Testar requisição ${block.data.config.method || 'GET'}`}
              </button>
              <p>
                O teste usa os valores fixos configurados. Para testar entradas conectadas, execute
                o fluxo na prévia.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <strong>Conexão HTTP · {status}</strong>
          {block.data.config.auth !== 'none' && (
            <HttpSecretForm
              key={block.data.config.secretEnv}
              name={block.data.config.secretEnv || ''}
            />
          )}
          <p>
            Configure a URL e conecte a saída Conexão HTTP à entrada de uma Requisição API. O teste
            é feito na requisição.
          </p>
          <p>
            Informe o nome da variável de credencial; o valor fica no servidor e não é salvo no
            projeto.
          </p>
        </>
      )}
    </div>
  );
}
