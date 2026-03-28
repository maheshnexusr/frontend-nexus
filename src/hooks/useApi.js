/**
 * useApi — universal hook for API calls.
 *
 * Manages loading / error / data lifecycle for any service function.
 * Keeps all async logic out of components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE PATTERNS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Manual trigger (forms, button clicks):
 *
 *    const { execute, loading, error } = useApi(authService.login);
 *    const handleSubmit = async () => {
 *      const user = await execute({ email, password });
 *    };
 *
 * 2. Auto-fetch on mount (data lists, detail pages):
 *
 *    const { data, loading } = useApi(sponsorService.list, {
 *      immediate: true,
 *    });
 *
 * 3. Auto-fetch with arguments:
 *
 *    const { data } = useApi(studyService.getById, {
 *      immediate:    true,
 *      immediateArgs: [studyId],
 *    });
 *
 * 4. With success / error callbacks:
 *
 *    const { execute } = useApi(userService.updateProfile, {
 *      onSuccess: (data) => toast.success('Profile saved!'),
 *      onError:   (err)  => toast.error(err.message),
 *    });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * @template T  Type of the resolved data value
 *
 * @param  {(...args: any[]) => Promise<T>} apiFn
 *         A service function that returns a Promise.
 *
 * @param  {Object}    [config={}]
 * @param  {function}  [config.onSuccess]      Called with (data) after success.
 * @param  {function}  [config.onError]        Called with (normalizedError) after failure.
 * @param  {boolean}   [config.immediate=false] Auto-call on mount.
 * @param  {any[]}     [config.immediateArgs=[]] Args forwarded when immediate=true.
 * @param  {T|null}    [config.initialData=null] Initial value for `data`.
 * @param  {boolean}   [config.resetOnExecute=false] Clear data before each call.
 *
 * @returns {{
 *   data:    T|null,
 *   loading: boolean,
 *   error:   object|null,
 *   execute: (...args: any[]) => Promise<T>,
 *   reset:   () => void,
 *   setData: React.Dispatch,
 * }}
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useApi(apiFn, config = {}) {
  const {
    onSuccess,
    onError,
    immediate     = false,
    immediateArgs = [],
    initialData   = null,
    resetOnExecute = false,
  } = config;

  const [data,    setData]    = useState(initialData);
  const [loading, setLoading] = useState(immediate);   // true on mount if immediate
  const [error,   setError]   = useState(null);

  /* Prevent setState on an unmounted component */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Keep stable refs to callbacks so execute() doesn't change identity */
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef   = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current   = onError;   }, [onError]);

  /* ── execute ────────────────────────────────────────────────────────────── */
  const execute = useCallback(
    async (...args) => {
      if (!mountedRef.current) return;

      if (resetOnExecute) setData(initialData);
      setLoading(true);
      setError(null);

      try {
        const result = await apiFn(...args);

        if (!mountedRef.current) return result;

        setData(result);
        onSuccessRef.current?.(result);
        return result;
      } catch (err) {
        if (!mountedRef.current) return;

        /* Cancelled requests are not real errors — ignore silently */
        if (err?.cancelled) return;

        setError(err);
        onErrorRef.current?.(err);

        /* Re-throw so the call-site can also catch if needed */
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [apiFn, initialData, resetOnExecute],
  );

  /* ── Auto-execute on mount ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!immediate) return;
    execute(...immediateArgs).catch(() => {
      /* Error already stored in state; suppress unhandled-rejection */
    });
    // Only runs once on mount — intentionally omitting deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── reset ──────────────────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  return { data, loading, error, execute, reset, setData };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * useApiQuery
 * Thin wrapper around useApi for read-only data fetching.
 * Re-fetches whenever `deps` change (like useEffect).
 *
 * const { data, loading } = useApiQuery(
 *   () => studyService.list({ status: 'Active' }),
 *   [status],
 * );
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useApiQuery(apiFn, deps = [], config = {}) {
  const { data, loading, error, execute, reset, setData } = useApi(apiFn, {
    ...config,
    immediate: false,           // we control timing via the effect below
  });

  useEffect(() => {
    execute().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: execute, reset, setData };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * usePaginatedApi
 * Manages pagination state alongside an API call.
 *
 * const { data, page, pageSize, setPage, loading } = usePaginatedApi(
 *   (params) => sponsorService.list(params),
 *   { defaultPageSize: 25 },
 * );
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function usePaginatedApi(apiFn, config = {}) {
  const { defaultPage = 1, defaultPageSize = 50, extraParams = {} } = config;

  const [page,     setPage]     = useState(defaultPage);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const boundFn = useCallback(
    () => apiFn({ ...extraParams, page, pageSize }),
    [apiFn, page, pageSize, JSON.stringify(extraParams)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { data, loading, error, execute } = useApiQuery(boundFn, [page, pageSize, JSON.stringify(extraParams)], config);

  const goToPage    = (n) => { setPage(n); };
  const changeSize  = (s) => { setPageSize(s); setPage(1); };

  /* Convenience: total / rows extracted from typical paginated response shape */
  const rows       = data?.items ?? data?.data ?? (Array.isArray(data) ? data : []);
  const totalCount = data?.total ?? data?.totalCount ?? rows.length;

  return {
    data, rows, totalCount,
    page, pageSize,
    loading, error,
    setPage: goToPage,
    setPageSize: changeSize,
    refetch: execute,
  };
}
