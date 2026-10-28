import { getLogicTemplateById } from './blockLogicTemplates';
import codeCatalog from './codeCatalog.json';
import { isExecInput } from './ports';
import type { Block, Graph, Kind, Link } from './types';

type CatalogEntry = {
  description: string;
  template: string;
};

const catalog = codeCatalog as Record<Kind, CatalogEntry>;

/**
 * Emite um literal JavaScript seguro a partir de qualquer valor,
 * prevenindo quebras de sintaxe e injeção de código.
 */
export function jsLiteral(value: unknown, quote: "'" | '"' = "'"): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    if (quote === "'") {
      return `'${escaped.replace(/'/g, "\\'")}'`;
    } else {
      return `"${escaped.replace(/"/g, '\\"')}"`;
    }
  }
  return JSON.stringify(value);
}

/** Formata um valor de retorno como expressão JavaScript válida (literal ou identificador). */
export function formatReturnExpression(val: string | undefined, fallback = '""'): string {
  if (val === undefined || val === null) return fallback;
  const trimmed = String(val).trim();
  if (!trimmed) return fallback;
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed;
  }
  if (
    /^-?\d+(\.\d+)?$/.test(trimmed) ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return trimmed;
  }
  if (
    /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(trimmed) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    trimmed.startsWith('new ')
  ) {
    return trimmed;
  }
  return jsLiteral(trimmed, '"');
}

/** Sanitiza um ID de bloco para ser um identificador de função JavaScript válido. */
export function toSafeFunctionName(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_$]/g, '_');
  return /^[0-9]/.test(sanitized) ? `fn_${sanitized}` : sanitized;
}

/**
 * Gera o código JavaScript real correspondente a uma conexão específica entre dois blocos.
 */
export function getEdgeGeneratedCode(graph: Graph, block: Block, edge: Link): string {
  const isSource = edge.source === block.id;
  const sourceNode = isSource ? block : graph.nodes.find((n) => n.id === edge.source);
  const targetNode = isSource ? graph.nodes.find((n) => n.id === edge.target) : block;
  if (!sourceNode || !targetNode) return '// Conexão sem nós correspondentes';

  const sourceHandle =
    edge.sourceHandle || (sourceNode.data.kind === 'condition' ? 'true' : 'next');
  const targetFn = toSafeFunctionName(targetNode.id);

  let defaultArg = 'value';
  if (sourceNode.data.kind === 'condition') {
    if (sourceHandle === 'true') {
      defaultArg = sourceNode.data.config.trueValue
        ? formatReturnExpression(sourceNode.data.config.trueValue, 'value')
        : 'true';
    } else {
      defaultArg = sourceNode.data.config.falseValue
        ? formatReturnExpression(sourceNode.data.config.falseValue, 'false')
        : 'new Error("Dados inválidos")';
    }
  } else if (sourceNode.data.kind === 'button') {
    defaultArg = '';
  } else if (sourceNode.data.kind === 'auth') {
    defaultArg = sourceHandle === 'onSuccess' ? 'user' : 'new Error("Falha na autenticação")';
  } else if (targetNode.data.kind === 'error') {
    defaultArg = 'new Error("Falha na validação")';
  }

  const effectiveArg =
    edge.data?.callArg !== undefined && edge.data.callArg !== '' ? edge.data.callArg : defaultArg;

  if (targetNode.data.kind === 'screen') {
    return `// Redireciona para tela\nreturn navigateTo('${targetNode.id}');`;
  }
  if (targetNode.data.kind === 'condition') {
    return `// Condição Aninhada (If dentro de If) ➔ ${targetNode.data.label || targetNode.id}\nreturn ${targetFn}(${effectiveArg});`;
  }
  if (targetNode.data.kind === 'database') {
    return `// Grava no Banco ➔ ${targetNode.data.label || targetNode.id}\nreturn ${targetFn}(${effectiveArg});`;
  }
  if (targetNode.data.kind === 'error') {
    return `// Tratamento de Erro ➔ ${targetNode.data.label || targetNode.id}\nreturn ${targetFn}(${effectiveArg});`;
  }
  return `// Chamada do bloco ➔ ${targetNode.data.label || targetNode.id}\nreturn ${targetFn}(${effectiveArg});`;
}

/**
 * Gera o código JavaScript de um bloco com base nas conexões de entrada e saída no grafo.
 */
export function generateBlockCode(graph: Graph, block: Block): string {
  const kind = block.data.kind;
  const entry = catalog[kind];
  const fnName = toSafeFunctionName(block.id);
  const config = block.data.config;
  const label = block.data.label || block.id;
  const safeCommentLabel = (label || block.id).replace(/[\r\n*/]/g, ' ');

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
    let arg =
      edge.data?.callArg !== undefined && edge.data.callArg !== '' ? edge.data.callArg : defaultArg;
    if (targetNode.data.kind === 'error' && (!arg || arg === 'false')) {
      arg = 'new Error("Falha na validação")';
    } else if (targetNode.data.kind === 'screen') {
      arg = defaultArg.includes('user') ? 'user' : '';
    }

    let comment = '';
    if (targetNode.data.kind === 'condition') {
      comment = `// Condição Aninhada (If dentro de If) ➔ ${targetNode.data.label || targetNode.id}\n    `;
    }
    return `${comment}return ${targetFn}(${arg});`;
  };

  if (!entry) {
    const activeLogic = getLogicTemplateById(config.logicTemplateId);
    const snippet = activeLogic
      ? activeLogic.buildCodeSnippet(config, block.id)
      : `// Lógica do bloco ${safeCommentLabel} (${kind})`;
    const nextCall =
      getCallForHandle('then', 'result') ||
      getCallForHandle('next', 'result') ||
      getCallForHandle('onSuccess', 'result') ||
      (outEdges[0]
        ? `return ${toSafeFunctionName(outEdges[0].target)}(result);`
        : 'return result;');
    return `function ${fnName}(value = "") {\n  if (typeof __step === 'function') __step('${fnName}');\n  // ${safeCommentLabel}\n  const result = (() => {\n    ${snippet.split('\n').join('\n    ')}\n  })();\n  ${nextCall}\n}`;
  }

  let code = entry.template;
  code = code.replace(/\{\{id\}\}/g, fnName);
  code = code.replace(/\{\{label\}\}/g, safeCommentLabel);

  switch (kind) {
    case 'button': {
      const clickCall =
        getCallForHandle('onClick') ||
        getCallForHandle('click') ||
        getCallForHandle('then') ||
        (outEdges[0]
          ? `return ${toSafeFunctionName(outEdges[0].target)}();`
          : "return '// Sem conexão: configure um destino no editor';");
      code = code.replace(/\{\{targetCall\}\}/g, clickCall);
      break;
    }

    case 'input': {
      const defaultValue = jsLiteral(config.value || '');
      code = code.replace(/\{\{defaultValue\}\}/g, defaultValue);
      break;
    }

    case 'function': {
      // Procura chamadas de saída (then, next, ou qualquer aresta conectada que não seja erro)
      const nextEdge =
        outEdges.find(
          (e) =>
            e.sourceHandle === 'then' ||
            e.sourceHandle === 'next' ||
            (e.sourceHandle !== 'onError' && e.sourceHandle !== 'error'),
        ) || outEdges[0];

      const nextTargetNode = nextEdge ? graph.nodes.find((n) => n.id === nextEdge.target) : null;
      const nextTargetFn = nextTargetNode ? toSafeFunctionName(nextTargetNode.id) : '';

      // Identifica entradas de dados conectadas (excluindo conexões de controle/execução)
      const directDataInputs = inEdges
        .filter(
          (e) =>
            !isExecInput(e.targetHandle) &&
            e.sourceHandle !== 'onClick' &&
            e.sourceHandle !== 'click' &&
            e.sourceHandle !== 'then' &&
            e.sourceHandle !== 'next',
        )
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

      // Gera leituras seguras para variáveis dos inputs da tela (sem colidir com 'value' e sem sombrear o próximo destino)
      const inputReads = relevantInputs
        .filter(
          (n) => toSafeFunctionName(n.id) !== 'value' && toSafeFunctionName(n.id) !== nextTargetFn,
        )
        .map((n) => {
          const varName = toSafeFunctionName(n.id);
          const defaultVal = jsLiteral(n.data.config.value || '');
          return `const ${varName} = (typeof value === 'object' && value !== null && value.${varName} !== undefined) ? value.${varName} : read(${jsLiteral(n.id)}, 'value', ${defaultVal});`;
        })
        .join('\n  ');

      const paramNames = relevantInputs
        .map((n) => toSafeFunctionName(n.id))
        .filter((name) => name !== 'value' && name !== nextTargetFn);

      const paramsArg =
        paramNames.length > 1 ? `{ ${paramNames.join(', ')} }` : paramNames[0] || 'value';

      let bodyText = '// Lógica personalizada da função';
      let returnCall = paramNames.length > 0 ? `return ${paramsArg};` : 'return value;';

      let customLogic = '';
      if (config.logicTemplateId) {
        const tmpl = getLogicTemplateById(config.logicTemplateId);
        if (tmpl && tmpl.compatibleKinds.includes(kind)) {
          customLogic = tmpl.buildCodeSnippet(config, block.id);
        }
      }
      if (!customLogic && config.code) {
        if (!config.code.startsWith('function ') && !config.code.startsWith('async function ')) {
          customLogic = config.code;
        } else if (config.code.includes('(() => {')) {
          const match = config.code.match(/\(\(\)\s*=>\s*\{([\s\S]*?)\}\)\(\);/);
          if (match) customLogic = match[1].trim();
        } else if (config.code.includes('// Lógica:\n')) {
          const match = config.code.match(
            /\/\/\s*Lógica:\s*([\s\S]*?)(?=\n\s*if\s*\(computed|\n\s*return|\n\})/,
          );
          if (match) customLogic = match[1].trim();
        }
      }

      if (customLogic) {
        if (nextTargetFn) {
          bodyText = `// Lógica personalizada do bloco\n    const computed = (() => {\n      ${customLogic}\n    })();\n    if (computed && typeof computed.then === 'function') {\n      return computed.then((resolved) => ${nextTargetFn}(resolved !== undefined ? resolved : ${paramsArg}));\n    }`;
          returnCall = `return ${nextTargetFn}(computed !== undefined ? computed : ${paramsArg});`;
        } else {
          bodyText = `// Lógica:\n    const computed = (() => {\n      ${customLogic}\n    })();\n    if (computed && typeof computed.then === 'function') {\n      return computed.then((resolved) => resolved !== undefined ? resolved : value);\n    }\n    return computed !== undefined ? computed : value;`;
          returnCall = '';
        }
      } else if (
        outEdges.some((e) => graph.nodes.find((n) => n.id === e.target)?.data.kind === 'database')
      ) {
        bodyText = `// Prepara payload para inserção no banco de dados\n    const payload = { id: Date.now(), ${paramNames.length > 0 ? paramNames.join(', ') : 'value'}, provider: 'email' };`;
        if (nextTargetFn) {
          returnCall = `return ${nextTargetFn}(payload);`;
        }
      } else if (nextTargetFn) {
        returnCall = `return ${nextTargetFn}(${paramsArg});`;
      }

      const errorCall = getCallForHandle('onError', 'error') || getCallForHandle('error', 'error');
      const errorBranch = errorCall || 'throw error;';

      code = code.replace(/\{\{params\}\}/g, 'value = ""');
      code = code.replace(/\{\{inputReads\}\}/g, inputReads ? `${inputReads}\n  ` : '');
      code = code.replace(/\{\{body\}\}/g, bodyText);
      code = code.replace(/\{\{returnCall\}\}/g, returnCall);
      code = code.replace(/\{\{errorBranch\}\}/g, errorBranch);
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

      let rawInputs: Block[] = [];
      if (sourceNodes.some((n) => n.data.kind === 'input')) {
        rawInputs = sourceNodes.filter((n) => n.data.kind === 'input');
      } else if (screenInputs.length > 0) {
        rawInputs = screenInputs;
      }

      let conditionParamsDecl = 'value';
      let paramExtraction = '';
      let conditionExpr = 'Boolean(value)';
      let passArg = 'value';

      // Se a condição recebe dados de uma função anterior, o dado de entrada é o resultado computado (value)
      const isInputFromFunction = inEdges.some((e) => {
        const src = graph.nodes.find((n) => n.id === e.source);
        return src && src.data.kind === 'function';
      });

      if (isInputFromFunction) {
        paramExtraction = `if (value && typeof value.then === 'function') {\n    return value.then((resolved) => ${fnName}(resolved));\n  }\n  `;
        conditionParamsDecl = 'value = ""';
        if (config.operator === 'equals') {
          conditionExpr = `value === ${jsLiteral(config.compare ?? '')}`;
        } else if (config.operator === 'gt') {
          conditionExpr = `Number(value) > ${Number(config.compare || 0)}`;
        } else {
          conditionExpr = `Boolean(value)`;
        }
        passArg = 'value';
      } else if (rawInputs.length > 1) {
        conditionParamsDecl = 'inputArgs = {}';
        const safeNames = rawInputs.map((n) => toSafeFunctionName(n.id));
        const extractions = rawInputs.map((n) => {
          const safe = toSafeFunctionName(n.id);
          const defaultVal = jsLiteral(n.data.config.value || '');
          return `const ${safe} = (typeof inputArgs === 'object' && inputArgs !== null && inputArgs.${safe} !== undefined) ? inputArgs.${safe} : read(${jsLiteral(n.id)}, 'value', ${defaultVal});`;
        });
        paramExtraction = extractions.join('\n  ') + '\n  ';
        conditionExpr = safeNames.map((s) => `Boolean(${s})`).join(' && ');
        passArg = `{ ${safeNames.join(', ')} }`;
      } else if (rawInputs.length === 1) {
        const single = rawInputs[0];
        const safe = toSafeFunctionName(single.id);
        const defaultVal = jsLiteral(single.data.config.value || '');
        conditionParamsDecl = `${safe} = read(${jsLiteral(single.id)}, 'value', ${defaultVal})`;
        if (config.operator === 'equals') {
          conditionExpr = `${safe} === ${jsLiteral(config.compare ?? '')}`;
        } else if (config.operator === 'gt') {
          conditionExpr = `Number(${safe}) > ${Number(config.compare || 0)}`;
        } else {
          conditionExpr = `Boolean(${safe})`;
        }
        passArg = safe;
      } else {
        paramExtraction = `if (value && typeof value.then === 'function') {\n    return value.then((resolved) => ${fnName}(resolved));\n  }\n  `;
        const param = config.paramName || 'value';
        const hasCustomParams = Boolean(config.paramName || config.defaultValue !== undefined);
        conditionParamsDecl = hasCustomParams
          ? `${param} = ${config.defaultValue !== undefined && config.defaultValue !== '' ? config.defaultValue : '""'}`
          : 'value';
        if (config.operator === 'equals') {
          conditionExpr = `${param} === ${jsLiteral(config.compare ?? '')}`;
        } else if (config.operator === 'not_equals') {
          conditionExpr = `${param} !== ${jsLiteral(config.compare ?? '')}`;
        } else if (config.operator === 'gt') {
          conditionExpr = `Number(${param}) > ${Number(config.compare || 0)}`;
        } else if (config.operator === 'lt') {
          conditionExpr = `Number(${param}) < ${Number(config.compare || 0)}`;
        } else if (config.operator === 'gte') {
          conditionExpr = `Number(${param}) >= ${Number(config.compare || 0)}`;
        } else if (config.operator === 'lte') {
          conditionExpr = `Number(${param}) <= ${Number(config.compare || 0)}`;
        } else {
          conditionExpr = `Boolean(${param})`;
        }
        passArg = param;
      }

      const trueArg = config.trueValue
        ? formatReturnExpression(config.trueValue, passArg)
        : passArg;
      const falseArg = config.falseValue
        ? formatReturnExpression(config.falseValue, 'new Error("Dados inválidos")')
        : 'new Error("Dados inválidos")';

      const trueFallback = config.trueValue
        ? `return ${formatReturnExpression(config.trueValue, 'true')};`
        : 'return true;';
      const falseFallback = config.falseValue
        ? `return ${formatReturnExpression(config.falseValue, 'false')};`
        : 'return false;';

      const trueBranch = getCallForHandle('true', trueArg) || trueFallback;
      const falseBranch = getCallForHandle('false', falseArg) || falseFallback;

      code = code.replace(/\{\{params\}\}/g, conditionParamsDecl);
      code = code.replace(/\{\{paramExtraction\}\}/g, paramExtraction);
      code = code.replace(/\{\{condition\}\}/g, conditionExpr);
      code = code.replace(/\{\{trueBranch\}\}/g, trueBranch);
      code = code.replace(/\{\{falseBranch\}\}/g, falseBranch);
      break;
    }

    case 'auth': {
      const provider = config.provider || 'email';
      const successBranch =
        getCallForHandle('onSuccess', 'user') || 'return { success: true, user };';
      const errorBranch =
        getCallForHandle('onError', 'new Error("Credenciais inválidas")') ||
        'return { success: false, error: new Error("Falha na autenticação") };';

      // Identifica campos de input na mesma tela para leitura precisa caso nomes sejam customizados
      const screenInputs = block.data.config.screenId
        ? graph.nodes.filter(
            (n) => n.data.kind === 'input' && n.data.config.screenId === block.data.config.screenId,
          )
        : [];
      const emailInput = screenInputs.find(
        (n) => n.data.config.field === 'email' || n.id.includes('email'),
      );
      const passInput = screenInputs.find(
        (n) =>
          n.data.config.field === 'password' || n.id.includes('senha') || n.id.includes('password'),
      );

      const emailFallbackId = emailInput ? emailInput.id : 'email';
      const passFallbackId = passInput ? passInput.id : 'senha';
      const safeEmailKey = toSafeFunctionName(emailFallbackId);
      const safePassKey = toSafeFunctionName(passFallbackId);

      let params = 'email, password';
      let authBody = `// Obtém credenciais de entrada (objeto ou argumentos) ou lê da tela
  const creds = typeof email === 'object' && email !== null ? email : { email, password };
  const authEmail = creds.email || creds.${safeEmailKey} || read(${jsLiteral(emailFallbackId)}, 'value') || read('email', 'value') || '';
  const authPassword = creds.password || creds.senha || creds.${safePassKey} || read(${jsLiteral(passFallbackId)}, 'value') || read('senha', 'value') || read('password', 'value') || '';
  const user = authenticate('email', authEmail, authPassword);`;

      if (provider === 'google') {
        const clientId = config.clientId || 'google-oauth-flowforge.apps.googleusercontent.com';
        const mockToken = config.mockToken || 'ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE';
        const googleEmail = config.googleEmail || 'google.teste@gmail.com';
        const googleName = config.googleName || 'Google Teste';

        params = 'token';
        authBody = `const googleToken = token || ${jsLiteral(mockToken)};
  // Valida token fictício e autentica sessão do Google
  const user = authenticateGoogle({
    clientId: ${jsLiteral(clientId)},
    token: googleToken,
    email: ${jsLiteral(googleEmail)},
    name: ${jsLiteral(googleName)}
  });`;
      } else if (config.mode === 'register') {
        authBody = `// Registra nova conta com e-mail e senha
  const creds = typeof email === 'object' && email !== null ? email : { email, password };
  const regEmail = creds.email || creds.${safeEmailKey} || read(${jsLiteral(emailFallbackId)}, 'value') || read('email', 'value') || '';
  const regPassword = creds.password || creds.senha || creds.${safePassKey} || read(${jsLiteral(passFallbackId)}, 'value') || read('senha', 'value') || read('password', 'value') || '';
  const user = registerUser(regEmail, regPassword);`;
      }

      code = code.replace(/\{\{params\}\}/g, params);
      code = code.replace(/\{\{authBody\}\}/g, authBody);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      code = code.replace(/\{\{errorBranch\}\}/g, errorBranch);
      break;
    }

    case 'error': {
      const message = config.message || 'Erro detectado no fluxo';
      const retryCall = getCallForHandle('retry');
      const retryBranch = retryCall
        ? `if (canRetry(${jsLiteral(block.id)}, 1)) {\n    ${retryCall}\n  }`
        : '';

      code = code.replace(/\{\{message\}\}/g, jsLiteral(message));
      code = code.replace(/\{\{retryBranch\}\}/g, retryBranch);
      break;
    }

    case 'notify': {
      const message = config.message || 'Operação realizada com sucesso!';
      const type = config.type || 'success';
      const duration = Number(config.duration || 3000);
      const nextCall =
        getCallForHandle('next', 'payload') ||
        getCallForHandle('then', 'payload') ||
        getCallForHandle('onDismiss', 'payload') ||
        '';

      code = code.replace(/\{\{message\}\}/g, jsLiteral(message));
      code = code.replace(/\{\{type\}\}/g, jsLiteral(type));
      code = code.replace(/\{\{duration\}\}/g, String(duration));
      code = code.replace(/\{\{nextCall\}\}/g, nextCall);
      break;
    }

    case 'state': {
      const key = config.key || 'variavel';
      const op = config.operation || 'set';
      const valExpr = jsLiteral(config.value ?? '');
      const nextCall =
        getCallForHandle('next', 'result') || getCallForHandle('then', 'result') || '';

      code = code.replace(/\{\{key\}\}/g, jsLiteral(key));
      code = code.replace(/\{\{op\}\}/g, jsLiteral(op));
      code = code.replace(/\{\{valExpr\}\}/g, valExpr);
      code = code.replace(/\{\{nextCall\}\}/g, nextCall);
      break;
    }

    case 'validator': {
      const rule = config.rule || 'required';
      const param = config.param || '';
      const message = config.message || 'Campo obrigatório ou formato inválido';

      const sourceInputs = inEdges
        .map((e) => graph.nodes.find((n) => n.id === e.source))
        .filter((n): n is Block => Boolean(n && n.data.kind === 'input'));
      const screenInputs = block.data.config.screenId
        ? graph.nodes.filter(
            (n) => n.data.kind === 'input' && n.data.config.screenId === block.data.config.screenId,
          )
        : [];
      const inputId = sourceInputs[0]?.id || screenInputs[0]?.id || '';

      const valExtraction = inputId
        ? `const value = typeof payload === 'string' && payload ? payload : read(${jsLiteral(inputId)}, 'value', '');\n`
        : `const value = payload !== undefined ? payload : '';\n`;

      const validBranch =
        getCallForHandle('valid', 'value') ||
        getCallForHandle('then', 'value') ||
        getCallForHandle('next', 'value') ||
        'return { valid: true, value };';

      const invalidBranch =
        getCallForHandle('invalid', 'validation.error') ||
        getCallForHandle('error', 'validation.error') ||
        getCallForHandle('false', 'validation.error') ||
        'return { valid: false, error: validation.error };';

      code = code.replace(/\{\{valExtraction\}\}/g, valExtraction);
      code = code.replace(/\{\{rule\}\}/g, jsLiteral(rule));
      code = code.replace(/\{\{param\}\}/g, jsLiteral(param));
      code = code.replace(/\{\{message\}\}/g, jsLiteral(message));
      code = code.replace(/\{\{validBranch\}\}/g, validBranch);
      code = code.replace(/\{\{invalidBranch\}\}/g, invalidBranch);
      break;
    }

    case 'switch': {
      const cases = (config.cases || 'opcao1, opcao2')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const valExpr = jsLiteral(config.value ?? '');

      const branchLines: string[] = [];
      cases.forEach((caseName, idx) => {
        const caseHandle = `case${idx + 1}`;
        const targetCall =
          getCallForHandle(caseHandle, 'value') || getCallForHandle(caseName, 'value');
        if (targetCall) {
          branchLines.push(
            `if (String(value).toLowerCase() === ${jsLiteral(caseName.toLowerCase(), '"')}) {\n    ${targetCall}\n  }`,
          );
        }
      });

      const defaultCall =
        getCallForHandle('default', 'value') ||
        getCallForHandle('then', 'value') ||
        getCallForHandle('next', 'value') ||
        'return value;';
      branchLines.push(`// Rota padrão (default)\n  ${defaultCall}`);

      const switchBranches = branchLines.join(' else ');

      code = code.replace(/\{\{valExpr\}\}/g, valExpr);
      code = code.replace(/\{\{switchBranches\}\}/g, switchBranches);
      break;
    }

    case 'delay': {
      const duration = Number(config.duration || 1000);
      const nextCall =
        getCallForHandle('next', 'payload') ||
        getCallForHandle('then', 'payload') ||
        getCallForHandle('onComplete', 'payload') ||
        '';

      code = code.replace(/\{\{duration\}\}/g, String(duration));
      code = code.replace(/\{\{nextCall\}\}/g, nextCall);
      break;
    }

    case 'api': {
      const method = config.method || 'GET';
      const url = config.url || '/api/endpoint';
      const successBranch = getCallForHandle('onSuccess', 'data') || 'return data;';
      const errorCall = getCallForHandle('onError', 'error') || getCallForHandle('error', 'error');
      const errorBranch = errorCall || 'throw error;';

      let apiBody = '';
      if (config.mode === 'real' || config.useRealApi === 'true') {
        apiBody = `throw new Error('HTTP real exige o projeto ZIP com backend. Use a exportação TypeScript.');`;
      } else {
        const hasError = Boolean(
          config.simulateError === 'true' || (config.status && Number(config.status) >= 400),
        );
        const errorMsg = config.errorMessage || 'Falha na chamada da API';
        let mockDataStr = '{ ok: true }';
        if (config.mock) {
          try {
            mockDataStr = JSON.stringify(JSON.parse(config.mock));
          } catch {
            mockDataStr = JSON.stringify({ ok: true, data: config.mock });
          }
        }
        apiBody = `if (${hasError}) {
      throw new Error(${jsLiteral(errorMsg)});
    }
    const data = ${mockDataStr};
    log('API simulada [' + ${jsLiteral(method)} + ']: ' + ${jsLiteral(url)}, data);`;
      }

      code = code.replace(/\{\{apiBody\}\}/g, apiBody);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      code = code.replace(/\{\{errorBranch\}\}/g, errorBranch);
      break;
    }

    case 'database': {
      const operation = config.operation || 'query';
      const table = config.table || 'usuarios';
      const successBranch = getCallForHandle('onSuccess', 'data') || 'return data;';
      const errorCall = getCallForHandle('onError', 'error') || getCallForHandle('error', 'error');
      const errorBranch = errorCall || 'throw error;';

      const hasError = config.simulateError === 'true';
      const errorMsg = config.errorMessage || 'Falha na operação de banco de dados';

      let dbBody = `// Consulta registros da tabela ${jsLiteral(table)}
    if (${hasError}) {
      throw new Error(${jsLiteral(errorMsg)});
    }
    const data = await db.query(${jsLiteral(table)}, typeof payload === 'object' ? payload : undefined);`;
      if (operation === 'insert') {
        dbBody = `// Insere novo registro na tabela ${jsLiteral(table)} do banco de dados
    if (${hasError}) {
      throw new Error(${jsLiteral(errorMsg)});
    }
    const record = typeof payload === 'object' && payload !== null ? payload : { value: payload };
    const data = await db.insert(${jsLiteral(table)}, record);`;
      }

      code = code.replace(/\{\{dbBody\}\}/g, dbBody);
      code = code.replace(/\{\{successBranch\}\}/g, successBranch);
      code = code.replace(/\{\{errorBranch\}\}/g, errorBranch);
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
        ? `// Início automático do fluxo da tela\n  return ${toSafeFunctionName(outEdges[0].target)}();`
        : `return { id: ${jsLiteral(block.id)}, label: ${jsLiteral(label)} };`;
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

/**
 * Compila todo o projeto em um script JavaScript modular, real e executável.
 */
export function generateProjectCode(graph: Graph): string {
  const initialDbData: Record<string, unknown[]> = {};
  for (const n of graph.nodes) {
    if (n.data.kind === 'database') {
      const table = n.data.config.table || 'usuarios';
      try {
        initialDbData[table] = JSON.parse(n.data.config.mock || '[]');
      } catch {
        initialDbData[table] = [];
      }
    }
  }

  const initialInputs: Record<string, unknown> = {};
  for (const n of graph.nodes) {
    if (n.data.kind === 'input') {
      initialInputs[n.id] = n.data.config.value || '';
    }
  }

  const blockFunctions = graph.nodes.map((node) => generateBlockCode(graph, node)).join('\n\n');

  return `// ============================================================================
// FlowForge - Programa JavaScript Completo e Funcional
// Projeto: ${graph.name || 'Fluxo FlowForge'}
// Gerado automaticamente com base nos blocos, conexões e propriedades.
// ============================================================================

export function createFlowRunner(initialInputs = {}, customStore = {}, options = {}) {
  // 1. Contexto de execução compartilhado e controle de passos (proteção contra ciclos)
  const __stepLimit = Number(options.maxSteps || 100);
  let __currentSteps = 0;
  function __step(blockId) {
    __currentSteps++;
    if (__currentSteps > __stepLimit) {
      throw new Error('Fluxo interrompido: limite de ' + __stepLimit + ' passos (possível ciclo).');
    }
  }

  // 2. Estado em memória e Store do projeto
  const currentInputs = { ...${JSON.stringify(initialInputs, null, 2)}, ...initialInputs };
  const store = {
    ...${JSON.stringify(initialDbData, null, 2)},
    ...customStore
  };
  let currentScreen = ${jsLiteral(graph.nodes.find((n) => n.data.kind === 'screen')?.id || '')};
  const executionLog = [];

  function log(msg, data) {
    executionLog.push({ timestamp: Date.now(), msg, data });
  }

  // 3. Runtime Helpers
  function read(id, field, fallback = '') {
    if (currentInputs[id] !== undefined) return currentInputs[id];
    if (currentInputs[field] !== undefined) return currentInputs[field];
    return fallback;
  }

  function navigateTo(targetScreenId) {
    currentScreen = targetScreenId;
    log('Navegou para a tela: ' + targetScreenId);
    return { screen: targetScreenId };
  }

  const notifications = [];
  function notify(opts) {
    const item = typeof opts === 'string' ? { message: opts, type: 'info' } : (opts || {});
    item.id = Date.now();
    item.timestamp = Date.now();
    item.type = item.type || 'success';
    item.duration = item.duration || 3000;
    notifications.push(item);
    log('[Notificação ' + item.type.toUpperCase() + '] ' + item.message, item);
    return item;
  }

  const retryCounters = {};
  function canRetry(blockId, max = 1) {
    retryCounters[blockId] = (retryCounters[blockId] || 0) + 1;
    return retryCounters[blockId] <= max;
  }

  const db = {
    async query(table, filter) {
      if (!table) throw new Error('Nome da tabela não informado para consulta no banco.');
      const rows = store[table] || [];
      if (!filter || typeof filter !== 'object') return rows;
      return rows.filter((r) =>
        Object.entries(filter).every(([k, v]) => r[k] === v)
      );
    },
    async insert(table, record) {
      if (!table) throw new Error('Nome da tabela não informado para inserção no banco.');
      if (!store[table]) store[table] = [];
      const newRecord = { id: Date.now(), ...record };
      store[table].push(newRecord);
      log('Inserido em ' + table, newRecord);
      return newRecord;
    }
  };

  function authenticate(provider, email, password) {
    const users = store['usuarios'] || [];
    const found = users.find((u) => u.email === email && (u.senha === password || u.password === password));
    if (found) {
      store.__session = [found];
      return found;
    }
    if (email === 'demo@exemplo.com' && password === '123456') {
      const demoUser = { id: 1, email, nome: 'Usuário Demo' };
      store.__session = [demoUser];
      return demoUser;
    }
    return null;
  }

  function authenticateGoogle(opts) {
    const users = store['usuarios'] || (store['usuarios'] = []);
    let user = users.find((u) => u.email === opts.email);
    if (!user) {
      user = { id: Date.now(), email: opts.email, nome: opts.name, provider: 'google', token: opts.token };
      users.push(user);
    } else {
      user.token = opts.token;
      user.provider = 'google';
    }
    store.__session = [user];
    return user;
  }

  function registerUser(email, password) {
    const users = store['usuarios'] || (store['usuarios'] = []);
    if (users.some((u) => u.email === email)) {
      throw new Error('Usuário já cadastrado');
    }
    const newUser = { id: Date.now(), email, senha: password };
    users.push(newUser);
    store.__session = [newUser];
    return newUser;
  }

  function setVar(key, val) {
    store[key] = val;
    log('Estado atualizado: ' + key, val);
    return val;
  }

  function getVar(key, fallback = '') {
    return store[key] !== undefined ? store[key] : fallback;
  }

  function clearVar(key) {
    delete store[key];
    log('Estado removido: ' + key);
    return null;
  }

  function validate(value, rule, param, message) {
    const strVal = String(value ?? '');
    let valid = false;
    if (rule === 'required') {
      valid = strVal.trim().length > 0;
    } else if (rule === 'email') {
      valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(strVal);
    } else if (rule === 'minLength') {
      valid = strVal.length >= Number(param || 6);
    } else if (rule === 'maxLength') {
      valid = strVal.length <= Number(param || 100);
    } else if (rule === 'numeric') {
      valid = !isNaN(Number(strVal)) && strVal.trim() !== '';
    } else if (rule === 'cpf') {
      const clean = strVal.replace(/[^0-9]/g, '');
      valid = clean.length === 11 && !clean.split('').every((c) => c === clean[0]);
    } else if (rule === 'regex') {
      try { valid = new RegExp(param || '.*').test(strVal); } catch { valid = false; }
    } else {
      valid = Boolean(value);
    }
    return {
      valid,
      value,
      error: valid ? null : (message || 'Validação falhou')
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Number(ms) || 0));
  }

  // 4. Funções dos Blocos Conectados
  ${blockFunctions.split('\n').join('\n  ')}

  // 5. API de execução do fluxo
  return {
    store,
    getScreen: () => currentScreen,
    getLogs: () => executionLog,
    getNotifications: () => notifications,
    setInputs: (newInputs) => Object.assign(currentInputs, newInputs),
    blocks: {
      ${graph.nodes.map((n) => `${toSafeFunctionName(n.id)}`).join(',\n      ')}
    }
  };
}
`;
}

/**
 * Executa o código JavaScript real compilado a partir do grafo para validação fim a fim.
 */
export async function executeProjectCode(
  graph: Graph,
  startBlockId: string,
  inputs: Record<string, unknown> = {},
  options: { maxSteps?: number } = {},
): Promise<{
  result: unknown;
  screen: string;
  store: Record<string, unknown>;
  logs: Array<{ timestamp: number; msg: string; data?: unknown }>;
  notifications: Array<{ id: number; type: string; message: string; duration: number }>;
}> {
  const code = generateProjectCode(graph);
  // Remove 'export ' para execução em new Function
  const executableScript = code.replace(
    /export function createFlowRunner/,
    'function createFlowRunner',
  );
  const factory = new Function(`${executableScript}; return createFlowRunner;`)() as (
    initInputs?: Record<string, unknown>,
    customStore?: Record<string, unknown>,
    options?: { maxSteps?: number },
  ) => {
    store: Record<string, unknown>;
    getScreen: () => string;
    getLogs: () => Array<{ timestamp: number; msg: string; data?: unknown }>;
    getNotifications?: () => Array<{
      id: number;
      type: string;
      message: string;
      duration: number;
    }>;
    blocks: Record<string, (...args: unknown[]) => unknown>;
  };

  const runner = factory(inputs, {}, options);
  const fnName = toSafeFunctionName(startBlockId);
  if (typeof runner.blocks[fnName] !== 'function') {
    throw new Error(`Bloco inicial "${startBlockId}" não gerou função executável.`);
  }

  const result = await runner.blocks[fnName]();
  return {
    result,
    screen: runner.getScreen(),
    store: runner.store,
    logs: runner.getLogs(),
    notifications: runner.getNotifications ? runner.getNotifications() : [],
  };
}

/**
 * Retorna os blocos pertencentes a uma tela específica.
 */
export function getBlocksForScreen(graph: Graph, screenId: string): Block[] {
  const allScreens = graph.nodes.filter((n) => n.data.kind === 'screen');
  const targetScreen = allScreens.find((s) => s.id === screenId) || allScreens[0];
  if (!targetScreen) return graph.nodes;

  return graph.nodes.filter((node) => {
    if (node.id === targetScreen.id) return true;
    if (node.data.kind === 'screen') return false;
    // Se explicitamente vinculado à tela
    if (node.data.config.screenId === targetScreen.id) return true;
    // Se o projeto tem apenas uma tela e não tem screenId explícito
    if (allScreens.length === 1 && !node.data.config.screenId) return true;
    return false;
  });
}

/**
 * Compila o arquivo JavaScript funcional e autônomo específico de uma tela,
 * contendo apenas os blocos que pertencem a ela.
 */
export function generateScreenCode(graph: Graph, screenId: string): string {
  const allScreens = graph.nodes.filter((n) => n.data.kind === 'screen');
  const targetScreen = allScreens.find((s) => s.id === screenId) || allScreens[0];
  const screenName = targetScreen ? targetScreen.data.label || targetScreen.id : screenId;
  const targetScreenId = targetScreen ? targetScreen.id : screenId;

  const screenBlocks = getBlocksForScreen(graph, targetScreenId);

  const initialDbData: Record<string, unknown[]> = {};
  for (const n of screenBlocks) {
    if (n.data.kind === 'database') {
      const table = n.data.config.table || 'usuarios';
      try {
        initialDbData[table] = JSON.parse(n.data.config.mock || '[]');
      } catch {
        initialDbData[table] = [];
      }
    }
  }

  const initialInputs: Record<string, unknown> = {};
  for (const n of screenBlocks) {
    if (n.data.kind === 'input') {
      initialInputs[n.id] = n.data.config.value || '';
    }
  }

  const blockFunctions = screenBlocks.map((node) => generateBlockCode(graph, node)).join('\n\n');

  const safeScreenFnName = toSafeFunctionName(targetScreenId);
  const runnerFactoryName = `create${safeScreenFnName.charAt(0).toUpperCase() + safeScreenFnName.slice(1)}Runner`;

  return `// ============================================================================
// FlowForge - Tela: ${screenName} (${targetScreenId}.js)
// Arquivo de código autônomo gerado com base nos blocos e conexões desta tela.
// ============================================================================

export const SCREEN_ID = ${JSON.stringify(targetScreenId)};
export const SCREEN_NAME = ${JSON.stringify(screenName)};

export function createScreenRunner(initialInputs = {}, customStore = {}, options = {}) {
  // 1. Contexto de execução compartilhado e controle de passos (proteção contra ciclos)
  const __stepLimit = Number(options.maxSteps || 100);
  let __currentSteps = 0;
  function __step(blockId) {
    __currentSteps++;
    if (__currentSteps > __stepLimit) {
      throw new Error('Fluxo interrompido: limite de ' + __stepLimit + ' passos (possível ciclo).');
    }
  }

  // 2. Estado em memória e Store desta tela
  const currentInputs = { ...${JSON.stringify(initialInputs, null, 2)}, ...initialInputs };
  const store = {
    ...${JSON.stringify(initialDbData, null, 2)},
    ...customStore
  };
  let currentScreen = ${jsLiteral(targetScreenId)};
  const executionLog = [];

  function log(msg, data) {
    executionLog.push({ timestamp: Date.now(), msg, data });
  }

  // 3. Runtime Helpers
  function read(id, field, fallback = '') {
    if (currentInputs[id] !== undefined) return currentInputs[id];
    if (currentInputs[field] !== undefined) return currentInputs[field];
    return fallback;
  }

  function navigateTo(targetScreenId) {
    currentScreen = targetScreenId;
    log('Navegou para a tela: ' + targetScreenId);
    return { screen: targetScreenId };
  }

  const notifications = [];
  function notify(opts) {
    const item = typeof opts === 'string' ? { message: opts, type: 'info' } : (opts || {});
    item.id = Date.now();
    item.timestamp = Date.now();
    item.type = item.type || 'success';
    item.duration = item.duration || 3000;
    notifications.push(item);
    log('[Notificação ' + item.type.toUpperCase() + '] ' + item.message, item);
    return item;
  }

  // Navegadores para telas do projeto
  ${graph.nodes
    .filter((n) => n.data.kind === 'screen')
    .map(
      (s) =>
        `function ${toSafeFunctionName(s.id)}() { if (typeof __step === 'function') __step(${jsLiteral(s.id)}); return navigateTo(${jsLiteral(s.id)}); }`,
    )
    .join('\n  ')}

  const retryCounters = {};
  function canRetry(blockId, max = 1) {
    retryCounters[blockId] = (retryCounters[blockId] || 0) + 1;
    return retryCounters[blockId] <= max;
  }

  const db = {
    async query(table, filter) {
      if (!table) throw new Error('Nome da tabela não informado para consulta no banco.');
      const rows = store[table] || [];
      if (!filter || typeof filter !== 'object') return rows;
      return rows.filter((r) =>
        Object.entries(filter).every(([k, v]) => r[k] === v)
      );
    },
    async insert(table, record) {
      if (!table) throw new Error('Nome da tabela não informado para inserção no banco.');
      if (!store[table]) store[table] = [];
      const newRecord = { id: Date.now(), ...record };
      store[table].push(newRecord);
      log('Inserido em ' + table, newRecord);
      return newRecord;
    }
  };

  function authenticate(provider, email, password) {
    const users = store['usuarios'] || [];
    const found = users.find((u) => u.email === email && (u.senha === password || u.password === password));
    if (found) {
      store.__session = [found];
      return found;
    }
    if (email === 'demo@exemplo.com' && password === '123456') {
      const demoUser = { id: 1, email, nome: 'Usuário Demo' };
      store.__session = [demoUser];
      return demoUser;
    }
    return null;
  }

  function authenticateGoogle(opts) {
    const users = store['usuarios'] || (store['usuarios'] = []);
    let user = users.find((u) => u.email === opts.email);
    if (!user) {
      user = { id: Date.now(), email: opts.email, nome: opts.name, provider: 'google', token: opts.token };
      users.push(user);
    } else {
      user.token = opts.token;
      user.provider = 'google';
    }
    store.__session = [user];
    return user;
  }

  function registerUser(email, password) {
    const users = store['usuarios'] || (store['usuarios'] = []);
    if (users.some((u) => u.email === email)) {
      throw new Error('Usuário já cadastrado');
    }
    const newUser = { id: Date.now(), email, senha: password };
    users.push(newUser);
    store.__session = [newUser];
    return newUser;
  }

  function setVar(key, val) {
    store[key] = val;
    log('Estado atualizado: ' + key, val);
    return val;
  }

  function getVar(key, fallback = '') {
    return store[key] !== undefined ? store[key] : fallback;
  }

  function clearVar(key) {
    delete store[key];
    log('Estado removido: ' + key);
    return null;
  }

  function validate(value, rule, param, message) {
    const strVal = String(value ?? '');
    let valid = false;
    if (rule === 'required') {
      valid = strVal.trim().length > 0;
    } else if (rule === 'email') {
      valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(strVal);
    } else if (rule === 'minLength') {
      valid = strVal.length >= Number(param || 6);
    } else if (rule === 'maxLength') {
      valid = strVal.length <= Number(param || 100);
    } else if (rule === 'numeric') {
      valid = !isNaN(Number(strVal)) && strVal.trim() !== '';
    } else if (rule === 'cpf') {
      const clean = strVal.replace(/[^0-9]/g, '');
      valid = clean.length === 11 && !clean.split('').every((c) => c === clean[0]);
    } else if (rule === 'regex') {
      try { valid = new RegExp(param || '.*').test(strVal); } catch { valid = false; }
    } else {
      valid = Boolean(value);
    }
    return {
      valid,
      value,
      error: valid ? null : (message || 'Validação falhou')
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Number(ms) || 0));
  }

  // 4. Funções dos Blocos Desta Tela
  ${blockFunctions.split('\n').join('\n  ')}

  const blocks = {
    ${screenBlocks.map((n) => `${toSafeFunctionName(n.id)}`).join(',\n    ')}
  };

  // 5. API de execução da tela
  return {
    screenId: ${jsLiteral(targetScreenId)},
    screenName: ${JSON.stringify(screenName)},
    store,
    getScreen: () => currentScreen,
    getLogs: () => executionLog,
    getNotifications: () => notifications,
    setInputs: (newInputs) => Object.assign(currentInputs, newInputs),
    blocks,
    async execute(blockId, inputs = {}) {
      if (inputs && typeof inputs === 'object') {
        Object.assign(currentInputs, inputs);
      }
      const fn = blocks[blockId] || blocks[blockId.replace(/[^a-zA-Z0-9_$]/g, '_')];
      if (typeof fn !== 'function') {
        throw new Error('Bloco "' + blockId + '" não encontrado na tela ' + ${jsLiteral(targetScreenId)});
      }
      return await fn();
    }
  };
}

export const ${runnerFactoryName} = createScreenRunner;
`;
}

/**
 * Retorna um mapa contendo o arquivo de código de cada tela do projeto:
 * { [screenId]: screenCode }
 */
export function generateAllScreensCode(graph: Graph): Record<string, string> {
  const screens = graph.nodes.filter((n) => n.data.kind === 'screen');
  const result: Record<string, string> = {};
  for (const s of screens) {
    result[s.id] = generateScreenCode(graph, s.id);
  }
  return result;
}
