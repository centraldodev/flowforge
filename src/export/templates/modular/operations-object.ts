export const objectOperationsSource = `export const operations = {
  object_from_fields(...values) { const result = Object.create(null); for (let i = 0; i + 1 < values.length; i += 2) result[String(values[i])] = values[i + 1]; return result; },
  object_create(d) {
    if (typeof d === "object" && d !== null && !Array.isArray(d)) return { ...d };
    if (typeof d === "string" && d.trim().startsWith("{")) {
      try { const p = JSON.parse(d); if (typeof p === "object" && p !== null) return p; } catch {}
    }
    return { value: d };
  },

};
`;
