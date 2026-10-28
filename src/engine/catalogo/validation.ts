export type LogicKind = 'condition' | 'validator';
type LogicOption = { value: string; label: string; operation: string };
export type LogicDefinition = {
  id: LogicKind;
  version: number;
  operationField: string;
  defaultOperation: string;
  options: LogicOption[];
};

// O catálogo fornece dados; somente operações explicitamente implementadas podem ser selecionadas.
const supported: Record<LogicKind, Record<string, string>> = {
  condition: {
    truthy: 'truthy',
    equals: 'eq',
    not_equals: 'neq',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    contains: 'contains',
  },
  validator: {
    required: 'validate_required',
    email: 'validate_email',
    minLength: 'validate_minLength',
    maxLength: 'validate_maxLength',
    numeric: 'validate_numeric',
    cpf: 'validate_cpf',
    cnpj: 'validate_cnpj',
    phone: 'validate_phone',
    matchField: 'validate_matchField',
    regex: 'validate_regex',
  },
};

export function validateLogicCatalog(
  value: unknown,
  options: { complete?: boolean } = {},
): LogicDefinition[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('definitions' in value) ||
    !Array.isArray(value.definitions)
  )
    throw new Error('Catálogo de lógica inválido ou versão não suportada.');
  const seen = new Set<string>();
  const result: LogicDefinition[] = [];
  for (const item of value.definitions as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('id' in item) ||
      (item.id !== 'condition' && item.id !== 'validator')
    )
      throw new Error('Definição de bloco não suportada.');
    const definition = item as LogicDefinition;
    if (
      seen.has(definition.id) ||
      !Number.isSafeInteger(definition.version) ||
      definition.version < 1 ||
      definition.operationField !== (definition.id === 'condition' ? 'operator' : 'rule') ||
      !Array.isArray(definition.options) ||
      !definition.options.length ||
      definition.options.length > 256
    )
      throw new Error('Definição de bloco inválida.');
    seen.add(definition.id);
    const names = new Set<string>();
    for (const option of definition.options) {
      if (
        !option ||
        typeof option.value !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(option.value) ||
        typeof option.label !== 'string' ||
        !option.label.trim() ||
        option.label.length > 200 ||
        option.value.length > 100 ||
        names.has(option.value) ||
        !Object.values(supported[definition.id]).includes(option.operation)
      )
        throw new Error('Operação do catálogo não suportada.');
      names.add(option.value);
    }
    if (!names.has(definition.defaultOperation)) throw new Error('Operação padrão ausente.');
    result.push({
      id: definition.id,
      version: definition.version,
      operationField: definition.operationField,
      defaultOperation: definition.defaultOperation,
      options: definition.options.map((option) => ({
        value: option.value,
        label: option.label,
        operation: option.operation,
      })),
    });
  }
  if (options.complete !== false && seen.size !== Object.keys(supported).length)
    throw new Error('Catálogo de lógica incompleto.');
  return result;
}
