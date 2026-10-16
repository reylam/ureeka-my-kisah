import { useEffect, useRef, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';

/**
 * Fetch-once-then-stay-live.
 *
 * The first read goes through the mock API, which is where a real HTTP request
 * would sit. That call is genuinely async, so the page can show a skeleton.
 * After it resolves, the hook subscribes to the data store and recomputes
 * synchronously whenever records change. That means an edit made elsewhere in
 * the app is reflected immediately, without a second spinner.
 *
 * `recompute` must be a cheap, synchronous read of the current store state.
 */
export function useStoreQuery<T>(
  fetcher: () => Promise<T>,
  recompute: () => T,
  deps: readonly unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keep the latest callbacks without making them part of the effect's deps.
  const fetcherRef = useRef(fetcher);
  const recomputeRef = useRef(recompute);
  fetcherRef.current = fetcher;
  recomputeRef.current = recompute;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Data ini gagal dimuat.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  // Live updates once the initial read has landed.
  useEffect(() => {
    if (loading) return undefined;
    return useDataStore.subscribe(() => {
      setData(recomputeRef.current());
    });
  }, [loading]);

  return {
    data,
    loading,
    error,
    refetch: () => setNonce((n) => n + 1),
  };
}
