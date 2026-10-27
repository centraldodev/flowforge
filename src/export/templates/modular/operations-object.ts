export const objectOperationsSource = `export const operations = {
  object_create(d) {
    if (typeof d === "object" && d !== null && !Array.isArray(d)) return { ...d };
    if (typeof d === "string" && d.trim().startsWith("{")) {
      try { const p = JSON.parse(d); if (typeof p === "object" && p !== null) return p; } catch {}
    }
    return { value: d };
  },

};
`;
