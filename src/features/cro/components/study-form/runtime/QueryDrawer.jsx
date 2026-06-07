import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import { sponsorQueryClient } from '@/features/sponsor/api/sponsorQueryClient';
import { siteQueryClient } from '@/features/site/api/siteQueryClient';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import Popover from './Popover';
import { useFieldCapabilities } from './useFieldCapabilities';
import { useStudyAssignees } from './useStudyAssignees';
import { useFormQueries } from '@/components/study-form-runner/FormQueriesContext';
import { formatDateTime } from '@/utils/formatDate';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import s from './runtime.module.css';

/**
 * QueryDrawer — field-level Query Management. Lists queries raised on this
 * field for the current subject/form, and lets a Query Manager raise a new
 * one. Persists to the backend on submit (POST /sponsor/workspace/queries
 * → cro_studies tenant `queries` table) so the data survives a page refresh
 * and shows up in the Queries page list.
 *
 * Scope handling:
 *   - Sponsor / CRO impersonator (/sponsor/*)  → sponsorQueryClient
 *   - Site personnel (/site/*)                 → siteQueryClient (read-only,
 *     can't raise new queries)
 *
 * The drawer reads subjectId + formId from the URL search params — both
 * CaptureFormPage variants put them there.
 */

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Backend status vocab — Spec §4.5: Open / Answered / Closed
// UI surface 3-step pipeline: Raised → Answered → Resolved.
const STATUS_ALIASES = { Open: 'Raised', Raised: 'Raised', Answered: 'Answered', Closed: 'Resolved', Resolved: 'Resolved', Reviewed: 'Answered', 'In Progress': 'Raised' };
const normalizeStatus = (st) => STATUS_ALIASES[st] ?? 'Raised';

const fmt = (iso) => formatDateTime(iso);

function pillClass(status) {
  const st = normalizeStatus(status);
  if (st === 'Raised')   return s.pillRaised;
  if (st === 'Answered') return s.pillAnswered;
  if (st === 'Resolved') return s.pillResolved;
  return '';
}

function priorityPill(p) {
  return p === 'Critical' ? s.pillCritical
       : p === 'High'     ? s.pillHigh
       : p === 'Medium'   ? s.pillMedium
       : s.pillLow;
}

export default function QueryDrawer({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch  = useDispatch();
  const user      = useSelector(selectCurrentUser);
  const caps      = useFieldCapabilities();
  const location  = useLocation();
  const [params]  = useSearchParams();
  const assignees = useStudyAssignees();
  // Form-level aggregate — used to refresh sidebar + field-icon counts after
  // the drawer raises / answers / closes a query.
  const formQueries = useFormQueries();

  // Identity keys for the logged-in user — used to render "you" instead of the
  // person's own name on assignee / escalated / reassigned meta lines. The
  // query's assigned_to/escalated_to is a personnel_id which may differ from the
  // auth user id, so we also match on name/email (same loose match the Queries
  // list uses for its "only mine" filter).
  const meKeys = useMemo(() => new Set(
    [user?.id, user?.email, user?.username, user?.fullName]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase()),
  ), [user]);
  const isMe = (id, name) =>
    Boolean((id && meKeys.has(String(id).toLowerCase())) ||
            (name && meKeys.has(String(name).toLowerCase())));

  // (subject, form) come from the form runner URL.
  const subjectId = params.get('subjectId') ?? '';
  const formId    = params.get('formId')    ?? '';

  // Scope from the URL path. Both sponsor and site can raise queries (a site
  // Query Manager is a valid role — it can raise queries on their site's data
  // and assign them to a PI / CRC). The right backend client is picked per
  // scope. site_id is pinned by the backend from the JWT in either case.
  const scope = location.pathname.startsWith('/site/') ? 'site' : 'sponsor';
  const client = scope === 'site' ? siteQueryClient : sponsorQueryClient;
  const canRaise = caps.canCreateQuery;
  const raiseBlockReason = !canRaise
    ? 'Your role does not have "Raise Query" on Data Capture. Ask the CRO to tick Data Capture → Raise Query on your role (or on the Study Wizard Step 1 matrix when the study has a per-study cap).'
    : null;
  // One-shot diagnostic — paste this if the button still shows after a perm
  // is removed. Shows raise + close gates side-by-side so we can see which
  // one is failing.
  // eslint-disable-next-line no-console
  console.debug('[QueryDrawer] gates', {
    canRaise,
    canCreateQuery: caps.canCreateQuery,
    canCloseQuery:  caps.canCloseQuery,
    _hasWorkspace:   caps._hasWorkspace,
    _hasPermissions: caps._hasPermissions,
  });

  const [queries,    setQueries]    = useState([]);
  const [allCount,   setAllCount]   = useState(0); // total returned by API
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [draft, setDraft] = useState({ description: '', priority: 'Medium', assignedTo: '' });

  // The subject's site — drives the Assigned-To picker so a query is only
  // assignable to personnel actually working at this site. Fetched once; the
  // strip up top fetches the same subject so this is cheap (browser cache).
  const [subjectSiteId,   setSubjectSiteId]   = useState('');
  const [subjectSiteName, setSubjectSiteName] = useState('');
  useEffect(() => {
    if (!subjectId) { setSubjectSiteId(''); setSubjectSiteName(''); return undefined; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = scope === 'site'
          ? await siteWorkspaceClient.getSubject(subjectId)
          : await sponsorAxiosClient.get(`/api/v1/sponsor/workspace/subjects/${subjectId}`);
        const sub = res?.subject ?? res?.item ?? res ?? {};
        if (cancelled) return;
        setSubjectSiteId(sub.siteId ?? sub.site_id ?? '');
        setSubjectSiteName(sub.siteName ?? sub.site_name ?? '');
      } catch { /* silent — falls back to study-wide assignees */ }
    };
    load();
    return () => { cancelled = true; };
  }, [scope, subjectId]);

  // Site-scoped, status-tagged options for the Assigned-To dropdown. Mirrors
  // the Site Master active/inactive pattern: every personnel on this site is
  // listed with their status as a label suffix; an Inactive row stays
  // selectable in case the QM needs to assign retroactively but is visually
  // de-emphasised by the "(Inactive)" tag. If we can't resolve the subject's
  // site, fall back to the study-wide list (status still tagged).
  const assigneeOptions = useMemo(() => {
    // Multi-site personnel: the BE returns `site_ids` = [primary, ...additional].
    // Match on membership in that list (or fall back to the primary fields if
    // the array wasn't surfaced). Without this, a person invited to "All" or
    // "Multiple" sites only matches their primary site and disappears from the
    // dropdown when the subject is on one of their *additional* sites.
    const sameSite = (p) => {
      if (!subjectSiteId && !subjectSiteName) return true;
      const ids = Array.isArray(p.siteIds) ? p.siteIds : [];
      if (subjectSiteId   && (ids.includes(subjectSiteId) || p.siteId === subjectSiteId))   return true;
      if (subjectSiteName && p.siteName && p.siteName === subjectSiteName) return true;
      return false;
    };
    return assignees.items
      .filter(sameSite)
      .map((p) => {
        const status = (p.status ?? 'Active');
        const role   = p.role ? ` — ${p.role}` : '';
        return {
          value: p.id,
          label: `${p.fullName}${role} (${status})`,
        };
      });
  }, [assignees.items, subjectSiteId, subjectSiteName]);
  // Per-query answer form state — keyed by queryId so opening one row's answer
  // form doesn't clobber another's draft.
  const [answeringId, setAnsweringId] = useState(null);
  const [answerDraft, setAnswerDraft] = useState({ text: '', updatedFieldValue: '' });
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  // Pull all queries for this study/env and filter to this (subject, form,
  // field). Cheap enough at MVP scale; if the volume grows we can add
  // server-side filters.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await client.list();
      setAllCount(all.length);
      // Match on field first (always required), then narrow by subject + form
      // when the URL has them. The runner can mount in a "form preview" mode
      // without a subject — show every query on that field instead of empty.
      const sameField = all.filter(
        (q) => q.fieldName === fieldId || q.fieldId === fieldId
      );
      const narrowed = sameField.filter((q) => {
        if (subjectId && q.subjectId && q.subjectId !== subjectId) return false;
        if (formId    && q.formId    && q.formId    !== formId)    return false;
        return true;
      });
      // Dev visibility — paste this if the list looks wrong:
      // eslint-disable-next-line no-console
      console.debug('[QueryDrawer]', {
        fieldId, subjectId, formId,
        apiReturned: all.length,
        matchingField: sameField.length,
        afterSubjectFormFilter: narrowed.length,
        sample: all.slice(0, 3).map((q) => ({
          id: q.id, fieldName: q.fieldName, subjectId: q.subjectId, formId: q.formId,
        })),
      });
      setQueries(narrowed);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load queries.' }));
      setQueries([]);
      setAllCount(0);
    } finally {
      setLoading(false);
    }
  }, [client, subjectId, formId, fieldId, dispatch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setDraft({ description: '', priority: 'Medium', assignedTo: '' });
    setCreating(true);
  };

  const submit = async () => {
    const text = draft.description.trim();
    if (!text || !canRaise || submitting) return;
    if (!subjectId || !formId) {
      dispatch(addToast({ type: 'error', message: 'Subject and form are required to raise a query.' }));
      return;
    }
    setSubmitting(true);
    try {
      // Both sponsor and site clients accept the same payload shape; the URL
      // scope picked the right one upstairs.
      // Resolve the field's block/page titles from the form tree so the Query
      // Manager table can show where the query was raised.
      const loc = formQueries.fieldLocation?.(fieldId) ?? null;
      const payload = {
        subjectId,
        formId,
        fieldName:  fieldId,
        // Field's display label from the form schema. Stored alongside the
        // ID so the Queries table can render "Date of Birth" instead of the
        // raw fieldId. Falls back to fieldId at display time if missing.
        fieldLabel,
        // Structural ids (not just labels) so the Query Manager can deep-link
        // straight to this page of the form instead of opening page 1.
        blockId:   loc?.blockId   || undefined,
        pageId:    loc?.pageId    || undefined,
        blockName: loc?.blockName || undefined,
        pageName:  loc?.pageName  || undefined,
        queryText: text,
        priority:  draft.priority,
        assignedTo: draft.assignedTo || undefined,
      };
      if (scope === 'site') {
        await siteQueryClient.raise(payload);
      } else {
        await sponsorQueryClient.raise(undefined, payload);
      }
      dispatch(addToast({ type: 'success', message: 'Query raised.' }));
      setCreating(false);
      setDraft({ description: '', priority: 'Medium', assignedTo: '' });
      await load();
      // Bubble the change up so the sidebar block/page badges and the
      // field-icon count update immediately too.
      formQueries.refresh();
    } catch (e) {
      // Surfaces the backend workflow gate ("Queries can only be raised after
      // verification is completed or clarification is requested") verbatim.
      dispatch(addToast({
        type: 'error',
        message: e?.response?.data?.message || e?.message || 'Failed to raise query.',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // Close a query (Resolve). Gated strictly on data_capture.close_query
  // (migration 026) — separate from canEditQuery so a role can answer but
  // not close.
  const closeQuery = async (queryId) => {
    if (!caps.canCloseQuery) return;
    const reason = window.prompt(
      'Closing reason (required) — explain how this query was resolved:',
      ''
    );
    if (reason == null || !reason.trim()) return;
    try {
      if (scope === 'site') {
        await siteQueryClient.close(queryId, { comments: reason.trim() });
      } else {
        await sponsorQueryClient.close(undefined, queryId, { comments: reason.trim() });
      }
      dispatch(addToast({ type: 'success', message: 'Query closed.' }));
      await load();
      // Bubble the change up so the sidebar block/page badges and the
      // field-icon count update immediately too.
      formQueries.refresh();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to close query.' }));
    }
  };

  const startAnswer = (queryId) => {
    setAnsweringId(queryId);
    setAnswerDraft({ text: '', updatedFieldValue: '' });
  };

  // Submit an answer (with optional new field value). Backend records it as a
  // query_comment + flips status to 'Answered'. Updating the field value is
  // optional but useful — a PI can fix the underlying value in the same step.
  const submitAnswer = async (queryId) => {
    const text = answerDraft.text.trim();
    if (!text || answerSubmitting) return;
    setAnswerSubmitting(true);
    try {
      const payload = {
        responseText: text,
        statusUpdate: 'Answered',
        updatedFieldValue: answerDraft.updatedFieldValue.trim() || undefined,
      };
      if (scope === 'site') {
        await siteQueryClient.respond(queryId, payload);
      } else {
        await sponsorQueryClient.respond(undefined, queryId, payload);
      }
      dispatch(addToast({ type: 'success', message: 'Answer submitted.' }));
      setAnsweringId(null);
      setAnswerDraft({ text: '', updatedFieldValue: '' });
      await load();
      // Bubble the change up so the sidebar block/page badges and the
      // field-icon count update immediately too.
      formQueries.refresh();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to submit answer.' }));
    } finally {
      setAnswerSubmitting(false);
    }
  };

  // The user shown in row meta when there's no createdByName yet.
  const meName = user?.fullName ?? user?.email ?? 'You';
  void meName;

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Queries · ${fieldLabel}`}
      width={460}
      maxHeight={520}
      onClose={onClose}
      footer={<button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>}
    >
      {!creating && canRaise && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className={s.btnPrimary} onClick={startNew} disabled={submitting}>
            <Plus size={13} /> Raise Query
          </button>
        </div>
      )}
      {!creating && !canRaise && raiseBlockReason && (
        <div style={{ marginBottom: 10, padding: '8px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11.5, color: '#92400e' }}>
          {raiseBlockReason}
        </div>
      )}

      {creating && (
        <div className={s.item} style={{ marginBottom: 12, background: '#fafbff' }}>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Query Details</label>
            <textarea
              className={s.textArea}
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe the query (e.g. DOB does not match source document)"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Priority</label>
              <select
                className={s.selectInput}
                value={draft.priority}
                onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Associated</label>
              {/* Searchable dropdown — personnel for the current subject's
                  site only, each tagged with its Active/Inactive status
                  (mirrors the Site Master status pattern the spec references).
                  Inactive rows stay selectable in case a retroactive
                  assignment is needed but the "(Inactive)" tag makes the
                  current status obvious. */}
              <SearchableDropdown
                options={assigneeOptions}
                value={draft.assignedTo}
                onChange={(val) => setDraft((p) => ({ ...p, assignedTo: val ?? '' }))}
                placeholder={
                  assignees.loading ? 'Loading personnel…'
                  : assigneeOptions.length === 0
                    ? (subjectSiteName
                        ? `No personnel on ${subjectSiteName}`
                        : 'No personnel available')
                    : 'Search personnel…'
                }
                searchPlaceholder="Search by name, role or status…"
                disabled={assignees.loading}
                clearable
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
            <button type="button" className={s.btnSecondary} onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className={s.btnPrimary}
              onClick={submit}
              disabled={!draft.description.trim() || !canRaise || submitting}
              title={!canRaise ? 'You do not have permission to raise queries.' : undefined}
            >
              {submitting ? <><Loader2 size={12} className={s.spin} /> Submitting…</> : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={s.emptyState}>
          <Loader2 size={14} className={s.spin} /> Loading queries…
        </div>
      ) : queries.length === 0 ? (
        <div className={s.emptyState}>
          No queries raised on this field yet.
          {allCount > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
              ({allCount} {allCount === 1 ? 'query exists' : 'queries exist'} on this study but none match this subject/form/field — see browser console for the comparison.)
            </div>
          )}
        </div>
      ) : (
        <div className={s.itemList}>
          {queries.map((q) => {
            const status = normalizeStatus(q.status);
            const assigneeName =
              q.assignedToName
              || assignees.items.find((x) => x.id === q.assignedTo)?.fullName
              || q.assignedTo;
            const escalatedToName =
              q.escalatedToName
              || assignees.items.find((x) => x.id === q.escalatedTo)?.fullName
              || q.escalatedTo;
            // Show "you" when the logged-in user is the assignee / escalation
            // target, otherwise the person's name.
            const assignedToMe   = isMe(q.assignedTo, assigneeName);
            const escalatedToMe  = isMe(q.escalatedTo, escalatedToName);
            const assigneeLabel    = assignedToMe  ? 'you' : assigneeName;
            const escalatedToLabel = escalatedToMe ? 'you' : escalatedToName;
            const raisedByLabel    = q.raisedByName    || q.raisedBy    || 'Unknown';
            const respondedByLabel = q.respondedByName || q.respondedBy || '';
            const isOpen           = status !== 'Resolved';
            const isAnswering      = answeringId === q.id;
            return (
              <div key={q.id} className={s.item}>
                <div className={s.itemHead}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={s.itemAuthor}>Query</span>
                      <span className={`${s.pill} ${pillClass(status)}`}>{status}</span>
                      <span className={`${s.pill} ${priorityPill(q.priority)}`}>{q.priority}</span>
                      {/* Escalation is explicit here: an amber "Escalated" badge
                          so it's obvious at a glance the query was escalated, and
                          the meta line below names WHO it went to. */}
                      {q.isEscalated && (
                        <span
                          className={s.pill}
                          style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                          title={escalatedToLabel ? `Escalated to ${escalatedToLabel}` : 'Escalated'}
                        >
                          ⬆ Escalated
                        </span>
                      )}
                    </div>
                    <div className={s.itemMeta}>
                      Raised by {raisedByLabel} · {fmt(q.raisedDate)}
                      {q.assignedTo && <> · @{assigneeLabel}</>}
                      {q.siteName && <> · {q.siteName}</>}
                    </div>
                    {q.isEscalated && escalatedToLabel && (
                      <div className={s.itemMeta} style={{ color: '#b45309', fontWeight: 600 }}>
                        ⬆ Escalated to {escalatedToLabel}
                        {q.escalatedAt ? ` · ${fmt(q.escalatedAt)}` : ''}
                      </div>
                    )}
                    {q.isReassigned && (
                      <div
                        className={s.itemMeta}
                        style={{ color: assignedToMe ? '#0d9488' : '#64748b', fontWeight: assignedToMe ? 600 : 400 }}
                      >
                        ↪ Reassigned to {assigneeLabel}
                        {q.previousAssignedToName ? ` · was ${q.previousAssignedToName}` : ''}
                        {q.reassignedAt ? ` · ${fmt(q.reassignedAt)}` : ''}
                      </div>
                    )}
                  </div>
                  <div className={s.itemActions}>
                    {/* PI / responder can Answer while the query is still open. */}
                    {caps.canEditQuery && isOpen && !isAnswering && (
                      <button
                        type="button"
                        className={s.btnSecondary}
                        style={{ height: 22, padding: '0 8px', fontSize: 10.5 }}
                        onClick={() => startAnswer(q.id)}
                        title="Answer this query with a reason"
                      >
                        Answer
                      </button>
                    )}
                    {/* Strict close gate — only roles with
                        data_capture.close_query (migration 026) see Close. */}
                    {caps.canCloseQuery && isOpen && (
                      <button
                        type="button"
                        className={s.btnPrimary}
                        style={{ height: 22, padding: '0 10px', fontSize: 10.5, background: '#16a34a' }}
                        onClick={() => closeQuery(q.id)}
                        title="Close (resolve) this query"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>

                {q.queryText && <div className={s.itemBody}>{q.queryText}</div>}

                {/* Latest answer / resolution shown inline so the Query
                    Manager can read the PI's reason without leaving the form.
                    Skip lifecycle markers ([Escalated]/[Reopened]) — those are
                    shown as the badge/line above, not as an "Answer". */}
                {q.latestResponseText && !/^\s*\[(escalated|reopened)\]/i.test(q.latestResponseText) && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                      {status === 'Resolved' ? 'Resolution' : 'Answer'}
                      {respondedByLabel && (
                        <span style={{ fontWeight: 400, color: '#475569', marginLeft: 6 }}>
                          — {respondedByLabel}
                          {q.responseDate ? ` · ${fmt(q.responseDate)}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                      {q.latestResponseText}
                    </div>
                  </div>
                )}

                {/* Inline Answer form. Optional updatedFieldValue lets the PI
                    correct the underlying field in the same call (backend
                    patches subject_form_data via siteQueryService.answerQuery). */}
                {isAnswering && (
                  <div style={{ marginTop: 10, padding: 10, background: '#fafbff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                    <div className={s.formField}>
                      <label className={s.fieldLabel}>Your answer / reason</label>
                      <textarea
                        className={s.textArea}
                        rows={3}
                        value={answerDraft.text}
                        onChange={(e) => setAnswerDraft((p) => ({ ...p, text: e.target.value }))}
                        placeholder="e.g. DOB confirmed against the source document — value updated."
                      />
                    </div>
                    <div className={s.formField}>
                      <label className={s.fieldLabel}>Corrected field value <span style={{ color: '#94a3b8' }}>(optional)</span></label>
                      <input
                        className={s.textInput}
                        value={answerDraft.updatedFieldValue}
                        onChange={(e) => setAnswerDraft((p) => ({ ...p, updatedFieldValue: e.target.value }))}
                        placeholder="Leave blank to keep the current value"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        className={s.btnSecondary}
                        onClick={() => { setAnsweringId(null); }}
                        disabled={answerSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={s.btnPrimary}
                        onClick={() => submitAnswer(q.id)}
                        disabled={!answerDraft.text.trim() || answerSubmitting}
                      >
                        {answerSubmitting
                          ? <><Loader2 size={12} className={s.spin} /> Submitting…</>
                          : 'Submit Answer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
