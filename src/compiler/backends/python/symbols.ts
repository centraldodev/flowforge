/**
 * Tabela de símbolos para geração segura de identificadores Python.
 * Evita colisões, sanitiza caracteres especiais e protege palavras reservadas da linguagem.
 */

const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

const PYTHON_BUILTINS = new Set([
  'id',
  'type',
  'print',
  'list',
  'dict',
  'set',
  'str',
  'int',
  'float',
  'bool',
  'len',
  'range',
  'input',
  'open',
  'format',
  'dir',
  'all',
  'any',
  'sum',
  'min',
  'max',
  'map',
  'filter',
  'zip',
]);

export class PythonSymbolTable {
  private readonly assigned = new Map<string, string>();
  private readonly used = new Set<string>();

  constructor() {
    for (const kw of PYTHON_KEYWORDS) {
      this.used.add(kw);
    }
  }

  /**
   * Sanitiza uma string bruta para formato válido de identificador Python [a-zA-Z_][a-zA-Z0-9_]*
   */
  sanitize(raw: string): string {
    const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleaned || /^[0-9]/.test(cleaned)) {
      return `_${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Obtém ou aloca um identificador Python único e determinístico para uma chave.
   */
  getIdentifier(key: string): string {
    const existing = this.assigned.get(key);
    if (existing) {
      return existing;
    }

    let base = this.sanitize(key);

    if (PYTHON_KEYWORDS.has(base) || PYTHON_BUILTINS.has(base)) {
      base = `_${base}`;
    }

    let candidate = base;
    let counter = 1;

    while (this.used.has(candidate)) {
      counter += 1;
      candidate = `${base}_${counter}`;
    }

    this.assigned.set(key, candidate);
    this.used.add(candidate);
    return candidate;
  }

  /**
   * Cria um identificador temporário único.
   */
  createTemp(prefix = 'tmp'): string {
    let counter = 1;
    let candidate = `${prefix}_${counter}`;
    while (this.used.has(candidate)) {
      counter += 1;
      candidate = `${prefix}_${counter}`;
    }
    this.used.add(candidate);
    return candidate;
  }
}
