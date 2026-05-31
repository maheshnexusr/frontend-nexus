/**
 * StudyFormRunner — shared participant view of the eCRF form, used by both
 * the sponsor and site data-capture pages.
 *
 * Mirrors the layout of the CRO designer's SFBPreview (left rail stepper +
 * main content panel + nav footer) AND, just like the preview, wraps every
 * non-layout field with `RuntimeFieldRenderer` so the collaboration stack
 * (annotation chips, 3-dot menu, queries, attachments, verification, audit
 * trail) is consistently available everywhere a user fills out the form.
 *
 * Props:
 *   blocks         — array from form_structure.blocks
 *   formTitle      — heading shown in the sidebar
 *   defaultValues  — { [fieldId]: value } loaded from the backend
 *   onSubmit(vals) — async callback with { [fieldId]: value }
 *   submitLabel    — text for the final submit button
 *   readOnly       — disables inputs and submit
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { selectFormStatus, READ_ONLY_STATUSES, resetRuntime } from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import {
  ChevronLeft, ChevronRight, ChevronDown, CheckCircle2,
  UploadCloud, PenLine, Star, Layers,
  Search, FileText, Type as TypeIcon, CornerDownRight, PanelLeftClose, PanelLeft,
  AlertCircle, History, Lock, Snowflake, CircleDot, X as XIcon, Save, ShieldCheck,
} from 'lucide-react';
import RuntimeFieldRenderer from '@/features/cro/components/study-form/runtime/RuntimeFieldRenderer';
import FormStatusToolbar    from './FormStatusToolbar';
import { FormQueriesProvider, useFormQueries } from './FormQueriesContext';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import ActivityLogDrawer from '@/features/sponsor/components/activity/ActivityLogDrawer';
import { usePermissions } from '@/features/auth/usePermissions';
import { selectAllFieldData } from '@/features/cro/store/formRuntimeSlice';
import s from '@/features/cro/components/study-form/SFBPreview.module.css';

function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Normalise a field value for equality comparison so undefined/null/'' all
// collapse together and arrays compare by content. Used to detect whether a
// page changed since it was last completed.
function sameValue(a, b) {
  const norm = (v) => (v === undefined || v === null)
    ? ''
    : Array.isArray(v) ? v.join(' ') : String(v);
  return norm(a) === norm(b);
}

// Non-input field types — excluded from data-entry / verification counting.
const LAYOUT_TYPES = ['h2', 'paragraph', 'divider'];

/**
 * Sidebar badge helpers. Each returns a small inline `<span>` styled to match
 * the existing query count chip, OR null when the badge doesn't apply.
 *
 * The data plumbing for per-page lock + per-page verification doesn't exist
 * in the data model yet — these helpers fall back to the form-level status
 * (which is the closest signal we have today). When per-page tracking is
 * introduced, replace `formStatus` with the per-page value here.
 */
const PILL = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '1px 6px', borderRadius: 999,
  fontSize: 10.5, fontWeight: 700, marginLeft: 4,
};
function LockBadge({ formStatus, size = 10 }) {
  // Shown on a block/page only when the form's status is one of the locked
  // statuses. Snowflake for Frozen; padlock for Locked / Signed.
  if (formStatus === 'Frozen') {
    return (
      <span title="Frozen" style={{ ...PILL, background: '#dbeafe', color: '#1e40af' }}>
        <Snowflake size={size} />
      </span>
    );
  }
  if (formStatus === 'Locked' || formStatus === 'Signed') {
    return (
      <span title={formStatus} style={{ ...PILL, background: '#e2e8f0', color: '#475569' }}>
        <Lock size={size} />
      </span>
    );
  }
  return null;
}
/**
 * Page status symbol per spec. Combines the data-entry signal (from runtime
 * values) with the verification signal (from form status). The highest-
 * priority state wins:
 *
 *   1. Verified                                 ✓  (green check)
 *   2. In Verification / Partially Verified     ◔  (blue dot)
 *   3. Data entered, not yet verified           ✕  (gray X — "submitted")
 *   4. No data entry                            —  (no symbol)
 */
function VerificationBadge({ formStatus, dataEntered, completed, verified, verifiedBy, size = 10 }) {
  // Persisted SDV (data_verifications) takes priority over the form-level
  // signals: a page whose fields are all Verified shows a green check; some
  // verified shows a blue dot. Driven by the real per-field verify state, so a
  // single-field verify is reflected here too.
  if (verified === 'Verified') {
    return (
      <span title={`Verified${verifiedBy ? ` by ${verifiedBy}` : ''}`} style={{ ...PILL, background: '#dcfce7', color: '#15803d' }}>
        <CheckCircle2 size={size} />
      </span>
    );
  }
  if (verified === 'Partially Verified') {
    return (
      <span title="Partially verified" style={{ ...PILL, background: '#dbeafe', color: '#1d4ed8' }}>
        <CircleDot size={size} />
      </span>
    );
  }
  if (formStatus === 'Verified' || formStatus === 'Approved' || formStatus === 'Signed') {
    return (
      <span title="Verified" style={{ ...PILL, background: '#dcfce7', color: '#15803d' }}>
        <CheckCircle2 size={size} />
      </span>
    );
  }
  if (formStatus === 'In Verification' || formStatus === 'Partially Verified' || formStatus === 'Reviewed') {
    return (
      <span title="In Verification" style={{ ...PILL, background: '#dbeafe', color: '#1d4ed8' }}>
        <CircleDot size={size} />
      </span>
    );
  }
  // Marked Completed by data entry, sent to the Verification Manager, not yet
  // verified — a green check distinguishes it from the plain "data entered" ✕.
  if (completed) {
    return (
      <span title="Marked completed — awaiting verification" style={{ ...PILL, background: '#dcfce7', color: '#15803d' }}>
        <CheckCircle2 size={size} />
      </span>
    );
  }
  if (dataEntered) {
    return (
      <span title="Data entered — awaiting verification" style={{ ...PILL, background: '#f1f5f9', color: '#475569' }}>
        <XIcon size={size} />
      </span>
    );
  }
  // No data entry yet — no symbol per spec.
  return null;
}

/** Highlight every match of `needle` inside `text`. */
function Highlight({ text, needle }) {
  if (!needle) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(needle)})`, 'ig');
  const parts = String(text ?? '').split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase()
      ? <mark key={i} className={s.mark}>{p}</mark>
      : <span key={i}>{p}</span>
  );
}

const LABEL_STYLE = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#0f172a',
  marginBottom: 6,
};
const REQUIRED_STYLE = { color: '#dc2626' };
// Local overrides for SFBPreview.module.css — tighten the side gutters and
// let the form fill the available width instead of capping at 880px.
const MAIN_COL_STYLE      = { padding: '20px 16px 28px' };
const CONTENT_SHELL_STYLE = { maxWidth: 'none' };

// Public wrapper — mounts the FormQueriesProvider once with the right
// (subjectId, formId) from the URL so the inner component + every descendant
// (sidebar badges, field renderer, query drawer) share one fetch.
export default function StudyFormRunner(props) {
  const [params]  = useSearchParams();
  const dispatch  = useDispatch();
  const subjectId = params.get('subjectId') ?? '';
  const formId    = params.get('formId') ?? '';

  // The form-runtime slice (form status / field verification / approval /
  // audit) is a SINGLE global bucket — it is not keyed by subject or form.
  // Without an explicit reset it carries one subject's workflow state over to
  // the next: e.g. "Mark Verified" on Subject A then opening Subject B's same
  // form shows B as Verified too. Reset the slice whenever the (subjectId,
  // formId) target changes so every subject+form starts from a clean
  // 'In Progress' state. useLayoutEffect runs before paint so the new subject
  // never flashes the previous subject's status. The matching `key` on the
  // inner component drops stale local state (page index, seeded values).
  useLayoutEffect(() => {
    dispatch(resetRuntime());
  }, [dispatch, subjectId, formId]);

  return (
    <FormQueriesProvider
      subjectId={subjectId}
      formId={formId}
      blocks={props.blocks ?? []}
    >
      <StudyFormRunnerInner key={`${subjectId}::${formId}`} {...props} />
    </FormQueriesProvider>
  );
}

function StudyFormRunnerInner({
  blocks = [],
  formTitle = 'Study Form',
  defaultValues = {},
  onSubmit,
  // Optional secondary action. When provided, a "Save" button appears in the
  // footer that persists progress without finalising the form (the subject
  // stays in Screening). Submit remains the finalising action.
  onSave,
  // Optional per-page action. When provided, a "Mark Page Completed" button
  // appears that flags the current page as done → it becomes a Verification
  // Manager work-item. Called with (pageId, pageTitle).
  onCompletePage,
  // Optional verifier action. When provided (caller holds the verify
  // permission), a "Verify Page" button appears. Called with
  // (pageId, pageTitle, fields[]) where fields = the page's data fields, each
  // flagged verified — the backend rolls the page status up to Verified.
  onVerifyPage,
  // Pages already Marked Completed for this subject+form, as
  // { [pageId]: { completedAt, status } }. Drives the footer: a completed page
  // shows a "Page Completed" badge instead of the button — until the user edits
  // it, when the button returns as "Re-mark Completed".
  completedPages = {},
  // Persisted SDV state: { fields: { [fieldId]: {status, verifiedByName, verifiedAt} },
  //                        pages:  { [pageId]:  {status, verifiedByName, verifiedAt} } }.
  // Drives the per-field green "Verified" tag and the "Page Verified" footer badge,
  // so a second verifier opening an already-verified page sees it as done.
  verification = { fields: {}, pages: {} },
  // Whether the signed-in role may finalize (Submit) the form. When false the
  // Submit button is hidden — e.g. a data-entry role allowed to Save but not
  // Submit, or a verify-only role. Defaults true for callers that don't gate it.
  canSubmit = true,
  submitLabel = 'Submit Form',
  readOnly = false,
  // Phase 2 — the current user's role name. When supplied, each field's
  // `clinical.viewRoles` / `clinical.editRoles` are enforced (hide / read-only).
  // When omitted, no role enforcement happens (safe no-op for existing callers).
  userRole = null,
}) {
  // Per-block and per-page active query counts from the runner context.
  const { byBlock: queryCountByBlock, byPage: queryCountByPage } = useFormQueries();
  // Per-page data-entry state — true if at least one field on the page has a
  // non-empty value. Lets the sidebar show the spec's "X" (data entered,
  // awaiting verification) vs "no symbol" (nothing entered yet). Driven by
  // the runtime store so it updates immediately as users type.
  const allFieldData = useSelector(selectAllFieldData);
  const dataEnteredByPage = useMemo(() => {
    const map = new Map(); // pageId → bool
    const isEntered = (v) => v !== '' && v !== null && v !== undefined
      && !(Array.isArray(v) && v.length === 0);
    for (const blk of blocks ?? []) {
      for (const pg of blk.pages ?? []) {
        let entered = false;
        for (const f of pg.fields ?? []) {
          const rec = allFieldData?.[f.id];
          if (rec && isEntered(rec.value)) { entered = true; break; }
        }
        map.set(pg.id, entered);
      }
    }
    return map;
  }, [blocks, allFieldData]);
  const [blockIdx,  setBlockIdx]  = useState(0);
  const [pageIdx,   setPageIdx]   = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [values,    setValues]    = useState(defaultValues);
  // Baseline = the values as last persisted/completed. A page is "dirty" when
  // its current values differ from the baseline; a dirty completed page re-offers
  // the "Mark Page Completed" button.
  const [baseline,  setBaseline]  = useState(defaultValues);
  // Pages already Marked Completed, seeded from the prop and updated locally so
  // the footer flips to "Page Completed" the moment the user marks it (no reload).
  const [completed, setCompleted] = useState(completedPages || {});
  // Persisted SDV verification, seeded from the prop + updated locally on verify
  // so verified fields paint green immediately.
  const [verifiedFields, setVerifiedFields] = useState(verification?.fields || {});
  const [verifiedPages,  setVerifiedPages]  = useState(verification?.pages  || {});
  const [busy,      setBusy]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [completing, setCompleting] = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Per-form activity log. Gated by data_capture.activity_log; the form's
  // identity comes from the URL (?formId=...). Subject context is implicit —
  // any audit row tied to this form is shown regardless of subject.
  const [params] = useSearchParams();
  const formIdFromUrl = params.get('formId') ?? '';
  const { has } = usePermissions();
  const canViewFormActivity = has('data_capture', 'activity_log');
  // NOTE: verification STATUS (green field tag, "Page Verified" badge, sidebar
  // check) is shown to EVERYONE — it reflects the true state of the data, so a
  // PI/data-entry role correctly sees "Verified" once it's verified. Only the
  // verify ACTION (the field Verify icon + Verify Page button) is gated, via
  // useFieldCapabilities.canSeeVerification (data_verification) in FieldToolbar
  // / the capture page's canVerify. Do NOT gate the status display.
  const [formActivityOpen, setFormActivityOpen] = useState(false);

  // Phase 1 — form status from runtime slice; blocks Submit on read-only.
  const formStatus = useSelector(selectFormStatus);
  const statusReadOnly = READ_ONLY_STATUSES.has(formStatus);

  // Phase 2 — current user (for per-field role enforcement, below).
  const currentUser = useSelector(selectCurrentUser);

  // Sidebar — collapsed (hide whole rail) + per-block expanded (show/hide
  // each block's page list).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expanded,         setExpanded]         = useState({}); // { [blockId]: true }

  // Search — popover open state + currently-highlighted result index.
  const [search,     setSearch]     = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [hi,         setHi]         = useState(0);
  const searchRef = useRef(null);
  const popRef    = useRef(null);

  useEffect(() => {
    setValues(defaultValues || {});
    setBaseline(defaultValues || {});
  }, [defaultValues]);
  useEffect(() => { setCompleted(completedPages || {}); }, [completedPages]);
  useEffect(() => {
    setVerifiedFields(verification?.fields || {});
    setVerifiedPages(verification?.pages || {});
  }, [verification]);

  // Deep-link: when opened with ?pageId=… (e.g. from the Verification Manager),
  // jump straight to that page instead of page 1.
  useEffect(() => {
    const targetPageId = params.get('pageId');
    if (!targetPageId || !blocks.length) return;
    for (let b = 0; b < blocks.length; b += 1) {
      const p = (blocks[b].pages ?? []).findIndex((pg) => pg.id === targetPageId);
      if (p >= 0) { setBlockIdx(b); setPageIdx(p); break; }
    }
  }, [params, blocks]);

  // Auto-expand the active block in the sidebar.
  useEffect(() => {
    if (!blocks.length) return;
    const active = blocks[Math.min(blockIdx, blocks.length - 1)];
    if (active) setExpanded((p) => ({ ...p, [active.id]: true }));
  }, [blockIdx, blocks]);

  // Ctrl/⌘ + F focuses search; Esc closes the popover.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Outside-click closes the search popover.
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !searchRef.current?.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const toggleSidebarBlock = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const setValue = (fieldId, value) =>
    setValues((prev) => ({ ...prev, [fieldId]: value }));

  if (!blocks.length) {
    return (
      <div className={s.emptyRoot} style={{ flex: 1 }}>
        <Layers size={40} strokeWidth={1.25} className={s.emptyIcon} />
        <p className={s.emptyTitle}>This study has no form yet</p>
        <p className={s.emptySub}>Ask the CRO admin to publish a form design first.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={s.successRoot}>
        <div className={s.successCard}>
          <div className={s.successIconWrap}>
            <CheckCircle2 size={48} strokeWidth={1.5} className={s.successIcon} />
          </div>
          <h2 className={s.successTitle}>Form Submitted Successfully</h2>
          <p className={s.successSub}>Your responses have been recorded.</p>
        </div>
      </div>
    );
  }

  const bi    = Math.min(blockIdx, blocks.length - 1);
  const block = blocks[bi];
  const pi    = Math.min(pageIdx, block.pages.length - 1);
  const page  = block.pages[pi];

  // Phase 2 — per-field role access from the field's `clinical` block. The
  // role is the explicit `userRole` prop if given, else the signed-in user's
  // role from the auth session. With no role resolvable, OR a field with no
  // role list, the field shows + edits exactly as before (safe no-op).
  const effectiveRole =
    (typeof userRole === 'string' && userRole) ||
    currentUser?.roleName ||
    currentUser?.role_name ||
    null;
  const roleEnforced = typeof effectiveRole === 'string' && effectiveRole.length > 0;
  const roleAllows = (roles) =>
    !roleEnforced
    || !Array.isArray(roles)
    || roles.length === 0
    || roles.includes(effectiveRole);
  const canViewField = (field) => roleAllows(field?.clinical?.viewRoles);
  const canEditField = (field) => roleAllows(field?.clinical?.editRoles);
  const visibleFields = (page.fields || []).filter(canViewField);

  const isFirstPage = bi === 0 && pi === 0;
  const isLastPage  = bi === blocks.length - 1 && pi === block.pages.length - 1;

  // Per-page completion state for the footer. A page is "dirty" when any of its
  // fields differ from the baseline (last saved/completed snapshot). The Mark
  // Page Completed button is offered when the page is NOT completed, or has been
  // edited since it was completed; otherwise a "Page Completed" badge shows.
  const pageIsDirty = (pg) =>
    (pg.fields || []).some((f) => !sameValue(values[f.id], baseline[f.id]));
  const currentCompleted = !!completed[page.id];
  const currentDirty     = pageIsDirty(page);
  const showCompleteBtn  = !currentCompleted || currentDirty;

  // Per-field verification state. A field's green "Verified" tag only shows
  // while its value is unchanged since it was verified — editing it makes the
  // prior SDV stale, so the tag clears and the page is no longer fully verified
  // (the Verify button returns). This is how "again changes → show Verify" works.
  const fieldVerified = (f) =>
    verifiedFields[f.id]?.status === 'Verified' && sameValue(values[f.id], baseline[f.id]);
  // Per-page verify status for the sidebar badge: all data fields verified →
  // 'Verified', some → 'Partially Verified', none → null. Uses fieldVerified so
  // an edited field drops the page out of Verified, consistent with the footer.
  const pageVerifyStatus = (pg) => {
    const df = (pg.fields || []).filter((f) => !LAYOUT_TYPES.includes(f.type));
    if (df.length === 0) return null;
    const n = df.filter(fieldVerified).length;
    return n === 0 ? null : n === df.length ? 'Verified' : 'Partially Verified';
  };
  const pageDataFields = (page.fields || []).filter((f) => !LAYOUT_TYPES.includes(f.type));
  const pageFullyVerified = pageDataFields.length > 0 && pageDataFields.every(fieldVerified);
  // Name to show on the "Page Verified" badge (page-row verifier, else any field's).
  const pageVerifier = verifiedPages[page.id]?.verifiedByName
    || pageDataFields.map((f) => fieldVerified(f) && verifiedFields[f.id]?.verifiedByName).find(Boolean)
    || null;

  const goNext = () => {
    if (pi < block.pages.length - 1) setPageIdx(pi + 1);
    else if (bi < blocks.length - 1) { setBlockIdx(bi + 1); setPageIdx(0); }
  };
  const goPrev = () => {
    if (pi > 0) setPageIdx(pi - 1);
    else if (bi > 0) {
      const pb = blocks[bi - 1];
      setBlockIdx(bi - 1);
      setPageIdx(pb.pages.length - 1);
    }
  };
  const goBlock = (i) => { setBlockIdx(i); setPageIdx(0); };
  const goPage  = (i) => setPageIdx(i);

  const goToBlockPage = (blockId, pageId) => {
    const targetBi = blocks.findIndex((b) => b.id === blockId);
    if (targetBi < 0) return;
    const targetPi = pageId
      ? Math.max(0, blocks[targetBi].pages.findIndex((p) => p.id === pageId))
      : 0;
    setBlockIdx(targetBi);
    setPageIdx(targetPi);
    setExpanded((p) => ({ ...p, [blockId]: true }));
  };

  /* ── Search index — matches block title, page title, field label/key. */
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    for (const blk of blocks) {
      if ((blk.title ?? '').toLowerCase().includes(needle)) {
        out.push({ kind: 'block', id: blk.id, label: blk.title || 'Untitled Block', blockId: blk.id, path: 'Block' });
      }
      for (const pg of blk.pages ?? []) {
        if ((pg.title ?? '').toLowerCase().includes(needle)) {
          out.push({ kind: 'page', id: pg.id, label: pg.title || 'Untitled Page', blockId: blk.id, pageId: pg.id, path: `${blk.title || 'Block'} › Page` });
        }
        for (const fld of pg.fields ?? []) {
          const hay = `${fld.label ?? ''} ${fld.key ?? ''}`.toLowerCase();
          if (hay.includes(needle)) {
            out.push({ kind: 'field', id: fld.id, label: fld.label || fld.key || '(unnamed field)', blockId: blk.id, pageId: pg.id, fieldId: fld.id, path: `${blk.title || 'Block'} › ${pg.title || 'Page'}` });
          }
        }
      }
    }
    return out.slice(0, 30);
  }, [search, blocks]);

  useEffect(() => { setHi(0); }, [results]);

  const jumpTo = (r) => {
    goToBlockPage(r.blockId, r.pageId);
    setSearchOpen(false);
    if (r.fieldId) {
      requestAnimationFrame(() => {
        const node = document.querySelector(`[data-field-id="${r.fieldId}"]`);
        if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown')   { e.preventDefault(); setHi((i) => Math.min(i + 1, Math.max(results.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')   { if (results[hi]) { e.preventDefault(); jumpTo(results[hi]); } }
  };

  const iconFor = (kind) =>
    kind === 'block' ? <Layers   size={13} />
  : kind === 'page'  ? <FileText size={13} />
  :                    <TypeIcon size={13} />;

  const totalPages = blocks.reduce((acc, b) => acc + b.pages.length, 0);
  const donePages  = blocks.slice(0, bi).reduce((acc, b) => acc + b.pages.length, 0) + pi + 1;
  const pct        = Math.round((donePages / totalPages) * 100);

  const handleSubmit = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await onSubmit?.(values);
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  // Save progress without finalising — stays on the form (no success screen).
  const handleSave = async () => {
    if (readOnly || saving) return;
    setSaving(true);
    try {
      await onSave?.(values);
    } finally {
      setSaving(false);
    }
  };

  // Mark the CURRENT page Completed → it becomes a Verification Manager
  // work-item. Saves the page's data first so the verifier sees current values.
  const handleCompletePage = async () => {
    if (readOnly || completing) return;
    setCompleting(true);
    try {
      await onSave?.(values);
      await onCompletePage?.(page.id, page.title);
      // Mark this page completed locally and snapshot its values as the new
      // baseline, so the footer flips to "Page Completed" until it's edited again.
      setCompleted((c) => ({
        ...c,
        [page.id]: { completedAt: new Date().toISOString(), status: 'Not Verified' },
      }));
      setBaseline((b) => {
        const next = { ...b };
        for (const f of page.fields || []) next[f.id] = values[f.id];
        return next;
      });
      // Marking a page Completed resets its verification on the backend
      // (resetVerificationsForFormEdit) — clear the now-stale verified state
      // locally so old green tags don't reappear against the new baseline.
      setVerifiedFields((prev) => {
        const next = { ...prev };
        for (const f of page.fields || []) {
          if (next[f.id]) next[f.id] = { status: 'Not Verified', verifiedByName: null, verifiedAt: null };
        }
        return next;
      });
      setVerifiedPages((prev) => ({ ...prev, [page.id]: { status: 'Not Verified' } }));
    } finally {
      setCompleting(false);
    }
  };

  // Verify the CURRENT page (SDV). The Verify dialog hands back the page's data
  // fields with each field's verified flag; the backend persists a row per
  // field and rolls the page up (all → Verified, some → Partially Verified).
  const handleVerifyPage = async (chosenFields) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const result = await onVerifyPage?.(page.id, page.title, chosenFields);
      // Optimistically paint the verified fields green — ticked fields that
      // weren't skipped (open query) become Verified; explicitly unticked clear.
      const skippedSet = new Set(result?.skipped || []);
      const vName = result?.verifiedByName ?? null;
      const now = new Date().toISOString();
      setVerifiedFields((prev) => {
        const next = { ...prev };
        for (const cf of chosenFields) {
          const id = cf.field_name;
          if (!id) continue;
          if (cf.verified && !skippedSet.has(cf.label) && !skippedSet.has(id)) {
            next[id] = { status: 'Verified', verifiedByName: vName, verifiedAt: now };
          } else if (cf.verified === false) {
            next[id] = { status: 'Not Verified', verifiedByName: null, verifiedAt: null };
          }
        }
        return next;
      });
      // Snapshot the page's values so a freshly-verified page reads "not dirty".
      setBaseline((b) => {
        const nb = { ...b };
        for (const f of page.fields || []) nb[f.id] = values[f.id];
        return nb;
      });
      setVerifyOpen(false);
    } finally {
      setVerifying(false);
    }
  };

  // Verify (or unverify) a SINGLE field via the field's Verify popover — routes
  // through the same persisted page-verify path (one field in the list), so the
  // green "Verified · <name>" tag is the single source of truth (no legacy tag).
  const handleVerifyField = async (field, verified, comment) => {
    await handleVerifyPage([{ field_name: field.id, label: field.label ?? field.id, verified, comment }]);
  };

  return (
    <div className={s.root}>
      {/* ── Collapsed sidebar rail (just a re-open chevron) ─────────────── */}
      {sidebarCollapsed && (
        <button
          type="button"
          className={s.btnPrev}
          style={{ position: 'absolute', top: 16, left: 12, zIndex: 5 }}
          onClick={() => setSidebarCollapsed(false)}
          title="Show outline"
          aria-label="Show outline"
        >
          <PanelLeft size={14} /> Outline
        </button>
      )}

      {!sidebarCollapsed && (
        <aside className={s.sidebar}>
          <div className={s.sidebarHead}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span className={s.sidebarTitle}>{formTitle}</span>
              <button
                type="button"
                className={s.btnPrev}
                style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => setSidebarCollapsed(true)}
                title="Hide outline"
                aria-label="Hide outline"
              >
                <PanelLeftClose size={13} />
              </button>
            </div>
            <span className={s.sidebarSub}>{pct}% complete</span>
            <div className={s.progressWrap}>
              <div className={s.progressBar} style={{ width: `${pct}%` }} />
            </div>
          </div>

          <nav className={s.stepList} aria-label="Form sections">
            {blocks.map((blk, i) => {
              const isPast    = i < bi;
              const isCurrent = i === bi;
              const isFuture  = i > bi;
              const isExpanded = !!expanded[blk.id];
              return (
                <div key={blk.id} className={s.stepBlock}>
                  <button
                    type="button"
                    className={`${s.stepBlockHead} ${isCurrent ? s.stepBlockHeadActive : ''} ${isPast ? s.stepBlockHeadDone : ''}`}
                    onClick={() => {
                      // Click toggles expand/collapse on the current/past blocks.
                      // For not-yet-reached blocks we still allow expanding so
                      // users can peek at the structure.
                      toggleSidebarBlock(blk.id);
                      if (!isFuture && !isCurrent) goBlock(i);
                    }}
                    title={blk.title}
                  >
                    <span className={`${s.stepBadge} ${isPast ? s.stepBadgeDone : ''} ${isCurrent ? s.stepBadgeActive : ''}`}>
                      {isPast ? <CheckCircle2 size={12} strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={s.stepBlockLabel}>{blk.title || `Block ${i + 1}`}</span>
                    {/* Active query count across every page in the block. Sourced
                        from the runner-level FormQueriesProvider fetch. */}
                    {(queryCountByBlock.get(blk.id) ?? 0) > 0 && (
                      <span
                        title={`${queryCountByBlock.get(blk.id)} active ${queryCountByBlock.get(blk.id) === 1 ? 'query' : 'queries'} in this block`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 6px', marginLeft: 4,
                          borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                          background: '#fef3c7', color: '#b45309',
                        }}
                      >
                        <AlertCircle size={10} /> {queryCountByBlock.get(blk.id)}
                      </span>
                    )}
                    {/* Block-level lock indicator (Frozen / Locked / Signed). */}
                    <LockBadge formStatus={formStatus} />
                    <span className={s.stepBlockCount}>{blk.pages.length}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        transition: 'transform 0.15s',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        opacity: 0.6,
                      }}
                    />
                  </button>

                  {isExpanded && (
                    <ol className={s.pageList}>
                      {blk.pages.map((pg, j) => {
                        const pPast    = isPast    || (isCurrent && j < pi);
                        const pCurrent = isCurrent && j === pi;
                        const clickable = !isFuture && (isPast || j <= pi);
                        return (
                          <li key={pg.id}>
                            <button
                              type="button"
                              className={`${s.pageItem} ${pCurrent ? s.pageItemActive : ''} ${pPast ? s.pageItemDone : ''}`}
                              onClick={() => clickable && goToBlockPage(blk.id, pg.id)}
                              disabled={!clickable}
                            >
                              <span className={s.pageDot} />
                              <span className={s.pageItemLabel}>{pg.title || `Page ${j + 1}`}</span>
                              {(queryCountByPage.get(pg.id) ?? 0) > 0 && (
                                <span
                                  title={`${queryCountByPage.get(pg.id)} active ${queryCountByPage.get(pg.id) === 1 ? 'query' : 'queries'} on this page`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    marginLeft: 'auto',
                                    padding: '1px 6px', borderRadius: 999,
                                    fontSize: 10, fontWeight: 700,
                                    background: '#fef3c7', color: '#b45309',
                                  }}
                                >
                                  <AlertCircle size={9} /> {queryCountByPage.get(pg.id)}
                                </span>
                              )}
                              {/* Page-level lock + verification indicators.
                                  Lock badge fires on Frozen / Locked / Signed.
                                  Verification badge picks the right symbol
                                  for the page state: ✓ (Verified) > ◔ (In
                                  Verification) > ✕ (data entered, awaiting
                                  verification) > nothing (no data entry). */}
                              <LockBadge formStatus={formStatus} size={9} />
                              <VerificationBadge
                                formStatus={formStatus}
                                dataEntered={dataEnteredByPage.get(pg.id) ?? false}
                                completed={!!completed[pg.id]}
                                verified={pageVerifyStatus(pg)}
                                verifiedBy={verifiedPages[pg.id]?.verifiedByName}
                                size={9}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      )}

      <div className={s.mainCol} style={MAIN_COL_STYLE}>
        <div className={s.contentShell} style={CONTENT_SHELL_STYLE}>

          {/* ── Sticky search bar — Ctrl/⌘+F to focus ─────────────────── */}
          <div className={s.searchBar}>
            <Search size={14} className={s.searchIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              className={s.searchInput}
              placeholder="Search blocks, pages, fields…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => search && setSearchOpen(true)}
              onKeyDown={onSearchKey}
            />
            <span className={s.searchKbd}>Ctrl + F</span>

            {searchOpen && search && (
              <div ref={popRef} className={s.searchPop}>
                {results.length === 0 ? (
                  <div className={s.searchEmpty}>No matches for &ldquo;{search}&rdquo;</div>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      className={`${s.searchRow} ${i === hi ? s.searchRowActive : ''}`}
                      onMouseEnter={() => setHi(i)}
                      onMouseDown={(e) => { e.preventDefault(); jumpTo(r); }}
                    >
                      <span className={`${s.kindBadge} ${s[`kind_${r.kind}`]}`}>
                        {iconFor(r.kind)} {r.kind}
                      </span>
                      <span className={s.searchLabel}>
                        <Highlight text={r.label} needle={search} />
                      </span>
                      <span className={s.searchPath}>
                        <CornerDownRight size={11} /> {r.path}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Phase 1 — form-status pill + transition buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <FormStatusToolbar pageFields={visibleFields} pageTitle={page.title} />
            {canViewFormActivity && formIdFromUrl && (
              <button
                type="button"
                onClick={() => setFormActivityOpen(true)}
                title="View activity log for this form"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', fontSize: 12.5, fontWeight: 600,
                  background: '#fff', color: '#0f172a',
                  border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer',
                }}
              >
                <History size={13} /> Activity Log
              </button>
            )}
          </div>
          <ActivityLogDrawer
            open={formActivityOpen}
            resourceType="form"
            resourceId={formIdFromUrl}
            resourceLabel={formTitle}
            onClose={() => setFormActivityOpen(false)}
          />

          <div className={s.pageHeading}>
            <div>
              <h2 className={s.pageTitle}>{page.title}</h2>
              {page.description && <p className={s.pageDesc}>{page.description}</p>}
            </div>
            <span className={s.pageCounter}>
              Page {pi + 1} / {block.pages.length} · Block {bi + 1} / {blocks.length}
            </span>
          </div>

          <div className={s.fields}>
            {visibleFields.length === 0 ? (
              <div className={s.noFields}>
                <p>This page has no fields.</p>
              </div>
            ) : (
              visibleFields.map((field) => {
                const isLayout = ['h2', 'paragraph', 'divider'].includes(field.type);
                if (isLayout) {
                  return (
                    <div
                      key={field.id}
                      className={`${s.fieldWrap} ${s.fieldWrapLayout}`}
                      data-field-id={field.id}
                    >
                      <FieldInput field={field} value={values[field.id]} onChange={() => {}} />
                    </div>
                  );
                }
                const vTag = fieldVerified(field) ? verifiedFields[field.id] : null;
                return (
                  <div key={field.id} data-field-id={field.id} style={{ minWidth: 0 }}>
                    {vTag && (
                      <span
                        title={`Verified${vTag.verifiedByName ? ` by ${vTag.verifiedByName}` : ''}${vTag.verifiedAt ? ` · ${new Date(vTag.verifiedAt).toLocaleString()}` : ''}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          marginBottom: 4, padding: '1px 8px', borderRadius: 999,
                          fontSize: 11, fontWeight: 700,
                          background: '#dcfce7', color: '#15803d', border: '1px solid #86efac',
                        }}
                      >
                        <CheckCircle2 size={11} /> Verified{vTag.verifiedByName ? ` · ${vTag.verifiedByName}` : ''}
                      </span>
                    )}
                    <RuntimeFieldRenderer
                      field={field}
                      value={values[field.id]}
                      onChange={(v) => setValue(field.id, v)}
                      allValues={values}
                      verifiedInfo={vTag}
                      onVerifyField={onVerifyPage
                        ? (verified, comment) => handleVerifyField(field, verified, comment)
                        : undefined}
                    >
                      {({ field: f, value: v, onChange, disabled }) => (
                        <fieldset
                          disabled={readOnly || disabled || !canEditField(f)}
                          style={{ border: 0, padding: 0, margin: 0 }}
                        >
                          <FieldInput field={f} value={v} onChange={onChange} />
                        </fieldset>
                      )}
                    </RuntimeFieldRenderer>
                  </div>
                );
              })
            )}
          </div>

          <div className={s.navFooter}>
            <button className={s.btnPrev} onClick={goPrev} disabled={isFirstPage}>
              <ChevronLeft size={15} /> Previous
            </button>

            {block.pages.length > 1 && (
              <div className={s.dots}>
                {block.pages.map((_, i) => (
                  <span
                    key={i}
                    className={`${s.dot} ${i === pi ? s.dotActive : ''} ${i < pi ? s.dotDone : ''}`}
                    onClick={() => i <= pi && goPage(i)}
                  />
                ))}
              </div>
            )}

            {onSave && !readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || busy || statusReadOnly}
                title={statusReadOnly
                  ? `Form is ${formStatus} — saving is disabled.`
                  : 'Save progress — the subject stays in Screening'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginLeft: 'auto', marginRight: 8,
                  padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                  border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
                  cursor: (saving || statusReadOnly) ? 'default' : 'pointer',
                  opacity: statusReadOnly ? 0.55 : 1,
                }}
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            )}

            {onCompletePage && !readOnly && (
              showCompleteBtn ? (
                <button
                  type="button"
                  onClick={handleCompletePage}
                  disabled={completing || busy || saving || statusReadOnly}
                  title={statusReadOnly
                    ? `Form is ${formStatus} — cannot change pages.`
                    : currentCompleted
                      ? 'This page changed since it was completed — re-mark it to send the update for verification'
                      : 'Mark this page Completed — sends it to the Verification Manager'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginRight: 8,
                    padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d',
                    cursor: (completing || statusReadOnly) ? 'default' : 'pointer',
                    opacity: statusReadOnly ? 0.55 : 1,
                  }}
                >
                  <CheckCircle2 size={14} /> {completing
                    ? 'Marking…'
                    : currentCompleted ? 'Re-mark Completed' : 'Mark Page Completed'}
                </button>
              ) : (
                <span
                  title="This page is marked completed and has been sent to the Verification Manager. Edit any field to re-mark it."
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginRight: 8,
                    padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                    border: '1px solid #86efac', background: '#dcfce7', color: '#15803d',
                  }}
                >
                  <CheckCircle2 size={14} /> Page Completed
                </span>
              )
            )}

            {onVerifyPage && (
              pageFullyVerified ? (
                <span
                  title={`This page is verified${pageVerifier ? ` by ${pageVerifier}` : ''}. Edit any field to re-verify.`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginRight: 8,
                    padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                    border: '1px solid #86efac', background: '#dcfce7', color: '#15803d',
                  }}
                >
                  <ShieldCheck size={14} /> Page Verified{pageVerifier ? ` · ${pageVerifier}` : ''}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setVerifyOpen(true)}
                  disabled={verifying}
                  title="Verify this page (SDV) — choose the whole page or individual fields"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginRight: 8,
                    padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8',
                    cursor: verifying ? 'default' : 'pointer',
                  }}
                >
                  <ShieldCheck size={14} /> {verifying ? 'Verifying…' : 'Verify Page'}
                </button>
              )
            )}

            {isLastPage ? (
              canSubmit ? (
                <button
                  className={s.btnSubmit}
                  onClick={handleSubmit}
                  disabled={readOnly || busy || statusReadOnly}
                  title={statusReadOnly ? `Form is ${formStatus} — submit is disabled.` : undefined}
                >
                  {busy ? 'Submitting…' : submitLabel} <CheckCircle2 size={14} />
                </button>
              ) : null
            ) : pi === block.pages.length - 1 ? (
              <button className={s.btnNextBlock} onClick={goNext}>
                Next: {blocks[bi + 1]?.title} <ChevronRight size={15} />
              </button>
            ) : (
              <button className={s.btnNext} onClick={goNext}>
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>

          {verifyOpen && onVerifyPage && (
            <VerifyPageDialog
              pageFields={visibleFields}
              values={values}
              pageTitle={page.title}
              saving={verifying}
              onCancel={() => setVerifyOpen(false)}
              onConfirm={handleVerifyPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Verify Page dialog (SDV) ─────────────────────────────────────────────
 * Lists the page's data fields with a checkbox each (default ticked). The
 * verifier confirms the whole page (all ticked) or individual fields (a
 * subset). Hands the full field list back with per-field verified flags so the
 * backend can derive the page status (all → Verified, some → Partially).
 */
const VP_LAYOUT = ['h2', 'paragraph', 'divider'];
const vpBtn  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const vpLink = { border: 'none', background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 };

function VerifyPageDialog({ pageFields, values, pageTitle, saving, onCancel, onConfirm }) {
  const dataFields = (pageFields || []).filter((f) => f && !VP_LAYOUT.includes(f.type));
  const [checks, setChecks] = useState(() => Object.fromEntries(dataFields.map((f) => [f.id, true])));
  const [comment, setComment] = useState('');

  const total = dataFields.length;
  const verifiedCount = dataFields.filter((f) => checks[f.id]).length;
  const pageStatus = total > 0 && verifiedCount === total ? 'Verified'
                   : verifiedCount > 0 ? 'Partially Verified'
                   : 'Not Verified';

  const toggle = (id) => setChecks((c) => ({ ...c, [id]: !c[id] }));
  const setAll = (v)  => setChecks(Object.fromEntries(dataFields.map((f) => [f.id, v])));
  const fmtVal = (v) => {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (Array.isArray(v)) return v.join(', ') || '(empty)';
    return String(v);
  };
  const confirm = () => onConfirm(dataFields.map((f) => ({
    field_name: f.id, label: f.label ?? '', verified: !!checks[f.id], comment: comment.trim() || null,
  })));

  return (
    <div role="dialog" aria-label="Verify page" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>Verify Page (SDV)</strong>
            {pageTitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{pageTitle}</div>}
          </div>
          <button type="button" onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}><XIcon size={14} /></button>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ color: '#475569' }}>Tick the fields you've verified against source.</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
            <button type="button" onClick={() => setAll(true)}  style={vpLink}>Verify all</button>
            <button type="button" onClick={() => setAll(false)} style={vpLink}>Clear</button>
          </span>
        </div>

        <div style={{ padding: '4px 18px', overflowY: 'auto', flex: 1 }}>
          {total === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>No data fields on this page.</p>
          ) : dataFields.map((f) => (
            <label key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!checks[f.id]} onChange={() => toggle(f.id)} style={{ marginTop: 3 }} />
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{f.label || f.id}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{fmtVal(values?.[f.id])}</span>
              </span>
            </label>
          ))}
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder="Optional comment (recorded on the verified fields)…"
            style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', background: '#fafbff', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 12px 12px' }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Page will be: <strong>{pageStatus}</strong> ({verifiedCount}/{total})</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <button type="button" onClick={onCancel} disabled={saving} style={{ ...vpBtn, background: '#fff', border: '1px solid #cbd5e1', color: '#475569' }}>Cancel</button>
            <button type="button" onClick={confirm} disabled={saving || total === 0}
              style={{ ...vpBtn, background: '#2563eb', border: '1px solid #2563eb', color: '#fff', opacity: (saving || total === 0) ? 0.6 : 1 }}>
              <ShieldCheck size={13} /> {saving ? 'Verifying…' : 'Confirm'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Plain field renderer (no collab stack) ──────────────────────────────── */
function FieldInput({ field, value, onChange }) {
  const v = value ?? '';

  switch (field.type) {
    case 'text':
    case 'number':
    case 'email':
    case 'phone':
      return (
        <input
          type={field.type === 'phone' ? 'tel' : field.type}
          className={s.input}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          className={s.textarea}
          placeholder={field.placeholder || ''}
          rows={field.rows ?? 3}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      // Fluent-style calendar popover. Returns the same ISO "YYYY-MM-DD" the
      // backend expects; display is always DD-MMM-YYYY (e.g. "12-MAY-2026").
      return <PlatformDatePicker value={v ?? ''} onChange={onChange} />;
    case 'datetime':
      return <input type="datetime-local" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <input type="time" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'select': {
      if (field.multiple) {
        const selected = Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
        return (
          <select
            className={s.select}
            multiple
            size={Math.min(6, Math.max(3, (field.options ?? []).length))}
            value={selected}
            onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      return (
        <select className={s.select} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'radiogroup':
      return (
        <div className={s.choiceGroup}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${v === o.value ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={v === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case 'checkboxgroup': {
      const checked = Array.isArray(v) ? v : [];
      return (
        <div className={s.choiceGroup}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${checked.includes(o.value) ? s.choiceItemSelected : ''}`}>
              <input
                type="checkbox"
                checked={checked.includes(o.value)}
                onChange={() => {
                  const next = checked.includes(o.value)
                    ? checked.filter((x) => x !== o.value)
                    : [...checked, o.value];
                  onChange(next);
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'toggle':
      return (
        <div className={s.toggleWrap} onClick={() => onChange(!v)}>
          <div className={s.toggleTrack} style={{ background: v ? '#2563eb' : undefined }}>
            <div className={s.toggleThumb} style={{ transform: v ? 'translateX(18px)' : 'translateX(0)' }} />
          </div>
          <span className={s.toggleLabel}>{v ? 'On' : 'Off'}</span>
        </div>
      );
    case 'file':
      return (
        <div className={s.fileZone}>
          <UploadCloud size={20} className={s.fileIcon} />
          <span className={s.fileText}>Click or drag to upload</span>
        </div>
      );
    case 'signature':
      return (
        <div className={s.signaturePad}>
          <PenLine size={18} className={s.signatureIcon} /><span>Sign here</span>
        </div>
      );
    case 'rating': {
      const rating = Number(v) || 0;
      return (
        <div className={s.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={24}
              className={s.starIcon}
              style={{ color: n <= rating ? '#f59e0b' : undefined, cursor: 'pointer' }}
              onClick={() => onChange(n)}
            />
          ))}
        </div>
      );
    }
    case 'slider': {
      const min  = Number(field.minValue ?? 0);
      const max  = Number(field.maxValue ?? 100);
      const step = Number(field.step    ?? 1);
      const cur  = v === '' || v == null ? min : Number(v);
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24, textAlign: 'right' }}>{min}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={cur}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24 }}>{max}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>
            {cur}
          </span>
        </div>
      );
    }
    case 'h2':
      return <h2 className={s.h2}>{field.label || 'Section Title'}</h2>;
    case 'paragraph':
      return <p className={s.paragraph}>{field.content || field.label || 'Paragraph text.'}</p>;
    case 'divider':
      return <hr className={s.divider} />;
    default:
      return (
        <input
          type="text"
          className={s.input}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
