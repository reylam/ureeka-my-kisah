/**
 * Clearing per-user state on sign-out.
 *
 * Every store that holds someone's records registers a reset here, so signing
 * out (or the server ending the session) leaves nothing of the previous
 * person in memory for the next one to see. Stores register themselves; the
 * auth store only calls `resetSession`, which keeps the import graph acyclic.
 */

const resetters = new Set<() => void>();

export function onSessionReset(reset: () => void): void {
  resetters.add(reset);
}

export function resetSession(): void {
  for (const reset of resetters) reset();
}
