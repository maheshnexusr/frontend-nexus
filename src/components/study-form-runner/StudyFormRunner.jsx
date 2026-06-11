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
  Search, FileText, Type as TypeIcon, CornerDownRight, PanelLeft,
  AlertCircle, Lock, Snowflake, CircleDot, X as XIcon, Save, ShieldCheck, ArrowLeft,
} from 'lucide-react';
import RuntimeFieldRenderer from '@/features/cro/components/study-form/runtime/RuntimeFieldRenderer';
import { evaluateField, evaluateEligibility } from '@/features/cro/components/study-form/runtime/runtimeEngine';
import { headingStyleToCss } from '@/features/cro/components/study-form/headingStyle';
import SignatureInput       from './SignatureInput';
import { uploadFormFile }    from '@/api/formFileClient';
import { resolveFileUrl }    from '@/api/fileUrl';
import { FormQueriesProvider, useFormQueries } from './FormQueriesContext';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
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
const LAYOUT_TYPES = ['h2', 'h3', 'paragraph', 'divider'];

// Record-status workflow colours (Draft → … → Completed).
const RECORD_STATUS_STYLE = {
  'Draft':              { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
  'Under Verification': { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  'Verified':           { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' },
  'Query Raised':       { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  'Response Pending':   { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  'Query Resolved':     { background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' },
  'Completed':          { background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7' },
};

// Inclusion/Exclusion eligibility chip colours.
const ELIG_STYLE = {
  'Included':       { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' },
  'Excluded':       { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  'Pending Review': { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
  'Screen Failed':  { background: '#fef2f2', color: '#9f1239', border: '1px solid #fecdd3' },
};

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
  // stays in Pending). Submit remains the finalising action.
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
  // Inclusion/Exclusion criteria (form-level) → live eligibility badge.
  eligibilityCriteria = [],
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
  // Step-3 study module toggles. When Verification Manager is OFF the whole
  // verification workflow is hidden (record_status chip, "Page Verified" badge,
  // Verify Page); when Query Manager is OFF the query chips/counters are hidden.
  // Default true so existing callers keep the full workflow.
  verificationEnabled = true,
  queryEnabled = true,
  // Optional "Back" handler. When provided, a compact Back button is rendered
  // in the sidebar header (next to "Progress Overview") and in the collapsed
  // rail — so the page no longer needs its own top bar.
  onBack,
  // Optional node rendered at the very top of the main content column, above
  // the search bar (e.g. the subject identity strip + header actions). Lets the
  // capture pages drop their separate top bar and let the form fill the height.
  topContent = null,
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
  // Set true when the user tries to leave a page (Next) with mandatory fields
  // still empty — drives the inline warning + red highlight on the missing
  // fields. Reset on every page change (effect below).
  const [triedNext,  setTriedNext]  = useState(false);
  // Holds the empty SOFT-required fields when a Submit is blocked because of
  // them — drives the inline warning. Soft check blocks Submit (but NOT Save).
  const [softBlocked, setSoftBlocked] = useState([]);
  // Open the app-styled "confirm before submit" dialog once checks pass.
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  // Deep-link support — ?pageId=… jumps straight to a page (used below).
  const [params] = useSearchParams();

  // NOTE: verification STATUS (green field tag, "Page Verified" badge, sidebar
  // check) is shown to EVERYONE — it reflects the true state of the data, so a
  // PI/data-entry role correctly sees "Verified" once it's verified. Only the
  // verify ACTION (the field Verify icon + Verify Page button) is gated, via
  // useFieldCapabilities.canSeeVerification (data_verification) in FieldToolbar
  // / the capture page's canVerify. Do NOT gate the status display.

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

  // Sticky subject header — measure its height so the (also-sticky) search bar
  // can pin directly beneath it instead of overlapping at top:0.
  const topRef = useRef(null);
  const [headerH, setHeaderH] = useState(0);
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) { setHeaderH(0); return undefined; }
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [topContent]);

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

  // ── Conditional Visibility (Phase 2) — block & page level ────────────────
  // Ordered [blockIndex, pageIndex] of every VISIBLE page (block/page `condition`
  // not evaluating to hidden against the live values). Drives prev/next, the
  // sidebar, and the "current page got hidden → move off it" effect below.
  const visiblePositions = useMemo(() => {
    const out = [];
    (blocks || []).forEach((blk, b) => {
      if (evaluateField(blk, values).hidden) return;
      (blk.pages || []).forEach((pg, p) => {
        if (evaluateField(pg, values).hidden) return;
        out.push([b, p]);
      });
    });
    return out;
  }, [blocks, values]);

  // If the page the user is on becomes hidden (a value change flipped a
  // condition), jump to the nearest still-visible page.
  useEffect(() => {
    if (!visiblePositions.length) return;
    const b = Math.min(blockIdx, (blocks.length || 1) - 1);
    const curBlock = blocks[b];
    const p = curBlock ? Math.min(pageIdx, (curBlock.pages.length || 1) - 1) : 0;
    if (visiblePositions.some(([vb, vp]) => vb === b && vp === p)) return;
    const next = visiblePositions.find(([vb, vp]) => vb > b || (vb === b && vp >= p))
              ?? visiblePositions[visiblePositions.length - 1];
    if (next && (next[0] !== blockIdx || next[1] !== pageIdx)) {
      setBlockIdx(next[0]);
      setPageIdx(next[1]);
    }
  }, [visiblePositions, blockIdx, pageIdx, blocks]);

  // Clear the per-page hard "fill mandatory fields" warning on page change. The
  // soft-block list is NOT cleared here — submit blocking navigates the user to
  // the missing field, so the list must survive that page change; it's cleared
  // on a successful submit (or refreshed on the next submit attempt).
  useEffect(() => { setTriedNext(false); }, [blockIdx, pageIdx]);

  // Clear-on-hide (Phase 4) at the FORM level so it works even though hidden
  // fields are no longer rendered: a field with `clearOnHide` whose condition
  // currently hides it gets its value wiped (default policy is retain).
  useEffect(() => {
    const patch = {};
    for (const blk of blocks || []) {
      for (const pg of blk.pages || []) {
        for (const f of pg.fields || []) {
          // `clear_on_hide` (snake) is what the API returns; `clearOnHide` is
          // the in-builder camelCase — accept either.
          if (!(f?.clearOnHide ?? f?.clear_on_hide)) continue;
          if (!evaluateField(f, values).hidden) continue;
          const v = values[f.id];
          const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
          if (!empty) patch[f.id] = '';
        }
      }
    }
    if (Object.keys(patch).length) setValues((prev) => ({ ...prev, ...patch }));
  }, [values, blocks]);

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

  // ── Conditional Visibility (Phase 2) — block & page level ────────────────
  // A block/page carries its own `condition` (same shape as a field's). We
  // evaluate it against the live form values: HIDDEN blocks/pages drop out of
  // navigation + the sidebar; READ-ONLY blocks/pages force every field inside
  // them non-editable. A page inherits its block's hidden/read-only state.
  const blockEff = (blk) => evaluateField(blk, values);
  const pageEff  = (blk, pg) => {
    const b = evaluateField(blk, values);
    const p = evaluateField(pg, values);
    return { hidden: b.hidden || p.hidden, readOnly: b.readOnly || p.readOnly };
  };
  // Index of the current page within the visible list (source of truth for
  // prev/next + first/last). `pageReadOnly` forces this page's fields read-only.
  const curVisIdx = visiblePositions.findIndex(([b, p]) => b === bi && p === pi);
  const pageReadOnly = pageEff(block, page).readOnly;

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
  // Fields actually painted on this page = role-visible AND not conditionally
  // hidden. Excluding hidden fields HERE (not just returning null inside the
  // renderer) means they don't leave an empty grid cell / gap in the layout.
  const renderFields = visibleFields.filter((f) => !evaluateField(f, values).hidden);

  const isFirstPage = curVisIdx <= 0;
  const isLastPage  = curVisIdx === visiblePositions.length - 1;

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
  // Per-page verify rollup — MUST mirror the backend so the footer badge and the
  // server agree. A field counts only if it's a visible (non-layout, non-hidden)
  // data field; the denominator = FILLED fields + REQUIRED-but-empty fields, and
  // the numerator = verified filled fields. Empty OPTIONAL fields are "not
  // applicable" → excluded, so they don't keep a page from reaching Verified.
  const fieldHasValue = (f) => {
    const v = values[f.id];
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  };
  const isVisibleData = (f) =>
    !LAYOUT_TYPES.includes(f.type) && !evaluateField(f, values).hidden;
  const pageVerifyRollup = (pg) => {
    const data = (pg.fields || []).filter(isVisibleData);
    const filled = data.filter(fieldHasValue);
    const requiredEmpty = data.filter((f) => f.required && !fieldHasValue(f));
    const denom = filled.length + requiredEmpty.length;
    const verified = filled.filter(fieldVerified).length;
    return { denom, verified };
  };
  const pageVerifyStatus = (pg) => {
    const { denom, verified } = pageVerifyRollup(pg);
    if (denom === 0) return null;
    return verified >= denom ? 'Verified' : verified > 0 ? 'Partially Verified' : null;
  };
  // Hard vs soft edit checks (clinical). hardCheck defaults ON → a required
  // field blocks Save/Submit. A required field with hardCheck OFF + softCheck ON
  // only WARNS (the user can continue). Both on → hard wins (blocks).
  // hardCheck/softCheck may arrive camelCase (builder) or snake_case (some save
  // paths) — accept either. hardCheck defaults ON when unset.
  const hardOf = (f) => f.hardCheck ?? f.hard_check;
  const softOf = (f) => f.softCheck ?? f.soft_check;
  const isHardReq = (f) => f.required === true && hardOf(f) !== false;
  const isSoftReq = (f) => f.required === true && softOf(f) === true && hardOf(f) === false;
  const fieldName = (f) => f.label || f.key || f.name || 'this field';
  const hardMsg   = (f) => ((f.hardMessage ?? f.hard_message)?.trim() || (f.requiredMessage ?? f.required_message)?.trim() || '{Field Name} is required.').replace(/\{Field Name\}/g, fieldName(f));
  const softMsg   = (f) => ((f.softMessage ?? f.soft_message)?.trim() || 'Please fill {Field Name}.').replace(/\{Field Name\}/g, fieldName(f));

  // Mandatory-field gate for page navigation: a VISIBLE hard-required field left
  // blank blocks Next (and is flagged inline). Mirrors the backend submit gate
  // (requiredFields.js) — layout + conditionally-hidden fields are excluded.
  const pageMissingRequired = (pg) =>
    (pg.fields || []).filter(isVisibleData).filter((f) => isHardReq(f) && !fieldHasValue(f));
  const missingRequiredNow = pageMissingRequired(page);
  const missingRequiredIds = new Set(missingRequiredNow.map((f) => f.id));

  // Fields flagged by a blocked submit (soft-required + empty) → drives the
  // inline amber message shown right under each offending field and the summary
  // list. A field drops out as soon as it's filled, so messages clear live.
  const softStillMissing = softBlocked.filter((e) => !fieldHasValue(e.field));
  const softBlockedIds = new Set(softStillMissing.map((e) => e.field.id));

  // Empty SOFT-required fields across every visible page — collected at submit
  // time so we can BLOCK submit and jump the user to the first one. Each entry
  // carries its block/page id so we can navigate straight to it.
  const allSoftMissing = () => {
    const out = []; // [{ field, blockId, pageId }]
    for (const blk of blocks) {
      if (evaluateField(blk, values).hidden) continue;
      for (const pg of blk.pages || []) {
        if (pageEff(blk, pg).hidden) continue;
        for (const f of pg.fields || []) {
          if (LAYOUT_TYPES.includes(f.type)) continue;
          if (evaluateField(f, values).hidden) continue;
          if (isSoftReq(f) && !fieldHasValue(f)) out.push({ field: f, blockId: blk.id, pageId: pg.id });
        }
      }
    }
    return out;
  };

  const pageDataFields = (page.fields || []).filter(isVisibleData);
  const curRollup = pageVerifyRollup(page);
  const pageFullyVerified = curRollup.denom > 0 && curRollup.verified >= curRollup.denom;
  // Name to show on the "Page Verified" badge (page-row verifier, else any field's).
  const pageVerifier = verifiedPages[page.id]?.verifiedByName
    || pageDataFields.map((f) => fieldVerified(f) && verifiedFields[f.id]?.verifiedByName).find(Boolean)
    || null;
  // Record-status workflow state for THIS page (Draft → Under Verification →
  // Verified → … → Completed). Falls back to Draft for a page that hasn't been
  // Marked Completed yet.
  const baseRecordStatus = verifiedPages[page.id]?.recordStatus
    || (currentCompleted ? 'Under Verification' : 'Draft');
  // Live override so the chip reflects query actions WITHOUT a reload: the
  // FormQueriesProvider refreshes after every raise/answer/close, so the active
  // query count is current. Open query on the page → Query Raised / Response
  // Pending; queries just cleared → Query Resolved. (The exact backend value
  // refreshes on next load.)
  const activePageQueries = queryEnabled ? (queryCountByPage.get(page.id) ?? 0) : 0;
  const currentRecordStatus =
    activePageQueries > 0
      ? (baseRecordStatus === 'Response Pending' ? 'Response Pending' : 'Query Raised')
      : (['Query Raised', 'Response Pending'].includes(baseRecordStatus) ? 'Query Resolved' : baseRecordStatus);

  // Live Inclusion/Exclusion eligibility — recomputed as the user types (spec's
  // real-time validation). The backend persists the authoritative value on save.
  const liveEligibility = evaluateEligibility(eligibilityCriteria, values);

  // Prev/Next step over VISIBLE pages only, so conditionally-hidden pages/blocks
  // are skipped during navigation.
  const goNext = () => {
    // Block forward navigation until every visible mandatory field on this page
    // is filled — the user must complete the page before moving on.
    if (!readOnly && missingRequiredNow.length) {
      setTriedNext(true);
      return;
    }
    const n = visiblePositions[curVisIdx + 1];
    if (n) { setBlockIdx(n[0]); setPageIdx(n[1]); }
  };
  const goPrev = () => {
    const n = visiblePositions[curVisIdx - 1];
    if (n) { setBlockIdx(n[0]); setPageIdx(n[1]); }
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
    // Soft checks BLOCK Submit (but never Save): an empty soft-required field
    // stops the submit, jumps the user to the FIRST missing field, and lists
    // them inline — there is no "submit anyway".
    const soft = allSoftMissing();
    if (soft.length) {
      setSoftBlocked(soft);
      jumpToField(soft[0].blockId, soft[0].pageId, soft[0].field.id);
      return;
    }
    setSoftBlocked([]);
    // Checks passed — ask for confirmation via the app's own dialog (no native
    // browser popup) before finalising.
    setSubmitConfirmOpen(true);
  };

  // Actual submit, run after the user confirms in the dialog.
  const doSubmit = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await onSubmit?.(values);
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  // Navigate to a field's block/page and scroll it into view + focus highlight.
  const jumpToField = (blockId, pageId, fieldId) => {
    goToBlockPage(blockId, pageId);
    requestAnimationFrame(() => {
      const node = document.querySelector(`[data-field-id="${fieldId}"]`);
      if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // Save progress without finalising — stays on the form (no success screen).
  // Hard checks block Save too (spec: hard = cannot save/submit until filled);
  // soft-required fields don't block. Flag the offending fields inline.
  const handleSave = async () => {
    if (readOnly || saving) return;
    if (missingRequiredNow.length) {
      setTriedNext(true);
      return;
    }
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
    <div className={`${s.root} ${sidebarCollapsed ? s.rootCollapsed : ''}`}>
      {/* ── Collapsed sidebar rail (Back + re-open chevron) ─────────────── */}
      {sidebarCollapsed && (
        <div style={{ position: 'absolute', top: 16, left: 12, zIndex: 5, display: 'flex', gap: 6 }}>
          {onBack && (
            <button
              type="button"
              className={s.btnPrev}
              onClick={onBack}
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button
            type="button"
            className={s.btnPrev}
            onClick={() => setSidebarCollapsed(false)}
            title="Show outline"
            aria-label="Show outline"
          >
            <PanelLeft size={14} /> Outline
          </button>
        </div>
      )}

      {!sidebarCollapsed && (
        <aside className={s.sidebar}>
          <div className={s.sidebarHead}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back"
                aria-label="Back"
                style={{
                  display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
                  gap: 3, marginBottom: 10,
                  padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  border: '1px solid #e2e8f0', background: '#fff', color: '#334155', cursor: 'pointer',
                }}
              >
                <ArrowLeft size={12} /> Back
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={s.sidebarTitle}>Progress Overview</span>
            </div>
            <span className={s.sidebarSub}>{pct}% complete</span>
            <div className={s.progressWrap}>
              <div className={s.progressBar} style={{ width: `${pct}%` }} />
            </div>
          </div>

          <nav className={s.stepList} aria-label="Form sections">
            {blocks.map((blk, i) => {
              // Conditionally-hidden blocks drop out of the outline entirely.
              if (blockEff(blk).hidden) return null;
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
                    {queryEnabled && (queryCountByBlock.get(blk.id) ?? 0) > 0 && (
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
                        // Skip conditionally-hidden pages.
                        if (pageEff(blk, pg).hidden) return null;
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
                              {queryEnabled && (queryCountByPage.get(pg.id) ?? 0) > 0 && (
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
                              {verificationEnabled && (
                                <VerificationBadge
                                  formStatus={formStatus}
                                  dataEntered={dataEnteredByPage.get(pg.id) ?? false}
                                  completed={!!completed[pg.id]}
                                  verified={pageVerifyStatus(pg)}
                                  verifiedBy={verifiedPages[pg.id]?.verifiedByName}
                                  size={9}
                                />
                              )}
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

          {/* Page-supplied header (subject identity strip + actions like the
              Prescriptions button). Sticky so it stays pinned while the form
              scrolls; the search bar below pins directly beneath it. */}
          {topContent && (
            <div
              ref={topRef}
              style={{ position: 'sticky', top: 0, zIndex: 21, background: '#f8fafc', paddingBottom: 10 }}
            >
              {topContent}
            </div>
          )}

          {/* ── Sticky search bar — Ctrl/⌘+F to focus ─────────────────── */}
          <div className={s.searchBar} style={topContent ? { top: headerH } : undefined}>
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
            {renderFields.length === 0 ? (
              <div className={s.noFields}>
                <p>This page has no fields.</p>
              </div>
            ) : (
              renderFields.map((field) => {
                const isLayout = ['h2', 'h3', 'paragraph', 'divider'].includes(field.type);
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
                const reqMissing = triedNext && missingRequiredIds.has(field.id);
                const softMissing = softBlockedIds.has(field.id);
                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    style={{
                      minWidth: 0,
                      // Flag a mandatory field the user tried to skip past. Outline
                      // doesn't affect layout flow, so the grid doesn't shift.
                      // Hard (red) takes precedence over soft (amber).
                      ...(reqMissing
                        ? { outline: '2px solid #fca5a5', outlineOffset: 4, borderRadius: 6 }
                        : softMissing
                          ? { outline: '2px solid #fcd34d', outlineOffset: 4, borderRadius: 6 }
                          : {}),
                    }}
                  >
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
                          disabled={readOnly || pageReadOnly || disabled || !canEditField(f)}
                          style={{ border: 0, padding: 0, margin: 0 }}
                        >
                          <FieldInput field={f} value={v} onChange={onChange} />
                        </fieldset>
                      )}
                    </RuntimeFieldRenderer>
                    {softMissing && (
                      <div
                        role="alert"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          marginTop: 4, fontSize: 12, fontWeight: 600, color: '#b45309',
                        }}
                      >
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        {softMsg(field)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {triedNext && missingRequiredNow.length > 0 && (
            <div
              role="alert"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                margin: '0 0 10px', padding: '10px 14px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                fontSize: 13, fontWeight: 600,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {missingRequiredNow.map((f) => <span key={f.id}>{hardMsg(f)}</span>)}
              </span>
            </div>
          )}

          <div className={s.navFooter}>
            {/* Record-status workflow chip — only when Verification Manager is
                enabled for the study (otherwise the page has no verification
                lifecycle, so "Under Verification" etc. is meaningless). */}
            {verificationEnabled && (
              <span
                title="Workflow status of this page"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 4,
                  padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                  ...(RECORD_STATUS_STYLE[currentRecordStatus] || RECORD_STATUS_STYLE.Draft),
                }}
              >
                <CircleDot size={11} /> {currentRecordStatus}
              </span>
            )}
            {/* Live Inclusion/Exclusion eligibility (subject-level, updates as you type). */}
            {liveEligibility.status && (
              <span
                title={liveEligibility.reason || `Eligibility: ${liveEligibility.status}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 4,
                  padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                  ...(ELIG_STYLE[liveEligibility.status] || ELIG_STYLE['Pending Review']),
                }}
              >
                {liveEligibility.status}
              </span>
            )}
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
                  : 'Save progress — the subject stays in Pending'}
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
                  title="Verify this page — choose the whole page or individual fields"
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
              pageFields={visibleFields.filter((f) => !evaluateField(f, values).hidden)}
              values={values}
              blockTitle={block.title}
              pageTitle={page.title}
              saving={verifying}
              onCancel={() => setVerifyOpen(false)}
              onConfirm={handleVerifyPage}
            />
          )}

          <ConfirmDialog
            open={submitConfirmOpen}
            onClose={() => setSubmitConfirmOpen(false)}
            onConfirm={doSubmit}
            variant="info"
            title="Submit form"
            message="Submit this form? Once submitted it becomes read-only — further changes go through the Reopen flow."
            confirmLabel="Submit"
            cancelLabel="Cancel"
          />
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
const VP_LAYOUT = ['h2', 'h3', 'paragraph', 'divider'];
const vpBtn  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const vpLink = { border: 'none', background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 };

function VerifyPageDialog({ pageFields, values, blockTitle, pageTitle, saving, onCancel, onConfirm }) {
  const crfBlockPage = [blockTitle, pageTitle].filter(Boolean).join(' / ');
  const dataFields = (pageFields || []).filter((f) => f && !VP_LAYOUT.includes(f.type));
  // Only FILLED fields are verifiable. The MANDATORY flag (field.required, from
  // the form builder) decides what an EMPTY field means: a required-but-empty
  // field still COUNTS toward the page (mandatory data missing → can't reach
  // 100%); an optional-empty field is excluded (not applicable). Mirrors the
  // backend, which enforces this authoritatively.
  const isFilled = (v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  };
  const fieldFilled = (f) => isFilled(values?.[f.id]);
  const isReq = (f) => f.required === true;
  // Counted toward the page total = filled OR required.
  const countedFields = dataFields.filter((f) => fieldFilled(f) || isReq(f));
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(dataFields.map((f) => [f.id, fieldFilled(f)])));
  const [comment, setComment] = useState('');

  const total = countedFields.length;
  const verifiedCount = countedFields.filter((f) => fieldFilled(f) && checks[f.id]).length;
  const pageStatus = total > 0 && verifiedCount === total ? 'Verified'
                   : verifiedCount > 0 ? 'Partially Verified'
                   : 'Not Verified';

  const toggle = (id, filled) => { if (filled) setChecks((c) => ({ ...c, [id]: !c[id] })); };
  const setAll = (v)  => setChecks(Object.fromEntries(dataFields.map((f) => [f.id, v && fieldFilled(f)])));
  const fmtVal = (v) => {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (Array.isArray(v)) return v.join(', ') || '(empty)';
    return String(v);
  };
  const confirm = () => onConfirm(dataFields.map((f) => ({
    field_name: f.id, label: f.label ?? '', verified: fieldFilled(f) && !!checks[f.id], comment: comment.trim() || null,
  })));

  return (
    <div role="dialog" aria-label="Verify page" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>Verify Page</strong>
            {crfBlockPage && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{crfBlockPage}</div>}
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
          ) : dataFields.map((f) => {
            const filled = fieldFilled(f);
            const reqEmpty = !filled && isReq(f);
            return (
              <label
                key={f.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc', cursor: filled ? 'pointer' : 'not-allowed', opacity: filled ? 1 : 0.7 }}
                title={filled ? undefined : (reqEmpty ? 'Required field is empty — page can\'t be fully verified until it\'s filled' : 'Empty field — nothing to verify')}
              >
                <input type="checkbox" checked={filled && !!checks[f.id]} disabled={!filled} onChange={() => toggle(f.id, filled)} style={{ marginTop: 3 }} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {f.label || f.id}
                    {isReq(f) && <span style={{ color: '#dc2626' }}> *</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
                    {fmtVal(values?.[f.id])}
                    {reqEmpty && <em style={{ color: '#dc2626' }}> · required — missing data</em>}
                    {!filled && !reqEmpty && <em style={{ color: '#94a3b8' }}> · not verifiable (empty)</em>}
                  </span>
                </span>
              </label>
            );
          })}
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
              <ShieldCheck size={13} /> {saving ? 'Verifying…' : 'Mark Page as Verified'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Plain field renderer (no collab stack) ──────────────────────────────── */
// Real file/attachment input — UPLOADS each chosen file to the backend (stored
// on disk under /var/www/uploads/<env>/<study_id>/) and stores only a small
// reference { name, type, size, url } in the form value (single file → object,
// multi → array). Older records may carry { dataUrl } (legacy inline base64) —
// those still render via the url ?? dataUrl fallback below.
// Honours the field's accept (types), maxSize (MB) and maxFiles config.
// True if `file` satisfies the accept string (".jpg,.png", "image/*", "application/pdf").
// The native accept attr is only a picker hint — this enforces it on selection.
function fileMatchesAccept(file, accept) {
  const tokens = (accept || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  return tokens.some((tok) => {
    if (tok.startsWith('.')) return name.endsWith(tok);          // extension
    if (tok.endsWith('/*')) return mime.startsWith(tok.slice(0, -1)); // image/*
    return mime === tok;                                          // exact mime
  });
}

function FileFieldInput({ field, value, onChange }) {
  const inputRef = useRef(null);
  // field.multiple (set via the builder's "Allow multiple files" toggle) is
  // authoritative; legacy fields fall back to their multi-variant type.
  const multiple = field.multiple != null
    ? !!field.multiple
    : (field.type === 'multifile' || field.type === 'multiimage');
  const accept = field.accept || ((field.type === 'image' || field.type === 'multiimage') ? 'image/*' : '');
  const maxSizeMb = Number(field.maxSize) || 0;
  const maxFiles = multiple ? (Number(field.maxFiles) || 10) : 1;
  const files = Array.isArray(value) ? value : (value ? [value] : []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const href = (f) => resolveFileUrl(f?.url ?? f?.dataUrl);
  const isImage = (f) => (f?.type || '').startsWith('image/');

  const onPick = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    setError('');
    const ok = [];
    let tooBig = 0;
    let wrongType = 0;
    setUploading(true);
    try {
      for (const f of picked) {
        if (!fileMatchesAccept(f, accept)) { wrongType++; continue; }
        if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) { tooBig++; continue; }
        // image fields → studies/study_<id>/images/, other files → .../files/
        const category = (field.type === 'image' || field.type === 'multiimage') ? 'images' : 'files';
        ok.push(await uploadFormFile(f, category)); // { url, name, type, size }
      }
      const msgs = [];
      if (wrongType) msgs.push(`${wrongType} file(s) were not an accepted type (${accept}) and were skipped.`);
      if (tooBig) msgs.push(`${tooBig} file(s) exceeded the ${maxSizeMb}MB limit and were skipped.`);
      if (msgs.length) setError(msgs.join(' '));
      if (ok.length) {
        if (multiple) onChange([...files, ...ok].slice(0, maxFiles));
        else onChange(ok[0]);
      }
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const remove = (i) => {
    if (multiple) onChange(files.filter((_, j) => j !== i));
    else onChange('');
  };

  return (
    <div>
      <button type="button" className={s.fileZone} onClick={() => inputRef.current?.click()} disabled={uploading} style={{ width: '100%', opacity: uploading ? 0.6 : 1, cursor: uploading ? 'wait' : 'pointer' }}>
        <UploadCloud size={26} className={s.fileIcon} />
        <span className={s.fileText}>
          {uploading ? 'Uploading…' : (multiple ? 'Click to upload files' : 'Click to upload a file')}
        </span>
        {!uploading && (
          <span className={s.fileHint}>
            {[
              multiple ? `Up to ${maxFiles} files` : 'Single file',
              maxSizeMb ? `max ${maxSizeMb}MB each` : null,
              accept ? accept.replace(/,/g, ', ') : 'Any file type',
            ].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept={accept || undefined} multiple={multiple} style={{ display: 'none' }} onChange={onPick} />
      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      {files.length > 0 && (() => {
        const totalKb = files.reduce((sum, f) => sum + (f?.size || 0), 0) / 1024;
        const sizeLabel = totalKb >= 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${Math.round(totalKb)} KB`;
        return (
          <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {/* Compact summary — one fixed-height row. Collapsed by default so the
                file count never grows the form. Expand to manage on demand. */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', flexShrink: 0 }}>
                {files.slice(0, 4).map((f, i) => (
                  isImage(f) && href(f)
                    ? <img key={i} src={href(f)} alt="" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', border: '1.5px solid #fff', marginLeft: i ? -9 : 0, boxShadow: '0 0 0 1px #e2e8f0' }} />
                    : <span key={i} style={{ width: 26, height: 26, borderRadius: 5, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', marginLeft: i ? -9 : 0 }}><FileText size={12} style={{ color: '#64748b' }} /></span>
                ))}
              </div>
              <span style={{ flex: 1, fontSize: 12.5, color: '#334155', fontWeight: 600 }}>
                {files.length} {files.length === 1 ? 'file' : 'files'}
                <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {sizeLabel}</span>
              </span>
              <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {expanded ? 'Hide' : 'Manage'}
                <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </span>
            </button>
            {/* Expanded gallery — capped height with internal scroll, so even open
                it can't push the rest of the form down past ~2 rows. */}
            {expanded && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8, padding: 10, maxHeight: 196, overflowY: 'auto', borderTop: '1px solid #e2e8f0' }}>
                {files.map((f, i) => {
                  const img = isImage(f) && href(f);
                  return (
                    <div key={i} title={f?.name} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label="Remove"
                        style={{ position: 'absolute', top: 3, right: 3, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.6)', color: '#fff', cursor: 'pointer', padding: 0 }}
                      >
                        <XIcon size={11} />
                      </button>
                      {img ? (
                        <a href={href(f)} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                          <img src={href(f)} alt={f?.name ?? 'image'} style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} />
                        </a>
                      ) : (
                        <a href={href(f) || undefined} target="_blank" rel="noreferrer" download={f?.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70, textDecoration: 'none' }}>
                          <FileText size={22} style={{ color: '#94a3b8' }} />
                        </a>
                      )}
                      <div style={{ padding: '4px 6px' }}>
                        <div style={{ fontSize: 10.5, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f?.name ?? 'file'}</div>
                        {f?.size ? <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{(f.size / 1024).toFixed(0)} KB</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  const v = value ?? '';
  // "Other" free-text mode for radio/checkbox groups (allowOther).
  const [otherOpen, setOtherOpen] = useState(false);
  const choiceStyle = field.orientation === 'horizontal'
    ? { flexDirection: 'row', flexWrap: 'wrap' }
    : undefined;

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
    case 'radiogroup': {
      const opts = field.options ?? [];
      const isOpt = opts.some((o) => o.value === v);
      const otherSel = field.allowOther && (otherOpen || (v !== '' && v != null && !isOpt));
      return (
        <div className={s.choiceGroup} style={choiceStyle}>
          {opts.map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${v === o.value && !otherSel ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={v === o.value && !otherSel} onChange={() => { setOtherOpen(false); onChange(o.value); }} />
              <span>{o.label}</span>
            </label>
          ))}
          {field.allowOther && (
            <label className={`${s.choiceItem} ${otherSel ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={otherSel} onChange={() => { setOtherOpen(true); onChange(''); }} />
              <span>{field.otherLabel || 'Other'}</span>
            </label>
          )}
          {otherSel && field.otherFreeText !== false && (
            <input className={s.input} style={{ marginTop: 6 }} placeholder="Please specify…" value={isOpt ? '' : v} onChange={(e) => onChange(e.target.value)} />
          )}
        </div>
      );
    }
    case 'checkboxgroup': {
      const opts = field.options ?? [];
      const optVals = opts.map((o) => o.value);
      const checked = Array.isArray(v) ? v : [];
      const otherVal = checked.find((x) => !optVals.includes(x));
      const otherChk = field.allowOther && (otherOpen || otherVal !== undefined);
      return (
        <div className={s.choiceGroup} style={choiceStyle}>
          {opts.map((o) => (
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
          {field.allowOther && (
            <label className={`${s.choiceItem} ${otherChk ? s.choiceItemSelected : ''}`}>
              <input
                type="checkbox"
                checked={otherChk}
                onChange={() => {
                  if (otherChk) { setOtherOpen(false); onChange(checked.filter((x) => optVals.includes(x))); }
                  else setOtherOpen(true);
                }}
              />
              <span>{field.otherLabel || 'Other'}</span>
            </label>
          )}
          {otherChk && field.otherFreeText !== false && (
            <input
              className={s.input}
              style={{ marginTop: 6 }}
              placeholder="Please specify…"
              value={otherVal ?? ''}
              onChange={(e) => {
                const base = checked.filter((x) => optVals.includes(x));
                onChange(e.target.value ? [...base, e.target.value] : base);
              }}
            />
          )}
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
    case 'image':
    case 'multifile':
    case 'multiimage':
      return <FileFieldInput field={field} value={value} onChange={onChange} />;
    case 'signature':
      return <SignatureInput value={typeof v === 'string' ? v : ''} onChange={onChange} />;
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
      return <h2 className={s.h2} style={headingStyleToCss(field)}>{field.label || 'Section Title'}</h2>;
    case 'h3':
      return <h3 className={s.h3} style={headingStyleToCss(field)}>{field.label || 'Sub-heading'}</h3>;
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
