/**
 * Operações embutidas nativas do runtime FlowForge executadas de forma segura e estrita sem new Function.
 */

export function validate_required(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return str.length > 0;
}

export function validate_email(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export function validate_minLength(value: unknown, param: unknown): boolean {
  const min = Number(param) || 6;
  const str = String(value ?? '');
  return str.length >= min;
}

export function validate_maxLength(value: unknown, param: unknown): boolean {
  const max = Number(param) || 100;
  const str = String(value ?? '');
  return str.length <= max;
}

export function validate_numeric(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return !Number.isNaN(Number(str)) && str !== '';
}

export function validate_cpf(value: unknown): boolean {
  const cleanCpf = String(value ?? '').replace(/\D/g, '');
  return cleanCpf.length === 11 && !/^(\d)\1{10}$/.test(cleanCpf);
}

export function validate_cnpj(value: unknown): boolean {
  const cleanCnpj = String(value ?? '').replace(/\D/g, '');
  return cleanCnpj.length === 14 && !/^(\d)\1{13}$/.test(cleanCnpj);
}

export function validate_phone(value: unknown): boolean {
  const cleanPhone = String(value ?? '').replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 13;
}

export function validate_matchField(value: unknown, param: unknown): boolean {
  return String(value ?? '') === String(param ?? '');
}

export function validate_regex(value: unknown, pattern: unknown): boolean {
  try {
    const reg = new RegExp(String(pattern || '.*'));
    return reg.test(String(value ?? ''));
  } catch {
    return false;
  }
}

export function math_add(a: unknown, b: unknown): number {
  return (Number(a) || 0) + (Number(b) || 0);
}

export function math_sub(a: unknown, b: unknown): number {
  return (Number(a) || 0) - (Number(b) || 0);
}

export function math_mul(a: unknown, b: unknown): number {
  return (Number(a) || 0) * (Number(b) || 0);
}

export function math_div(a: unknown, b: unknown): number {
  const div = Number(b) || 0;
  return div !== 0 ? (Number(a) || 0) / div : 0;
}

export function math_mod(a: unknown, b: unknown): number {
  const mod = Number(b) || 0;
  return mod !== 0 ? (Number(a) || 0) % mod : 0;
}

export function math_pow(a: unknown, b: unknown): number {
  return Math.pow(Number(a) || 0, Number(b) || 0);
}

export function math_round(a: unknown): number {
  return Math.round(Number(a) || 0);
}

export function math_abs(a: unknown): number {
  return Math.abs(Number(a) || 0);
}

export function text_concat(a: unknown, b: unknown): string {
  return String(a ?? '') + String(b ?? '');
}

export function text_upper(a: unknown): string {
  return String(a ?? '').toUpperCase();
}

export function text_lower(a: unknown): string {
  return String(a ?? '').toLowerCase();
}

export function text_trim(a: unknown): string {
  return String(a ?? '').trim();
}

export function text_split(a: unknown, sep: unknown): string[] {
  return String(a ?? '').split(String(sep ?? ','));
}

export function text_replace(a: unknown, search: unknown, replacement: unknown): string {
  return String(a ?? '')
    .split(String(search ?? ''))
    .join(String(replacement ?? ''));
}

export function object_from_fields(...values: unknown[]): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (let i = 0; i + 1 < values.length; i += 2) result[String(values[i])] = values[i + 1];
  return result;
}

export function object_create(data: unknown): Record<string, unknown> {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>) };
  }
  if (typeof data === 'string' && data.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {
      return { value: data };
    }
  }
  return { value: data };
}

export function array_create(item: unknown): unknown[] {
  if (Array.isArray(item)) return [...item];
  if (item !== undefined && item !== null && item !== '') return [item];
  return [];
}

export const BUILTIN_OPERATIONS: Record<string, (...args: unknown[]) => unknown> = {
  validate_required,
  validate_email,
  validate_minLength,
  validate_maxLength,
  validate_numeric,
  validate_cpf,
  validate_cnpj,
  validate_phone,
  validate_matchField,
  validate_regex,
  math_add,
  math_sub,
  math_mul,
  math_div,
  math_mod,
  math_pow,
  math_round,
  math_abs,
  text_concat,
  text_upper,
  text_lower,
  text_trim,
  text_split,
  text_replace,
  object_create,
  object_from_fields,
  array_create,
};
