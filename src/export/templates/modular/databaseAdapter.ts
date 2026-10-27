export const databaseAdapterSource = `export class MockDatabaseAdapter {
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


`;
