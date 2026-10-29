import type { DataModelDesign } from './dataModeling';
import {
  applyDataModelToGraph,
  convertConceptualToLogical,
  ensureDataModelFromGraph,
} from './dataModeling';
import type { PolicyCondition } from './auth';
import type { TestScenario } from './testScenarios';
import type { Graph, Kind } from './types';

export const APP_MODELING_SCHEMA_VERSION = 1;
export const APP_MODELING_GENERATOR_VERSION = 'flowforge-app-modeling-1.0.0';

/** As 9 etapas guiadas da área de Modelagem de Apps (Seção 4 do plano) */
export type ModelingStepId =
  | 'vision'
  | 'domains'
  | 'data'
  | 'permissions'
  | 'rules'
  | 'lifecycle'
  | 'operations'
  | 'apis'
  | 'scenarios';

/** Dimensão 1: Estado de preenchimento da etapa */
export type StepFillStatus = 'not_started' | 'editing' | 'completed' | 'not_applicable';

/** Dimensão 2: Consistência com dependências e geração */
export type StepConsistencyStatus = 'pending' | 'up_to_date' | 'needs_review' | 'blocked';

export type ModelingStepMeta = {
  id: ModelingStepId;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  generatesBlocks: boolean;
  optional?: boolean;
};

export const MODELING_STEPS: ModelingStepMeta[] = [
  {
    id: 'vision',
    number: 1,
    title: '1. Visão e escopo',
    shortTitle: 'Visão e escopo',
    description:
      'Problema, público, objetivos, limites do MVP, requisitos e critérios de aceitação verificáveis.',
    generatesBlocks: false,
  },
  {
    id: 'domains',
    number: 2,
    title: '2. Domínios e casos de uso',
    shortTitle: 'Domínios e casos de uso',
    description: 'Glossário, módulos, atores, ações, entradas, resultados e exceções.',
    generatesBlocks: false,
  },
  {
    id: 'data',
    number: 3,
    title: '3. Dados',
    shortTitle: 'Dados',
    description:
      'Entidades, campos, tipos, relações, obrigatoriedade, unicidade, propriedade e isolamento por organização.',
    generatesBlocks: true,
  },
  {
    id: 'permissions',
    number: 4,
    title: '4. Identidade e permissões',
    shortTitle: 'Identidade e permissões',
    description:
      'Identidade, papéis, recursos, ações e escopo: próprio, equipe, organização ou global.',
    generatesBlocks: true,
  },
  {
    id: 'rules',
    number: 5,
    title: '5. Regras e decisões',
    shortTitle: 'Regras e decisões',
    description:
      'Entradas tipadas, condições, tabelas de decisão, resultado, prioridade, exceções e exemplos.',
    generatesBlocks: true,
  },
  {
    id: 'lifecycle',
    number: 6,
    title: '6. Estados e ciclo de vida',
    shortTitle: 'Estados e ciclo de vida',
    description: 'Estado inicial/finais, transições, ator, condições, concorrência e efeitos.',
    generatesBlocks: true,
    optional: true,
  },
  {
    id: 'operations',
    number: 7,
    title: '7. Operações e processos',
    shortTitle: 'Operações e processos',
    description:
      'Gatilhos, ordem das atividades, chamadas, responsáveis, transações, erros, prazos e esperas.',
    generatesBlocks: true,
  },
  {
    id: 'apis',
    number: 8,
    title: '8. APIs, eventos e integrações',
    shortTitle: 'APIs, eventos e integrações',
    description:
      'Rotas, métodos, schemas, autenticação, eventos, webhooks, timeout, repetição e idempotência.',
    generatesBlocks: true,
    optional: true,
  },
  {
    id: 'scenarios',
    number: 9,
    title: '9. Cenários e revisão',
    shortTitle: 'Cenários e revisão',
    description:
      'Exemplos positivos, negativos, acesso negado, estados inválidos e requisitos de qualidade.',
    generatesBlocks: true,
  },
];

// ============================================================================
// Etapa 1: Visão e Escopo
// ============================================================================

export type RequirementCriterion = {
  id: string;
  description: string;
  verifiable: boolean;
};

export type AppRequirement = {
  id: string;
  code: string; // Ex: REQ-01
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  acceptanceCriteria: RequirementCriterion[];
};

export type VisionScopeSpec = {
  problemStatement: string;
  targetAudience: string;
  objectives: string[];
  mvpBoundaries: string[];
  outOfScope: string[];
  requirements: AppRequirement[];
};

// ============================================================================
// Etapa 2: Domínios e Casos de Uso
// ============================================================================

export type GlossaryTerm = {
  id: string;
  term: string;
  definition: string;
  domainId?: string;
};

export type DomainModule = {
  id: string;
  name: string;
  description: string;
};

export type DomainActor = {
  id: string;
  name: string;
  roleKey: string; // Ex: 'seller', 'manager', 'admin', 'user'
  description: string;
};

export type UseCaseField = {
  name: string;
  type: 'string' | 'number' | 'decimal_cents' | 'boolean' | 'date' | 'object';
  required: boolean;
};

export type UseCaseSpec = {
  id: string;
  code: string; // Ex: UC-01
  name: string;
  domainId: string;
  actorId: string;
  requirementIds: string[];
  actionSummary: string;
  inputs: UseCaseField[];
  expectedResult: string;
  exceptions: string[];
};

// ============================================================================
// Etapa 3: Dados (Metadados de Governança + vínculo com graph.dataModel)
// ============================================================================

export type EntityGovernanceSpec = {
  entityId: string; // Referencia ConceptualEntity.id em graph.dataModel
  tableName: string;
  ownerField?: string; // Ex: 'vendedor_id' ou 'solicitante_id'
  organizationField?: string; // Ex: 'org_id'
  versionField?: string; // Ex: 'versao' para controle otimista de concorrência
  monetaryFieldsCents?: string[]; // Campos com representação exata em centavos / numeric estrito
  isolationScope: 'none' | 'owner' | 'organization';
};

// ============================================================================
// Etapa 4: Identidade e Permissões
// ============================================================================

export type PermissionScope = 'public' | 'own' | 'team' | 'organization' | 'global';

export type PermissionPolicySpec = {
  id: string;
  name: string;
  actorRoles: string[]; // Ex: ['vendedor', 'user'] ou ['manager', 'admin']
  resource: string; // Ex: 'pedidos'
  actions: Array<'create' | 'read' | 'update' | 'delete' | 'approve' | '*'>;
  scope: PermissionScope;
  ownerField?: string;
  organizationField?: string;
  forbidSelfApproval?: boolean; // Segregação de função: aprovador != solicitante
  errorMessage: string;
  requirementIds: string[];
};

// ============================================================================
// Etapa 5: Regras de Negócio e Tabelas de Decisão
// ============================================================================

export type RuleParameter = {
  name: string;
  type: 'string' | 'number' | 'decimal_cents' | 'boolean';
  required: boolean;
};

export type RuleComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

export type RuleConditionNode =
  | {
      kind: 'comparison';
      id: string;
      leftField: string;
      operator: RuleComparisonOperator;
      rightValue: string | number | boolean;
      useExactCents?: boolean;
    }
  | {
      kind: 'logical';
      id: string;
      logicalOp: 'and' | 'or';
      children: RuleConditionNode[];
    };

export type DecisionHitPolicy = 'unique' | 'first_match' | 'multiple';

export type DecisionRow = {
  id: string;
  label: string;
  condition: RuleConditionNode;
  outcome: string; // Ex: 'auto_approved' | 'requires_manager_approval' | 'rejected'
  errorMessage?: string;
  priority: number;
};

export type BusinessRuleExample = {
  id: string;
  description: string;
  inputs: Record<string, unknown>;
  expectedOutcome: string;
  expectedValid: boolean;
};

export type BusinessRuleSpec = {
  id: string;
  code: string; // Ex: RN-01
  name: string;
  domainId?: string;
  requirementIds: string[];
  explanation: string; // Texto livre explicativo (não código executável)
  parameters: RuleParameter[];
  hitPolicy: DecisionHitPolicy;
  requireDefaultCase: boolean;
  defaultOutcome?: string;
  defaultErrorMessage?: string;
  rows: DecisionRow[];
  examples: BusinessRuleExample[];
};

// ============================================================================
// Etapa 6: Estados e Ciclo de Vida
// ============================================================================

export type StateTransitionSpec = {
  id: string;
  name: string;
  fromState: string;
  toState: string;
  allowedActorRoles: string[];
  ruleIds: string[];
  requireVersionMatch: boolean;
  forbidSelfTransitionByCreator?: boolean;
  sideEffects: string[];
};

export type LifecycleSpec = {
  id: string;
  name: string;
  targetEntity: string;
  stateField: string; // Ex: 'status'
  versionField?: string; // Ex: 'versao'
  initialState: string; // Ex: 'rascunho'
  finalStates: string[]; // Ex: ['aprovado', 'rejeitado']
  states: string[]; // Ex: ['rascunho', 'em_analise', 'aprovado', 'rejeitado']
  transitions: StateTransitionSpec[];
};

// ============================================================================
// Etapa 7: Operações e Processos
// ============================================================================

export type OperationStepKind =
  | 'authenticate'
  | 'authorize'
  | 'validate_input'
  | 'check_state_transition'
  | 'evaluate_rule'
  | 'persist_entity'
  | 'call_external_api'
  | 'emit_notification'
  | 'return_result';

export type OperationActivity = {
  id: string;
  order: number;
  kind: OperationStepKind;
  label: string;
  refId?: string; // ID da política, regra, transição ou entidade associada
  errorCode?: string;
};

export type OperationSpec = {
  id: string;
  code: string; // Ex: OP-01
  name: string;
  useCaseId?: string;
  requirementIds: string[];
  triggerKind: 'screen_action' | 'api_endpoint' | 'webhook' | 'scheduled_task';
  triggerScreenId?: string;
  accessMode: 'public' | 'policy';
  policyId?: string;
  targetEntity: string;
  entityAction: 'create' | 'read' | 'update' | 'delete' | 'transition';
  ruleIds: string[];
  lifecycleId?: string;
  transitionId?: string;
  transactional: boolean;
  concurrencyControl: 'none' | 'optimistic_version' | 'conditional_state';
  inputs: UseCaseField[];
  outputSummary: string;
  errorCases: Array<{ code: string; status: number; message: string }>;
  activities: OperationActivity[];
};

// ============================================================================
// Etapa 8: APIs, Eventos e Integrações
// ============================================================================

export type ApiContractSpec = {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // Ex: '/api/operations/submeter-pedido'
  operationId: string; // Vinculado a OperationSpec.id
  authRequired: boolean;
  idempotencyKeyHeader?: string; // Ex: 'Idempotency-Key'
  timeoutMs: number;
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
  requestSchemaSummary: string;
  responseSchemaSummary: string;
};

// ============================================================================
// Etapa 9: Cenários de Aceitação e Revisão + Ferramentas Complementares (C4, UML, ADR, Qualidade)
// ============================================================================

export type ModelingScenarioCategory =
  | 'positive'
  | 'negative_rule'
  | 'access_denied'
  | 'cross_org_denied'
  | 'self_approval_denied'
  | 'invalid_state'
  | 'concurrency_conflict'
  | 'persistence_error';

export type AcceptanceScenarioSpec = {
  id: string;
  code: string; // Ex: CEN-01
  name: string;
  category: ModelingScenarioCategory;
  requirementIds: string[];
  operationId: string;
  ruleIds: string[];
  actorRole: string;
  actorOrgId: string;
  actorUserId: string;
  inputPayload: Record<string, unknown>;
  initialRecordState?: Record<string, unknown>;
  expectedAllowed: boolean;
  expectedOutcome?: string;
  expectedStatus: number;
  expectedErrorCode?: string;
};

export type ArchitecturalDecisionRecord = {
  id: string;
  code: string; // Ex: ADR-001
  title: string;
  status: 'proposed' | 'accepted' | 'superseded';
  context: string;
  decision: string;
  alternatives: string[];
  consequences: string;
  owner: string;
  supersededById?: string;
};

export type QualityTargetSpec = {
  id: string;
  category: 'latency' | 'availability' | 'audit' | 'recovery' | 'retention';
  metricName: string;
  targetValue: string;
  verificationMethod: string;
  evidenceStatus: 'declared_only' | 'measured' | 'verified';
  measurementNotes?: string;
};

export type ExternalSystemSpec = {
  id: string;
  name: string;
  kind: 'api' | 'payment' | 'email' | 'storage' | 'webhook';
  description: string;
};

export type ScreenJourneyBinding = {
  id: string;
  useCaseId: string;
  screenId: string;
  actionLabel: string;
  operationId: string;
};

// ============================================================================
// Especificação Completa e Agregado Versionado (Seção 6.1)
// ============================================================================

export type AppSpecification = {
  vision: VisionScopeSpec;
  domains: DomainModule[];
  glossary: GlossaryTerm[];
  actors: DomainActor[];
  useCases: UseCaseSpec[];
  entityGovernance: EntityGovernanceSpec[];
  policies: PermissionPolicySpec[];
  rules: BusinessRuleSpec[];
  lifecycles: LifecycleSpec[];
  operations: OperationSpec[];
  apiContracts: ApiContractSpec[];
  scenarios: AcceptanceScenarioSpec[];
  adrs: ArchitecturalDecisionRecord[];
  qualityTargets: QualityTargetSpec[];
  externalSystems: ExternalSystemSpec[];
  journeys: ScreenJourneyBinding[];
};

export type ModelingStepRecord = {
  stepId: ModelingStepId;
  fillStatus: StepFillStatus;
  notApplicableReason?: string;
  lastSavedAt?: string;
  lastCompletedAt?: string;
  appliedRevision?: number;
};

export type GeneratedArtifactRecord = {
  artifactId: string; // ID do bloco ou aresta no grafo
  artifactKind: 'block' | 'edge' | 'test' | 'policy';
  sourceStep: ModelingStepId;
  sourceElementId: string; // ID do elemento no AppSpecification
  role: string;
  semanticHash: string;
  detached?: boolean; // Quando o usuário escolhe "Desvincular da geração"
  lastGeneratedConfig?: Record<string, string>;
};

export type GenerationConflict = {
  artifactId: string;
  sourceElementId: string;
  label: string;
  field: string;
  baseValue: string;
  currentManualValue: string;
  proposedModelValue: string;
};

export type GenerationManifest = {
  generatorVersion: string;
  appliedRevision: number;
  appliedAt?: string;
  specSemanticHash: string;
  artifacts: GeneratedArtifactRecord[];
};

export type AppModeling = {
  schemaVersion: number;
  draft: AppSpecification;
  applied: AppSpecification | null;
  steps: ModelingStepRecord[];
  generation: GenerationManifest;
};

// ============================================================================
// Hash Semântico Puro e Determinístico (Seção 6.2)
// ============================================================================

export function computeSemanticHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        if (
          k === 'x' ||
          k === 'y' ||
          k === 'position' ||
          k === 'lastSavedAt' ||
          k === 'appliedAt'
        ) {
          continue;
        }
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// Motor Determinístico de Avaliação de Regras e Decisões (Seção 4.1 e 8)
// ============================================================================

export function parseExactCents(val: unknown): number {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const str = String(val ?? '')
    .trim()
    .replace(/[R$\s]/g, '');
  if (!str) return 0;
  // Suporta formato brasileiro "5.000,50" ou internacional "5000.50"
  const normalized =
    str.includes(',') && str.includes('.')
      ? str.replace(/\./g, '').replace(',', '.')
      : str.includes(',')
        ? str.replace(',', '.')
        : str;
  const num = Number(normalized);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function evaluateConditionNode(
  node: RuleConditionNode,
  inputs: Record<string, unknown>,
): boolean {
  if (node.kind === 'logical') {
    if (node.children.length === 0) return true;
    if (node.logicalOp === 'and') {
      return node.children.every((c) => evaluateConditionNode(c, inputs));
    }
    return node.children.some((c) => evaluateConditionNode(c, inputs));
  }

  const rawLeft = inputs[node.leftField];
  const rawRight = node.rightValue;

  if (node.useExactCents) {
    const leftCents = parseExactCents(rawLeft);
    const rightCents = parseExactCents(rawRight);
    switch (node.operator) {
      case 'eq':
        return leftCents === rightCents;
      case 'neq':
        return leftCents !== rightCents;
      case 'gt':
        return leftCents > rightCents;
      case 'gte':
        return leftCents >= rightCents;
      case 'lt':
        return leftCents < rightCents;
      case 'lte':
        return leftCents <= rightCents;
      default:
        return false;
    }
  }

  switch (node.operator) {
    case 'eq':
      return String(rawLeft ?? '') === String(rawRight ?? '');
    case 'neq':
      return String(rawLeft ?? '') !== String(rawRight ?? '');
    case 'gt':
      return Number(rawLeft) > Number(rawRight);
    case 'gte':
      return Number(rawLeft) >= Number(rawRight);
    case 'lt':
      return Number(rawLeft) < Number(rawRight);
    case 'lte':
      return Number(rawLeft) <= Number(rawRight);
    case 'contains':
      return String(rawLeft ?? '').includes(String(rawRight ?? ''));
    case 'in': {
      const list = String(rawRight ?? '')
        .split(',')
        .map((s) => s.trim());
      return list.includes(String(rawLeft ?? ''));
    }
  }
}

export type RuleExecutionOutcome = {
  ruleId: string;
  matchedRowIds: string[];
  outcomes: string[];
  primaryOutcome: string;
  valid: boolean;
  errorMessage?: string;
  conflictDetected?: boolean;
};

export function evaluateBusinessRule(
  rule: BusinessRuleSpec,
  inputs: Record<string, unknown>,
): RuleExecutionOutcome {
  const sortedRows = [...rule.rows].sort((a, b) => a.priority - b.priority);
  const matched = sortedRows.filter((row) => evaluateConditionNode(row.condition, inputs));

  if (matched.length === 0) {
    if (rule.defaultOutcome) {
      const isRejected = rule.defaultOutcome === 'rejected' || rule.defaultOutcome === 'invalid';
      return {
        ruleId: rule.id,
        matchedRowIds: [],
        outcomes: [rule.defaultOutcome],
        primaryOutcome: rule.defaultOutcome,
        valid: !isRejected,
        errorMessage: isRejected ? rule.defaultErrorMessage || 'Regra não atendida.' : undefined,
      };
    }
    return {
      ruleId: rule.id,
      matchedRowIds: [],
      outcomes: [],
      primaryOutcome: 'unmatched',
      valid: !rule.requireDefaultCase,
      errorMessage: rule.requireDefaultCase
        ? rule.defaultErrorMessage || `Nenhuma condição atendida na regra "${rule.name}".`
        : undefined,
    };
  }

  if (rule.hitPolicy === 'unique' && matched.length > 1) {
    const distinctOutcomes = new Set(matched.map((m) => m.outcome));
    if (distinctOutcomes.size > 1) {
      return {
        ruleId: rule.id,
        matchedRowIds: matched.map((m) => m.id),
        outcomes: matched.map((m) => m.outcome),
        primaryOutcome: 'conflict',
        valid: false,
        conflictDetected: true,
        errorMessage: `Conflito de decisão na regra "${rule.name}": múltiplas linhas correspondem com resultados distintos.`,
      };
    }
  }

  const effective = rule.hitPolicy === 'multiple' ? matched : [matched[0]];
  const primary = effective[0];
  const isErrorOutcome = primary.outcome === 'rejected' || primary.outcome === 'invalid';

  return {
    ruleId: rule.id,
    matchedRowIds: effective.map((m) => m.id),
    outcomes: effective.map((m) => m.outcome),
    primaryOutcome: primary.outcome,
    valid: !isErrorOutcome,
    errorMessage: isErrorOutcome ? primary.errorMessage || 'Regra violada.' : undefined,
  };
}

// ============================================================================
// Execução Completa de Operação no Servidor / Simulação (Seções 4.2, 4.3 e 8)
// ============================================================================

export type OperationExecutionRequest = {
  operationId: string;
  actor: {
    userId: string;
    role: string;
    orgId?: string;
    authenticated: boolean;
  };
  payload: Record<string, unknown>;
  existingRecord?: Record<string, unknown> | null;
  idempotencyKey?: string;
};

export type OperationExecutionResponse = {
  ok: boolean;
  status: number;
  outcome?: string;
  record?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  trace: string[];
};

/**
 * Executa uma operação modelada aplicando rigorosamente a cadeia do servidor:
 * 1. Autenticar → 2. Verificar escopo e política (org/owner/segregação) →
 * 3. Validar dados e transição de estado/concorrência → 4. Avaliar regras →
 * 5. Retornar registro pronto para persistência atômica.
 */
export function executeModeledOperation(
  spec: AppSpecification,
  request: OperationExecutionRequest,
  idempotencyStore?: Map<string, OperationExecutionResponse>,
): OperationExecutionResponse {
  const trace: string[] = [];

  if (request.idempotencyKey && idempotencyStore?.has(request.idempotencyKey)) {
    const cached = idempotencyStore.get(request.idempotencyKey)!;
    return {
      ...cached,
      trace: [
        ...cached.trace,
        `Idempotência: resposta recuperada para chave ${request.idempotencyKey}`,
      ],
    };
  }

  const operation = spec.operations.find((op) => op.id === request.operationId);
  if (!operation) {
    return {
      ok: false,
      status: 404,
      error: { code: 'OPERATION_NOT_FOUND', message: 'Operação não encontrada na especificação.' },
      trace,
    };
  }

  trace.push(`Iniciando operação ${operation.code}: ${operation.name}`);

  // 1. Autenticação e Política (Ausência de política não libera acesso!)
  if (operation.accessMode !== 'public') {
    if (!request.actor.authenticated || !request.actor.userId) {
      return {
        ok: false,
        status: 401,
        error: { code: 'UNAUTHORIZED', message: 'Autenticação obrigatória para esta operação.' },
        trace,
      };
    }

    const policy = spec.policies.find((p) => p.id === operation.policyId);
    if (!policy) {
      return {
        ok: false,
        status: 403,
        error: {
          code: 'MISSING_POLICY',
          message: 'Operação protegida sem política de acesso vinculada (negação por padrão).',
        },
        trace,
      };
    }

    if (!policy.actorRoles.includes('*') && !policy.actorRoles.includes(request.actor.role)) {
      return {
        ok: false,
        status: 403,
        error: { code: 'FORBIDDEN_ROLE', message: policy.errorMessage },
        trace,
      };
    }

    // Isolamento por organização (Leitura, Escrita e Transição)
    if (policy.scope === 'organization') {
      const orgField = policy.organizationField || 'org_id';
      if (!request.actor.orgId) {
        return {
          ok: false,
          status: 403,
          error: { code: 'MISSING_ACTOR_ORG', message: 'Usuário sem organização atribuída.' },
          trace,
        };
      }
      if (request.existingRecord) {
        const recordOrg = String(request.existingRecord[orgField] ?? '');
        if (recordOrg && recordOrg !== request.actor.orgId) {
          return {
            ok: false,
            status: 403,
            error: {
              code: 'CROSS_ORG_FORBIDDEN',
              message: 'Acesso negado: registro pertence a outra organização.',
            },
            trace,
          };
        }
      }
    }

    // Escopo do próprio proprietário
    if (policy.scope === 'own' && request.existingRecord) {
      const ownerField = policy.ownerField || 'vendedor_id';
      const recordOwner = String(request.existingRecord[ownerField] ?? '');
      if (recordOwner && recordOwner !== request.actor.userId) {
        return {
          ok: false,
          status: 403,
          error: {
            code: 'NOT_OWNER',
            message: 'Acesso negado: você só pode acessar seus próprios registros.',
          },
          trace,
        };
      }
    }

    // Segregação de função: proibição de autoaprovação pelo próprio solicitante
    if (policy.forbidSelfApproval && request.existingRecord) {
      const ownerField = policy.ownerField || 'vendedor_id';
      const creatorId = String(
        request.existingRecord[ownerField] ?? request.existingRecord.solicitante_id ?? '',
      );
      if (creatorId && creatorId === request.actor.userId) {
        return {
          ok: false,
          status: 403,
          error: {
            code: 'SELF_APPROVAL_FORBIDDEN',
            message: 'Segregação de função: o solicitante não pode aprovar o próprio pedido.',
          },
          trace,
        };
      }
    }

    trace.push(`Política "${policy.name}" validada para papel "${request.actor.role}"`);
  }

  // 2. Validação de campos obrigatórios de entrada
  for (const field of operation.inputs) {
    const val = request.payload[field.name];
    if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
      return {
        ok: false,
        status: 400,
        error: {
          code: 'INVALID_INPUT',
          message: `Campo obrigatório ausente: "${field.name}".`,
        },
        trace,
      };
    }
    if (
      (field.type === 'number' || field.type === 'decimal_cents') &&
      val !== undefined &&
      val !== ''
    ) {
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        return {
          ok: false,
          status: 400,
          error: {
            code: 'INVALID_NUMBER',
            message: `Valor numérico inválido para "${field.name}".`,
          },
          trace,
        };
      }
    }
  }

  // 3. Verificação de Ciclo de Vida / Estado e Concorrência Otimista
  let nextState: string | undefined;
  let nextVersion: number | undefined;

  if (operation.lifecycleId && operation.transitionId) {
    const lifecycle = spec.lifecycles.find((lc) => lc.id === operation.lifecycleId);
    const transition = lifecycle?.transitions.find((tr) => tr.id === operation.transitionId);

    if (!lifecycle || !transition) {
      return {
        ok: false,
        status: 400,
        error: {
          code: 'INVALID_LIFECYCLE_CONFIG',
          message: 'Transição de ciclo de vida inválida.',
        },
        trace,
      };
    }

    if (!request.existingRecord) {
      return {
        ok: false,
        status: 404,
        error: { code: 'RECORD_NOT_FOUND', message: 'Registro não encontrado para transição.' },
        trace,
      };
    }

    const currentState = String(
      request.existingRecord[lifecycle.stateField] ?? lifecycle.initialState,
    );
    if (currentState !== transition.fromState) {
      return {
        ok: false,
        status: 409,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Transição inválida: estado atual é "${currentState}", esperado "${transition.fromState}".`,
        },
        trace,
      };
    }

    // Controle de concorrência por versão (impede duas aprovações concorrentes)
    if (transition.requireVersionMatch || operation.concurrencyControl === 'optimistic_version') {
      const versionField = lifecycle.versionField || 'versao';
      const currentVersion = Number(request.existingRecord[versionField] ?? 1);
      const expectedVersion = Number(request.payload[versionField] ?? currentVersion);
      if (request.payload[versionField] !== undefined && expectedVersion !== currentVersion) {
        return {
          ok: false,
          status: 409,
          error: {
            code: 'CONCURRENCY_CONFLICT',
            message: `Conflito de concorrência: versão esperada ${expectedVersion}, mas o registro já está na versão ${currentVersion}.`,
          },
          trace,
        };
      }
      nextVersion = currentVersion + 1;
    }

    if (
      transition.forbidSelfTransitionByCreator &&
      String(request.existingRecord.vendedor_id ?? '') === request.actor.userId
    ) {
      return {
        ok: false,
        status: 403,
        error: {
          code: 'SELF_APPROVAL_FORBIDDEN',
          message: 'Segregação de função: o criador não pode executar esta transição.',
        },
        trace,
      };
    }

    nextState = transition.toState;
    trace.push(`Transição de estado validada: ${transition.fromState} → ${transition.toState}`);
  }

  // 4. Avaliação de Regras de Negócio
  let primaryOutcome = 'success';
  const combinedInputs: Record<string, unknown> = {
    ...(request.existingRecord || {}),
    ...request.payload,
  };

  for (const ruleId of operation.ruleIds) {
    const rule = spec.rules.find((r) => r.id === ruleId);
    if (!rule) continue;
    const evaluation = evaluateBusinessRule(rule, combinedInputs);
    trace.push(`Regra "${rule.name}" avaliada → resultado: ${evaluation.primaryOutcome}`);

    if (!evaluation.valid) {
      return {
        ok: false,
        status: 422,
        outcome: evaluation.primaryOutcome,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: evaluation.errorMessage || `Violação da regra "${rule.name}".`,
        },
        trace,
      };
    }
    primaryOutcome = evaluation.primaryOutcome;
  }

  // Se uma regra definiu o estado destino (ex: auto_approved vs requires_manager_approval)
  if (!nextState && operation.lifecycleId) {
    const lifecycle = spec.lifecycles.find((lc) => lc.id === operation.lifecycleId);
    if (lifecycle) {
      if (primaryOutcome === 'auto_approved') {
        nextState = 'aprovado';
      } else if (primaryOutcome === 'requires_manager_approval') {
        nextState = 'em_analise';
      } else if (!request.existingRecord) {
        nextState = lifecycle.initialState;
      }
    }
  }

  // 5. Construção atômica do registro resultante
  const persistedRecord: Record<string, unknown> = {
    ...(request.existingRecord || {}),
    ...request.payload,
    org_id: request.existingRecord?.org_id ?? request.actor.orgId ?? 'org_default',
    ...(nextState ? { status: nextState } : {}),
    ...(nextVersion !== undefined ? { versao: nextVersion } : {}),
  };

  const response: OperationExecutionResponse = {
    ok: true,
    status: operation.entityAction === 'create' ? 201 : 200,
    outcome: primaryOutcome,
    record: persistedRecord,
    trace,
  };

  if (request.idempotencyKey && idempotencyStore) {
    idempotencyStore.set(request.idempotencyKey, response);
  }

  return response;
}

// ============================================================================
// Validador Estrutural, Semântico e de Estado das 9 Etapas (Seções 3.3 e 4)
// ============================================================================

export type ModelingValidationIssue = {
  id: string;
  stepId: ModelingStepId;
  severity: 'error' | 'warning';
  elementId?: string;
  message: string;
};

export type ComputedStepStatus = {
  stepId: ModelingStepId;
  meta: ModelingStepMeta;
  fillStatus: StepFillStatus;
  consistencyStatus: StepConsistencyStatus;
  pendingIssuesCount: number;
  issues: ModelingValidationIssue[];
  canComplete: boolean;
  statusLabel: string;
};

export function validateAppModeling(
  graph: Graph,
  modeling: AppModeling,
): {
  issues: ModelingValidationIssue[];
  stepStatuses: ComputedStepStatus[];
  completedValidCount: number;
  applicableStepsCount: number;
  isModelingReady: boolean;
} {
  const spec = modeling.draft;
  const applied = modeling.applied;
  const issues: ModelingValidationIssue[] = [];
  const dataModel = ensureDataModelFromGraph(graph);
  const logicalTables = convertConceptualToLogical(dataModel);

  // 1. Visão e Escopo
  if (!spec.vision.problemStatement.trim()) {
    issues.push({
      id: 'vis_problem',
      stepId: 'vision',
      severity: 'error',
      message: 'Descreva o problema central que o aplicativo resolve.',
    });
  }
  if (spec.vision.requirements.length === 0) {
    issues.push({
      id: 'vis_reqs',
      stepId: 'vision',
      severity: 'error',
      message: 'Cadastre pelo menos um requisito funcional com critério verificável.',
    });
  }
  for (const req of spec.vision.requirements) {
    if (req.acceptanceCriteria.length === 0) {
      issues.push({
        id: `vis_req_crit_${req.id}`,
        stepId: 'vision',
        severity: 'error',
        elementId: req.id,
        message: `O requisito "${req.code} - ${req.title}" precisa de ao menos 1 critério de aceitação verificável.`,
      });
    }
  }

  // 2. Domínios e Casos de Uso
  const reqIds = new Set(spec.vision.requirements.map((r) => r.id));
  if (spec.useCases.length === 0) {
    issues.push({
      id: 'dom_ucs',
      stepId: 'domains',
      severity: 'error',
      message: 'Cadastre pelo menos um caso de uso no catálogo.',
    });
  }
  for (const uc of spec.useCases) {
    if (uc.requirementIds.length === 0 || !uc.requirementIds.some((id) => reqIds.has(id))) {
      issues.push({
        id: `dom_uc_req_${uc.id}`,
        stepId: 'domains',
        severity: 'error',
        elementId: uc.id,
        message: `Caso de uso "${uc.code} - ${uc.name}" deve estar vinculado a um requisito válido.`,
      });
    }
  }

  // 3. Dados
  if (dataModel.entities.length === 0) {
    issues.push({
      id: 'data_entities',
      stepId: 'data',
      severity: 'error',
      message: 'O modelo de dados deve conter pelo menos uma entidade.',
    });
  }
  const tableNames = new Set(logicalTables.map((t) => t.name));

  // 4. Identidade e Permissões
  if (spec.policies.length === 0) {
    issues.push({
      id: 'perm_empty',
      stepId: 'permissions',
      severity: 'error',
      message: 'Defina pelo menos uma política explícita de acesso e permissão.',
    });
  }
  const policyIds = new Set(spec.policies.map((p) => p.id));

  // 5. Regras e Decisões
  const ruleIds = new Set(spec.rules.map((r) => r.id));
  for (const rule of spec.rules) {
    if (rule.rows.length === 0) {
      issues.push({
        id: `rule_rows_${rule.id}`,
        stepId: 'rules',
        severity: 'error',
        elementId: rule.id,
        message: `A regra "${rule.code} - ${rule.name}" não possui condições/linhas de decisão.`,
      });
    }
    if (rule.requireDefaultCase && !rule.defaultOutcome) {
      issues.push({
        id: `rule_default_${rule.id}`,
        stepId: 'rules',
        severity: 'error',
        elementId: rule.id,
        message: `A regra "${rule.code} - ${rule.name}" exige caso padrão (defaultOutcome) declarado.`,
      });
    }
    // Verifica exemplos da própria regra contra o avaliador
    for (const ex of rule.examples) {
      const res = evaluateBusinessRule(rule, ex.inputs);
      if (res.primaryOutcome !== ex.expectedOutcome) {
        issues.push({
          id: `rule_ex_${ex.id}`,
          stepId: 'rules',
          severity: 'error',
          elementId: rule.id,
          message: `Exemplo "${ex.description}" na regra "${rule.code}" produziu "${res.primaryOutcome}" (esperado: "${ex.expectedOutcome}").`,
        });
      }
    }
  }

  // 6. Estados e Ciclo de Vida
  const lifecycleIds = new Set(spec.lifecycles.map((l) => l.id));
  for (const lc of spec.lifecycles) {
    if (!tableNames.has(lc.targetEntity) && dataModel.entities.length > 0) {
      issues.push({
        id: `lc_entity_${lc.id}`,
        stepId: 'lifecycle',
        severity: 'error',
        elementId: lc.id,
        message: `Ciclo de vida "${lc.name}" referencia tabela inexistente "${lc.targetEntity}".`,
      });
    }
    const statesSet = new Set(lc.states);
    if (!statesSet.has(lc.initialState)) {
      issues.push({
        id: `lc_init_${lc.id}`,
        stepId: 'lifecycle',
        severity: 'error',
        elementId: lc.id,
        message: `Estado inicial "${lc.initialState}" não consta na lista de estados de "${lc.name}".`,
      });
    }
    for (const tr of lc.transitions) {
      if (!statesSet.has(tr.fromState) || !statesSet.has(tr.toState)) {
        issues.push({
          id: `lc_tr_${tr.id}`,
          stepId: 'lifecycle',
          severity: 'error',
          elementId: lc.id,
          message: `Transição "${tr.name}" referencia estados inexistentes (${tr.fromState} → ${tr.toState}).`,
        });
      }
    }
  }

  // 7. Operações e Processos
  if (spec.operations.length === 0) {
    issues.push({
      id: 'ops_empty',
      stepId: 'operations',
      severity: 'error',
      message: 'Defina pelo menos uma operação síncrona de negócio.',
    });
  }
  const operationIds = new Set(spec.operations.map((o) => o.id));
  for (const op of spec.operations) {
    if (op.accessMode === 'policy' && (!op.policyId || !policyIds.has(op.policyId))) {
      issues.push({
        id: `op_pol_${op.id}`,
        stepId: 'operations',
        severity: 'error',
        elementId: op.id,
        message: `Operação protegida "${op.code} - ${op.name}" exige vínculo com uma política válida.`,
      });
    }
    if (op.targetEntity && !tableNames.has(op.targetEntity) && dataModel.entities.length > 0) {
      issues.push({
        id: `op_ent_${op.id}`,
        stepId: 'operations',
        severity: 'error',
        elementId: op.id,
        message: `Operação "${op.code}" referencia entidade/tabela inexistente "${op.targetEntity}".`,
      });
    }
    for (const rId of op.ruleIds) {
      if (!ruleIds.has(rId)) {
        issues.push({
          id: `op_rule_${op.id}_${rId}`,
          stepId: 'operations',
          severity: 'error',
          elementId: op.id,
          message: `Operação "${op.code}" referencia regra inexistente "${rId}".`,
        });
      }
    }
    if (op.lifecycleId && !lifecycleIds.has(op.lifecycleId)) {
      issues.push({
        id: `op_lc_${op.id}`,
        stepId: 'operations',
        severity: 'error',
        elementId: op.id,
        message: `Operação "${op.code}" referencia ciclo de vida inexistente "${op.lifecycleId}".`,
      });
    }
  }

  // 8. APIs, Eventos e Integrações
  for (const api of spec.apiContracts) {
    if (!operationIds.has(api.operationId)) {
      issues.push({
        id: `api_op_${api.id}`,
        stepId: 'apis',
        severity: 'error',
        elementId: api.id,
        message: `Contrato de API "${api.method} ${api.path}" referencia operação inexistente "${api.operationId}".`,
      });
    }
    if (!api.path.startsWith('/')) {
      issues.push({
        id: `api_path_${api.id}`,
        stepId: 'apis',
        severity: 'error',
        elementId: api.id,
        message: `Rota "${api.path}" em "${api.name}" deve começar com "/".`,
      });
    }
  }

  // 9. Cenários e Revisão
  if (spec.scenarios.length === 0) {
    issues.push({
      id: 'scen_empty',
      stepId: 'scenarios',
      severity: 'error',
      message:
        'Cadastre cenários de aceitação (positivos, negativos, acesso negado) para validar o modelo.',
    });
  }
  for (const sc of spec.scenarios) {
    if (!operationIds.has(sc.operationId)) {
      issues.push({
        id: `scen_op_${sc.id}`,
        stepId: 'scenarios',
        severity: 'error',
        elementId: sc.id,
        message: `Cenário "${sc.code} - ${sc.name}" referencia operação inexistente "${sc.operationId}".`,
      });
    } else {
      // Verifica se o cenário passa contra a especificação atual!
      const simRes = executeModeledOperation(spec, {
        operationId: sc.operationId,
        actor: {
          userId: sc.actorUserId,
          role: sc.actorRole,
          orgId: sc.actorOrgId,
          authenticated: Boolean(sc.actorUserId),
        },
        payload: sc.inputPayload,
        existingRecord: sc.initialRecordState || null,
      });

      if (simRes.ok !== sc.expectedAllowed) {
        issues.push({
          id: `scen_exec_${sc.id}`,
          stepId: 'scenarios',
          severity: 'warning',
          elementId: sc.id,
          message: `Cenário "${sc.code} - ${sc.name}" divergiu após alteração nas regras/limites (esperado ok=${sc.expectedAllowed}, obtido ok=${simRes.ok}). Revise o cenário ou a regra.`,
        });
      } else if (sc.expectedOutcome && simRes.outcome !== sc.expectedOutcome) {
        issues.push({
          id: `scen_outcome_${sc.id}`,
          stepId: 'scenarios',
          severity: 'warning',
          elementId: sc.id,
          message: `Cenário "${sc.code} - ${sc.name}" divergiu no resultado após alteração nas regras/limites (esperado "${sc.expectedOutcome}", obtido "${simRes.outcome}"). Revise o cenário ou a regra.`,
        });
      } else if (
        !sc.expectedAllowed &&
        sc.expectedErrorCode &&
        simRes.error?.code !== sc.expectedErrorCode
      ) {
        issues.push({
          id: `scen_errcode_${sc.id}`,
          stepId: 'scenarios',
          severity: 'warning',
          elementId: sc.id,
          message: `Cenário "${sc.code} - ${sc.name}" divergiu no código de erro (esperado "${sc.expectedErrorCode}", obtido "${simRes.error?.code}").`,
        });
      }
    }
  }

  // Verifica requisitos sem cobertura por caso de uso ou cenário (Seção 5 - Rastreabilidade)
  for (const req of spec.vision.requirements) {
    const hasUseCase = spec.useCases.some((u) => u.requirementIds.includes(req.id));
    const hasScenario = spec.scenarios.some((s) => s.requirementIds.includes(req.id));
    if (!hasUseCase) {
      issues.push({
        id: `trace_req_uc_${req.id}`,
        stepId: 'domains',
        severity: 'warning',
        elementId: req.id,
        message: `Requisito "${req.code}" ainda não possui Caso de Uso vinculado.`,
      });
    }
    if (!hasScenario) {
      issues.push({
        id: `trace_req_sc_${req.id}`,
        stepId: 'scenarios',
        severity: 'warning',
        elementId: req.id,
        message: `Requisito "${req.code}" ainda não possui Cenário de Aceitação vinculado.`,
      });
    }
  }

  // Computa o estado de cada uma das 9 etapas
  const stepStatuses: ComputedStepStatus[] = MODELING_STEPS.map((meta) => {
    const rec = modeling.steps.find((s) => s.stepId === meta.id) || {
      stepId: meta.id,
      fillStatus: 'not_started' as StepFillStatus,
    };

    const stepIssues = issues.filter((i) => i.stepId === meta.id);
    const errors = stepIssues.filter((i) => i.severity === 'error');
    const warnings = stepIssues.filter((i) => i.severity === 'warning');

    // Verifica se uma etapa opcional marcada como not_applicable possui referências ativas (Seção 3.3)
    let referencedWhileNotApplicable = false;
    if (rec.fillStatus === 'not_applicable') {
      if (meta.id === 'lifecycle' && spec.operations.some((op) => Boolean(op.lifecycleId))) {
        referencedWhileNotApplicable = true;
      }
      if (meta.id === 'apis' && spec.apiContracts.length > 0) {
        referencedWhileNotApplicable = true;
      }
    }

    // Verifica se o rascunho divergiu da revisão aplicada para esta etapa
    const draftStepHash = getStepSemanticHash(spec, meta.id, dataModel);
    const appliedStepHash = applied ? getStepSemanticHash(applied, meta.id, dataModel) : null;
    const hasUnappliedChanges = appliedStepHash !== null && draftStepHash !== appliedStepHash;

    let consistencyStatus: StepConsistencyStatus = 'pending';
    if (referencedWhileNotApplicable || errors.length > 0) {
      consistencyStatus = rec.fillStatus === 'completed' ? 'needs_review' : 'blocked';
    } else if (warnings.length > 0 || hasUnappliedChanges) {
      consistencyStatus = rec.fillStatus === 'completed' ? 'needs_review' : 'pending';
    } else if (rec.fillStatus === 'completed' || rec.fillStatus === 'not_applicable') {
      consistencyStatus = 'up_to_date';
    }

    const canComplete = errors.length === 0 && !referencedWhileNotApplicable;

    let statusLabel = 'Não iniciada';
    if (rec.fillStatus === 'not_applicable') {
      statusLabel = referencedWhileNotApplicable
        ? 'Não se aplica — bloqueada por referência ativa'
        : 'Não se aplica';
    } else if (rec.fillStatus === 'completed') {
      if (consistencyStatus === 'needs_review') {
        statusLabel = '✓ Concluída — requer revisão';
      } else {
        statusLabel = '✓ Concluída — atualizada';
      }
    } else if (rec.fillStatus === 'editing') {
      statusLabel = errors.length > 0 ? 'Em edição — com pendências' : 'Em edição';
    }

    return {
      stepId: meta.id,
      meta,
      fillStatus: rec.fillStatus,
      consistencyStatus,
      pendingIssuesCount: stepIssues.length,
      issues: stepIssues,
      canComplete,
      statusLabel,
    };
  });

  const applicableSteps = stepStatuses.filter((s) => s.fillStatus !== 'not_applicable');
  const completedValidCount = applicableSteps.filter(
    (s) => s.fillStatus === 'completed' && s.consistencyStatus === 'up_to_date',
  ).length;

  return {
    issues,
    stepStatuses,
    completedValidCount,
    applicableStepsCount: applicableSteps.length,
    isModelingReady: applicableSteps.length > 0 && completedValidCount === applicableSteps.length,
  };
}

function getStepSemanticHash(
  spec: AppSpecification,
  stepId: ModelingStepId,
  dataModel: DataModelDesign,
): string {
  switch (stepId) {
    case 'vision':
      return computeSemanticHash(spec.vision);
    case 'domains':
      return computeSemanticHash({
        domains: spec.domains,
        glossary: spec.glossary,
        actors: spec.actors,
        useCases: spec.useCases,
      });
    case 'data':
      return computeSemanticHash({
        entities: dataModel.entities,
        relationships: dataModel.relationships,
        governance: spec.entityGovernance,
      });
    case 'permissions':
      return computeSemanticHash(spec.policies);
    case 'rules':
      return computeSemanticHash(spec.rules);
    case 'lifecycle':
      return computeSemanticHash(spec.lifecycles);
    case 'operations':
      return computeSemanticHash(spec.operations);
    case 'apis':
      return computeSemanticHash(spec.apiContracts);
    case 'scenarios':
      return computeSemanticHash(spec.scenarios);
  }
}

// ============================================================================
// Planejador e Reconciliador Incremental de Artefatos (Seções 6.2, 6.3 e 7)
// ============================================================================

export type ReconciliationSummary = {
  createdBlocks: string[];
  updatedBlocks: string[];
  preservedManualBlocks: string[];
  affectedReferences: string[];
  conflicts: GenerationConflict[];
};

export type ApplyModelingResult = {
  graph: Graph;
  summary: ReconciliationSummary;
};

/**
 * Aplica a especificação da modelagem ao grafo de forma determinística e incremental:
 * - Mantém IDs estáveis derivados da identidade do elemento (`mod_pol_*`, `mod_rule_*`, `mod_op_*`).
 * - Repetir a geração nunca duplica nós ou conexões.
 * - Preserva posição visual (`position`) e blocos desvinculados (`detached`).
 * - Detecta conflitos de 3 vias (base gerada vs grafo atual vs nova geração).
 */
export function applyAppModelingToGraph(
  graph: Graph,
  modeling: AppModeling,
  options?: {
    stepId?: ModelingStepId;
    forceOverwriteConflicts?: boolean;
  },
): ApplyModelingResult {
  const spec = modeling.draft;
  const prevManifest = modeling.generation;
  const prevArtifactsById = new Map(prevManifest.artifacts.map((a) => [a.artifactId, a]));

  const createdBlocks: string[] = [];
  const updatedBlocks: string[] = [];
  const preservedManualBlocks: string[] = [];
  const affectedReferences: string[] = [];
  const conflicts: GenerationConflict[] = [];
  const nextArtifacts: GeneratedArtifactRecord[] = [];

  // 1. Garante os 4 estágios/visões organizacionais de Fluxos (Seção 6.4)
  const requiredFlows = [
    { id: 'recursos_flow', name: 'Recursos e Dados', color: '#10b981' },
    { id: 'regras_flow', name: 'Regras e Políticas', color: '#8b5cf6' },
    { id: 'operacoes_flow', name: 'Operações de Servidor', color: '#f59e0b' },
    { id: 'processos_flow', name: 'Processos e APIs', color: '#3b82f6' },
  ];
  const existingFlows = [...(graph.flows || [])];
  for (const rf of requiredFlows) {
    if (!existingFlows.some((f) => f.id === rf.id)) {
      existingFlows.push(rf);
    }
  }

  // 2. Sincroniza Modelo de Dados (Etapa 3: disponibiliza recursos `entity` e `postgresConnection`, sem criar CRUD público automático)
  const dataModel = ensureDataModelFromGraph(graph);
  let nextGraph = applyDataModelToGraph({ ...graph, flows: existingFlows }, dataModel);

  const nodes = [...nextGraph.nodes];
  const edges = [...nextGraph.edges];

  // Helper de reconciliação de 3 vias para um bloco gerado
  const upsertGeneratedBlock = (
    artifactId: string,
    kind: Kind,
    label: string,
    config: Record<string, string>,
    defaultPos: { x: number; y: number },
    sourceStep: ModelingStepId,
    sourceElementId: string,
    role: string,
  ) => {
    const prevRecord = prevArtifactsById.get(artifactId);
    if (prevRecord?.detached) {
      preservedManualBlocks.push(artifactId);
      nextArtifacts.push(prevRecord);
      return;
    }

    const configWithOrigin: Record<string, string> = {
      ...config,
      modelingOriginStep: sourceStep,
      modelingOriginId: sourceElementId,
      modelingRole: role,
    };

    const semanticHash = computeSemanticHash({ kind, label, config: configWithOrigin });
    const existingIdx = nodes.findIndex((n) => n.id === artifactId);

    if (existingIdx === -1) {
      nodes.push({
        id: artifactId,
        type: 'block',
        position: defaultPos,
        data: {
          kind,
          label,
          config: configWithOrigin,
        },
      });
      createdBlocks.push(artifactId);
    } else {
      const existingNode = nodes[existingIdx];

      // Comparação de 3 vias (última base gerada vs grafo atual vs nova geração)
      if (prevRecord?.lastGeneratedConfig && !options?.forceOverwriteConflicts) {
        for (const [k, baseVal] of Object.entries(prevRecord.lastGeneratedConfig)) {
          if (k.startsWith('modeling') || k === 'flowId' || k === 'screenId') continue;
          const currentVal = existingNode.data.config[k] ?? '';
          const newVal = configWithOrigin[k] ?? '';
          if (currentVal !== baseVal && newVal !== currentVal && newVal !== baseVal) {
            conflicts.push({
              artifactId,
              sourceElementId,
              label,
              field: k,
              baseValue: baseVal,
              currentManualValue: currentVal,
              proposedModelValue: newVal,
            });
          }
        }
      }

      // Preserva posição manual e propriedades visuais do canvas (Regra 3 da Seção 7)
      const mergedConfig =
        conflicts.some((c) => c.artifactId === artifactId) && !options?.forceOverwriteConflicts
          ? existingNode.data.config
          : {
              ...existingNode.data.config,
              ...configWithOrigin,
            };

      if (prevRecord && prevRecord.semanticHash !== semanticHash) {
        updatedBlocks.push(artifactId);
      }

      nodes[existingIdx] = {
        ...existingNode,
        data: {
          ...existingNode.data,
          kind,
          label,
          config: mergedConfig,
        },
      };
    }

    nextArtifacts.push({
      artifactId,
      artifactKind: 'block',
      sourceStep,
      sourceElementId,
      role,
      semanticHash,
      detached: false,
      lastGeneratedConfig: configWithOrigin,
    });
  };

  const upsertGeneratedEdge = (
    edgeId: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
    sourceStep: ModelingStepId,
    sourceElementId: string,
  ) => {
    if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) {
      return;
    }
    const existing = edges.find(
      (e) =>
        e.id === edgeId ||
        (e.source === source &&
          e.target === target &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle),
    );
    if (!existing) {
      edges.push({
        id: edgeId,
        source,
        sourceHandle,
        target,
        targetHandle,
      });
    }
    nextArtifacts.push({
      artifactId: edgeId,
      artifactKind: 'edge',
      sourceStep,
      sourceElementId,
      role: 'wire',
      semanticHash: computeSemanticHash({ source, sourceHandle, target, targetHandle }),
    });
  };

  // 3. Etapa 4: Identidade e Permissões → gera blocos `policy`
  spec.policies.forEach((pol, idx) => {
    const blockId = `mod_pol_${pol.id}`;
    const conditions: PolicyCondition[] = [
      { field: 'user.authenticated', operator: 'authenticated' },
    ];
    if (pol.actorRoles.length > 0 && !pol.actorRoles.includes('*')) {
      conditions.push({
        field: 'user.role',
        operator: pol.actorRoles.length === 1 ? 'hasRole' : 'inList',
        value: pol.actorRoles.length === 1 ? pol.actorRoles[0] : pol.actorRoles,
      });
    }
    if (pol.scope === 'organization') {
      conditions.push({
        field: 'user.orgId',
        operator: 'sameOrg',
        value: pol.organizationField || 'org_id',
      });
    } else if (pol.scope === 'own') {
      conditions.push({
        field: 'user.id',
        operator: 'isOwner',
        value: pol.ownerField || 'vendedor_id',
      });
    }

    upsertGeneratedBlock(
      blockId,
      'policy',
      `Política — ${pol.name}`,
      {
        name: pol.name,
        target: `${pol.resource}.*`,
        action: pol.actions[0] === 'approve' ? 'update' : pol.actions[0] || '*',
        effect: 'allow',
        conditions: JSON.stringify(conditions),
        errorMessage: pol.errorMessage,
        flowId: 'regras_flow',
      },
      { x: 80, y: 120 + idx * 150 },
      'permissions',
      pol.id,
      'policy_guard',
    );
  });

  // 4. Etapa 5: Regras e Decisões → gera blocos de decisão reutilizáveis (`condition`)
  spec.rules.forEach((rule, idx) => {
    const blockId = `mod_rule_${rule.id}`;
    const primaryRow = rule.rows[0];
    let operator = 'lte';
    let compareVal = '5000';
    if (primaryRow?.condition.kind === 'comparison') {
      const opMap: Record<string, string> = {
        eq: 'equals',
        neq: 'not_equals',
        gt: 'gt',
        gte: 'gte',
        lt: 'lt',
        lte: 'lte',
        contains: 'contains',
      };
      operator = opMap[primaryRow.condition.operator] || 'lte';
      compareVal = String(primaryRow.condition.rightValue ?? '');
    }

    upsertGeneratedBlock(
      blockId,
      'condition',
      `Regra ${rule.code} — ${rule.name}`,
      {
        operator,
        compare: compareVal,
        flowId: 'regras_flow',
        logicTemplateId: 'cond_compare_branch',
      },
      { x: 420, y: 120 + idx * 160 },
      'rules',
      rule.id,
      'business_rule',
    );
  });

  // 5. Etapa 6: Ciclo de Vida → gera blocos de validação de estado (`validator`)
  spec.lifecycles.forEach((lc, idx) => {
    const blockId = `mod_lc_${lc.id}`;
    upsertGeneratedBlock(
      blockId,
      'validator',
      `Ciclo de Vida — ${lc.name}`,
      {
        rule: 'required',
        param: lc.states.join(','),
        flowId: 'regras_flow',
        logicTemplateId: 'val_required_field',
      },
      { x: 760, y: 120 + idx * 160 },
      'lifecycle',
      lc.id,
      'lifecycle_validator',
    );
  });

  // 6. Etapa 7: Operações e Processos → gera cadeia backend conectada (Auth → Validação/Regra → Persistência → Resultado)
  const connNode = nodes.find((n) => n.data.kind === 'postgresConnection');
  const firstScreen = nodes.find((n) => n.data.kind === 'screen');

  spec.operations.forEach((op, idx) => {
    const baseY = 120 + idx * 240;
    const screenId = op.triggerScreenId || firstScreen?.id || '';

    const authBlockId = `mod_op_auth_${op.id}`;
    const dbBlockId = `mod_op_db_${op.id}`;
    const okNotifyId = `mod_op_ok_${op.id}`;
    const errBlockId = `mod_op_err_${op.id}`;

    // Bloco Guard de Autorização da Operação
    upsertGeneratedBlock(
      authBlockId,
      'auth',
      `Autorizar — ${op.name}`,
      {
        ...(screenId ? { screenId } : {}),
        provider: 'email',
        mode: 'session',
        execution: 'demo',
        flowId: 'operacoes_flow',
        logicTemplateId: 'auth_email_password_login',
        onSuccessTargetId: dbBlockId,
      },
      { x: 100, y: baseY },
      'operations',
      op.id,
      'operation_auth_guard',
    );

    // Bloco de Persistência Atômica da Operação
    const dbOp =
      op.entityAction === 'create'
        ? 'insert'
        : op.entityAction === 'read'
          ? 'query'
          : op.entityAction === 'delete'
            ? 'delete'
            : 'update';

    upsertGeneratedBlock(
      dbBlockId,
      'database',
      `Persistir — ${op.name}`,
      {
        ...(screenId ? { screenId } : {}),
        mode: 'mock',
        operation: dbOp,
        table: op.targetEntity || 'pedidos',
        ...(connNode ? { connectionId: connNode.id } : {}),
        flowId: 'operacoes_flow',
        logicTemplateId: dbOp === 'insert' ? 'db_insert_record' : 'db_crud_table',
      },
      { x: 720, y: baseY },
      'operations',
      op.id,
      'operation_persistence',
    );

    if (connNode) {
      upsertGeneratedEdge(
        `mod_wire_conn_${op.id}`,
        connNode.id,
        'connection',
        dbBlockId,
        'connection',
        'operations',
        op.id,
      );
    }

    // Bloco de Sucesso / Retorno
    upsertGeneratedBlock(
      okNotifyId,
      'notify',
      `Resultado — ${op.name}`,
      {
        ...(screenId ? { screenId } : {}),
        type: 'success',
        message: op.outputSummary || `${op.name} concluída com sucesso.`,
        flowId: 'operacoes_flow',
        logicTemplateId: 'notify_toast',
      },
      { x: 1040, y: baseY },
      'operations',
      op.id,
      'operation_result',
    );

    // Bloco de Tratamento de Erro
    upsertGeneratedBlock(
      errBlockId,
      'error',
      `Erro — ${op.name}`,
      {
        ...(screenId ? { screenId } : {}),
        message: op.errorCases[0]?.message || `Falha ao executar ${op.name}.`,
        flowId: 'operacoes_flow',
      },
      { x: 1040, y: baseY + 100 },
      'operations',
      op.id,
      'operation_error',
    );

    // Conecta Regra se vinculada à operação
    const linkedRuleId = op.ruleIds[0];
    const ruleBlockId = linkedRuleId ? `mod_rule_${linkedRuleId}` : null;
    if (ruleBlockId && nodes.some((n) => n.id === ruleBlockId)) {
      upsertGeneratedEdge(
        `mod_wire_auth_rule_${op.id}`,
        authBlockId,
        'onSuccess',
        ruleBlockId,
        'execute',
        'operations',
        op.id,
      );
      upsertGeneratedEdge(
        `mod_wire_rule_db_${op.id}`,
        ruleBlockId,
        'true',
        dbBlockId,
        'execute',
        'operations',
        op.id,
      );
      upsertGeneratedEdge(
        `mod_wire_rule_err_${op.id}`,
        ruleBlockId,
        'false',
        errBlockId,
        'execute',
        'operations',
        op.id,
      );
      affectedReferences.push(ruleBlockId);
    } else {
      upsertGeneratedEdge(
        `mod_wire_auth_db_${op.id}`,
        authBlockId,
        'onSuccess',
        dbBlockId,
        'execute',
        'operations',
        op.id,
      );
    }

    upsertGeneratedEdge(
      `mod_wire_auth_err_${op.id}`,
      authBlockId,
      'onError',
      errBlockId,
      'execute',
      'operations',
      op.id,
    );
    upsertGeneratedEdge(
      `mod_wire_db_ok_${op.id}`,
      dbBlockId,
      'onSuccess',
      okNotifyId,
      'execute',
      'operations',
      op.id,
    );
    upsertGeneratedEdge(
      `mod_wire_db_err_${op.id}`,
      dbBlockId,
      'onError',
      errBlockId,
      'execute',
      'operations',
      op.id,
    );
  });

  // 7. Etapa 8: APIs e Integrações → gera bindings explícitos de contrato (`webhook` / `api`)
  spec.apiContracts.forEach((api, idx) => {
    const apiBlockId = `mod_api_${api.id}`;
    const targetOpAuthId = `mod_op_auth_${api.operationId}`;

    upsertGeneratedBlock(
      apiBlockId,
      'webhook',
      `Endpoint ${api.method} ${api.path}`,
      {
        path: api.path,
        eventType: api.method,
        secretEnv: 'FLOWFORGE_SECRET_WEBHOOK_SECRET',
        flowId: 'processos_flow',
      },
      { x: 100, y: 120 + idx * 180 },
      'apis',
      api.id,
      'api_endpoint_binding',
    );

    if (nodes.some((n) => n.id === targetOpAuthId)) {
      upsertGeneratedEdge(
        `mod_wire_api_op_${api.id}`,
        apiBlockId,
        'onEvent',
        targetOpAuthId,
        'trigger',
        'apis',
        api.id,
      );
    }
  });

  // 8. Etapa 9: Cenários de Aceitação → sincroniza com `graph.tests` sem perder testes manuais
  const existingTests = (nextGraph.tests || []).filter((t) => !t.id.startsWith('mod_test_'));
  const generatedTests: TestScenario[] = spec.scenarios.map((sc) => {
    const entryBlockId = nodes.some((n) => n.id === `mod_op_auth_${sc.operationId}`)
      ? `mod_op_auth_${sc.operationId}`
      : nodes[0]?.id || 'login';

    return {
      id: `mod_test_${sc.id}`,
      name: `${sc.code}: ${sc.name}`,
      description: `Categoria: ${sc.category} | Ator: ${sc.actorRole} (${sc.actorOrgId})`,
      entryBlockId,
      initialInputs: Object.fromEntries(
        Object.entries(sc.inputPayload).map(([k, v]) => [k, String(v ?? '')]),
      ),
      initialStore: sc.initialRecordState ? { [sc.operationId]: sc.initialRecordState } : {},
      assertions: [
        {
          id: `assert_${sc.id}`,
          kind: 'trace_contains',
          target: entryBlockId,
          expectedValue: entryBlockId,
          message: `Deve exercitar a operação vinculada ao cenário ${sc.code}`,
        },
      ],
    };
  });

  const nextRevision = (prevManifest.appliedRevision || 0) + 1;
  const appliedSpec: AppSpecification = JSON.parse(JSON.stringify(spec));

  const nextSteps: ModelingStepRecord[] = MODELING_STEPS.map((m) => {
    const existing = modeling.steps.find((s) => s.stepId === m.id);
    if (options?.stepId && options.stepId === m.id) {
      return {
        stepId: m.id,
        fillStatus: 'completed',
        lastSavedAt: new Date().toISOString(),
        lastCompletedAt: new Date().toISOString(),
        appliedRevision: nextRevision,
      };
    }
    return (
      existing || {
        stepId: m.id,
        fillStatus: 'completed',
        appliedRevision: nextRevision,
      }
    );
  });

  const nextModeling: AppModeling = {
    schemaVersion: APP_MODELING_SCHEMA_VERSION,
    draft: spec,
    applied: appliedSpec,
    steps: nextSteps,
    generation: {
      generatorVersion: APP_MODELING_GENERATOR_VERSION,
      appliedRevision: nextRevision,
      appliedAt: new Date().toISOString(),
      specSemanticHash: computeSemanticHash(appliedSpec),
      artifacts: nextArtifacts,
    },
  };

  nextGraph = {
    ...nextGraph,
    nodes,
    edges,
    tests: [...existingTests, ...generatedTests],
    appModeling: nextModeling,
  };

  return {
    graph: nextGraph,
    summary: {
      createdBlocks,
      updatedBlocks,
      preservedManualBlocks,
      affectedReferences: [...new Set(affectedReferences)],
      conflicts,
    },
  };
}

/**
 * Desvincula um bloco gerado da geração automática, passando-o ao controle manual (Seção 7, Regra 4).
 */
export function detachGeneratedArtifact(graph: Graph, artifactId: string): Graph {
  if (!graph.appModeling) return graph;
  const nextArtifacts = graph.appModeling.generation.artifacts.map((a) =>
    a.artifactId === artifactId ? { ...a, detached: true } : a,
  );
  const nextNodes = graph.nodes.map((n) =>
    n.id === artifactId
      ? {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              modelingDetached: 'true',
            },
          },
        }
      : n,
  );
  return {
    ...graph,
    nodes: nextNodes,
    appModeling: {
      ...graph.appModeling,
      generation: {
        ...graph.appModeling.generation,
        artifacts: nextArtifacts,
      },
    },
  };
}

/**
 * Análise de impacto antes de excluir um elemento modelado (Seção 7, Regra 6).
 */
export function analyzeElementDeletionImpact(
  spec: AppSpecification,
  elementType: 'requirement' | 'rule' | 'policy' | 'lifecycle' | 'operation',
  elementId: string,
): { canDeleteDirectly: boolean; dependents: Array<{ kind: string; id: string; name: string }> } {
  const dependents: Array<{ kind: string; id: string; name: string }> = [];

  if (elementType === 'requirement') {
    for (const uc of spec.useCases) {
      if (uc.requirementIds.includes(elementId)) {
        dependents.push({ kind: 'Caso de Uso', id: uc.id, name: `${uc.code} - ${uc.name}` });
      }
    }
    for (const r of spec.rules) {
      if (r.requirementIds.includes(elementId)) {
        dependents.push({ kind: 'Regra de Negócio', id: r.id, name: `${r.code} - ${r.name}` });
      }
    }
    for (const sc of spec.scenarios) {
      if (sc.requirementIds.includes(elementId)) {
        dependents.push({ kind: 'Cenário', id: sc.id, name: `${sc.code} - ${sc.name}` });
      }
    }
  } else if (elementType === 'policy') {
    for (const op of spec.operations) {
      if (op.policyId === elementId) {
        dependents.push({ kind: 'Operação', id: op.id, name: `${op.code} - ${op.name}` });
      }
    }
  } else if (elementType === 'rule') {
    for (const op of spec.operations) {
      if (op.ruleIds.includes(elementId)) {
        dependents.push({ kind: 'Operação', id: op.id, name: `${op.code} - ${op.name}` });
      }
    }
    for (const sc of spec.scenarios) {
      if (sc.ruleIds.includes(elementId)) {
        dependents.push({ kind: 'Cenário', id: sc.id, name: `${sc.code} - ${sc.name}` });
      }
    }
  } else if (elementType === 'lifecycle') {
    for (const op of spec.operations) {
      if (op.lifecycleId === elementId) {
        dependents.push({ kind: 'Operação', id: op.id, name: `${op.code} - ${op.name}` });
      }
    }
  } else if (elementType === 'operation') {
    for (const api of spec.apiContracts) {
      if (api.operationId === elementId) {
        dependents.push({ kind: 'Contrato API', id: api.id, name: `${api.method} ${api.path}` });
      }
    }
    for (const sc of spec.scenarios) {
      if (sc.operationId === elementId) {
        dependents.push({ kind: 'Cenário', id: sc.id, name: `${sc.code} - ${sc.name}` });
      }
    }
  }

  return {
    canDeleteDirectly: dependents.length === 0,
    dependents,
  };
}

// ============================================================================
// Rastreabilidade Bidirecional e Geradores de Diagramas (Seção 5)
// ============================================================================

export type TraceabilityRow = {
  requirement: AppRequirement;
  useCases: UseCaseSpec[];
  policies: PermissionPolicySpec[];
  rules: BusinessRuleSpec[];
  operations: OperationSpec[];
  generatedBlockIds: string[];
  scenarios: AcceptanceScenarioSpec[];
  isFullyCovered: boolean;
};

export function buildTraceabilityMatrix(
  spec: AppSpecification,
  manifest: GenerationManifest,
): TraceabilityRow[] {
  return spec.vision.requirements.map((req) => {
    const useCases = spec.useCases.filter((u) => u.requirementIds.includes(req.id));
    const policies = spec.policies.filter((p) => p.requirementIds.includes(req.id));
    const rules = spec.rules.filter((r) => r.requirementIds.includes(req.id));
    const operations = spec.operations.filter(
      (o) => o.requirementIds.includes(req.id) || useCases.some((u) => u.id === o.useCaseId),
    );
    const scenarios = spec.scenarios.filter((s) => s.requirementIds.includes(req.id));

    const sourceIds = new Set([
      ...policies.map((p) => p.id),
      ...rules.map((r) => r.id),
      ...operations.map((o) => o.id),
    ]);
    const generatedBlockIds = manifest.artifacts
      .filter((a) => a.artifactKind === 'block' && sourceIds.has(a.sourceElementId))
      .map((a) => a.artifactId);

    const isFullyCovered = useCases.length > 0 && operations.length > 0 && scenarios.length > 0;

    return {
      requirement: req,
      useCases,
      policies,
      rules,
      operations,
      generatedBlockIds,
      scenarios,
      isFullyCovered,
    };
  });
}

/**
 * Gera Markdown completo da especificação arquitetural do aplicativo (Seções 3.1 e 5).
 */
export function generateAppSpecificationMarkdown(graph: Graph): string {
  const modeling = ensureAppModeling(graph);
  const spec = modeling.applied || modeling.draft;
  const matrix = buildTraceabilityMatrix(spec, modeling.generation);

  const lines: string[] = [
    `# Especificação e Arquitetura — ${graph.name}`,
    '',
    `- **Versão do Schema de Modelagem:** ${modeling.schemaVersion}`,
    `- **Gerador:** ${modeling.generation.generatorVersion}`,
    `- **Revisão Aplicada:** #${modeling.generation.appliedRevision}`,
    `- **Hash Semântico:** \`${modeling.generation.specSemanticHash}\``,
    '',
    '## 1. Visão e Escopo',
    `**Problema:** ${spec.vision.problemStatement}`,
    `**Público-alvo:** ${spec.vision.targetAudience}`,
    '',
    '### Requisitos e Critérios de Aceitação',
    ...spec.vision.requirements.map(
      (r) =>
        `- **${r.code} (${r.priority.toUpperCase()}) — ${r.title}:** ${r.description}\n` +
        r.acceptanceCriteria.map((c) => `  - [x] ${c.description}`).join('\n'),
    ),
    '',
    '## 2. Casos de Uso',
    ...spec.useCases.map(
      (uc) =>
        `- **${uc.code} — ${uc.name}** (Ator: \`${uc.actorId}\` | Requisitos: ${uc.requirementIds.join(', ')})\n  - Ação: ${uc.actionSummary}\n  - Resultado esperado: ${uc.expectedResult}`,
    ),
    '',
    '## 3. Políticas de Identidade e Permissão',
    ...spec.policies.map(
      (p) =>
        `- **${p.name}**: Papéis \`[${p.actorRoles.join(', ')}]\` → Recurso \`${p.resource}\` (\`${p.actions.join(', ')}\`) | Escopo: **${p.scope}**${p.forbidSelfApproval ? ' | **Proíbe Autoaprovação**' : ''}`,
    ),
    '',
    '## 4. Regras de Negócio e Tabelas de Decisão',
    ...spec.rules.map(
      (r) =>
        `- **${r.code} — ${r.name}** (Estratégia: \`${r.hitPolicy}\`)\n  - ${r.explanation}\n` +
        r.rows
          .map((row) => `  - Linha ${row.priority}: ${row.label} ➔ \`${row.outcome}\``)
          .join('\n'),
    ),
    '',
    '## 5. Estados e Ciclo de Vida',
    ...spec.lifecycles.map(
      (lc) =>
        `- **${lc.name}** (Entidade: \`${lc.targetEntity}\`, Campo: \`${lc.stateField}\`)\n  - Estados: ${lc.states.join(' → ')}\n` +
        lc.transitions
          .map((t) => `  - Transição **${t.name}**: \`${t.fromState}\` → \`${t.toState}\``)
          .join('\n'),
    ),
    '',
    '## 6. Operações de Servidor e Contratos de API',
    ...spec.operations.map(
      (op) =>
        `- **${op.code} — ${op.name}** (Entidade: \`${op.targetEntity}\`, Transacional: ${op.transactional ? 'Sim' : 'Não'}, Concorrência: \`${op.concurrencyControl}\`)`,
    ),
    ...spec.apiContracts.map(
      (api) =>
        `- **Endpoint \`${api.method} ${api.path}\`** → Operação \`${api.operationId}\` (Auth: ${api.authRequired ? 'Obrigatória' : 'Pública'}, Idempotência: \`${api.idempotencyKeyHeader || 'N/A'}\`)`,
    ),
    '',
    '## 7. Matriz de Rastreabilidade (Requisito → Caso de Uso → Regra/Política → Operação → Blocos → Teste)',
    '| Requisito | Casos de Uso | Regras / Políticas | Operações | Blocos Gerados | Cenários | Status |',
    '|---|---|---|---|---|---|---|',
    ...matrix.map(
      (row) =>
        `| ${row.requirement.code} | ${row.useCases.map((u) => u.code).join(', ') || '-'} | ${[...row.rules.map((r) => r.code), ...row.policies.map((p) => p.name)].join(', ') || '-'} | ${row.operations.map((o) => o.code).join(', ') || '-'} | ${row.generatedBlockIds.length} blocos | ${row.scenarios.map((s) => s.code).join(', ') || '-'} | ${row.isFullyCovered ? 'Completo' : 'Pendente'} |`,
    ),
    '',
    '## 8. Registro de Decisões Arquiteturais (ADRs)',
    ...spec.adrs.map(
      (adr) =>
        `### ${adr.code}: ${adr.title} (${adr.status.toUpperCase()})\n- **Contexto:** ${adr.context}\n- **Decisão:** ${adr.decision}\n- **Consequências:** ${adr.consequences}`,
    ),
  ];

  return lines.join('\n') + '\n';
}

// ============================================================================
// Cenário de Referência Obrigatório (Seção 11: Aprovação de Pedidos por Organização)
// ============================================================================

export function createOrderApprovalReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Controlar solicitações e aprovações de pedidos comerciais por organização, garantindo isolamento multi-tenant, precisão financeira em centavos e alçada gerencial para pedidos acima de R$ 5.000,00.',
      targetAudience:
        'Vendedores corporativos e Gerentes comerciais agrupados por Organização (Tenant).',
      objectives: [
        'Permitir que vendedores submetam pedidos vinculados à sua própria organização.',
        'Aprovar automaticamente pedidos de até R$ 5.000,00 e exigir aprovação gerencial acima desse limite.',
        'Impedir acesso entre organizações distintas e proibir autoaprovação pelo próprio solicitante.',
      ],
      mvpBoundaries: [
        'Submissão e aprovação síncronas com controle de versão contra aprovações concorrentes.',
        'Persistência transacional em PostgreSQL ou SQLite.',
      ],
      outOfScope: ['Faturamento fiscal externo ERP nesta primeira fase.'],
      requirements: [
        {
          id: 'req_submissao_aprovacao',
          code: 'REQ-01',
          title: 'Submissão pelo vendedor e decisão por gerente da mesma organização',
          description:
            'O vendedor solicita aprovação de pedido e o gerente da mesma organização aprova ou rejeita conforme limite de alçada.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_1',
              description:
                'Pedidos até R$ 5.000,00 são aprovados no fluxo normal; acima de R$ 5.000,00 ficam Em análise para o gerente.',
              verifiable: true,
            },
            {
              id: 'crit_2',
              description:
                'Gerente de outra organização ou o próprio vendedor solicitante recebem HTTP 403 Forbidden ao tentar aprovar.',
              verifiable: true,
            },
          ],
        },
        {
          id: 'req_integridade_concorrencia',
          code: 'REQ-02',
          title: 'Exatidão financeira e proteção contra aprovação concorrente',
          description:
            'Valores monetários avaliados em centavos exatos e transição protegida por versão.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_3',
              description:
                'Duas tentativas concorrentes de aprovação para a mesma versão falham com HTTP 409 Conflict.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_comercial',
        name: 'Pedidos e Alçadas Comerciais',
        description: 'Gestão de pedidos de venda, cálculo de alçada e workflow de aprovação.',
      },
    ],
    glossary: [
      {
        id: 'gl_alcada',
        term: 'Limite de Alçada',
        definition: 'Valor teto (R$ 5.000,00) até o qual o pedido segue aprovação automática.',
        domainId: 'dom_comercial',
      },
      {
        id: 'gl_segregacao',
        term: 'Segregação de Função',
        definition: 'Impedimento de que o criador do pedido aprove sua própria solicitação.',
        domainId: 'dom_comercial',
      },
    ],
    actors: [
      {
        id: 'act_vendedor',
        name: 'Vendedor',
        roleKey: 'user',
        description: 'Cria pedidos e consulta os pedidos da sua organização.',
      },
      {
        id: 'act_gerente',
        name: 'Gerente Comercial',
        roleKey: 'manager',
        description: 'Decide sobre pedidos Em análise da sua própria organização.',
      },
    ],
    useCases: [
      {
        id: 'uc_submeter_pedido',
        code: 'UC-01',
        name: 'Submeter Pedido',
        domainId: 'dom_comercial',
        actorId: 'act_vendedor',
        requirementIds: ['req_submissao_aprovacao', 'req_integridade_concorrencia'],
        actionSummary: 'Vendedor envia pedido com itens e valor total para avaliação de alçada.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'cliente_id', type: 'string', required: true },
          { name: 'total', type: 'decimal_cents', required: true },
        ],
        expectedResult:
          'Pedido gravado como Aprovado (se <= R$ 5.000) ou Em análise (se > R$ 5.000).',
        exceptions: ['Valor negativo ou ausente', 'Usuário não autenticado'],
      },
      {
        id: 'uc_aprovar_pedido',
        code: 'UC-02',
        name: 'Aprovar Pedido Gerencial',
        domainId: 'dom_comercial',
        actorId: 'act_gerente',
        requirementIds: ['req_submissao_aprovacao', 'req_integridade_concorrencia'],
        actionSummary:
          'Gerente da mesma organização aprova pedido que está Em análise, desde que não seja o próprio solicitante.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'decisao', type: 'string', required: true },
          { name: 'versao', type: 'number', required: false },
        ],
        expectedResult: 'Estado do pedido atualizado atomicamente para Aprovado ou Rejeitado.',
        exceptions: [
          'Acesso de outra organização (403)',
          'Autoaprovação pelo solicitante (403)',
          'Aprovação concorrente / versão desatualizada (409)',
        ],
      },
    ],
    entityGovernance: [
      {
        entityId: 'ent_pedidos',
        tableName: 'pedidos',
        ownerField: 'vendedor_id',
        organizationField: 'org_id',
        versionField: 'versao',
        monetaryFieldsCents: ['total'],
        isolationScope: 'organization',
      },
    ],
    policies: [
      {
        id: 'pol_vendedor_pedidos',
        name: 'Vendedor Submete e Consulta Pedidos da Organização',
        actorRoles: ['user', 'manager', 'admin'],
        resource: 'pedidos',
        actions: ['create', 'read'],
        scope: 'organization',
        ownerField: 'vendedor_id',
        organizationField: 'org_id',
        forbidSelfApproval: false,
        errorMessage:
          'Apenas membros autenticados da organização podem criar ou consultar pedidos.',
        requirementIds: ['req_submissao_aprovacao'],
      },
      {
        id: 'pol_gerente_aprovacao',
        name: 'Gerente Aprova Pedidos da Mesma Organização (Sem Autoaprovação)',
        actorRoles: ['manager', 'admin'],
        resource: 'pedidos',
        actions: ['approve', 'update'],
        scope: 'organization',
        ownerField: 'vendedor_id',
        organizationField: 'org_id',
        forbidSelfApproval: true,
        errorMessage:
          'Apenas gerentes da mesma organização (e distintos do solicitante) podem aprovar pedidos.',
        requirementIds: ['req_submissao_aprovacao'],
      },
    ],
    rules: [
      {
        id: 'rule_alcada_valor',
        code: 'RN-01',
        name: 'Alçada de Aprovação de Pedido por Valor',
        domainId: 'dom_comercial',
        requirementIds: ['req_submissao_aprovacao', 'req_integridade_concorrencia'],
        explanation:
          'Pedidos de até R$ 5.000,00 seguem aprovação normal automática; pedidos acima de R$ 5.000,00 exigem aprovação gerencial.',
        parameters: [{ name: 'total', type: 'decimal_cents', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'requires_manager_approval',
        rows: [
          {
            id: 'row_ate_limite',
            label: 'Pedido até R$ 5.000,00 (caminho normal)',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_ate_5000',
              leftField: 'total',
              operator: 'lte',
              rightValue: 5000,
              useExactCents: true,
            },
            outcome: 'auto_approved',
          },
          {
            id: 'row_acima_limite',
            label: 'Pedido acima de R$ 5.000,00 (exige gerente)',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_acima_5000',
              leftField: 'total',
              operator: 'gt',
              rightValue: 5000,
              useExactCents: true,
            },
            outcome: 'requires_manager_approval',
          },
        ],
        examples: [
          {
            id: 'ex_normal',
            description: 'Pedido de R$ 5.000,00 exatos segue caminho normal',
            inputs: { total: 5000 },
            expectedOutcome: 'auto_approved',
            expectedValid: true,
          },
          {
            id: 'ex_gerencial',
            description: 'Pedido de R$ 7.500,00 exige aprovação gerencial',
            inputs: { total: 7500 },
            expectedOutcome: 'requires_manager_approval',
            expectedValid: true,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_pedido_status',
        name: 'Ciclo de Vida do Pedido',
        targetEntity: 'pedidos',
        stateField: 'status',
        versionField: 'versao',
        initialState: 'rascunho',
        finalStates: ['aprovado', 'rejeitado'],
        states: ['rascunho', 'em_analise', 'aprovado', 'rejeitado'],
        transitions: [
          {
            id: 'tr_submeter',
            name: 'Submeter Pedido para Análise',
            fromState: 'rascunho',
            toState: 'em_analise',
            allowedActorRoles: ['user', 'manager'],
            ruleIds: ['rule_alcada_valor'],
            requireVersionMatch: false,
            sideEffects: ['Registrar data de submissão'],
          },
          {
            id: 'tr_aprovar',
            name: 'Aprovar Pedido em Análise',
            fromState: 'em_analise',
            toState: 'aprovado',
            allowedActorRoles: ['manager', 'admin'],
            ruleIds: [],
            requireVersionMatch: true,
            forbidSelfTransitionByCreator: true,
            sideEffects: ['Atualizar versão e registrar aprovador'],
          },
          {
            id: 'tr_rejeitar',
            name: 'Rejeitar Pedido em Análise',
            fromState: 'em_analise',
            toState: 'rejeitado',
            allowedActorRoles: ['manager', 'admin'],
            ruleIds: [],
            requireVersionMatch: true,
            forbidSelfTransitionByCreator: true,
            sideEffects: ['Notificar solicitante da rejeição'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_submeter_pedido',
        code: 'OP-01',
        name: 'Submeter Pedido',
        useCaseId: 'uc_submeter_pedido',
        requirementIds: ['req_submissao_aprovacao'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_vendedor_pedidos',
        targetEntity: 'pedidos',
        entityAction: 'create',
        ruleIds: ['rule_alcada_valor'],
        lifecycleId: 'lc_pedido_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'cliente_id', type: 'string', required: true },
          { name: 'total', type: 'decimal_cents', required: true },
        ],
        outputSummary: 'Pedido submetido e classificado conforme regra de alçada.',
        errorCases: [
          { code: 'UNAUTHORIZED', status: 401, message: 'Sessão inválida.' },
          { code: 'INVALID_INPUT', status: 400, message: 'Dados do pedido inválidos.' },
        ],
        activities: [
          { id: 'act_1', order: 1, kind: 'authenticate', label: 'Autenticar sessão do vendedor' },
          {
            id: 'act_2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar política de organização',
            refId: 'pol_vendedor_pedidos',
          },
          {
            id: 'act_3',
            order: 3,
            kind: 'validate_input',
            label: 'Validar valor em centavos e campos',
          },
          {
            id: 'act_4',
            order: 4,
            kind: 'evaluate_rule',
            label: 'Avaliar regra de alçada (R$ 5.000)',
            refId: 'rule_alcada_valor',
          },
          {
            id: 'act_5',
            order: 5,
            kind: 'persist_entity',
            label: 'Persistir pedido atomicamente',
            refId: 'pedidos',
          },
          {
            id: 'act_6',
            order: 6,
            kind: 'return_result',
            label: 'Retornar pedido e estado inicial',
          },
        ],
      },
      {
        id: 'op_aprovar_pedido',
        code: 'OP-02',
        name: 'Aprovar Pedido',
        useCaseId: 'uc_aprovar_pedido',
        requirementIds: ['req_submissao_aprovacao', 'req_integridade_concorrencia'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_gerente_aprovacao',
        targetEntity: 'pedidos',
        entityAction: 'transition',
        ruleIds: [],
        lifecycleId: 'lc_pedido_status',
        transitionId: 'tr_aprovar',
        transactional: true,
        concurrencyControl: 'optimistic_version',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'versao', type: 'number', required: false },
        ],
        outputSummary: 'Pedido aprovado com verificação de organização, segregação e versão.',
        errorCases: [
          { code: 'CROSS_ORG_FORBIDDEN', status: 403, message: 'Organização divergente.' },
          { code: 'SELF_APPROVAL_FORBIDDEN', status: 403, message: 'Autoaprovação proibida.' },
          {
            code: 'CONCURRENCY_CONFLICT',
            status: 409,
            message: 'Conflito de aprovação concorrente.',
          },
        ],
        activities: [
          { id: 'ap_1', order: 1, kind: 'authenticate', label: 'Autenticar sessão do gerente' },
          {
            id: 'ap_2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar organização e segregação',
            refId: 'pol_gerente_aprovacao',
          },
          {
            id: 'ap_3',
            order: 3,
            kind: 'check_state_transition',
            label: 'Verificar estado Em análise e versão',
            refId: 'tr_aprovar',
          },
          {
            id: 'ap_4',
            order: 4,
            kind: 'persist_entity',
            label: 'Atualizar estado atomicamente',
            refId: 'pedidos',
          },
          {
            id: 'ap_5',
            order: 5,
            kind: 'return_result',
            label: 'Retornar confirmação de aprovação',
          },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_submeter_pedido',
        name: 'Endpoint de Submissão de Pedido',
        method: 'POST',
        path: '/api/operations/submeter-pedido',
        operationId: 'op_submeter_pedido',
        authRequired: true,
        idempotencyKeyHeader: 'Idempotency-Key',
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 500 },
        requestSchemaSummary: '{ id: string, cliente_id: string, total: number }',
        responseSchemaSummary: '{ ok: boolean, outcome: string, record: Pedido }',
      },
      {
        id: 'api_aprovar_pedido',
        name: 'Endpoint de Aprovação Gerencial',
        method: 'POST',
        path: '/api/operations/aprovar-pedido',
        operationId: 'op_aprovar_pedido',
        authRequired: true,
        idempotencyKeyHeader: 'Idempotency-Key',
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 1, backoffMs: 0 },
        requestSchemaSummary: '{ id: string, versao: number }',
        responseSchemaSummary: '{ ok: boolean, record: Pedido }',
      },
    ],
    scenarios: [
      {
        id: 'scen_ate_5000',
        code: 'CEN-01',
        name: 'Submissão de pedido de R$ 4.800,00 (aprovação automática)',
        category: 'positive',
        requirementIds: ['req_submissao_aprovacao'],
        operationId: 'op_submeter_pedido',
        ruleIds: ['rule_alcada_valor'],
        actorRole: 'user',
        actorOrgId: 'org_alfa',
        actorUserId: 'usr_vendedor_1',
        inputPayload: { id: 'ped_101', cliente_id: 'cli_1', total: 4800 },
        expectedAllowed: true,
        expectedOutcome: 'auto_approved',
        expectedStatus: 201,
      },
      {
        id: 'scen_acima_5000',
        code: 'CEN-02',
        name: 'Submissão de pedido de R$ 7.500,00 (exige aprovação gerencial)',
        category: 'positive',
        requirementIds: ['req_submissao_aprovacao'],
        operationId: 'op_submeter_pedido',
        ruleIds: ['rule_alcada_valor'],
        actorRole: 'user',
        actorOrgId: 'org_alfa',
        actorUserId: 'usr_vendedor_1',
        inputPayload: { id: 'ped_102', cliente_id: 'cli_1', total: 7500 },
        expectedAllowed: true,
        expectedOutcome: 'requires_manager_approval',
        expectedStatus: 201,
      },
      {
        id: 'scen_outra_org',
        code: 'CEN-03',
        name: 'Gerente de outra organização tenta aprovar pedido (acesso negado)',
        category: 'cross_org_denied',
        requirementIds: ['req_submissao_aprovacao'],
        operationId: 'op_aprovar_pedido',
        ruleIds: [],
        actorRole: 'manager',
        actorOrgId: 'org_beta',
        actorUserId: 'usr_gerente_beta',
        inputPayload: { id: 'ped_102', versao: 1 },
        initialRecordState: {
          id: 'ped_102',
          vendedor_id: 'usr_vendedor_1',
          org_id: 'org_alfa',
          status: 'em_analise',
          total: 7500,
          versao: 1,
        },
        expectedAllowed: false,
        expectedStatus: 403,
        expectedErrorCode: 'CROSS_ORG_FORBIDDEN',
      },
      {
        id: 'scen_autoaprovacao',
        code: 'CEN-04',
        name: 'Próprio solicitante tenta aprovar seu pedido (segregação de função)',
        category: 'self_approval_denied',
        requirementIds: ['req_submissao_aprovacao'],
        operationId: 'op_aprovar_pedido',
        ruleIds: [],
        actorRole: 'manager',
        actorOrgId: 'org_alfa',
        actorUserId: 'usr_vendedor_1',
        inputPayload: { id: 'ped_102', versao: 1 },
        initialRecordState: {
          id: 'ped_102',
          vendedor_id: 'usr_vendedor_1',
          org_id: 'org_alfa',
          status: 'em_analise',
          total: 7500,
          versao: 1,
        },
        expectedAllowed: false,
        expectedStatus: 403,
        expectedErrorCode: 'SELF_APPROVAL_FORBIDDEN',
      },
      {
        id: 'scen_concorrencia',
        code: 'CEN-05',
        name: 'Tentativa de aprovação concorrente com versão desatualizada',
        category: 'concurrency_conflict',
        requirementIds: ['req_integridade_concorrencia'],
        operationId: 'op_aprovar_pedido',
        ruleIds: [],
        actorRole: 'manager',
        actorOrgId: 'org_alfa',
        actorUserId: 'usr_gerente_alfa',
        inputPayload: { id: 'ped_102', versao: 1 },
        initialRecordState: {
          id: 'ped_102',
          vendedor_id: 'usr_vendedor_1',
          org_id: 'org_alfa',
          status: 'em_analise',
          total: 7500,
          versao: 2,
        },
        expectedAllowed: false,
        expectedStatus: 409,
        expectedErrorCode: 'CONCURRENCY_CONFLICT',
      },
      {
        id: 'scen_entrada_invalida',
        code: 'CEN-06',
        name: 'Submissão com valor negativo ou entrada inválida',
        category: 'negative_rule',
        requirementIds: ['req_integridade_concorrencia'],
        operationId: 'op_submeter_pedido',
        ruleIds: ['rule_alcada_valor'],
        actorRole: 'user',
        actorOrgId: 'org_alfa',
        actorUserId: 'usr_vendedor_1',
        inputPayload: { id: 'ped_103', cliente_id: '', total: -100 },
        expectedAllowed: false,
        expectedStatus: 400,
        expectedErrorCode: 'INVALID_INPUT',
      },
    ],
    adrs: [
      {
        id: 'adr_moeda_centavos',
        code: 'ADR-001',
        title: 'Representação monetária exata em centavos inteiros',
        status: 'accepted',
        context:
          'Cálculos financeiros em ponto flutuante IEEE 754 podem causar erros de arredondamento em limites de alçada.',
        decision:
          'Converter e comparar valores monetários em centavos inteiros exatos no motor de regras e armazenar como NUMERIC no banco.',
        alternatives: ['Ponto flutuante genérico Number', 'Strings sem validação'],
        consequences: 'Comparações determinísticas entre simulação e backend exportado.',
        owner: 'Arquitetura FlowForge',
      },
      {
        id: 'adr_isolamento_org',
        code: 'ADR-002',
        title: 'Isolamento por Organização e Controle Otimista de Concorrência no Gateway',
        status: 'accepted',
        context:
          'Apenas esconder botões no frontend não impede chamadas diretas nem condições de corrida em aprovações.',
        decision:
          'Aplicar filtro de org_id e validação de versão diretamente na operação do servidor dentro de transação.',
        alternatives: ['Verificação apenas no cliente'],
        consequences: 'Segurança garantida mesmo em chamadas HTTP diretas à API.',
        owner: 'Segurança FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia',
        category: 'latency',
        metricName: 'Tempo de resposta p95 da operação de aprovação',
        targetValue: '<= 150ms',
        verificationMethod: 'Teste de carga local no endpoint /api/operations/aprovar-pedido',
        evidenceStatus: 'declared_only',
        measurementNotes: 'Meta cadastrada para validação em ambiente de staging.',
      },
      {
        id: 'qt_auditoria',
        category: 'audit',
        metricName: 'Rastreabilidade de transições de estado e autor',
        targetValue: '100% das aprovações com org_id e versão registrados',
        verificationMethod: 'Cenários automatizados CEN-01 a CEN-06',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [
      {
        id: 'ext_erp',
        name: 'Gateway de E-mail Corporativo',
        kind: 'email',
        description: 'Envio de avisos transacionais de aprovação ou rejeição.',
      },
    ],
    journeys: [
      {
        id: 'jrn_submeter',
        useCaseId: 'uc_submeter_pedido',
        screenId: 'screen_clientes',
        actionLabel: 'Submeter Pedido',
        operationId: 'op_submeter_pedido',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

function createCompletedModelingFromDraft(draft: AppSpecification): AppModeling {
  return {
    schemaVersion: APP_MODELING_SCHEMA_VERSION,
    draft,
    applied: JSON.parse(JSON.stringify(draft)),
    steps: MODELING_STEPS.map((m) => ({
      stepId: m.id,
      fillStatus: 'completed',
      lastSavedAt: '2026-10-29T00:00:00.000Z',
      lastCompletedAt: '2026-10-29T00:00:00.000Z',
      appliedRevision: 1,
    })),
    generation: {
      generatorVersion: APP_MODELING_GENERATOR_VERSION,
      appliedRevision: 1,
      appliedAt: '2026-10-29T00:00:00.000Z',
      specSemanticHash: computeSemanticHash(draft),
      artifacts: [],
    },
  };
}

/**
 * Modelagem de Referência para o App "Minhas Tarefas" (tasks)
 */
export function createTasksReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Gerenciar tarefas pessoais e de equipe com categorização por etiquetas, rastreamento de conclusão e isolamento estrito por usuário proprietário.',
      targetAudience: 'Profissionais e equipes ágeis organizando demandas diárias.',
      objectives: [
        'Permitir cadastro ágil de tarefas com validação de título obrigatório.',
        'Garantir que cada usuário visualize e modifique apenas suas próprias tarefas.',
        'Acompanhar transições de estado: pendente, em progresso e concluída.',
      ],
      mvpBoundaries: [
        'Criação, listagem, atualização e conclusão com persistência relacional.',
        'Compatibilidade com PostgreSQL e SQLite local.',
      ],
      outOfScope: ['Sincronização em tempo real via WebSockets nesta versão.'],
      requirements: [
        {
          id: 'req_tarefas_cadastro',
          code: 'REQ-01',
          title: 'Cadastro e validação de tarefas',
          description:
            'Criação de tarefas exigindo título preenchido e vinculado ao usuário atual.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_t1',
              description: 'Tarefas sem título são rejeitadas com erro HTTP 400.',
              verifiable: true,
            },
            {
              id: 'crit_t2',
              description: 'Tarefas válidas são salvas com status pendente.',
              verifiable: true,
            },
          ],
        },
        {
          id: 'req_tarefas_conclusao',
          code: 'REQ-02',
          title: 'Ciclo de conclusão e isolamento por proprietário',
          description: 'Apenas o criador da tarefa pode alterar seu estado para concluída.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_t3',
              description: 'Tentativa de concluir tarefa alheia retorna HTTP 403 Forbidden.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_produtividade',
        name: 'Gestão de Produtividade',
        description: 'Módulo de criação, organização e conclusão de tarefas.',
      },
    ],
    glossary: [
      {
        id: 'gl_tarefa',
        term: 'Tarefa',
        definition: 'Item de trabalho acionável com título, descrição e estado de execução.',
        domainId: 'dom_produtividade',
      },
    ],
    actors: [
      {
        id: 'act_usuario_tarefas',
        name: 'Usuário',
        roleKey: 'user',
        description: 'Cria, visualiza e conclui suas próprias tarefas.',
      },
    ],
    useCases: [
      {
        id: 'uc_criar_tarefa',
        code: 'UC-01',
        name: 'Criar Tarefa',
        domainId: 'dom_produtividade',
        actorId: 'act_usuario_tarefas',
        requirementIds: ['req_tarefas_cadastro'],
        actionSummary: 'Usuário preenche título e detalhes da tarefa.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'detalhe', type: 'string', required: false },
        ],
        expectedResult: 'Tarefa persistida no banco com status pendente.',
        exceptions: ['Título vazio', 'Usuário não autenticado'],
      },
      {
        id: 'uc_concluir_tarefa',
        code: 'UC-02',
        name: 'Concluir Tarefa',
        domainId: 'dom_produtividade',
        actorId: 'act_usuario_tarefas',
        requirementIds: ['req_tarefas_conclusao'],
        actionSummary: 'Usuário marca a tarefa como concluída.',
        inputs: [{ name: 'id', type: 'string', required: true }],
        expectedResult: 'Estado da tarefa atualizado para concluída.',
        exceptions: ['Tarefa de outro usuário (403)', 'Tarefa inexistente (404)'],
      },
    ],
    entityGovernance: [
      {
        entityId: 'entidade',
        tableName: 'tarefas',
        ownerField: 'usuario_id',
        organizationField: 'org_id',
        isolationScope: 'owner',
      },
      {
        entityId: 'ent_usuarios',
        tableName: 'usuarios',
        isolationScope: 'none',
      },
      {
        entityId: 'ent_etiquetas',
        tableName: 'etiquetas',
        isolationScope: 'none',
      },
    ],
    policies: [
      {
        id: 'pol_usuario_tarefas',
        name: 'Proprietário Gerencia Suas Tarefas',
        actorRoles: ['user', 'admin'],
        resource: 'tarefas',
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'own',
        ownerField: 'usuario_id',
        organizationField: 'org_id',
        errorMessage: 'Apenas o proprietário autenticado pode gerenciar suas tarefas.',
        requirementIds: ['req_tarefas_cadastro', 'req_tarefas_conclusao'],
      },
    ],
    rules: [
      {
        id: 'rule_validar_tarefa',
        code: 'RN-01',
        name: 'Validação de Título da Tarefa',
        domainId: 'dom_produtividade',
        requirementIds: ['req_tarefas_cadastro'],
        explanation:
          'O título da tarefa não pode ser vazio ou consistir apenas em espaços em branco.',
        parameters: [{ name: 'titulo', type: 'string', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'titulo_valido',
        rows: [
          {
            id: 'row_t_vazio',
            label: 'Título vazio',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_tv1',
              leftField: 'titulo',
              operator: 'eq',
              rightValue: '',
            },
            outcome: 'titulo_obrigatorio',
          },
          {
            id: 'row_t_ok',
            label: 'Título preenchido',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_tv2',
              leftField: 'titulo',
              operator: 'neq',
              rightValue: '',
            },
            outcome: 'titulo_valido',
          },
        ],
        examples: [
          {
            id: 'ex_t_valido',
            description: 'Título informado corretamente',
            inputs: { titulo: 'Preparar apresentação técnica' },
            expectedOutcome: 'titulo_valido',
            expectedValid: true,
          },
          {
            id: 'ex_t_vazio',
            description: 'Título em branco',
            inputs: { titulo: '' },
            expectedOutcome: 'titulo_obrigatorio',
            expectedValid: false,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_tarefas_status',
        name: 'Ciclo de Vida da Tarefa',
        targetEntity: 'tarefas',
        stateField: 'status',
        initialState: 'pendente',
        finalStates: ['concluida'],
        states: ['pendente', 'em_progresso', 'concluida'],
        transitions: [
          {
            id: 'tr_iniciar_tarefa',
            name: 'Iniciar Tarefa',
            fromState: 'pendente',
            toState: 'em_progresso',
            allowedActorRoles: ['user', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            sideEffects: ['Registrar início da execução'],
          },
          {
            id: 'tr_concluir_tarefa',
            name: 'Concluir Tarefa',
            fromState: 'em_progresso',
            toState: 'concluida',
            allowedActorRoles: ['user', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            sideEffects: ['Marcar concluida=true'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_criar_tarefa',
        code: 'OP-01',
        name: 'Criar Tarefa',
        useCaseId: 'uc_criar_tarefa',
        requirementIds: ['req_tarefas_cadastro'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_usuario_tarefas',
        targetEntity: 'tarefas',
        entityAction: 'create',
        ruleIds: ['rule_validar_tarefa'],
        lifecycleId: 'lc_tarefas_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'detalhe', type: 'string', required: false },
        ],
        outputSummary: 'Tarefa criada com sucesso.',
        errorCases: [
          { code: 'UNAUTHORIZED', status: 401, message: 'Sessão inválida.' },
          { code: 'INVALID_INPUT', status: 400, message: 'Título da tarefa é obrigatório.' },
        ],
        activities: [
          { id: 'act_t1', order: 1, kind: 'authenticate', label: 'Autenticar sessão do usuário' },
          {
            id: 'act_t2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar permissão de escrita',
            refId: 'pol_usuario_tarefas',
          },
          {
            id: 'act_t3',
            order: 3,
            kind: 'validate_input',
            label: 'Validar título da tarefa',
            refId: 'rule_validar_tarefa',
          },
          {
            id: 'act_t4',
            order: 4,
            kind: 'persist_entity',
            label: 'Persistir tarefa no banco',
            refId: 'tarefas',
          },
          { id: 'act_t5', order: 5, kind: 'return_result', label: 'Retornar registro criado' },
        ],
      },
      {
        id: 'op_concluir_tarefa',
        code: 'OP-02',
        name: 'Concluir Tarefa',
        useCaseId: 'uc_concluir_tarefa',
        requirementIds: ['req_tarefas_conclusao'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_usuario_tarefas',
        targetEntity: 'tarefas',
        entityAction: 'transition',
        ruleIds: [],
        lifecycleId: 'lc_tarefas_status',
        transitionId: 'tr_concluir_tarefa',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [{ name: 'id', type: 'string', required: true }],
        outputSummary: 'Tarefa concluída pelo proprietário.',
        errorCases: [
          {
            code: 'FORBIDDEN_OWNER',
            status: 403,
            message: 'Acesso negado: a tarefa pertence a outro usuário.',
          },
        ],
        activities: [
          { id: 'act_tc1', order: 1, kind: 'authenticate', label: 'Autenticar sessão do usuário' },
          {
            id: 'act_tc2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar propriedade da tarefa',
            refId: 'pol_usuario_tarefas',
          },
          {
            id: 'act_tc3',
            order: 3,
            kind: 'check_state_transition',
            label: 'Avançar para concluída',
            refId: 'tr_concluir_tarefa',
          },
          {
            id: 'act_tc4',
            order: 4,
            kind: 'persist_entity',
            label: 'Salvar estado no banco',
            refId: 'tarefas',
          },
          { id: 'act_tc5', order: 5, kind: 'return_result', label: 'Confirmar conclusão' },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_criar_tarefa',
        name: 'Endpoint Criar Tarefa',
        method: 'POST',
        path: '/api/operations/criar-tarefa',
        operationId: 'op_criar_tarefa',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 300 },
        requestSchemaSummary: '{ id: string, titulo: string, detalhe?: string }',
        responseSchemaSummary: '{ ok: boolean, record: Tarefa }',
      },
      {
        id: 'api_concluir_tarefa',
        name: 'Endpoint Concluir Tarefa',
        method: 'POST',
        path: '/api/operations/concluir-tarefa',
        operationId: 'op_concluir_tarefa',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 1, backoffMs: 0 },
        requestSchemaSummary: '{ id: string }',
        responseSchemaSummary: '{ ok: boolean, record: Tarefa }',
      },
    ],
    scenarios: [
      {
        id: 'scen_criar_tarefa_ok',
        code: 'CEN-01',
        name: 'Criação de tarefa com título válido',
        category: 'positive',
        requirementIds: ['req_tarefas_cadastro'],
        operationId: 'op_criar_tarefa',
        ruleIds: ['rule_validar_tarefa'],
        actorRole: 'user',
        actorOrgId: 'org_padrao',
        actorUserId: 'usr_joao',
        inputPayload: { id: 't_101', titulo: 'Atualizar documentação' },
        expectedAllowed: true,
        expectedOutcome: 'titulo_valido',
        expectedStatus: 201,
      },
      {
        id: 'scen_criar_tarefa_sem_titulo',
        code: 'CEN-02',
        name: 'Tentativa de criar tarefa com título em branco',
        category: 'negative_rule',
        requirementIds: ['req_tarefas_cadastro'],
        operationId: 'op_criar_tarefa',
        ruleIds: ['rule_validar_tarefa'],
        actorRole: 'user',
        actorOrgId: 'org_padrao',
        actorUserId: 'usr_joao',
        inputPayload: { id: 't_102', titulo: '' },
        expectedAllowed: false,
        expectedStatus: 400,
        expectedErrorCode: 'INVALID_INPUT',
      },
      {
        id: 'scen_concluir_tarefa_alheia',
        code: 'CEN-03',
        name: 'Tentativa de concluir tarefa pertencente a outro usuário',
        category: 'access_denied',
        requirementIds: ['req_tarefas_conclusao'],
        operationId: 'op_concluir_tarefa',
        ruleIds: [],
        actorRole: 'user',
        actorOrgId: 'org_padrao',
        actorUserId: 'usr_maria',
        inputPayload: { id: 't_101' },
        initialRecordState: {
          id: 't_101',
          usuario_id: 'usr_joao',
          status: 'em_progresso',
        },
        expectedAllowed: false,
        expectedStatus: 403,
        expectedErrorCode: 'NOT_OWNER',
      },
    ],
    adrs: [
      {
        id: 'adr_tarefas_isolamento',
        code: 'ADR-001',
        title: 'Isolamento por Proprietário (Owner-based RBAC)',
        status: 'accepted',
        context: 'Cada usuário deve manter suas tarefas privadas.',
        decision:
          'Vincular cada tarefa ao usuario_id no gateway e barrar atualizações por terceiros.',
        alternatives: ['Permissões globais', 'Acesso sem filtro'],
        consequences: 'Segurança garantida no nível do servidor com ou sem interface web.',
        owner: 'Arquitetura FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia_tarefas',
        category: 'latency',
        metricName: 'Tempo de resposta p95 na criação de tarefas',
        targetValue: '<= 100ms',
        verificationMethod: 'Cenários de teste e medição local',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [],
    journeys: [
      {
        id: 'jrn_tarefas',
        useCaseId: 'uc_criar_tarefa',
        screenId: 'home',
        actionLabel: 'Adicionar Tarefa',
        operationId: 'op_criar_tarefa',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

/**
 * Modelagem de Referência para o App "Catálogo de Produtos" (store)
 */
export function createStoreReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Disponibilizar catálogo comercial de produtos com controle exato de preços em centavos inteiros e restrição de cadastro apenas a gerentes.',
      targetAudience: 'Vendedores consultando a vitrine e gerentes atualizando o catálogo.',
      objectives: [
        'Evitar erros de arredondamento em preços usando aritmética inteira em centavos.',
        'Permitir consulta livre ao catálogo e reservar mutações a gerentes comerciais.',
        'Manter ciclo de vida do produto com estados de rascunho, ativo e inativo.',
      ],
      mvpBoundaries: ['Gestão de produtos com categorias e pedidos em PostgreSQL ou SQLite.'],
      outOfScope: ['Gateway de pagamento externo na fase de catálogo básico.'],
      requirements: [
        {
          id: 'req_produto_preco',
          code: 'REQ-01',
          title: 'Validação de preço estritamente positivo em centavos',
          description: 'Produtos devem ter preço maior que zero avaliado em centavos inteiros.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_s1',
              description: 'Preço igual a zero ou negativo é rejeitado com HTTP 400.',
              verifiable: true,
            },
            {
              id: 'crit_s2',
              description: 'Preços válidos são salvos como NUMERIC/INTEGER centavos.',
              verifiable: true,
            },
          ],
        },
        {
          id: 'req_produto_permissao',
          code: 'REQ-02',
          title: 'Permissão de cadastro reservada a gerentes',
          description:
            'Apenas usuários com papel manager ou admin podem incluir ou ativar produtos.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_s3',
              description: 'Vendedor comum recebe HTTP 403 ao tentar cadastrar produtos.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_catalogo',
        name: 'Catálogo Comercial',
        description: 'Gestão de produtos, precificação e categorização.',
      },
    ],
    glossary: [
      {
        id: 'gl_preco_centavos',
        term: 'Preço em Centavos',
        definition:
          'Representação inteira do valor em reais multiplicada por 100 para exatidão contábil.',
        domainId: 'dom_catalogo',
      },
    ],
    actors: [
      {
        id: 'act_vendedor_loja',
        name: 'Vendedor',
        roleKey: 'user',
        description: 'Consulta produtos disponíveis no catálogo.',
      },
      {
        id: 'act_gerente_loja',
        name: 'Gerente Comercial',
        roleKey: 'manager',
        description: 'Cadastra, atualiza preços e ativa produtos.',
      },
    ],
    useCases: [
      {
        id: 'uc_cadastrar_produto',
        code: 'UC-01',
        name: 'Cadastrar Produto',
        domainId: 'dom_catalogo',
        actorId: 'act_gerente_loja',
        requirementIds: ['req_produto_preco', 'req_produto_permissao'],
        actionSummary: 'Gerente cadastra novo produto com nome, descrição e preço em centavos.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'preco', type: 'decimal_cents', required: true },
        ],
        expectedResult: 'Produto gravado no banco como ativo.',
        exceptions: ['Preço não-positivo', 'Papel sem permissão gerencial (403)'],
      },
    ],
    entityGovernance: [
      {
        entityId: 'entidade',
        tableName: 'produtos',
        ownerField: 'gestor_id',
        organizationField: 'org_id',
        monetaryFieldsCents: ['preco'],
        isolationScope: 'organization',
      },
      {
        entityId: 'ent_categorias',
        tableName: 'categorias',
        isolationScope: 'none',
      },
      {
        entityId: 'ent_pedidos_loja',
        tableName: 'pedidos',
        isolationScope: 'organization',
      },
    ],
    policies: [
      {
        id: 'pol_gestao_produtos',
        name: 'Gerentes Gerenciam Catálogo',
        actorRoles: ['manager', 'admin'],
        resource: 'produtos',
        actions: ['create', 'update', 'delete'],
        scope: 'organization',
        ownerField: 'gestor_id',
        organizationField: 'org_id',
        errorMessage: 'Apenas gerentes comerciais podem alterar o catálogo de produtos.',
        requirementIds: ['req_produto_permissao'],
      },
    ],
    rules: [
      {
        id: 'rule_preco_positivo',
        code: 'RN-01',
        name: 'Validação de Preço Estritamente Positivo em Centavos',
        domainId: 'dom_catalogo',
        requirementIds: ['req_produto_preco'],
        explanation: 'O preço de venda do produto deve ser estritamente maior que zero centavos.',
        parameters: [{ name: 'preco', type: 'decimal_cents', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'preco_valido',
        rows: [
          {
            id: 'row_p_invalido',
            label: 'Preço menor ou igual a zero',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_p1',
              leftField: 'preco',
              operator: 'lte',
              rightValue: 0,
              useExactCents: true,
            },
            outcome: 'preco_invalido',
          },
          {
            id: 'row_p_valido',
            label: 'Preço maior que zero',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_p2',
              leftField: 'preco',
              operator: 'gt',
              rightValue: 0,
              useExactCents: true,
            },
            outcome: 'preco_valido',
          },
        ],
        examples: [
          {
            id: 'ex_p_valido',
            description: 'Produto com valor de R$ 489,90',
            inputs: { preco: 48990 },
            expectedOutcome: 'preco_valido',
            expectedValid: true,
          },
          {
            id: 'ex_p_invalido',
            description: 'Produto com preço zerado',
            inputs: { preco: 0 },
            expectedOutcome: 'preco_invalido',
            expectedValid: false,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_produtos_status',
        name: 'Ciclo de Vida do Produto',
        targetEntity: 'produtos',
        stateField: 'status',
        initialState: 'ativo',
        finalStates: ['inativo'],
        states: ['rascunho', 'ativo', 'inativo'],
        transitions: [
          {
            id: 'tr_desativar_produto',
            name: 'Desativar Produto',
            fromState: 'ativo',
            toState: 'inativo',
            allowedActorRoles: ['manager', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            sideEffects: ['Ocultar do catálogo de vendas'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_cadastrar_produto',
        code: 'OP-01',
        name: 'Cadastrar Produto',
        useCaseId: 'uc_cadastrar_produto',
        requirementIds: ['req_produto_preco', 'req_produto_permissao'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_gestao_produtos',
        targetEntity: 'produtos',
        entityAction: 'create',
        ruleIds: ['rule_preco_positivo'],
        lifecycleId: 'lc_produtos_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'preco', type: 'decimal_cents', required: true },
        ],
        outputSummary: 'Produto cadastrado no catálogo.',
        errorCases: [
          {
            code: 'FORBIDDEN_ROLE',
            status: 403,
            message: 'Apenas gerentes podem cadastrar produtos.',
          },
          { code: 'INVALID_INPUT', status: 400, message: 'Preço deve ser maior que zero.' },
        ],
        activities: [
          { id: 'act_cp1', order: 1, kind: 'authenticate', label: 'Autenticar sessão do gestor' },
          {
            id: 'act_cp2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar papel gerencial',
            refId: 'pol_gestao_produtos',
          },
          {
            id: 'act_cp3',
            order: 3,
            kind: 'validate_input',
            label: 'Validar preço em centavos',
            refId: 'rule_preco_positivo',
          },
          {
            id: 'act_cp4',
            order: 4,
            kind: 'persist_entity',
            label: 'Persistir produto',
            refId: 'produtos',
          },
          { id: 'act_cp5', order: 5, kind: 'return_result', label: 'Retornar produto criado' },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_cadastrar_produto',
        name: 'Endpoint Cadastrar Produto',
        method: 'POST',
        path: '/api/operations/cadastrar-produto',
        operationId: 'op_cadastrar_produto',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 300 },
        requestSchemaSummary: '{ id: string, titulo: string, preco: number }',
        responseSchemaSummary: '{ ok: boolean, record: Produto }',
      },
    ],
    scenarios: [
      {
        id: 'scen_cadastrar_produto_ok',
        code: 'CEN-01',
        name: 'Gerente cadastra produto com preço válido',
        category: 'positive',
        requirementIds: ['req_produto_preco', 'req_produto_permissao'],
        operationId: 'op_cadastrar_produto',
        ruleIds: ['rule_preco_positivo'],
        actorRole: 'manager',
        actorOrgId: 'org_loja',
        actorUserId: 'usr_gerente_1',
        inputPayload: { id: 'prod_99', titulo: 'Teclado Mecânico', preco: 48990 },
        expectedAllowed: true,
        expectedOutcome: 'preco_valido',
        expectedStatus: 201,
      },
      {
        id: 'scen_cadastrar_produto_sem_titulo',
        code: 'CEN-02',
        name: 'Tentativa de cadastrar produto sem título',
        category: 'negative_rule',
        requirementIds: ['req_produto_preco'],
        operationId: 'op_cadastrar_produto',
        ruleIds: ['rule_preco_positivo'],
        actorRole: 'manager',
        actorOrgId: 'org_loja',
        actorUserId: 'usr_gerente_1',
        inputPayload: { id: 'prod_100', titulo: '', preco: 4900 },
        expectedAllowed: false,
        expectedStatus: 400,
        expectedErrorCode: 'INVALID_INPUT',
      },
      {
        id: 'scen_vendedor_bloqueado',
        code: 'CEN-03',
        name: 'Vendedor comum tenta cadastrar produto no catálogo',
        category: 'access_denied',
        requirementIds: ['req_produto_permissao'],
        operationId: 'op_cadastrar_produto',
        ruleIds: ['rule_preco_positivo'],
        actorRole: 'user',
        actorOrgId: 'org_loja',
        actorUserId: 'usr_vendedor_1',
        inputPayload: { id: 'prod_101', titulo: 'Headset', preco: 29900 },
        expectedAllowed: false,
        expectedStatus: 403,
        expectedErrorCode: 'FORBIDDEN_ROLE',
      },
    ],
    adrs: [
      {
        id: 'adr_moeda_catalogo',
        code: 'ADR-001',
        title: 'Armazenamento de Preços em Centavos Inteiros',
        status: 'accepted',
        context: 'Cálculos contábeis requerem exatidão sem imprecisão binária.',
        decision:
          'Modelar todos os atributos de valor como centavos e validar estritamente no backend.',
        alternatives: ['Float IEEE 754'],
        consequences: 'Previsibilidade contábil total.',
        owner: 'Arquitetura FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia_loja',
        category: 'latency',
        metricName: 'Tempo de resposta p95 no cadastro de produtos',
        targetValue: '<= 120ms',
        verificationMethod: 'Testes de integração locais',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [],
    journeys: [
      {
        id: 'jrn_store',
        useCaseId: 'uc_cadastrar_produto',
        screenId: 'home',
        actionLabel: 'Adicionar Produto',
        operationId: 'op_cadastrar_produto',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

/**
 * Modelagem de Referência para o App "Mural de Publicações" (social)
 */
export function createSocialReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Compartilhar publicações e comentários em rede corporativa interna com autoria auditável e título de publicação não-vazio.',
      targetAudience: 'Colaboradores compartilhando comunicados e novidades.',
      objectives: [
        'Permitir que autores publiquem no mural com título preenchido.',
        'Garantir que apenas o autor original possa alterar ou arquivar sua publicação.',
      ],
      mvpBoundaries: ['Publicações, autores e comentários persistidos no PostgreSQL ou SQLite.'],
      outOfScope: ['Algoritmo de recomendação com IA nesta primeira versão.'],
      requirements: [
        {
          id: 'req_social_post',
          code: 'REQ-01',
          title: 'Publicação com título obrigatório e autoria vinculada',
          description: 'Postagens devem conter título preenchido e vincular o autor autenticado.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_m1',
              description: 'Tentativa de postar com título vazio é rejeitada com HTTP 400.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_comunicacao',
        name: 'Comunicação Interna',
        description: 'Mural de postagens e interações.',
      },
    ],
    glossary: [
      {
        id: 'gl_publicacao',
        term: 'Publicação',
        definition: 'Mensagem compartilhada no mural corporativo por um autor identificado.',
        domainId: 'dom_comunicacao',
      },
    ],
    actors: [
      {
        id: 'act_autor_social',
        name: 'Autor Colaborador',
        roleKey: 'user',
        description: 'Cria postagens no mural e comenta.',
      },
    ],
    useCases: [
      {
        id: 'uc_publicar_post',
        code: 'UC-01',
        name: 'Publicar no Mural',
        domainId: 'dom_comunicacao',
        actorId: 'act_autor_social',
        requirementIds: ['req_social_post'],
        actionSummary: 'Autor submete título e detalhe do post.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'detalhe', type: 'string', required: false },
        ],
        expectedResult: 'Post persistido e visível no feed.',
        exceptions: ['Título em branco'],
      },
    ],
    entityGovernance: [
      {
        entityId: 'entidade',
        tableName: 'publicacoes',
        ownerField: 'autor_id',
        organizationField: 'org_id',
        isolationScope: 'owner',
      },
      {
        entityId: 'ent_autores',
        tableName: 'autores',
        isolationScope: 'none',
      },
      {
        entityId: 'ent_comentarios',
        tableName: 'comentarios',
        isolationScope: 'none',
      },
    ],
    policies: [
      {
        id: 'pol_autor_publicacoes',
        name: 'Autor Gerencia Suas Publicações',
        actorRoles: ['user', 'admin'],
        resource: 'publicacoes',
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'own',
        ownerField: 'autor_id',
        organizationField: 'org_id',
        errorMessage: 'Apenas o autor pode editar ou arquivar sua publicação.',
        requirementIds: ['req_social_post'],
      },
    ],
    rules: [
      {
        id: 'rule_validar_post',
        code: 'RN-01',
        name: 'Validação de Título do Post',
        domainId: 'dom_comunicacao',
        requirementIds: ['req_social_post'],
        explanation: 'A publicação precisa de um título preenchido para ser exibida no mural.',
        parameters: [{ name: 'titulo', type: 'string', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'post_valido',
        rows: [
          {
            id: 'row_post_vazio',
            label: 'Título vazio',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_pv1',
              leftField: 'titulo',
              operator: 'eq',
              rightValue: '',
            },
            outcome: 'post_invalido',
          },
          {
            id: 'row_post_ok',
            label: 'Título preenchido',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_pv2',
              leftField: 'titulo',
              operator: 'neq',
              rightValue: '',
            },
            outcome: 'post_valido',
          },
        ],
        examples: [
          {
            id: 'ex_post_valido',
            description: 'Post com título regular',
            inputs: { titulo: 'Lançamento da nova versão' },
            expectedOutcome: 'post_valido',
            expectedValid: true,
          },
          {
            id: 'ex_post_vazio',
            description: 'Post sem título',
            inputs: { titulo: '' },
            expectedOutcome: 'post_invalido',
            expectedValid: false,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_publicacoes_status',
        name: 'Ciclo de Vida da Publicação',
        targetEntity: 'publicacoes',
        stateField: 'status',
        initialState: 'publicado',
        finalStates: ['arquivado'],
        states: ['rascunho', 'publicado', 'arquivado'],
        transitions: [
          {
            id: 'tr_arquivar_post',
            name: 'Arquivar Publicação',
            fromState: 'publicado',
            toState: 'arquivado',
            allowedActorRoles: ['user', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            sideEffects: ['Remover do feed ativo'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_publicar_post',
        code: 'OP-01',
        name: 'Publicar no Mural',
        useCaseId: 'uc_publicar_post',
        requirementIds: ['req_social_post'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_autor_publicacoes',
        targetEntity: 'publicacoes',
        entityAction: 'create',
        ruleIds: ['rule_validar_post'],
        lifecycleId: 'lc_publicacoes_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'titulo', type: 'string', required: true },
          { name: 'detalhe', type: 'string', required: false },
        ],
        outputSummary: 'Publicação registrada no mural.',
        errorCases: [
          { code: 'INVALID_INPUT', status: 400, message: 'Título da publicação é obrigatório.' },
        ],
        activities: [
          { id: 'act_sp1', order: 1, kind: 'authenticate', label: 'Autenticar autor' },
          {
            id: 'act_sp2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar política de postagem',
            refId: 'pol_autor_publicacoes',
          },
          {
            id: 'act_sp3',
            order: 3,
            kind: 'validate_input',
            label: 'Validar conteúdo',
            refId: 'rule_validar_post',
          },
          {
            id: 'act_sp4',
            order: 4,
            kind: 'persist_entity',
            label: 'Persistir publicação',
            refId: 'publicacoes',
          },
          { id: 'act_sp5', order: 5, kind: 'return_result', label: 'Retornar post criado' },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_publicar_post',
        name: 'Endpoint Publicar no Mural',
        method: 'POST',
        path: '/api/operations/publicar-post',
        operationId: 'op_publicar_post',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 300 },
        requestSchemaSummary: '{ id: string, titulo: string, detalhe?: string }',
        responseSchemaSummary: '{ ok: boolean, record: Publicacao }',
      },
    ],
    scenarios: [
      {
        id: 'scen_publicar_post_ok',
        code: 'CEN-01',
        name: 'Autor publica post com título preenchido',
        category: 'positive',
        requirementIds: ['req_social_post'],
        operationId: 'op_publicar_post',
        ruleIds: ['rule_validar_post'],
        actorRole: 'user',
        actorOrgId: 'org_mural',
        actorUserId: 'usr_autor_1',
        inputPayload: { id: 'pub_1', titulo: 'Boas-vindas a todos!' },
        expectedAllowed: true,
        expectedOutcome: 'post_valido',
        expectedStatus: 201,
      },
      {
        id: 'scen_publicar_post_vazio',
        code: 'CEN-02',
        name: 'Tentativa de publicação com título em branco',
        category: 'negative_rule',
        requirementIds: ['req_social_post'],
        operationId: 'op_publicar_post',
        ruleIds: ['rule_validar_post'],
        actorRole: 'user',
        actorOrgId: 'org_mural',
        actorUserId: 'usr_autor_1',
        inputPayload: { id: 'pub_2', titulo: '' },
        expectedAllowed: false,
        expectedStatus: 400,
        expectedErrorCode: 'INVALID_INPUT',
      },
    ],
    adrs: [
      {
        id: 'adr_mural_auditoria',
        code: 'ADR-001',
        title: 'Auditoria de Autoria no Backend',
        status: 'accepted',
        context: 'Necessidade de identificar o autor verificado de cada publicação.',
        decision: 'Injetar autor_id a partir do token de sessão.',
        alternatives: ['Autor passado livremente no payload'],
        consequences: 'Impossível forjar autoria.',
        owner: 'Segurança FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia_mural',
        category: 'latency',
        metricName: 'Tempo de resposta p95 no mural',
        targetValue: '<= 100ms',
        verificationMethod: 'Testes locais de carga',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [],
    journeys: [
      {
        id: 'jrn_social',
        useCaseId: 'uc_publicar_post',
        screenId: 'home',
        actionLabel: 'Publicar no Mural',
        operationId: 'op_publicar_post',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

/**
 * Modelagem de Referência para o App "Reserva de Salas e Agendamentos" (schedulingConflict)
 */
export function createSchedulingReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Controlar agendamentos de salas de reunião por organização, garantindo sala selecionada e integridade transacional de reservas.',
      targetAudience: 'Colaboradores agendando reuniões e gestores de infraestrutura.',
      objectives: [
        'Permitir reserva de salas com identificador de sala obrigatório.',
        'Impedir cancelamento de agendamento por usuários que não sejam o responsável ou administrador.',
      ],
      mvpBoundaries: ['Persistência relacional de salas e agendamentos.'],
      outOfScope: ['Integração com Microsoft Exchange ou Google Calendar nesta fase.'],
      requirements: [
        {
          id: 'req_agenda_reserva',
          code: 'REQ-01',
          title: 'Reserva com sala obrigatória',
          description: 'A reserva exige uma sala informada e é vinculada ao responsável.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_sc1',
              description: 'Reserva sem sala é rejeitada com HTTP 400.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_facilities',
        name: 'Gestão de Espaços e Salas',
        description: 'Mapeamento de salas e horários de agendamento.',
      },
    ],
    glossary: [
      {
        id: 'gl_agendamento',
        term: 'Agendamento',
        definition: 'Reserva de horário em determinada sala vinculada ao responsável.',
        domainId: 'dom_facilities',
      },
    ],
    actors: [
      {
        id: 'act_colab_agenda',
        name: 'Colaborador',
        roleKey: 'user',
        description: 'Efetua e gerencia suas reservas de salas.',
      },
    ],
    useCases: [
      {
        id: 'uc_reservar_sala',
        code: 'UC-01',
        name: 'Reservar Sala',
        domainId: 'dom_facilities',
        actorId: 'act_colab_agenda',
        requirementIds: ['req_agenda_reserva'],
        actionSummary: 'Colaborador seleciona sala e solicita agendamento.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'sala_id', type: 'string', required: true },
        ],
        expectedResult: 'Agendamento confirmado para o solicitante.',
        exceptions: ['Sala não informada'],
      },
    ],
    entityGovernance: [
      {
        entityId: 'ent_agendamentos',
        tableName: 'agendamentos',
        ownerField: 'responsavel_email',
        organizationField: 'org_id',
        isolationScope: 'organization',
      },
      {
        entityId: 'ent_salas',
        tableName: 'salas',
        isolationScope: 'none',
      },
    ],
    policies: [
      {
        id: 'pol_agendamento_org',
        name: 'Membros da Organização Agendam Salas',
        actorRoles: ['user', 'admin'],
        resource: 'agendamentos',
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'organization',
        ownerField: 'responsavel_email',
        organizationField: 'org_id',
        errorMessage: 'Apenas membros da organização podem agendar salas.',
        requirementIds: ['req_agenda_reserva'],
      },
    ],
    rules: [
      {
        id: 'rule_sala_obrigatoria',
        code: 'RN-01',
        name: 'Validação de Identificador de Sala',
        domainId: 'dom_facilities',
        requirementIds: ['req_agenda_reserva'],
        explanation: 'O agendamento precisa de uma sala válida informada.',
        parameters: [{ name: 'sala_id', type: 'string', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'sala_valida',
        rows: [
          {
            id: 'row_sala_vazia',
            label: 'Sala vazia',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_sv1',
              leftField: 'sala_id',
              operator: 'eq',
              rightValue: '',
            },
            outcome: 'sala_obrigatoria',
          },
          {
            id: 'row_sala_ok',
            label: 'Sala preenchida',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_sv2',
              leftField: 'sala_id',
              operator: 'neq',
              rightValue: '',
            },
            outcome: 'sala_valida',
          },
        ],
        examples: [
          {
            id: 'ex_sala_valida',
            description: 'Sala A informada',
            inputs: { sala_id: 'sala_a' },
            expectedOutcome: 'sala_valida',
            expectedValid: true,
          },
          {
            id: 'ex_sala_vazia',
            description: 'Sala vazia',
            inputs: { sala_id: '' },
            expectedOutcome: 'sala_obrigatoria',
            expectedValid: false,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_agendamento_status',
        name: 'Ciclo de Vida do Agendamento',
        targetEntity: 'agendamentos',
        stateField: 'status',
        initialState: 'confirmado',
        finalStates: ['cancelado'],
        states: ['confirmado', 'cancelado'],
        transitions: [
          {
            id: 'tr_cancelar_agendamento',
            name: 'Cancelar Agendamento',
            fromState: 'confirmado',
            toState: 'cancelado',
            allowedActorRoles: ['user', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            sideEffects: ['Liberar horário'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_reservar_sala',
        code: 'OP-01',
        name: 'Reservar Sala',
        useCaseId: 'uc_reservar_sala',
        requirementIds: ['req_agenda_reserva'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_agendamento_org',
        targetEntity: 'agendamentos',
        entityAction: 'create',
        ruleIds: ['rule_sala_obrigatoria'],
        lifecycleId: 'lc_agendamento_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'sala_id', type: 'string', required: true },
        ],
        outputSummary: 'Sala reservada com sucesso.',
        errorCases: [{ code: 'INVALID_INPUT', status: 400, message: 'Sala deve ser informada.' }],
        activities: [
          { id: 'act_ag1', order: 1, kind: 'authenticate', label: 'Autenticar colaborador' },
          {
            id: 'act_ag2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar organização',
            refId: 'pol_agendamento_org',
          },
          {
            id: 'act_ag3',
            order: 3,
            kind: 'validate_input',
            label: 'Validar sala informada',
            refId: 'rule_sala_obrigatoria',
          },
          {
            id: 'act_ag4',
            order: 4,
            kind: 'persist_entity',
            label: 'Gravar agendamento',
            refId: 'agendamentos',
          },
          { id: 'act_ag5', order: 5, kind: 'return_result', label: 'Retornar reserva confirmada' },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_reservar_sala',
        name: 'Endpoint Reservar Sala',
        method: 'POST',
        path: '/api/operations/reservar-sala',
        operationId: 'op_reservar_sala',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 300 },
        requestSchemaSummary: '{ id: string, sala_id: string }',
        responseSchemaSummary: '{ ok: boolean, record: Agendamento }',
      },
    ],
    scenarios: [
      {
        id: 'scen_reservar_sala_ok',
        code: 'CEN-01',
        name: 'Colaborador reserva sala existente',
        category: 'positive',
        requirementIds: ['req_agenda_reserva'],
        operationId: 'op_reservar_sala',
        ruleIds: ['rule_sala_obrigatoria'],
        actorRole: 'user',
        actorOrgId: 'org_corporativa',
        actorUserId: 'usr_colab_1',
        inputPayload: { id: 'ag_101', sala_id: 'sala_reuniao_1' },
        expectedAllowed: true,
        expectedOutcome: 'sala_valida',
        expectedStatus: 201,
      },
      {
        id: 'scen_reservar_sem_sala',
        code: 'CEN-02',
        name: 'Tentativa de reserva com sala não informada',
        category: 'negative_rule',
        requirementIds: ['req_agenda_reserva'],
        operationId: 'op_reservar_sala',
        ruleIds: ['rule_sala_obrigatoria'],
        actorRole: 'user',
        actorOrgId: 'org_corporativa',
        actorUserId: 'usr_colab_1',
        inputPayload: { id: 'ag_102', sala_id: '' },
        expectedAllowed: false,
        expectedStatus: 400,
        expectedErrorCode: 'INVALID_INPUT',
      },
    ],
    adrs: [
      {
        id: 'adr_agendamento_org',
        code: 'ADR-001',
        title: 'Isolamento de Agendamentos por Organização',
        status: 'accepted',
        context: 'Salas corporativas pertencem a organizações específicas.',
        decision: 'Conferir org_id em todas as consultas e operações.',
        alternatives: ['Compartilhamento global irrestrito'],
        consequences: 'Segregação adequada entre tenants.',
        owner: 'Segurança FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia_agenda',
        category: 'latency',
        metricName: 'Tempo de resposta p95 na reserva de salas',
        targetValue: '<= 120ms',
        verificationMethod: 'Testes automatizados locais',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [],
    journeys: [
      {
        id: 'jrn_agenda',
        useCaseId: 'uc_reservar_sala',
        screenId: 'screen_agendamento',
        actionLabel: 'Reservar Sala',
        operationId: 'op_reservar_sala',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

/**
 * Modelagem de Referência para o App "Portal de Aprovação de Solicitações" (roleApprovalPortal)
 */
export function createRoleApprovalReferenceModeling(): AppModeling {
  const draft: AppSpecification = {
    vision: {
      problemStatement:
        'Controlar submissões e aprovações de solicitações orçamentárias por organização, impedindo autoaprovação pelo solicitante e garantindo alçada de R$ 5.000,00.',
      targetAudience:
        'Colaboradores solicitantes e gestores aprovadores organizados por organização.',
      objectives: [
        'Permitir que colaboradores submetam solicitações orçamentárias.',
        'Aprovar automaticamente solicitações até R$ 5.000,00 e exigir análise gerencial acima desse teto.',
        'Impedir expressamente autoaprovação pelo próprio solicitante.',
      ],
      mvpBoundaries: [
        'Persistência transacional com histórico de aprovações em PostgreSQL ou SQLite.',
      ],
      outOfScope: ['Integração com folha de pagamento externa.'],
      requirements: [
        {
          id: 'req_solicitacao_alcada',
          code: 'REQ-01',
          title: 'Submissão e decisão conforme alçada e segregação de funções',
          description:
            'Solicitações até R$ 5.000,00 seguem fluxo automático; acima desse teto requerem aprovação por gestor distinto do solicitante.',
          priority: 'must',
          acceptanceCriteria: [
            {
              id: 'crit_sol1',
              description: 'Solicitações <= R$ 5.000,00 aprovadas automaticamente no envio.',
              verifiable: true,
            },
            {
              id: 'crit_sol2',
              description:
                'Tentativa de autoaprovação pelo solicitante retorna HTTP 403 Forbidden.',
              verifiable: true,
            },
          ],
        },
      ],
    },
    domains: [
      {
        id: 'dom_governanca',
        name: 'Governança e Alçadas',
        description: 'Gestão de aprovações e conformidade de alçada financeira.',
      },
    ],
    glossary: [
      {
        id: 'gl_solicitacao',
        term: 'Solicitação',
        definition: 'Pedido formal de despesa ou recurso orçamentário submetido para avaliação.',
        domainId: 'dom_governanca',
      },
    ],
    actors: [
      {
        id: 'act_solicitante',
        name: 'Solicitante',
        roleKey: 'user',
        description: 'Submete solicitações orçamentárias de sua organização.',
      },
      {
        id: 'act_gestor_aprovador',
        name: 'Gestor Aprovador',
        roleKey: 'manager',
        description:
          'Decide sobre solicitações da mesma organização sem poder autoaprovar suas próprias.',
      },
    ],
    useCases: [
      {
        id: 'uc_submeter_solicitacao',
        code: 'UC-01',
        name: 'Submeter Solicitação',
        domainId: 'dom_governanca',
        actorId: 'act_solicitante',
        requirementIds: ['req_solicitacao_alcada'],
        actionSummary: 'Colaborador envia solicitação com valor monetário em centavos.',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'valor', type: 'decimal_cents', required: true },
        ],
        expectedResult: 'Solicitação criada e classificada conforme alçada.',
        exceptions: ['Valor inválido'],
      },
      {
        id: 'uc_aprovar_solicitacao',
        code: 'UC-02',
        name: 'Aprovar Solicitação Gerencial',
        domainId: 'dom_governanca',
        actorId: 'act_gestor_aprovador',
        requirementIds: ['req_solicitacao_alcada'],
        actionSummary: 'Gestor da mesma organização avalia solicitação pendente.',
        inputs: [{ name: 'id', type: 'string', required: true }],
        expectedResult: 'Solicitação alterada para o estado aprovado.',
        exceptions: ['Autoaprovação (403)', 'Organização divergente (403)'],
      },
    ],
    entityGovernance: [
      {
        entityId: 'ent_solicitacoes',
        tableName: 'solicitacoes',
        ownerField: 'solicitante_email',
        organizationField: 'org_id',
        versionField: 'versao',
        monetaryFieldsCents: ['valor'],
        isolationScope: 'organization',
      },
      {
        entityId: 'ent_aprovacoes',
        tableName: 'aprovacoes',
        isolationScope: 'organization',
      },
    ],
    policies: [
      {
        id: 'pol_solicitante_submissao',
        name: 'Membros Submetem Solicitações da Organização',
        actorRoles: ['user', 'manager', 'admin'],
        resource: 'solicitacoes',
        actions: ['create', 'read'],
        scope: 'organization',
        ownerField: 'solicitante_email',
        organizationField: 'org_id',
        errorMessage: 'Apenas membros da organização podem submeter solicitações.',
        requirementIds: ['req_solicitacao_alcada'],
      },
      {
        id: 'pol_gestor_aprovacao_sol',
        name: 'Gestor Aprova Solicitações da Mesma Organização (Sem Autoaprovação)',
        actorRoles: ['manager', 'admin'],
        resource: 'solicitacoes',
        actions: ['approve', 'update'],
        scope: 'organization',
        ownerField: 'solicitante_email',
        organizationField: 'org_id',
        forbidSelfApproval: true,
        errorMessage:
          'Apenas gestores da mesma organização (distintos do solicitante) podem aprovar.',
        requirementIds: ['req_solicitacao_alcada'],
      },
    ],
    rules: [
      {
        id: 'rule_alcada_solicitacao',
        code: 'RN-01',
        name: 'Alçada de Solicitação por Valor (R$ 5.000)',
        domainId: 'dom_governanca',
        requirementIds: ['req_solicitacao_alcada'],
        explanation:
          'Solicitações até R$ 5.000,00 seguem aprovação normal; acima desse teto requerem gestor.',
        parameters: [{ name: 'valor', type: 'decimal_cents', required: true }],
        hitPolicy: 'first_match',
        requireDefaultCase: true,
        defaultOutcome: 'requires_manager_approval',
        rows: [
          {
            id: 'row_sol_normal',
            label: 'Solicitação até R$ 5.000,00',
            priority: 1,
            condition: {
              kind: 'comparison',
              id: 'cond_sol1',
              leftField: 'valor',
              operator: 'lte',
              rightValue: 5000,
              useExactCents: true,
            },
            outcome: 'auto_approved',
          },
          {
            id: 'row_sol_gestor',
            label: 'Solicitação acima de R$ 5.000,00',
            priority: 2,
            condition: {
              kind: 'comparison',
              id: 'cond_sol2',
              leftField: 'valor',
              operator: 'gt',
              rightValue: 5000,
              useExactCents: true,
            },
            outcome: 'requires_manager_approval',
          },
        ],
        examples: [
          {
            id: 'ex_sol_ok',
            description: 'Solicitação de R$ 3.500,00',
            inputs: { valor: 3500 },
            expectedOutcome: 'auto_approved',
            expectedValid: true,
          },
          {
            id: 'ex_sol_acima',
            description: 'Solicitação de R$ 9.000,00',
            inputs: { valor: 9000 },
            expectedOutcome: 'requires_manager_approval',
            expectedValid: true,
          },
        ],
      },
    ],
    lifecycles: [
      {
        id: 'lc_solicitacoes_status',
        name: 'Ciclo de Vida da Solicitação',
        targetEntity: 'solicitacoes',
        stateField: 'status',
        versionField: 'versao',
        initialState: 'rascunho',
        finalStates: ['aprovado', 'rejeitado'],
        states: ['rascunho', 'pendente', 'aprovado', 'rejeitado'],
        transitions: [
          {
            id: 'tr_submeter_sol',
            name: 'Submeter Solicitação',
            fromState: 'rascunho',
            toState: 'pendente',
            allowedActorRoles: ['user', 'manager', 'admin'],
            ruleIds: ['rule_alcada_solicitacao'],
            requireVersionMatch: false,
            sideEffects: ['Avisar comitê de aprovação'],
          },
          {
            id: 'tr_aprovar_sol',
            name: 'Aprovar Solicitação',
            fromState: 'pendente',
            toState: 'aprovado',
            allowedActorRoles: ['manager', 'admin'],
            ruleIds: [],
            requireVersionMatch: false,
            forbidSelfTransitionByCreator: true,
            sideEffects: ['Registrar gestor'],
          },
        ],
      },
    ],
    operations: [
      {
        id: 'op_submeter_solicitacao',
        code: 'OP-01',
        name: 'Submeter Solicitação',
        useCaseId: 'uc_submeter_solicitacao',
        requirementIds: ['req_solicitacao_alcada'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_solicitante_submissao',
        targetEntity: 'solicitacoes',
        entityAction: 'create',
        ruleIds: ['rule_alcada_solicitacao'],
        lifecycleId: 'lc_solicitacoes_status',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [
          { name: 'id', type: 'string', required: true },
          { name: 'valor', type: 'decimal_cents', required: true },
        ],
        outputSummary: 'Solicitação criada no portal.',
        errorCases: [{ code: 'UNAUTHORIZED', status: 401, message: 'Autenticação necessária.' }],
        activities: [
          { id: 'act_ss1', order: 1, kind: 'authenticate', label: 'Autenticar solicitante' },
          {
            id: 'act_ss2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar permissão',
            refId: 'pol_solicitante_submissao',
          },
          {
            id: 'act_ss3',
            order: 3,
            kind: 'validate_input',
            label: 'Avaliar alçada',
            refId: 'rule_alcada_solicitacao',
          },
          {
            id: 'act_ss4',
            order: 4,
            kind: 'persist_entity',
            label: 'Gravar solicitação',
            refId: 'solicitacoes',
          },
          { id: 'act_ss5', order: 5, kind: 'return_result', label: 'Retornar solicitação criada' },
        ],
      },
      {
        id: 'op_aprovar_solicitacao',
        code: 'OP-02',
        name: 'Aprovar Solicitação',
        useCaseId: 'uc_aprovar_solicitacao',
        requirementIds: ['req_solicitacao_alcada'],
        triggerKind: 'api_endpoint',
        accessMode: 'policy',
        policyId: 'pol_gestor_aprovacao_sol',
        targetEntity: 'solicitacoes',
        entityAction: 'transition',
        ruleIds: [],
        lifecycleId: 'lc_solicitacoes_status',
        transitionId: 'tr_aprovar_sol',
        transactional: true,
        concurrencyControl: 'none',
        inputs: [{ name: 'id', type: 'string', required: true }],
        outputSummary: 'Solicitação aprovada por gestor da mesma organização.',
        errorCases: [
          {
            code: 'SELF_APPROVAL_FORBIDDEN',
            status: 403,
            message: 'Solicitante não pode aprovar sua própria solicitação.',
          },
          {
            code: 'CROSS_ORG_FORBIDDEN',
            status: 403,
            message: 'Acesso negado para organização distinta.',
          },
        ],
        activities: [
          { id: 'act_sa1', order: 1, kind: 'authenticate', label: 'Autenticar gestor' },
          {
            id: 'act_sa2',
            order: 2,
            kind: 'authorize',
            label: 'Verificar segregação de funções',
            refId: 'pol_gestor_aprovacao_sol',
          },
          {
            id: 'act_sa3',
            order: 3,
            kind: 'check_state_transition',
            label: 'Transitar para aprovado',
            refId: 'tr_aprovar_sol',
          },
          {
            id: 'act_sa4',
            order: 4,
            kind: 'persist_entity',
            label: 'Persistir decisão',
            refId: 'solicitacoes',
          },
          { id: 'act_sa5', order: 5, kind: 'return_result', label: 'Confirmar aprovação' },
        ],
      },
    ],
    apiContracts: [
      {
        id: 'api_submeter_solicitacao',
        name: 'Endpoint Submeter Solicitação',
        method: 'POST',
        path: '/api/operations/submeter-solicitacao',
        operationId: 'op_submeter_solicitacao',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 2, backoffMs: 300 },
        requestSchemaSummary: '{ id: string, valor: number }',
        responseSchemaSummary: '{ ok: boolean, record: Solicitacao }',
      },
      {
        id: 'api_aprovar_solicitacao',
        name: 'Endpoint Aprovar Solicitação',
        method: 'POST',
        path: '/api/operations/aprovar-solicitacao',
        operationId: 'op_aprovar_solicitacao',
        authRequired: true,
        timeoutMs: 5000,
        retryPolicy: { maxAttempts: 1, backoffMs: 0 },
        requestSchemaSummary: '{ id: string }',
        responseSchemaSummary: '{ ok: boolean, record: Solicitacao }',
      },
    ],
    scenarios: [
      {
        id: 'scen_submeter_sol_ok',
        code: 'CEN-01',
        name: 'Colaborador submete solicitação normal de R$ 3.500,00',
        category: 'positive',
        requirementIds: ['req_solicitacao_alcada'],
        operationId: 'op_submeter_solicitacao',
        ruleIds: ['rule_alcada_solicitacao'],
        actorRole: 'user',
        actorOrgId: 'org_corp',
        actorUserId: 'usr_sol_1',
        inputPayload: { id: 'sol_201', valor: 3500 },
        expectedAllowed: true,
        expectedOutcome: 'auto_approved',
        expectedStatus: 201,
      },
      {
        id: 'scen_autoaprovacao_sol_bloqueada',
        code: 'CEN-02',
        name: 'Solicitante tenta autoaprovar sua solicitação (segregação barrada)',
        category: 'self_approval_denied',
        requirementIds: ['req_solicitacao_alcada'],
        operationId: 'op_aprovar_solicitacao',
        ruleIds: [],
        actorRole: 'manager',
        actorOrgId: 'org_corp',
        actorUserId: 'usr_sol_1',
        inputPayload: { id: 'sol_201' },
        initialRecordState: {
          id: 'sol_201',
          solicitante_email: 'usr_sol_1',
          org_id: 'org_corp',
          status: 'pendente',
        },
        expectedAllowed: false,
        expectedStatus: 403,
        expectedErrorCode: 'SELF_APPROVAL_FORBIDDEN',
      },
    ],
    adrs: [
      {
        id: 'adr_segregacao_sol',
        code: 'ADR-001',
        title: 'Segregação Estrita de Funções na Aprovação de Despesas',
        status: 'accepted',
        context: 'Regras de compliance impedem que o criador aprove seus próprios dispêndios.',
        decision: 'Bloquear transição no gateway quando ator autenticado coincide com solicitante.',
        alternatives: ['Permitir com aviso visual'],
        consequences: 'Conformidade com auditoria interna garantida.',
        owner: 'Compliance FlowForge',
      },
    ],
    qualityTargets: [
      {
        id: 'qt_latencia_portal',
        category: 'latency',
        metricName: 'Tempo de resposta p95 nas aprovações',
        targetValue: '<= 120ms',
        verificationMethod: 'Testes automatizados locais',
        evidenceStatus: 'verified',
      },
    ],
    externalSystems: [],
    journeys: [
      {
        id: 'jrn_portal',
        useCaseId: 'uc_submeter_solicitacao',
        screenId: 'screen_solicitacoes',
        actionLabel: 'Submeter Solicitação',
        operationId: 'op_submeter_solicitacao',
      },
    ],
  };

  return createCompletedModelingFromDraft(draft);
}

/**
 * Garante que qualquer grafo possua uma estrutura AppModeling inicializada.
 * Se o projeto ainda não tiver `appModeling`, cria uma proposta a partir dos blocos/dados existentes
 * sem alterar automaticamente blocos manuais (Seção 9).
 */
export function ensureAppModeling(graph: Graph): AppModeling {
  if (graph.appModeling && graph.appModeling.draft) {
    return graph.appModeling;
  }

  const nameLower = (graph.name || '').toLowerCase();
  if (nameLower.includes('tarefa') || nameLower.includes('task')) {
    return createTasksReferenceModeling();
  }
  if (
    nameLower.includes('catálogo') ||
    nameLower.includes('catalogo') ||
    nameLower.includes('produto') ||
    nameLower.includes('store')
  ) {
    return createStoreReferenceModeling();
  }
  if (
    nameLower.includes('mural') ||
    nameLower.includes('publicaç') ||
    nameLower.includes('publicac') ||
    nameLower.includes('social')
  ) {
    return createSocialReferenceModeling();
  }
  if (
    nameLower.includes('conflito') ||
    nameLower.includes('agendamento') ||
    nameLower.includes('sala') ||
    nameLower.includes('agenda')
  ) {
    return createSchedulingReferenceModeling();
  }
  if (
    nameLower.includes('portal de aprovação') ||
    graph.nodes?.some((n) => n.data?.config?.name === 'solicitacoes')
  ) {
    return createRoleApprovalReferenceModeling();
  }
  if (
    nameLower.includes('pedido') ||
    nameLower.includes('cliente') ||
    graph.nodes?.some((n) => n.data?.config?.name === 'pedidos')
  ) {
    return createOrderApprovalReferenceModeling();
  }

  const ref = createOrderApprovalReferenceModeling();
  const dataModel = ensureDataModelFromGraph(graph);
  const firstTable = dataModel.entities[0]?.name || 'itens';

  const draft: AppSpecification = {
    ...ref.draft,
    vision: {
      ...ref.draft.vision,
      problemStatement: `Especificação arquitetural e regras de negócio para o aplicativo "${graph.name}".`,
    },
    entityGovernance: dataModel.entities.map((e) => ({
      entityId: e.id,
      tableName: e.name,
      ownerField: 'owner_id',
      organizationField: 'org_id',
      isolationScope: 'organization',
    })),
    lifecycles: [
      {
        ...ref.draft.lifecycles[0],
        targetEntity: firstTable,
      },
    ],
    operations: ref.draft.operations.map((op) => ({
      ...op,
      targetEntity: firstTable,
    })),
  };

  return {
    schemaVersion: APP_MODELING_SCHEMA_VERSION,
    draft,
    applied: null,
    steps: MODELING_STEPS.map((m) => ({
      stepId: m.id,
      fillStatus: m.id === 'data' && dataModel.entities.length > 0 ? 'editing' : 'not_started',
    })),
    generation: {
      generatorVersion: APP_MODELING_GENERATOR_VERSION,
      appliedRevision: 0,
      specSemanticHash: computeSemanticHash(draft),
      artifacts: [],
    },
  };
}
