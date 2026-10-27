export const mathOperationsSource = `export const operations = {
  math_add(a, b) { return (Number(a) || 0) + (Number(b) || 0); },
  math_sub(a, b) { return (Number(a) || 0) - (Number(b) || 0); },
  math_mul(a, b) { return (Number(a) || 0) * (Number(b) || 0); },
  math_div(a, b) { const d = Number(b) || 0; return d !== 0 ? (Number(a) || 0) / d : 0; },
  math_mod(a, b) { const d = Number(b) || 0; return d !== 0 ? (Number(a) || 0) % d : 0; },
  math_pow(a, b) { return Math.pow(Number(a) || 0, Number(b) || 0); },
  math_round(a) { return Math.round(Number(a) || 0); },
  math_abs(a) { return Math.abs(Number(a) || 0); },

};
`;
