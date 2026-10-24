/**
 * AST minimalista e segura para emissão do backend JavaScript/TypeScript.
 */

export function safeLiteral(val: unknown): string {
  if (val === undefined) return 'undefined';
  return JSON.stringify(val);
}

export type JSExpr =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'call'; callee: JSExpr; args: JSExpr[]; isAwait?: boolean }
  | { type: 'unary'; op: string; expr: JSExpr }
  | { type: 'binary'; op: string; left: JSExpr; right: JSExpr }
  | { type: 'member'; object: JSExpr; property: string; computed?: boolean }
  | { type: 'object'; properties: Record<string, JSExpr> }
  | { type: 'array'; items: JSExpr[] }
  | { type: 'raw'; code: string; isAwait?: boolean };

export type JSStmt =
  | { type: 'variable_decl'; kind: 'const' | 'let'; name: string; value?: JSExpr }
  | { type: 'assignment'; target: string; value: JSExpr }
  | { type: 'expression_stmt'; expr: JSExpr }
  | { type: 'return'; value?: JSExpr }
  | { type: 'if'; condition: JSExpr; thenBranch: JSStmt[]; elseBranch?: JSStmt[] }
  | {
      type: 'switch';
      expr: JSExpr;
      cases: { value: JSExpr; statements: JSStmt[] }[];
      defaultBranch?: JSStmt[];
    }
  | { type: 'try_catch'; body: JSStmt[]; catchVar?: string; catchBranch: JSStmt[] }
  | {
      type: 'function_decl';
      name: string;
      params: string[];
      body: JSStmt[];
      isAsync?: boolean;
      isExported?: boolean;
    }
  | { type: 'comment'; text: string }
  | { type: 'raw'; code: string };

export function emitExpr(expr: JSExpr): string {
  switch (expr.type) {
    case 'literal':
      return safeLiteral(expr.value);

    case 'identifier':
      return expr.name;

    case 'call': {
      const calleeCode = emitExpr(expr.callee);
      const argsCode = expr.args.map(emitExpr).join(', ');
      const callStr = `${calleeCode}(${argsCode})`;
      return expr.isAwait ? `await ${callStr}` : callStr;
    }

    case 'unary':
      return `${expr.op}(${emitExpr(expr.expr)})`;

    case 'binary':
      return `(${emitExpr(expr.left)} ${expr.op} ${emitExpr(expr.right)})`;

    case 'member': {
      const obj = emitExpr(expr.object);
      if (expr.computed) {
        return `${obj}[${expr.property}]`;
      }
      return `${obj}.${expr.property}`;
    }

    case 'object': {
      const props = Object.entries(expr.properties).map(
        ([k, v]) => `${JSON.stringify(k)}: ${emitExpr(v)}`,
      );
      return `{ ${props.join(', ')} }`;
    }

    case 'array': {
      const items = expr.items.map(emitExpr).join(', ');
      return `[${items}]`;
    }

    case 'raw':
      return expr.isAwait ? `await (${expr.code})` : expr.code;
  }
}

export function emitStmt(stmt: JSStmt, indent = 0): string {
  const pad = '  '.repeat(indent);

  switch (stmt.type) {
    case 'comment':
      return `${pad}// ${stmt.text}`;

    case 'variable_decl':
      if (stmt.value) {
        return `${pad}${stmt.kind} ${stmt.name} = ${emitExpr(stmt.value)};`;
      }
      return `${pad}${stmt.kind} ${stmt.name};`;

    case 'assignment':
      return `${pad}${stmt.target} = ${emitExpr(stmt.value)};`;

    case 'expression_stmt':
      return `${pad}${emitExpr(stmt.expr)};`;

    case 'return':
      if (stmt.value) {
        return `${pad}return ${emitExpr(stmt.value)};`;
      }
      return `${pad}return;`;

    case 'if': {
      const cond = emitExpr(stmt.condition);
      const thenStmts = stmt.thenBranch.map((s) => emitStmt(s, indent + 1)).join('\n');
      let out = `${pad}if (${cond}) {\n${thenStmts}\n${pad}}`;
      if (stmt.elseBranch && stmt.elseBranch.length > 0) {
        const elseStmts = stmt.elseBranch.map((s) => emitStmt(s, indent + 1)).join('\n');
        out += ` else {\n${elseStmts}\n${pad}}`;
      }
      return out;
    }

    case 'switch': {
      const expr = emitExpr(stmt.expr);
      let out = `${pad}switch (${expr}) {\n`;
      for (const c of stmt.cases) {
        out += `${pad}  case ${emitExpr(c.value)}: {\n`;
        out += c.statements.map((s) => emitStmt(s, indent + 2)).join('\n');
        out += `\n${pad}    break;\n${pad}  }\n`;
      }
      if (stmt.defaultBranch && stmt.defaultBranch.length > 0) {
        out += `${pad}  default: {\n`;
        out += stmt.defaultBranch.map((s) => emitStmt(s, indent + 2)).join('\n');
        out += `\n${pad}    break;\n${pad}  }\n`;
      }
      out += `${pad}}`;
      return out;
    }

    case 'try_catch': {
      const bodyStmts = stmt.body.map((s) => emitStmt(s, indent + 1)).join('\n');
      const catchVar = stmt.catchVar || '_err';
      const catchStmts = stmt.catchBranch.map((s) => emitStmt(s, indent + 1)).join('\n');
      return `${pad}try {\n${bodyStmts}\n${pad}} catch (${catchVar}) {\n${catchStmts}\n${pad}}`;
    }

    case 'function_decl': {
      const prefix = `${stmt.isExported ? 'export ' : ''}${stmt.isAsync ? 'async ' : ''}function ${stmt.name}`;
      const params = stmt.params.join(', ');
      const body = stmt.body.map((s) => emitStmt(s, indent + 1)).join('\n');
      return `${pad}${prefix}(${params}) {\n${body}\n${pad}}`;
    }

    case 'raw':
      return `${pad}${stmt.code}`;
  }
}

export function emitProgram(stmts: JSStmt[]): string {
  return stmts.map((s) => emitStmt(s, 0)).join('\n\n');
}
