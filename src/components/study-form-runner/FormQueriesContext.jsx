/**
 * FormQueriesContext — single source of truth for queries on the open form.
 *
 * Mounted inside StudyFormRunner with (subjectId, formId, blocks). On mount
 * (and on `refresh()`) it fetches every query for that (subject, form) from
 * the right backend (site if /site/* path, sponsor otherwise) and aggregates
 * them by field, page, and block.
 *
 * Consumers:
 *   • StudyFormRunner sidebar — block + page count badges
 *   • RuntimeFieldRenderer    — field-level count chip
 *   • QueryDrawer             — list view + post-mutate refresh
 *
 * "Active" = status not in {Resolved, Closed} per the FE normalizer's vocab.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { sponsorQueryClient } from '@/features/sponsor/api/sponsorQueryClient';
import { siteQueryClient } from '@/features/site/api/siteQueryClient';
import { usePermissions } from '@/features/auth/usePermissions';

const FormQueriesContext = createContext({
  queries:        [],
  byField:        new Map(),
  byPage:         new Map(),
  byBlock:        new Map(),
  fieldLocation:  () => null,
  loading:        false,
  refresh:        () => Promise.resolve(),
});

// Backend stores 'Resolved' on a normal close (sponsor + site close endpoints
// both set status='Resolved'), but 'Closed' and 'Cancelled' can also appear on
// legacy / cancelled rows. Counts include only ACTIVE (Open / Raised /
// Answered / In Progress) — none of those terminal states.
const TERMINAL_STATUSES = new Set(['Resolved', 'Closed', 'Cancelled']);
const isInactive = (status) => TERMINAL_STATUSES.has(status);

export function FormQueriesProvider({ subjectId, formId, blocks, children }) {
  const location = useLocation();
  const isSite   = location.pathname.startsWith('/site/');
  const client   = isSite ? siteQueryClient : sponsorQueryClient;

  // Only fetch queries if the user can actually access them. A data-capture
  // role without query access (e.g. a Data Manager with no query_manager.view /
  // raise_query) would otherwise fire GET /queries → 403, which the read-only
  // axios interceptor surfaces as a misleading "You do not have permission"
  // toast on the data-capture screen. Skipping the call when they can't view
  // queries avoids the request entirely (the field count badges simply don't
  // show). The drawer's own raise/answer actions stay gated server-side.
  const perms = usePermissions();
  const canSeeQueries = perms?.canAccessQueryManager || perms?.canRaiseQueryOnField;

  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.debug('[FormQueries] load()', { subjectId, formId, isSite });
    if (!subjectId || !formId) {
      // eslint-disable-next-line no-console
      console.warn('[FormQueries] skipping fetch — missing subjectId/formId in URL', { subjectId, formId });
      setQueries([]);
      return;
    }
    // No query access → skip the fetch entirely (avoids a 403 that the
    // read-only interceptor would toast on the data-capture screen).
    if (!canSeeQueries) {
      setQueries([]);
      return;
    }
    setLoading(true);
    try {
      const all  = await client.list();
      const mine = all.filter((q) => q.subjectId === subjectId && q.formId === formId);
      // eslint-disable-next-line no-console
      console.debug('[FormQueries] api response', {
        total:    all.length,
        matched:  mine.length,
        sample:   all.slice(0, 3).map((q) => ({
          id: q.id, subjectId: q.subjectId, formId: q.formId, fieldName: q.fieldName, status: q.status,
        })),
      });
      setQueries(mine);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[FormQueries] fetch failed', e);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, [client, subjectId, formId, isSite, canSeeQueries]);

  useEffect(() => { load(); }, [load]);

  // Map every fieldId in the blocks tree → its (blockId, pageId) plus the
  // human-readable block/page titles. The IDs drive the count aggregation; the
  // titles are stamped onto a raised query so the Query Manager table can show
  // the block/page the query belongs to.
  const fieldIndex = useMemo(() => {
    const map = new Map(); // fieldId → { blockId, pageId, blockName, pageName }
    for (const blk of blocks ?? []) {
      for (const pg of blk.pages ?? []) {
        for (const f of pg.fields ?? []) {
          map.set(f.id, {
            blockId:   blk.id,
            pageId:    pg.id,
            blockName: blk.title ?? '',
            pageName:  pg.title ?? '',
          });
        }
      }
    }
    return map;
  }, [blocks]);

  // Resolve a field's block/page titles — used when raising a query so the
  // Query Manager table can render the originating block/page.
  const fieldLocation = useCallback(
    (fieldId) => fieldIndex.get(fieldId) ?? null,
    [fieldIndex]
  );

  const aggregates = useMemo(() => {
    const byField = new Map(); // fieldId → active count
    const byPage  = new Map(); // pageId  → active count
    const byBlock = new Map(); // blockId → active count
    const unmatched = []; // queries whose fieldId isn't in the blocks tree
    for (const q of queries) {
      if (isInactive(q.status)) continue;
      const fieldId = q.fieldName || q.fieldId;
      if (!fieldId) continue;
      byField.set(fieldId, (byField.get(fieldId) ?? 0) + 1);
      const loc = fieldIndex.get(fieldId);
      if (loc) {
        byPage.set(loc.pageId,   (byPage.get(loc.pageId)   ?? 0) + 1);
        byBlock.set(loc.blockId, (byBlock.get(loc.blockId) ?? 0) + 1);
      } else {
        unmatched.push({ id: q.id, fieldId, status: q.status });
      }
    }
    if (queries.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('[FormQueries] aggregates', {
        active:        [...byField.values()].reduce((a, b) => a + b, 0),
        byFieldCount:  byField.size,
        byPageCount:   byPage.size,
        byBlockCount:  byBlock.size,
        fieldsInTree:  fieldIndex.size,
        unmatched,
      });
    }
    return { byField, byPage, byBlock };
  }, [queries, fieldIndex]);

  const value = useMemo(() => ({
    queries,
    byField:  aggregates.byField,
    byPage:   aggregates.byPage,
    byBlock:  aggregates.byBlock,
    fieldLocation,
    loading,
    refresh:  load,
  }), [queries, aggregates, fieldLocation, loading, load]);

  return (
    <FormQueriesContext.Provider value={value}>
      {children}
    </FormQueriesContext.Provider>
  );
}

FormQueriesProvider.propTypes = {
  subjectId: PropTypes.string,
  formId:    PropTypes.string,
  blocks:    PropTypes.array,
  children:  PropTypes.node,
};

export function useFormQueries() {
  return useContext(FormQueriesContext);
}

/** Convenience: active query count for a single field. Returns 0 when no
 *  provider is mounted (form-builder preview safely renders nothing). */
export function useFieldQueryCount(fieldId) {
  const { byField } = useContext(FormQueriesContext);
  return byField.get(fieldId) ?? 0;
}
