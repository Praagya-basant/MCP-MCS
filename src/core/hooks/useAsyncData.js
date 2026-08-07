import { useCallback, useEffect, useState } from 'react';

/**
 * Standardizes the fetch/loading/error/reload dance used by every
 * data-driven page in the app, so pages only supply an async fetcher.
 * `setData` is exposed for optimistic local updates (e.g. after a
 * checkout, patch the row in place instead of refetching everything).
 */
export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
