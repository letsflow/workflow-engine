export function clean<T extends Record<string, any>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([_, v]) => v !== undefined)) as T;
}
