export const guardsSource = String.raw`export const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const pairs = (value) => Array.isArray(value) && value.every((row) => object(row) && typeof row.key === 'string' && typeof row.value === 'string');
`;
