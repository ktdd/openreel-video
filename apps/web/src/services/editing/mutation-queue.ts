/** Shared mutation ordering for manual transactions and temporary agent adapters. */
let pending: Promise<unknown> = Promise.resolve();
export function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}
