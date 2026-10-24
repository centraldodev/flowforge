/**
 * AST minimalista e emissor de código seguro para o backend Python.
 */

export type PyExpr =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'raw'; code: string }
  | { type: 'call'; callee: string; args: PyExpr[] }
  | { type: 'await_call'; callee: string; args: PyExpr[] }
  | { type: 'binary'; left: PyExpr; op: string; right: PyExpr }
  | { type: 'unary'; op: string; expr: PyExpr }
  | { type: 'dict'; entries: Array<[PyExpr, PyExpr]> }
  | { type: 'list'; items: PyExpr[] };

export type PyStmt =
  | { type: 'assign'; target: string; value: PyExpr }
  | { type: 'expr'; expr: PyExpr }
  | { type: 'return'; value?: PyExpr }
  | {
      type: 'if';
      condition: PyExpr;
      body: PyStmt[];
      elifBranches?: Array<{ condition: PyExpr; body: PyStmt[] }>;
      elseBody?: PyStmt[];
    }
  | {
      type: 'try';
      body: PyStmt[];
      handlers: Array<{ exceptionType?: string; varName?: string; body: PyStmt[] }>;
      finallyBody?: PyStmt[];
    }
  | { type: 'pass' }
  | { type: 'raw'; code: string }
  | {
      type: 'func_def';
      name: string;
      params: string[];
      isAsync: boolean;
      body: PyStmt[];
      decorator?: string;
    }
  | {
      type: 'class_def';
      name: string;
      bases?: string[];
      body: PyStmt[];
    };

/**
 * Emite literais Python com segurança rigorosa, sem risco de injeção de código.
 */
export function safeLiteral(val: unknown): string {
  if (val === null || val === undefined) {
    return 'None';
  }
  if (typeof val === 'boolean') {
    return val ? 'True' : 'False';
  }
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return "float('nan')";
    if (!Number.isFinite(val)) return val > 0 ? "float('inf')" : "float('-inf')";
    return String(val);
  }
  if (typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(safeLiteral).join(', ')}]`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>).map(
      ([k, v]) => `${safeLiteral(k)}: ${safeLiteral(v)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return JSON.stringify(String(val));
}

export { safeLiteral as safePythonLiteral };

/**
 * Emite uma expressão Python como string.
 */
export function emitExpr(expr: PyExpr): string {
  switch (expr.type) {
    case 'literal':
      return safeLiteral(expr.value);

    case 'identifier':
      return expr.name;

    case 'raw':
      return expr.code;

    case 'call': {
      const args = expr.args.map(emitExpr).join(', ');
      return `${expr.callee}(${args})`;
    }

    case 'await_call': {
      const args = expr.args.map(emitExpr).join(', ');
      return `await ${expr.callee}(${args})`;
    }

    case 'binary':
      return `(${emitExpr(expr.left)} ${expr.op} ${emitExpr(expr.right)})`;

    case 'unary':
      return `(${expr.op} ${emitExpr(expr.expr)})`;

    case 'dict': {
      const items = expr.entries.map(([k, v]) => `${emitExpr(k)}: ${emitExpr(v)}`).join(', ');
      return `{${items}}`;
    }

    case 'list': {
      const items = expr.items.map(emitExpr).join(', ');
      return `[${items}]`;
    }
  }
}

function indent(level: number): string {
  return '    '.repeat(level);
}

/**
 * Emite uma instrução Python respeitando a indentação por blocos.
 */
export function emitStmt(stmt: PyStmt, level = 0): string {
  const ind = indent(level);

  switch (stmt.type) {
    case 'assign':
      return `${ind}${stmt.target} = ${emitExpr(stmt.value)}`;

    case 'expr':
      return `${ind}${emitExpr(stmt.expr)}`;

    case 'return':
      return stmt.value ? `${ind}return ${emitExpr(stmt.value)}` : `${ind}return`;

    case 'pass':
      return `${ind}pass`;

    case 'raw': {
      const lines = stmt.code.split('\n');
      return lines.map((line) => (line.trim() ? `${ind}${line}` : '')).join('\n');
    }

    case 'if': {
      const out: string[] = [];
      out.push(`${ind}if ${emitExpr(stmt.condition)}:`);
      if (stmt.body.length === 0) {
        out.push(`${indent(level + 1)}pass`);
      } else {
        for (const child of stmt.body) {
          out.push(emitStmt(child, level + 1));
        }
      }

      if (stmt.elifBranches) {
        for (const branch of stmt.elifBranches) {
          out.push(`${ind}elif ${emitExpr(branch.condition)}:`);
          if (branch.body.length === 0) {
            out.push(`${indent(level + 1)}pass`);
          } else {
            for (const child of branch.body) {
              out.push(emitStmt(child, level + 1));
            }
          }
        }
      }

      if (stmt.elseBody) {
        out.push(`${ind}else:`);
        if (stmt.elseBody.length === 0) {
          out.push(`${indent(level + 1)}pass`);
        } else {
          for (const child of stmt.elseBody) {
            out.push(emitStmt(child, level + 1));
          }
        }
      }
      return out.join('\n');
    }

    case 'try': {
      const out: string[] = [];
      out.push(`${ind}try:`);
      if (stmt.body.length === 0) {
        out.push(`${indent(level + 1)}pass`);
      } else {
        for (const child of stmt.body) {
          out.push(emitStmt(child, level + 1));
        }
      }

      for (const handler of stmt.handlers) {
        const excType = handler.exceptionType ?? 'Exception';
        const asVar = handler.varName ? ` as ${handler.varName}` : '';
        out.push(`${ind}except ${excType}${asVar}:`);
        if (handler.body.length === 0) {
          out.push(`${indent(level + 1)}pass`);
        } else {
          for (const child of handler.body) {
            out.push(emitStmt(child, level + 1));
          }
        }
      }

      if (stmt.finallyBody) {
        out.push(`${ind}finally:`);
        if (stmt.finallyBody.length === 0) {
          out.push(`${indent(level + 1)}pass`);
        } else {
          for (const child of stmt.finallyBody) {
            out.push(emitStmt(child, level + 1));
          }
        }
      }
      return out.join('\n');
    }

    case 'func_def': {
      const out: string[] = [];
      if (stmt.decorator) {
        out.push(`${ind}@${stmt.decorator}`);
      }
      const prefix = stmt.isAsync ? 'async def' : 'def';
      const params = stmt.params.join(', ');
      out.push(`${ind}${prefix} ${stmt.name}(${params}):`);
      if (stmt.body.length === 0) {
        out.push(`${indent(level + 1)}pass`);
      } else {
        for (const child of stmt.body) {
          out.push(emitStmt(child, level + 1));
        }
      }
      return out.join('\n');
    }

    case 'class_def': {
      const out: string[] = [];
      const bases = stmt.bases && stmt.bases.length > 0 ? `(${stmt.bases.join(', ')})` : '';
      out.push(`${ind}class ${stmt.name}${bases}:`);
      if (stmt.body.length === 0) {
        out.push(`${indent(level + 1)}pass`);
      } else {
        for (const child of stmt.body) {
          out.push(emitStmt(child, level + 1));
        }
      }
      return out.join('\n');
    }
  }
}

/**
 * Emite uma lista de declarações/instruções Python no nível raiz do módulo.
 */
export function emitProgram(stmts: PyStmt[]): string {
  return stmts.map((stmt) => emitStmt(stmt, 0)).join('\n\n');
}
