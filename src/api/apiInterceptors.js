/**
 * apiInterceptors — shared cross-client error handlers.
 *
 * Used by axiosClient, sponsorAxiosClient, and formsAxiosClient so the
 * "locked" (423) and "read-only sponsor view" (403) behaviors are identical
 * across all three. Anything that needs Redux dispatches lazy-imports the
 * store to avoid a static cycle (api → store → api).
 */

const LOCKED_EVENT = 'nexus:locked';

/**
 * 423 — Study / Site / Subject is locked.
 *
 * - Dispatch a toast with the locked entity ("Study X is locked")
 * - Broadcast a window CustomEvent so any open page can refresh + show
 *   inline lock state without each page having to subscribe to the toast.
 *
 * Body shape per spec §0:
 *   { success: false, message, details: { scope: 'study'|'site'|'subject', id } }
 */
export function handleLocked(error) {
  const data    = error?.response?.data ?? {};
  const message = data.message || 'This record is locked.';
  const scope   = data.details?.scope ?? null;
  const id      = data.details?.id    ?? null;

  // Notify listening forms/pages (LockBanner, save buttons, etc.) — Phase 4
  // will hang the LockBanner UI off this same event.
  try {
    window.dispatchEvent(new CustomEvent(LOCKED_EVENT, {
      detail: { scope, id, message, error },
    }));
  } catch { /* SSR / non-window contexts — ignore */ }

  // Lazy-dispatch a toast so the user always gets feedback even when no
  // form is mounted to handle the event (e.g. background save).
  import('@/app/store').then(({ default: store }) =>
    import('@/app/notificationSlice').then(({ addToast }) => {
      store.dispatch(addToast({
        type:     'error',
        message:  message,
        duration: 5000,
      }));
    }),
  ).catch(() => { /* dispatch failure should not mask the original error */ });
}

/**
 * 403 inside a sponsor view — backend rejected the request.
 *
 * CRO viewers now have full write access via /enter, so 403 here is a true
 * permission error, not a read-only block. Surface whatever the server said.
 */
export function handleReadOnlyForbidden(error) {
  const serverMsg = error?.response?.data?.message ?? error?.response?.data?.error ?? '';
  const message   = serverMsg || 'You do not have permission to perform this action.';

  import('@/app/store').then(({ default: store }) =>
    import('@/app/notificationSlice').then(({ addToast }) => {
      store.dispatch(addToast({ type: 'error', message, duration: 5000 }));
    }),
  ).catch(() => { /* ignore */ });
}

/**
 * Subscribe to the global lock event. Returns an unsubscribe.
 *
 *   useEffect(() => onLocked((evt) => { …refresh… }), []);
 */
export function onLocked(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener(LOCKED_EVENT, handler);
  return () => window.removeEventListener(LOCKED_EVENT, handler);
}

export const LOCKED_EVENT_NAME = LOCKED_EVENT;
