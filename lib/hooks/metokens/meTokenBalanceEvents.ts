/** Lightweight pub/sub so trade flows can refresh portfolio holdings without prop drilling. */

type MeTokenBalanceListener = (address: string) => void;

const listeners = new Set<MeTokenBalanceListener>();

export function subscribeMeTokenBalancesChanged(listener: MeTokenBalanceListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMeTokenBalancesChanged(address: string): void {
  const normalized = address.toLowerCase();
  for (const listener of listeners) {
    try {
      listener(normalized);
    } catch {
      // ignore listener errors
    }
  }
}

/** Backoff poll after a trade so subgraph/indexer can catch up. */
export async function pollMeTokenBalanceRefresh(
  refresh: () => void | Promise<void>,
  delaysMs: number[] = [2000, 5000, 10000],
): Promise<void> {
  for (const delay of delaysMs) {
    await new Promise((r) => setTimeout(r, delay));
    await refresh();
  }
}
