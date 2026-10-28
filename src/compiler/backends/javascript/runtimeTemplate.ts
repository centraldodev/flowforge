/**
 * Código de runtime leve embutido no arquivo gerado pelo backend JavaScript.
 */
export const EMBEDDED_RUNTIME = `
const DEMO_USER = { email: "demo@exemplo.com", password: "123456", nome: "Usuário Demo" };

class MockAuthAdapter {
  async execute(action, payload, context) {
    let email = String(payload.email || "");
    let password = String(payload.password || "");

    if (!email) {
      const emailKey = Object.keys(context.inputs).find((k) => k.toLowerCase().includes("email"));
      if (emailKey) email = String(context.inputs[emailKey] ?? "");
    }
    if (!password) {
      const passKey = Object.keys(context.inputs).find(
        (k) => k.toLowerCase().includes("senha") || k.toLowerCase().includes("password")
      );
      if (passKey) password = String(context.inputs[passKey] ?? "");
    }

    const dbTable = "usuarios";
    const dbRows = (context.store[dbTable] ??= [
      { id: 1, ...DEMO_USER, senha: DEMO_USER.password, provider: "email" }
    ]);

    if (action === "google") {
      const googleEmail = "google.teste@gmail.com";
      const mockToken = "ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE";
      const googleUser = { id: 2, nome: "Google Teste", email: googleEmail, provider: "google", token: mockToken };
      const existing = dbRows.find((u) => u.email === googleEmail);
      if (existing) {
        existing.token = mockToken;
        existing.provider = "google";
      } else {
        dbRows.push(googleUser);
      }
      context.store.__session = [googleUser];
      return googleUser;
    }

    if (action === "register") {
      const exists = dbRows.some((u) => u.email === email);
      if (exists) {
        delete context.store.__session;
        throw new Error("E-mail já cadastrado no banco de dados");
      }
      if (!email.includes("@") || password.length < 6) {
        delete context.store.__session;
        throw new Error("Use e-mail válido e senha com 6 caracteres");
      }
      const newUser = { id: dbRows.length + 1, nome: email.split("@")[0], email, senha: password, provider: "email" };
      dbRows.push(newUser);
      context.store.__session = [newUser];
      return newUser;
    }

    const userInDb = dbRows.find((u) => u.email === email && (u.senha === password || u.password === password));
    if (userInDb) {
      context.store.__session = [userInDb];
      return userInDb;
    }
    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      context.store.__session = [DEMO_USER];
      return DEMO_USER;
    }

    delete context.store.__session;
    throw new Error("E-mail ou senha incorretos");
  }
}

class MockDatabaseAdapter {
  async execute(action, payload, context) {
    const table = String(payload.table || "itens");
    const rows = (context.store[table] ??= []);

    if (rows.length === 0 && payload.mock) {
      if (typeof payload.mock === "string") {
        try {
          const parsed = JSON.parse(payload.mock);
          if (Array.isArray(parsed)) rows.push(...parsed);
        } catch {}
      } else if (Array.isArray(payload.mock)) {
        rows.push(...payload.mock);
      }
    }

    const op = String(payload.operation || action || "query").toLowerCase();

    if (op === "insert") {
      let rawData = payload.data ?? payload.user ?? payload.value;
      if (typeof rawData === "string" && rawData.trim().startsWith("{")) {
        try { rawData = JSON.parse(rawData); } catch {}
      }
      const record = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? { ...rawData } : { value: rawData };
      if (record.id === undefined || record.id === null || record.id === "") {
        const maxId = rows.reduce((max, r) => {
          const num = Number(r.id);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        record.id = maxId + 1;
      }
      rows.push(record);
      context.variables["value"] = record;
      context.outputs["value"] = record;
      return record;
    }

    if (op === "get") {
      const targetId = payload.id !== undefined && payload.id !== "" ? payload.id : (payload.data && typeof payload.data === "object" ? payload.data.id : undefined);
      let found;
      if (targetId !== undefined) {
        found = rows.find((r) => r.id === targetId || String(r.id) === String(targetId));
      } else if (payload.filter && typeof payload.filter === "object") {
        found = rows.find((r) => Object.entries(payload.filter).every(([k, v]) => r[k] === v || String(r[k]) === String(v)));
      }
      if (!found) throw new Error(\`Registro com ID "\${targetId}" não encontrado na tabela "\${table}".\`);
      context.variables["value"] = found;
      context.outputs["value"] = found;
      return found;
    }

    if (op === "update") {
      let rawUpdates = payload.data ?? payload.value;
      if (typeof rawUpdates === "string" && rawUpdates.trim().startsWith("{")) {
        try { rawUpdates = JSON.parse(rawUpdates); } catch {}
      }
      const updates = rawUpdates && typeof rawUpdates === "object" && !Array.isArray(rawUpdates) ? rawUpdates : {};
      const targetId = payload.id !== undefined && payload.id !== "" ? payload.id : updates.id;
      const idx = rows.findIndex((r) => r.id === targetId || String(r.id) === String(targetId));
      if (idx === -1) throw new Error(\`Registro com ID "\${targetId}" não encontrado para atualização na tabela "\${table}".\`);
      const updated = { ...rows[idx], ...updates, id: rows[idx].id };
      rows[idx] = updated;
      context.variables["value"] = updated;
      context.outputs["value"] = updated;
      return updated;
    }

    if (op === "delete") {
      const targetId = payload.id !== undefined && payload.id !== "" ? payload.id : (payload.data && typeof payload.data === "object" ? payload.data.id : undefined);
      const idx = rows.findIndex((r) => r.id === targetId || String(r.id) === String(targetId));
      if (idx === -1) throw new Error(\`Registro com ID "\${targetId}" não encontrado para exclusão na tabela "\${table}".\`);
      const [deleted] = rows.splice(idx, 1);
      const res = { success: true, id: targetId, deletedCount: 1, item: deleted };
      context.variables["value"] = res;
      context.outputs["value"] = res;
      context.variables["deletedCount"] = 1;
      context.outputs["deletedCount"] = 1;
      return res;
    }

    // Query
    let filtered = [...rows];
    if (payload.filter) {
      if (Array.isArray(payload.filter)) {
        for (const f of payload.filter) {
          filtered = filtered.filter((r) => {
            const val = r[f.field];
            switch (f.op) {
              case "eq": return val === f.value || String(val) === String(f.value);
              case "neq": return val !== f.value && String(val) !== String(f.value);
              case "gt": return (Number(val) || 0) > (Number(f.value) || 0);
              case "gte": return (Number(val) || 0) >= (Number(f.value) || 0);
              case "lt": return (Number(val) || 0) < (Number(f.value) || 0);
              case "lte": return (Number(val) || 0) <= (Number(f.value) || 0);
              case "contains": return String(val ?? "").toLowerCase().includes(String(f.value ?? "").toLowerCase());
              default: return val === f.value || String(val) === String(f.value);
            }
          });
        }
      } else if (typeof payload.filter === "object") {
        filtered = filtered.filter((r) =>
          Object.entries(payload.filter).every(([k, v]) => {
            if (v === undefined || v === null || v === "") return true;
            return r[k] === v || String(r[k] ?? "").toLowerCase() === String(v).toLowerCase();
          })
        );
      }
    }

    if (payload.orderBy && typeof payload.orderBy === "string") {
      const orderField = payload.orderBy;
      const desc = payload.orderDirection === "desc";
      filtered.sort((a, b) => {
        const va = a[orderField] ?? "";
        const vb = b[orderField] ?? "";
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return desc ? nb - na : na - nb;
        return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
      });
    }

    const total = filtered.length;
    const offset = Number(payload.offset) || 0;
    const limit = Number(payload.limit) || 0;
    let paged = filtered;
    if (limit > 0) paged = filtered.slice(offset, offset + limit);
    else if (offset > 0) paged = filtered.slice(offset);

    context.variables["total"] = total;
    context.outputs["total"] = total;
    context.variables["value"] = paged;
    context.outputs["value"] = paged;
    return paged;
  }
}


class MockApiAdapter {
  async execute(action, payload, context) {
    if (payload.mode === 'real') {
      const response = await fetch('/__flowforge/http', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: context.signal,
        body: JSON.stringify({ id: payload.blockId, body: payload.body, query: payload.query })
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Backend HTTP indisponível. Inicie o servidor do projeto exportado.');
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Falha na integração HTTP.'), { code: result.error?.code, status: result.error?.status });
      return result;
    }
    if (payload.mock && typeof payload.mock === "string") {
      try {
        return JSON.parse(payload.mock);
      } catch {}
    }
    return { ok: true, status: 200, data: payload.body ?? null };
  }
}

class MockDelayAdapter {
  constructor(fast = false) {
    this.fast = fast;
  }
  async execute(durationMs, signal) {
    if (signal?.aborted) throw new Error("Operação cancelada antes do delay.");
    if (this.fast || durationMs <= 0) {
      await Promise.resolve();
      return;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, durationMs);
      const onAbort = () => {
        cleanup();
        reject(new Error("Execução cancelada durante delay."));
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      signal?.addEventListener("abort", onAbort);
    });
  }
}

const BUILTIN_OPERATIONS = {
  validate_required(v) {
    return v !== null && v !== undefined && String(v).trim().length > 0;
  },
  validate_email(v) {
    return v !== null && v !== undefined && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v).trim());
  },
  validate_minLength(v, p) {
    return String(v ?? "").length >= (Number(p) || 6);
  },
  validate_maxLength(v, p) {
    return String(v ?? "").length <= (Number(p) || 100);
  },
  validate_numeric(v) {
    return v !== null && v !== undefined && !Number.isNaN(Number(v)) && String(v).trim() !== "";
  },
  validate_cpf(v) {
    const clean = String(v ?? "").replace(/\\D/g, "");
    return clean.length === 11 && !/^(\\d)\\1{10}$/.test(clean);
  },
  validate_regex(v, p) {
    try {
      return new RegExp(String(p || ".*")).test(String(v ?? ""));
    } catch {
      return false;
    }
  },
  math_add(a, b) { return (Number(a) || 0) + (Number(b) || 0); },
  math_sub(a, b) { return (Number(a) || 0) - (Number(b) || 0); },
  math_mul(a, b) { return (Number(a) || 0) * (Number(b) || 0); },
  math_div(a, b) { const d = Number(b) || 0; return d !== 0 ? (Number(a) || 0) / d : 0; },
  math_mod(a, b) { const d = Number(b) || 0; return d !== 0 ? (Number(a) || 0) % d : 0; },
  math_pow(a, b) { return Math.pow(Number(a) || 0, Number(b) || 0); },
  math_round(a) { return Math.round(Number(a) || 0); },
  math_abs(a) { return Math.abs(Number(a) || 0); },
  text_concat(a, b) { return String(a ?? "") + String(b ?? ""); },
  text_upper(a) { return String(a ?? "").toUpperCase(); },
  text_lower(a) { return String(a ?? "").toLowerCase(); },
  text_trim(a) { return String(a ?? "").trim(); },
  text_split(a, sep) { return String(a ?? "").split(String(sep ?? ",")); },
  text_replace(a, s, r) { return String(a ?? "").split(String(s ?? "")).join(String(r ?? "")); },
  object_from_fields(...values) { const result = Object.create(null); for (let i = 0; i + 1 < values.length; i += 2) result[String(values[i])] = values[i + 1]; return result; },
  object_create(d) {
    if (typeof d === "object" && d !== null && !Array.isArray(d)) return { ...d };
    if (typeof d === "string" && d.trim().startsWith("{")) {
      try { const p = JSON.parse(d); if (typeof p === "object" && p !== null) return p; } catch {}
    }
    return { value: d };
  },
  array_create(i) {
    if (Array.isArray(i)) return [...i];
    if (i !== undefined && i !== null && i !== "") return [i];
    return [];
  }
};

export function createRuntimeContext(init = {}) {
  return {
    inputs: init.inputs ? { ...init.inputs } : {},
    store: init.store ?? {},
    variables: init.variables ? { ...init.variables } : {},
    screen: init.screen,
    outputs: init.outputs ? { ...init.outputs } : {},
    notifications: init.notifications ? [...init.notifications] : [],
    logs: init.logs ? [...init.logs] : [],
    trace: init.trace ? [...init.trace] : [],
    stepCount: 0,
    maxSteps: init.maxSteps ?? 100,
    signal: init.signal,
    adapters: init.adapters ?? {
      auth: new MockAuthAdapter(),
      api: new MockApiAdapter(),
      database: new MockDatabaseAdapter(),
      delay: new MockDelayAdapter(init.fastDelay ?? false)
    }
  };
}
`;
