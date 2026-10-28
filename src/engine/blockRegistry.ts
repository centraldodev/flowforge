import { catalog, simulatedKinds } from './catalog';
import { fieldsFor, type FieldSpec } from './blockFields';
import { getBlockPortDefinitions } from './ports';
import type { Block, BlockDefinition, Kind } from './types';
import { logicDefinition, selectedLogicVersion } from './catalogo/logicCatalog';

export type BlockTarget = 'typescript' | 'python';
export type PropertyUsage = 'runtime' | 'editor' | 'legacy' | 'unsupported';
export type BlockProperty = FieldSpec & { usage: PropertyUsage; note?: string };
export type BlockContract = {
  kind: Kind;
  version: 1;
  definition: BlockDefinition;
  execution: 'client' | 'server';
  integration: 'none' | 'simulated' | 'http' | 'database' | 'auth' | 'integrations';
  targets: Record<BlockTarget, 'supported' | 'limited'>;
  properties: BlockProperty[];
  ports: typeof getBlockPortDefinitions;
};

// Campos que a interface oferece, mas que não têm implementação no compilador atual.
const unsupported: Partial<Record<Kind, string[]>> = {
  auth: ['clientId', 'mockToken'],
  error: ['type'],
  switch: ['cases', 'defaultCase'],
  validator: ['message'],
};

function property(kind: Kind, field: FieldSpec): BlockProperty {
  if (['screenId', 'flowId', 'connectionId'].includes(field.key))
    return { ...field, usage: 'editor' };
  if (field.key === 'code')
    return {
      ...field,
      usage: 'legacy',
      note: 'Código legado; não é uma operação visual portável.',
    };
  if (unsupported[kind]?.includes(field.key))
    return {
      ...field,
      usage: 'unsupported',
      note: 'Esta propriedade ainda não é aplicada pelo compilador semântico.',
    };
  return { ...field, usage: 'runtime' };
}

/** Registro comum à biblioteca, painel, diagnósticos e ferramentas de compatibilidade. */
export const blockRegistry = Object.fromEntries(
  (Object.keys(catalog) as Kind[]).map((kind) => [
    kind,
    {
      kind,
      version: 1,
      definition: catalog[kind],
      execution: [
        'httpConnection',
        'postgresConnection',
        'entity',
        'identityProvider',
        'policy',
        'storage',
        'email',
        'webhook',
        'task',
        'payment',
        'realtime',
      ].includes(kind)
        ? 'server'
        : 'client',
      integration:
        kind === 'httpConnection' || kind === 'api'
          ? 'http'
          : kind === 'postgresConnection' || kind === 'entity' || kind === 'database'
            ? 'database'
            : kind === 'identityProvider' || kind === 'policy'
              ? 'auth'
              : ['storage', 'email', 'webhook', 'task', 'payment', 'realtime'].includes(kind)
                ? 'integrations'
                : simulatedKinds.includes(kind)
                  ? 'simulated'
                  : 'none',
      targets: {
        typescript: 'supported',
        python: [
          'function',
          'api',
          'httpConnection',
          'postgresConnection',
          'entity',
          'identityProvider',
          'policy',
          'storage',
          'email',
          'webhook',
          'task',
          'payment',
          'realtime',
        ].includes(kind)
          ? 'limited'
          : 'supported',
      },
      properties: fieldsFor(kind).map((field) => property(kind, field)),
      ports: getBlockPortDefinitions,
    },
  ]),
) as Record<Kind, BlockContract>;

export type ContractIssue = { code: string; message: string; field?: string };

export function validateBlockContract(block: Block): ContractIssue[] {
  const contract = blockRegistry[block.data.kind];
  if (!contract) return [];
  const version = block.data.contractVersion ?? 1;
  if (version !== contract.version)
    return [
      {
        code: 'UNSUPPORTED_BLOCK_VERSION',
        message: `Bloco "${block.data.label}" usa versão ${version}; versão suportada: ${contract.version}.`,
      },
    ];
  const logicKind =
    block.data.kind === 'condition' || block.data.kind === 'validator'
      ? block.data.kind
      : undefined;
  let logicOptions: { value: string; label: string }[] | undefined;
  if (logicKind) {
    try {
      logicOptions = logicDefinition(logicKind, selectedLogicVersion(block.data.config)).options;
    } catch {
      return [
        {
          code: 'MISSING_CATALOG_VERSION',
          message: `Bloco "${block.data.label}": versão do catálogo indisponível ou incompatível.`,
        },
      ];
    }
  }
  const invalidOptions: ContractIssue[] = contract.properties
    .filter((field) => {
      const value = block.data.config[field.key];
      const options =
        logicKind && field.key === (logicKind === 'condition' ? 'operator' : 'rule')
          ? logicOptions
          : field.options;
      // Projetos legados usam field também como nome da variável, não apenas tipo visual.
      if (block.data.kind === 'input' && field.key === 'field') return false;
      return (
        value &&
        Array.isArray(options) &&
        !options.some((option) => option.value === value) &&
        (!field.visible || field.visible(block.data.config))
      );
    })
    .map((field) => ({
      code: 'INVALID_BLOCK_OPTION',
      field: field.key,
      message: `Bloco "${block.data.label}": selecione uma opção válida para ${field.label}.`,
    }));
  return [
    ...invalidOptions,
    ...contract.properties
      .filter(
        (field) =>
          field.usage === 'unsupported' &&
          block.data.config[field.key] &&
          (!field.visible || field.visible(block.data.config)),
      )
      .map((field) => ({
        code: 'UNSUPPORTED_BLOCK_PROPERTY',
        field: field.key,
        message: `Bloco "${block.data.label}": ${field.label} ainda não é aplicado na execução. Remova o valor ou use uma configuração suportada.`,
      })),
  ];
}
