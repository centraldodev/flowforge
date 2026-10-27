export const textOperationsSource = `export const operations = {
  text_concat(a, b) { return String(a ?? "") + String(b ?? ""); },
  text_upper(a) { return String(a ?? "").toUpperCase(); },
  text_lower(a) { return String(a ?? "").toLowerCase(); },
  text_trim(a) { return String(a ?? "").trim(); },
  text_split(a, sep) { return String(a ?? "").split(String(sep ?? ",")); },
  text_replace(a, s, r) { return String(a ?? "").split(String(s ?? "")).join(String(r ?? "")); },

};
`;
