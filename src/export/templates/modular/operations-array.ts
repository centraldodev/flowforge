export const arrayOperationsSource = `export const operations = {
  array_create(i) {
    if (Array.isArray(i)) return [...i];
    if (i !== undefined && i !== null && i !== "") return [i];
    return [];
  }
};
`;
