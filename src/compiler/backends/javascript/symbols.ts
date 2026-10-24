/** Palavras reservadas da linguagem JavaScript / TypeScript */
export const JS_RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'enum',
  'await',
  'async',
  'package',
  'private',
  'protected',
  'public',
  'interface',
  'implements',
  'null',
  'true',
  'false',
  'NaN',
  'Infinity',
  'undefined',
]);

/** Tabela de símbolos que converte nomes brutos em identificadores válidos sem colisões */
export class SymbolTable {
  private symbols = new Map<string, string>();
  private used = new Set<string>();

  getIdentifier(rawName: string): string {
    if (this.symbols.has(rawName)) {
      return this.symbols.get(rawName)!;
    }

    let sanitized = rawName.replace(/[^a-zA-Z0-9_$]/g, '_');
    if (!/^[a-zA-Z_$]/.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }

    let candidate = sanitized;
    if (JS_RESERVED_WORDS.has(candidate)) {
      candidate = `_${candidate}`;
    }

    let finalName = candidate;
    let counter = 1;
    while (this.used.has(finalName)) {
      finalName = `${candidate}_${counter++}`;
    }

    this.used.add(finalName);
    this.symbols.set(rawName, finalName);
    return finalName;
  }
}
