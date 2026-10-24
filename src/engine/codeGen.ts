// Gerador dinâmico de código JavaScript a partir do catálogo e das conexões do grafo.
import codeCatalog from './codeCatalog.json';
import type { Block, Graph, Kind } from './types';

type CatalogEntry = {
  description: string;
  template: string;
};

const catalog = codeCatalog as Record<Kind, CatalogEntry>;

/** Sanitiza um ID de bloco para ser um identificador de função JavaScript válido. */
export function toSafeFunctionName(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_$]/g, '_');
  return /^[0-9]/.test(sanitized) ? `fn_${sanitized}` : sanitized;
}

/**
 * Gera o código JavaScript de um bloco com base nas conexões de entrada e saída no grafo.
 */
export function generateBlockCode(graph: Graph, block: Block): string {
  const kind = block.data.kind;
  const entry = catalog[kind];
  if (!entry) return `// Bloco ${block.id}\nfunction ${toSafeFunctionName(block.id)}() {}\n`;

  const fnName = toSafeFunctionName(block.id);
  const config = block.data.config;
  const label = block.data.label || block.id;

  // Arestas de saída deste bloco
  const outEdges = graph.edges.filter((e) => e.source === block.id);
  // Arestas de entrada neste bloco
  const inEdges = graph.edges.filter((e) => e.target === block.id);

  // Auxiliar para obter a chamada de uma função de destino
  const getCallForHandle = (handle: string, defaultArg = ''): string => {
    const edge = outEdges.find((e) => e.sourceHandle === handle);
    if (!edge) return '';
    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (!targetNode) return '';
    const targetFn = toSafeFunctionName(targetNode.id);
    let arg = defaultArg;
    if (targetNode.data.kind === 'error' && (!arg || arg === 'false')) {
      arg = 'new Error("Falha na validação")';
    } else if (targetNode.data.kind === 'screen') {
      arg = defaultArg.includes('user') ? 'user' : '';
    }
    return `return ${targetFn}(${arg});`;
  };

  let code = entry.template;
  code = code.replace(/\{\{id\}\}/g, fnName);
  code = code.replace(/\{\{label\}\}/g, label);

  switch (kind) {
    case 'button': {
      const clickCall =
        getCallForHandle('onClick') ||
        (outEdges[0]
          ? `return ${toSafeFunctionName(outEdges[0].target)}();`
          : '// Conecte a um bloco para acionar');
      code = code.replace(/\{\{targetCall\}\}/g, clickCall);
      break;
    }

    case 'input': {
      break;
    }

    case 'function': {
      // Identifica entradas de dados conectadas (excluindo botões e saídas de trigger)
      const directDataInputs = inEdges
        .filter((e) => e.sourceHandle !== 'onClick' && e.sourceHandle !== 'click')
        .map((e) => graph.nodes.find((n) => n.id === e.source))
        .filter((n): n is Block => Boolean(n))
        .filter((n) => n.data.kind !== 'button');

      // Se não há fios diretos de dados, busca campos de input na mesma tela
      const relevantInputs =
        directDataInputs.length > 0
          ? directDataInputs
          : block.data.config.screenId
            ? graph.nodes.filter(
                (n) =>
                  n.data.kind === 'input' && n.data.config.screenId === block.data.config.screenId,
              )
            : [];

      const inputReads = relevantInputs
        .map((n) => {
          const varName = toSafeFunctionName(n.id);
          return `const ${varName} = read('${n.id}', 'value');`;
        })
        .join('\n  ');

      const params = relevantInputs.map((n) => toSafeFunctionName(n.id)).join(', ');

      // Procura chamadas de saída (then, next, ou qualquer aresta conectada)
      const nextEdge =
        outEdges.find((e) => e.sourceHandle === 'then' || e.sourceHandle === 'next') || outEdges[0];

      let returnCall = 'return value;';
      if (nextEdge) {
        const targetNode = graph.nodes.find((n) => n.id === nextEdge.target);
        if (targetNode) {
          const targetFn = toSafeFunctionName(targetNode.id);
          const args = params || 'value';
          returnCall = `return ${targetFn}(${args});`;
        }
      }

      let bodyText = '// Lógica personalizada da função';
      if (config.code && !config.code.startsWith('function ')) {
        bodyText = `// Lógica:\n  ${config.code}`;
      } else if (
        outEdges.some((e) => graph.nodes.find((n) => n.id === e.target)?.data.kind === 'database')
      ) {
        bodyText = `// Prepara payload para inserção no banco de dados\n  const payload = { id: Date.now(), ${params || 'value'}, provider: 'email' };`;
      }

      code = code.replace(/\{\{params\}\}/g, params);
      code = code.replace(/\{\{inputReads\}\}/g, inputReads ? `${inputReads}\n  ` : '');
      code = code.replace(/\{\{body\}\}/g, bodyText);
      code = code.replace(/\{\{returnCall\}\}/g, returnCall);
      break;
    }

    case 'condition': {
      // Blocos de origem que acionam ou alimentam esta condição
      const sourceNodes = inEdges
        .map((e) => graph.nodes.find((n) => n.id === e.source))
        .filter((n): n is Block => Boolean(n));

      // Entradas na mesma tela (ex: email, senha)
      const screenInputs = block.data.config.screenId
        ? graph.nodes.filter(
            (n) => n.data.kind === 'input' && n.data.config.screenId === block.data.config.screenId,
          )
        : [];

      let conditionParam = 'value';
      if (sourceNodes.some((n) => n.data.kind === 'input')) {
        conditionParam = sourceNodes
          .filter((n) => n.data.kind === 'input')
          .map((n) => toSafeFunctionName(n.id))
          .join(', ');
      } else if (screenInputs.length > 0) {
        conditionParam = screenInputs.map((n) => toSafeFunctionName(n.id)).join(', ');
      } else if (sourceNodes.length > 0) {
        conditionParam = sourceNodes.map((n) => toSafeFunctionName(n.id)).join(', ');
      }

      const paramList = conditionParam
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      let conditionExpr = 'value';
      if (config.operator === 'equals') {
        conditionExpr = `${conditionParam} === '${config.compare || ''}'`;
      } else if (config.operator === 'gt') {
        conditionExpr = `Number(${conditionParam}) > ${Number(config.compare || 0)}`;
      } else if (paramList.length > 1) {
        conditionExpr = paramList.map((p) => `Boolean(${p})`).join(' && ');
      } else {
        conditionExpr = `Boolean(${conditionParam})`;
      }

      const trueBranch = getCallForHandle('true', conditionParam) || 'return true;';
      const falseBranch =
        getCallForHandle('false', 'new Error("Dados inválidos")') || 'return false;';

      code = code.replace(/\{\{params\}\}/g, conditionParam);
      code = code.replace(/\{\{condition\}\}/g, conditionExpr);
      code = code.replace(/\{\{trueBranch\}\}/g, trueBranch);
      code = code.replace(/\{\{falseBranch\}\}/g, falseBranch);
      break;
    }

    case 'auth': {
      const provider = config.provider || 'email';
      const successBranch =
        getCallForHandle('onSuccess', 'user') || "console.log('Login autorizado', user);";
      const errorBranch =
        getCallForHandle('onError', 'new Error("Credenciais inválidas")') ||
        'throw new Error("Falha na autenticação");';

      let params = 'email, password';
      let authBody = `// Autenticação de usuário com e-mail e senha\n  const user = authenticate('email', email, password);`;

      if (provider === 'google') {
        const clientId = config.clientId || 'google-oauth-flowforge.apps.googleusercontent.com';
        const mockToken = config.mockToken || 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE';
        const googleEmail = config.googleEmail || 'google.teste@gmail.com';
        const googleName = config.googleName || 'Google Teste';

        params = 'token';
        authBody = `const googleToken = token || '${mockToken}';\n  // Valida token fictício e autentica sessão do Google\n  const user = authenticateGoogle({\n    clientId: '${clientId}',\n    token: googleToken,\n    email: '${googleEmail}',\n    name: '${googleName}'\n  });`;
      } else if (config.mode === 'register') {
        authBody = `// Cria e registra nova conta com e-mail e senha\n  const user = registerUser(email, password);`;
      }

      code = code.replace(/\{\{params\}\}/g, params);
      code = code.replace(/\{\{authBody\}\}/g, authBody);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      code = code.replace(/\{\{errorBranch\}\}/g, errorBranch);
      break;
    }

    case 'error': {
      const message = config.message || 'Erro detectado no fluxo';
      const retryBranch =
        getCallForHandle('retry') ||
        "alert(message || (error && error.message) || 'Ocorreu um erro');";

      code = code.replace(/\{\{message\}\}/g, message);
      code = code.replace(/\{\{retryBranch\}\}/g, retryBranch);
      break;
    }

    case 'api': {
      const method = config.method || 'GET';
      const url = config.url || '/api/endpoint';
      const successBranch = getCallForHandle('onSuccess', 'data') || 'return data;';

      code = code.replace(/\{\{method\}\}/g, method);
      code = code.replace(/\{\{url\}\}/g, url);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      break;
    }

    case 'database': {
      const operation = config.operation || 'query';
      const table = config.table || 'usuarios';
      const successBranch = getCallForHandle('onSuccess', 'data') || 'return data;';

      let dbBody = `// Consulta registros da tabela '${table}'\n  const data = await db.query('${table}', payload);`;
      if (operation === 'insert') {
        dbBody = `// Insere novo registro na tabela '${table}' do banco de dados\n  const data = await db.insert('${table}', payload || { email, senha });`;
      }

      code = code.replace(/\{\{dbBody\}\}/g, dbBody);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      break;
    }

    case 'navigate': {
      const target = config.target || 'home';
      const targetFn = toSafeFunctionName(target);
      code = code.replace(/\{\{target\}\}/g, targetFn);
      break;
    }

    case 'screen': {
      const nextCall = outEdges[0]
        ? `// Início automático do fluxo da tela\n  ${toSafeFunctionName(outEdges[0].target)}();`
        : '// Aguardando ações do usuário na tela';
      code = code.replace(/\{\{nextCall\}\}/g, nextCall);
      break;
    }
  }

  return code;
}

/**
 * Atualiza o campo `config.code` dos nós especificados (ou de todos) com base nas conexões atuais.
 */
export function syncGraphCode(graph: Graph, targetNodeIds?: string[]): Graph {
  const idsToUpdate = targetNodeIds ? new Set(targetNodeIds) : null;

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (idsToUpdate && !idsToUpdate.has(node.id)) return node;
      const generatedCode = generateBlockCode(graph, node);
      return {
        ...node,
        data: {
          ...node.data,
          config: {
            ...node.data.config,
            code: generatedCode,
          },
        },
      };
    }),
  };
}
