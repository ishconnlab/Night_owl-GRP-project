import { useCallback, useEffect, useState } from 'react';

/**
 * Small async data hook shared by the storefront and dashboard pages: one place
 * for loading, error and reload behaviour.
 */
export function useAsync(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, isLoading, reload: run };
}