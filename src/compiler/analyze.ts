import { catalog, interfaceKinds } from '../engine/catalog';
import { validateBlockContract } from '../engine/blockRegistry';
import { httpConfigurationIssues } from '../engine/http';
import { databaseConfigurationIssues } from '../engine/database';
import { authConfigurationIssues } from '../engine/auth';
import { buildCompositionManifest, detectSubflowCycles } from '../engine/composition';
import {
  formatValueType,
  getBlockPortDefinitions,
  getPortDefinition,
  isTypeCompatible,
} from '../engine/ports';
import { screenRoutes } from '../engine/routes';
import type { Block, Graph } from '../engine/types';
import type { Diagnostic } from './diagnostics';

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Realiza análise semântica estrita de nós, configurações, rotas, tipos, conexões e cardinalidade */
export function analyze(graph: Graph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const subflows = buildCompositionManifest(graph).subflows;
  for (const node of graph.nodes.filter((item) => item.data.kind === 'subflow')) {
    if (!subflows.some((item) => item.id === (node.data.config.subflowId || node.id)))
      diagnostics.push({
        code: 'MISSING_SUBFLOW',
        severity: 'error',
        nodeId: node.id,
        message: `Subfluxo "${node.data.label}" não possui uma definição válida.`,
      });
  }
  if (detectSubflowCycles(subflows).hasCycle)
    diagnostics.push({
      code: 'SUBFLOW_CYCLE',
      severity: 'error',
      message: 'Há um ciclo recursivo entre subfluxos.',
    });
  diagnostics.push(
    ...httpConfigurationIssues(graph).map((issue) => ({
      ...issue,
      code: 'INVALID_HTTP_CONFIGURATION',
      severity: 'error' as const,
    })),
    ...databaseConfigurationIssues(graph).map((issue) => ({
      ...issue,
      code: 'INVALID_DATABASE_CONFIGURATION',
      severity: 'error' as const,
    })),
    ...authConfigurationIssues(graph).map((issue) => ({
      ...issue,
      code: 'INVALID_AUTH_CONFIGURATION',
      severity: 'error' as const,
    })),
  );

  // 1. Verificação de IDs únicos
  const seenIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenIds.has(node.id.toLowerCase())) {
      diagnostics.push({
        code: 'DUPLICATE_NODE_ID',
        severity: 'error',
        message: `ID de bloco duplicado: "${node.id}".`,
        nodeId: node.id,
      });
    }
    seenIds.add(node.id.toLowerCase());
  }

  const isScreen = (id?: string) =>
    Boolean(id && graph.nodes.some((n) => n.id === id && n.data.kind === 'screen'));

  // 2. Validação individual dos blocos
  for (const node of graph.nodes) {
    const { kind, label, config } = node.data;

    if (kind === 'auth' && config.execution === 'real') {
      if (
        !graph.nodes.some(
          (item) => item.data.kind === 'postgresConnection' && item.id === config.authDatabaseId,
        )
      )
        diagnostics.push({
          code: 'MISSING_AUTH_DATABASE',
          severity: 'error',
          nodeId: node.id,
          message: `Autenticação "${label}": selecione uma conexão PostgreSQL para usuários e sessões.`,
        });
      if (config.provider && config.provider !== 'email')
        diagnostics.push({
          code: 'UNSUPPORTED_AUTH_PROVIDER',
          severity: 'error',
          nodeId: node.id,
          message: `Autenticação "${label}": este provedor real ainda não está disponível.`,
        });
      if (
        graph.nodes.some(
          (item) =>
            item.data.kind === 'auth' &&
            item.data.config.execution === 'real' &&
            item.data.config.authDatabaseId &&
            item.data.config.authDatabaseId !== config.authDatabaseId,
        )
      )
        diagnostics.push({
          code: 'AUTH_DATABASE_MISMATCH',
          severity: 'error',
          nodeId: node.id,
          message: `Autenticação "${label}": todos os blocos de autenticação real devem usar a mesma conexão PostgreSQL.`,
        });
    }

    if (!catalog[kind]) {
      diagnostics.push({
        code: 'UNKNOWN_BLOCK_KIND',
        severity: 'error',
        message: `Tipo de bloco desconhecido: "${kind}".`,
        nodeId: node.id,
      });
      continue;
    }

    for (const issue of validateBlockContract(node)) {
      diagnostics.push({
        ...issue,
        severity: issue.code === 'UNSUPPORTED_BLOCK_PROPERTY' ? 'warning' : 'error',
        nodeId: node.id,
      });
    }

    if (interfaceKinds.includes(kind) && !isScreen(config.screenId)) {
      diagnostics.push({
        code: 'MISSING_SCREEN_BINDING',
        severity: 'error',
        message: `Bloco "${label}" deve estar vinculado a uma tela válida.`,
        nodeId: node.id,
      });
    }

    if (kind === 'navigate' && !isScreen(config.target)) {
      diagnostics.push({
        code: 'MISSING_NAVIGATE_TARGET',
        severity: 'error',
        message: `Navegação "${label}" deve selecionar uma tela de destino existente.`,
        nodeId: node.id,
      });
    }

    if ((kind === 'api' || kind === 'database') && config.mock && !isJson(config.mock)) {
      diagnostics.push({
        code: 'INVALID_MOCK_JSON',
        severity: 'error',
        message: `Configuração mock de "${label}" possui JSON inválido.`,
        nodeId: node.id,
      });
    }

    if (
      kind === 'database' &&
      config.operation &&
      !['query', 'get', 'insert', 'update', 'delete'].includes(config.operation)
    ) {
      diagnostics.push({
        code: 'INVALID_DATABASE_OPERATION',
        severity: 'error',
        message: `Operação de banco de dados inválida em "${label}": "${config.operation}". Operações válidas: query, get, insert, update, delete.`,
        nodeId: node.id,
      });
    }

    if (kind === 'function' && config.code && config.code.trim() !== 'return value;') {
      diagnostics.push({
        code: 'LEGACY_JAVASCRIPT_FUNCTION',
        severity: 'warning',
        message: `Bloco "${label}" contém código JavaScript textual legado (unsafe/legacy).`,
        nodeId: node.id,
      });
      diagnostics.push({
        code: 'FUNCTION_TEXTUAL_JS_NOT_PORTABLE',
        severity: 'warning',
        message: `Bloco "${label}" contém código JavaScript textual legado incompatível com exportação multi-linguagem (Python).`,
        nodeId: node.id,
      });
    }

    if (kind === 'screen') {
      try {
        const routes = screenRoutes(node);
        for (const r of routes) {
          if (!isScreen(r.target)) {
            diagnostics.push({
              code: 'INVALID_SCREEN_ROUTE',
              severity: 'error',
              message: `Tela "${label}": destino de transição "${r.target}" não existe.`,
              nodeId: node.id,
            });
          }
        }
        const overlapping = routes.some((r, i) =>
          routes
            .slice(i + 1)
            .some(
              (t) =>
                t.trigger === r.trigger &&
                (t.when === r.when || t.when === 'always' || r.when === 'always'),
            ),
        );
        if (overlapping) {
          diagnostics.push({
            code: 'OVERLAPPING_SCREEN_ROUTES',
            severity: 'error',
            message: `Tela "${label}": transições com condições sobrepostas para o mesmo evento.`,
            nodeId: node.id,
          });
        }
      } catch {
        diagnostics.push({
          code: 'CORRUPTED_SCREEN_ROUTES',
          severity: 'error',
          message: `Tela "${label}": formato de rotas corrompido ou inválido.`,
          nodeId: node.id,
        });
      }
    }
  }

  // 3. Validação semântica de conexões
  const nodesById = new Map<string, Block>(graph.nodes.map((n) => [n.id, n]));

  // Contadores para cardinalidade
  const sourcePortCounts = new Map<string, number>();
  const targetPortCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);

    if (!sourceNode || !targetNode) {
      diagnostics.push({
        code: 'UNKNOWN_CONNECTION_NODE',
        severity: 'error',
        message: `Conexão "${edge.id}" referencia nós inexistentes (${edge.source} -> ${edge.target}).`,
        nodeId: !sourceNode ? edge.source : edge.target,
      });
      continue;
    }

    const sourceHandle = edge.sourceHandle || '';
    const targetHandle = edge.targetHandle || '';

    const sourcePort =
      getPortDefinition(sourceNode, sourceHandle, 'output') ||
      getPortDefinition(sourceNode, sourceHandle) ||
      (sourceNode.data.kind === 'screen' && sourceHandle === 'routes'
        ? {
            id: 'routes',
            name: 'routes',
            direction: 'output' as const,
            mode: 'control' as const,
            cardinality: 'many' as const,
          }
        : undefined);

    const targetPort =
      getPortDefinition(targetNode, targetHandle, 'input') ||
      getPortDefinition(targetNode, targetHandle);

    if (!sourcePort) {
      diagnostics.push({
        code: 'UNKNOWN_PORT',
        severity: 'error',
        message: `Porta de saída "${sourceHandle}" não existe no bloco "${sourceNode.data.label}".`,
        nodeId: sourceNode.id,
        portId: sourceHandle,
      });
      continue;
    }

    if (!targetPort) {
      diagnostics.push({
        code: 'UNKNOWN_PORT',
        severity: 'error',
        message: `Porta de entrada "${targetHandle}" não existe no bloco "${targetNode.data.label}".`,
        nodeId: targetNode.id,
        portId: targetHandle,
      });
      continue;
    }

    // Direção
    if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') {
      diagnostics.push({
        code: 'INVALID_PORT_DIRECTION',
        severity: 'error',
        message: `Direção inválida: saída requerida no bloco "${sourceNode.data.label}" e entrada no bloco "${targetNode.data.label}".`,
        nodeId: sourceNode.id,
        portId: sourcePort.id,
      });
    }

    // Modo
    const modeValid =
      sourcePort.mode === targetPort.mode ||
      (sourcePort.mode === 'error' &&
        (targetPort.mode === 'control' || targetPort.mode === 'error'));

    if (!modeValid) {
      diagnostics.push({
        code: 'INCOMPATIBLE_PORT_MODE',
        severity: 'error',
        message: `Modo incompatível: porta "${sourcePort.name}" (${sourcePort.mode}) do bloco "${sourceNode.data.label}" não pode conectar à porta "${targetPort.name}" (${targetPort.mode}) do bloco "${targetNode.data.label}".`,
        nodeId: sourceNode.id,
        portId: sourcePort.id,
      });
    }

    // Tipo de dados
    if (sourcePort.mode === 'data' && targetPort.mode === 'data') {
      if (!isTypeCompatible(sourcePort.valueType, targetPort.valueType)) {
        const sType = formatValueType(sourcePort.valueType);
        const tType = formatValueType(targetPort.valueType);
        diagnostics.push({
          code: 'TYPE_MISMATCH',
          severity: 'error',
          message: `Tipo incompatível: Bloco "${sourceNode.data.label}" (porta "${sourcePort.name}") do tipo ${sType} é incompatível com Bloco "${targetNode.data.label}" (porta "${targetPort.name}") do tipo ${tType}.`,
          nodeId: sourceNode.id,
          portId: sourcePort.id,
        });
      }
    }

    // Cardinalidade
    const srcKey = `${edge.source}:${sourceHandle}`;
    const tgtKey = `${edge.target}:${targetHandle}`;
    sourcePortCounts.set(srcKey, (sourcePortCounts.get(srcKey) || 0) + 1);
    targetPortCounts.set(tgtKey, (targetPortCounts.get(tgtKey) || 0) + 1);

    if (sourcePort.cardinality === 'one' && (sourcePortCounts.get(srcKey) || 0) > 1) {
      diagnostics.push({
        code: 'CARDINALITY_EXCEEDED',
        severity: 'error',
        message: `Limite de cardinalidade excedido: a saída "${sourcePort.name}" do bloco "${sourceNode.data.label}" aceita apenas 1 conexão.`,
        nodeId: sourceNode.id,
        portId: sourcePort.id,
      });
    }

    if (targetPort.cardinality === 'one' && (targetPortCounts.get(tgtKey) || 0) > 1) {
      diagnostics.push({
        code: 'CARDINALITY_EXCEEDED',
        severity: 'error',
        message: `Limite de cardinalidade excedido: a entrada "${targetPort.name}" do bloco "${targetNode.data.label}" aceita apenas 1 conexão de origem.`,
        nodeId: targetNode.id,
        portId: targetPort.id,
      });
    }
  }

  // 4. Alcançabilidade básica (warning para blocos desconectados)
  const connectedNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }
  for (const node of graph.nodes) {
    if (node.data.kind !== 'screen' && !connectedNodeIds.has(node.id)) {
      const ports = getBlockPortDefinitions(node);
      if (ports.length > 0) {
        diagnostics.push({
          code: 'UNCONNECTED_BLOCK',
          severity: 'warning',
          message: `Bloco "${node.data.label}" não possui nenhuma conexão ativa.`,
          nodeId: node.id,
        });
      }
    }
  }

  return diagnostics;
}
