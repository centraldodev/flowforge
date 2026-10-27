export const validateOperationsSource = `export const operations = {
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

};
`;
