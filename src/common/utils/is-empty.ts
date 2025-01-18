export function isEmpty(value: any): boolean {
  return (
    value === null ||
    value === '' ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}
