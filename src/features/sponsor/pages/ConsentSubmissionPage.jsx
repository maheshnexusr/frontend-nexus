/**
 * ConsentSubmissionPage — submitter-facing consent flow.
 *
 *   /sponsor/:studyId/consent/submit
 *
 * Lists Published consent forms the current user hasn't yet submitted (or has
 * had rejected). Selecting one renders the consent form_structure (built with
 * the drag-and-drop Consent Builder) via ConsentFormFill — read the text, fill
 * the fields, sign — then POSTs to /consent-submissions/submit. When the study
 * requires approval the row is Pending (sponsor/CRO approve/reject); otherwise
 * it is auto-approved on submit. A "My consents" section shows status + reason.
 *
 * Permission gates:
 *   - Page entry: `consent_submission.view`
 *   - Submit button: `consent_submission.submit`
 *
 * Submitter sees ONLY templates they need to sign — no admin / catalogue
 * view. That's intentional: this page is for one specific task, not for
 * browsing.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { FileText, ChevronLeft, CheckCircle2, Loader2, AlertCircle, Download, Paperclip } from 'lucide-react';
import { sponsorConsentSubmissionClient } from '@/features/sponsor/api/sponsorConsentSubmissionClient';
import { downloadProtectedFile } from '@/api/protectedFile';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import { usePermissions } from '@/features/auth/usePermissions';
import ConsentFormFill, { missingRequired, flattenConsentFields, scrollToConsentField } from '@/features/sponsor/components/consent/ConsentFormFill';
import { normalizeConsentBlocks } from '@/utils/consentContent';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import s from './ConsentSubmissionPage.module.css';

export default function ConsentSubmissionPage() {
  const dispatch    = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const { has }     = usePermissions();
  const canSubmit   = has('consent_submission', 'submit');

  // Site personnel (site workspace) get the sign + "My consents" flow; everyone
  // else (sponsor workspace: CRO/sponsor) gets the read-only oversight list of
  // ALL submitted consents. Detected by workspace token — the same way the API
  // client picks its scope — NOT by role name. A site-only token (no sponsor
  // token) ⇒ site workspace.
  const isSiteWorkspace = (() => {
    if (typeof window === 'undefined') return false;
    const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
    const hasSite    = !!localStorage.getItem('siteAccessToken');
    return hasSite && !hasSponsor;
  })();

  const [items,        setItems]        = useState([]);
  const [mine,         setMine]         = useState([]);
  const [allSubs,      setAllSubs]      = useState([]);     // viewer mode: all submitted consents
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [values,       setValues]       = useState({});
  const [invalidIds,   setInvalidIds]   = useState([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState(null);
  const [pdfBusyId,    setPdfBusyId]    = useState(null);   // submission id being PDF-downloaded
  const [docBusyId,    setDocBusyId]    = useState(null);   // document id being downloaded
  const [agreeBusy,    setAgreeBusy]    = useState(false);  // consent-agreement PDF download

  const selected = useMemo(
    () => items.find((it) => it.templateId === selectedId) ?? null,
    [items, selectedId],
  );

  const load = () => {
    setLoading(true);
    setLoadError(null);
    // Non-site-personnel (sponsor workspace) get the oversight list: ALL
    // submitted consents in the study, each with downloads. Site personnel get
    // the sign + "My consents" experience. Branch is workspace-driven.
    if (!isSiteWorkspace) {
      sponsorConsentSubmissionClient.listAll()
        .then((all) => setAllSubs(all))
        .catch((err) => setLoadError(err?.message ?? 'Failed to load consents.'))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([
      sponsorConsentSubmissionClient.listAvailable(),
      // "My consents" — status + rejection reason. Best-effort: a view-only
      // role that can submit but somehow lacks the /mine grant still sees the
      // available list rather than an error.
      sponsorConsentSubmissionClient.listMine().catch(() => []),
    ])
      .then(([avail, my]) => { setItems(avail); setMine(my); })
      .catch((err) => setLoadError(err?.message ?? 'Failed to load consents to sign.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Reset the per-template form state when the user picks a different template
  // or returns to the list.
  useEffect(() => {
    setValues({});
    setSubmitError(null);
  }, [selectedId]);

  // The consent form is a drag-and-drop form_structure ({ blocks }). Required +
  // data-bearing fields must be filled before submit.
  const blocks  = useMemo(() => normalizeConsentBlocks(selected?.content?.blocks), [selected]);
  const missing = useMemo(() => missingRequired(blocks, values), [blocks, values]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting || !selected) return;
    // Like the data-capture runner: flag + scroll to the first missing required
    // field instead of silently doing nothing.
    if (missing.length) {
      setInvalidIds(missing);
      scrollToConsentField(missing[0]);
      dispatch(addToast({ type: 'error', message: 'Please complete all required fields before submitting.' }));
      return;
    }
    setInvalidIds([]);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Use the first signature field's value as the submission signature (the
      // backend requires a signature OR an explicit `signed` flag).
      const sigField = flattenConsentFields(blocks).find((f) => f.type === 'signature');
      // Signature is uploaded as a file → value is a { url } ref; send its url
      // (legacy data-URL values pass through unchanged).
      const sigVal = sigField ? values[sigField.id] : '';
      const signatureDataUrl = sigVal && typeof sigVal === 'object' ? sigVal.url : (sigVal || '');
      const saved = await sponsorConsentSubmissionClient.submit({
        consentFormId:    selected.templateId,
        version:          selected.version,
        signatureDataUrl,
        signed:           true,
        submittedData:    { responses: values },
        userName:         currentUser?.fullName ?? '',
        userEmail:        currentUser?.email    ?? '',
      });
      // When the study has consent review disabled the submission is
      // auto-approved on submit — reflect that in the toast.
      const autoApproved = saved?.status === 'Approved';
      dispatch(addToast({
        type:    'success',
        message: autoApproved
          ? `Consent submitted and approved (${selected.templateName}).`
          : `Consent submitted for review (${selected.templateName}).`,
      }));
      setSelectedId(null);
      load();
    } catch (err) {
      setSubmitError(err?.message ?? 'Failed to submit consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Download the signed consent agreement (PDF) for one of my submissions.
  const handleDownloadPdf = async (sub) => {
    setPdfBusyId(sub.id);
    try {
      const blob = await sponsorConsentSubmissionClient.downloadMine(sub.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Consent_${(sub.userName || String(sub.id).slice(-6)).replace(/\s+/g, '_')}_${formatDate(sub.submissionDate)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to download consent agreement.' }));
    } finally {
      setPdfBusyId(null);
    }
  };

  // Viewer mode: download any submission's filled consent PDF (oversight).
  const handleDownloadAny = async (sub) => {
    setPdfBusyId(sub.id);
    try {
      const blob = await sponsorConsentSubmissionClient.downloadAny(sub.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Consent_${(sub.userName || String(sub.id).slice(-6)).replace(/\s+/g, '_')}_${formatDate(sub.submissionDate)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to download consent.' }));
    } finally {
      setPdfBusyId(null);
    }
  };

  // Download one of the files I uploaded with a submission (private — streamed
  // through the authenticated route).
  const handleDownloadDoc = async (doc) => {
    setDocBusyId(doc.id);
    try {
      await downloadProtectedFile(doc.url, doc.name);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to download document.' }));
    } finally {
      setDocBusyId(null);
    }
  };

  // Download the consent agreement (the form itself) as a PDF. Available to
  // EVERYONE who can open the consent — submitters and read-only viewers alike.
  const handleDownloadAgreement = async () => {
    if (!selected) return;
    setAgreeBusy(true);
    try {
      const blob = await sponsorConsentSubmissionClient.downloadAgreement(selected.templateId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Consent_${(selected.templateName || 'agreement').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to download consent agreement.' }));
    } finally {
      setAgreeBusy(false);
    }
  };

  // ─ Viewer mode (non-site-personnel / sponsor workspace) — oversight list of
  // ALL submitted consents in the study, each with downloads (docs + PDF). ────
  if (!isSiteWorkspace) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <div>
            <h1 className={s.title}>Consent Submission</h1>
            <p className={s.sub}>All consents submitted for this study (read-only).</p>
          </div>
        </div>

        {loading ? (
          <div className={s.loading}><Loader2 size={18} className={s.spin} /> Loading consents…</div>
        ) : loadError ? (
          <div className={s.error} role="alert"><AlertCircle size={14} /> {loadError}</div>
        ) : allSubs.length === 0 ? (
          <div className={s.emptyCard}>
            <FileText size={28} className={s.emptyIcon} />
            <h3 className={s.emptyTitle}>No consents submitted yet</h3>
            <p className={s.emptyBody}>Submitted consents will appear here once site personnel sign them.</p>
          </div>
        ) : (
          <ul className={s.mineList}>
            {allSubs.map((sub) => {
              const status = sub.status ?? 'Pending';
              const cls =
                status === 'Approved' ? s.badgeApproved
                : status === 'Rejected' ? s.badgeRejected
                : status === 'Withdrawn' || status === 'Expired' ? s.badgeMuted
                : s.badgePending;
              return (
                <li key={sub.id} className={s.mineCard}>
                  <div className={s.mineCardMain}>
                    <span className={s.mineName}>
                      {sub.userName || 'Consent'}
                      {sub.roleName ? ` · ${sub.roleName}` : ''}
                      {sub.siteName ? ` · ${sub.siteName}` : ''}
                    </span>
                    <span className={`${s.badge} ${cls}`}>{status}</span>
                  </div>
                  <p className={s.mineMeta}>
                    Submitted {sub.submissionDate ? formatDateTime(sub.submissionDate) : '—'}
                  </p>
                  <div className={s.mineDownloads}>
                    {(sub.documents ?? []).map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={s.docChip}
                        onClick={() => handleDownloadDoc(doc)}
                        disabled={docBusyId === doc.id}
                        title={`Download ${doc.name}`}
                      >
                        {docBusyId === doc.id
                          ? <Loader2 size={13} className={s.spin} />
                          : <Paperclip size={13} />}
                        <span className={s.docChipName}>{doc.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={s.pdfBtn}
                      onClick={() => handleDownloadAny(sub)}
                      disabled={pdfBusyId === sub.id}
                      title="Download the consent agreement (PDF)"
                    >
                      {pdfBusyId === sub.id
                        ? <><Loader2 size={13} className={s.spin} /> Preparing…</>
                        : <><Download size={13} /> Consent agreement (PDF)</>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ─ Detail view (a single template selected) ───────────────────────────────
  if (selected) {
    return (
      <div className={s.page}>
        <div className={s.detailHeader}>
          <button type="button" className={s.backBtn} onClick={() => setSelectedId(null)}>
            <ChevronLeft size={14} /> Back to list
          </button>
          <div>
            <h1 className={s.title}>{selected.templateName}</h1>
            <p className={s.sub}>
              {[selected.language, selected.updatedAt ? `Updated ${formatDateTime(selected.updatedAt)}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          {/* Anyone who can open the consent can download the agreement as PDF. */}
          <button
            type="button"
            className={s.agreementBtn}
            onClick={handleDownloadAgreement}
            disabled={agreeBusy || blocks.length === 0}
            title="Download the consent agreement (PDF)"
          >
            {agreeBusy
              ? <><Loader2 size={14} className={s.spin} /> Preparing…</>
              : <><Download size={14} /> Consent agreement (PDF)</>}
          </button>
        </div>

        <div className={s.detailBody}>
          {/* Consent form_structure (drag-and-drop builder) — read + fill + sign. */}
          {blocks.length === 0 ? (
            <p className={s.empty}>This consent form has no content yet.</p>
          ) : (
            <ConsentFormFill
              blocks={blocks}
              values={values}
              disabled={!canSubmit}
              invalidIds={invalidIds}
              onChange={(id, v) => {
                setValues((prev) => ({ ...prev, [id]: v }));
                setInvalidIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
              }}
            />
          )}

          {submitError && (
            <div className={s.error} role="alert">
              <AlertCircle size={14} /> {submitError}
            </div>
          )}

          <div className={s.detailFooter}>
            <button type="button" className={s.cancelBtn} onClick={() => setSelectedId(null)} disabled={submitting}>
              {canSubmit ? 'Cancel' : 'Back'}
            </button>
            {canSubmit ? (
              <button
                type="button"
                className={s.submitBtn}
                onClick={handleSubmit}
                disabled={submitting}
                title={
                  missing.length > 0 ? 'Fill every required field before submitting'
                  : 'Submit for review'
                }
              >
                {submitting
                  ? <><Loader2 size={14} className={s.spin} /> Submitting…</>
                  : <><CheckCircle2 size={14} /> Submit for review</>}
              </button>
            ) : (
              <span className={s.viewOnlyTag}>Your role can view consents but not submit them.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─ List view ─────────────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Consent Submission</h1>
          <p className={s.sub}>
            {canSubmit
              ? 'Sign and submit the consents you need to complete for this study.'
              : 'View the consent form for this study (read-only).'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className={s.loading}>
          <Loader2 size={18} className={s.spin} /> Loading consents…
        </div>
      ) : loadError ? (
        <div className={s.error} role="alert">
          <AlertCircle size={14} /> {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className={s.emptyCard}>
          {canSubmit ? (
            <>
              <CheckCircle2 size={28} className={s.emptyIcon} />
              <h3 className={s.emptyTitle}>You're all caught up</h3>
              <p className={s.emptyBody}>No consents are waiting for your signature right now.</p>
            </>
          ) : (
            <>
              <FileText size={28} className={s.emptyIcon} />
              <h3 className={s.emptyTitle}>No consent form</h3>
              <p className={s.emptyBody}>No published consent form is available for this study yet.</p>
            </>
          )}
        </div>
      ) : (
        <ul className={s.list}>
          {items.map((it) => (
            <li key={it.templateId} className={s.card}>
              <div className={s.cardIcon}><FileText size={18} /></div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle}>{it.templateName}</h3>
                <p className={s.cardMeta}>
                  {[it.language, it.updatedAt ? `Updated ${formatDateTime(it.updatedAt)}` : null]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className={s.cardBtn}
                onClick={() => setSelectedId(it.templateId)}
              >
                {canSubmit ? 'Review & sign →' : 'View →'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* My consents — status + rejection reason for everything this user has
          already submitted. Rejected ones also reappear in the list above so
          they can resubmit; here the reviewer's reason is shown verbatim. */}
      {mine.length > 0 && (
        <div className={s.mineSection}>
          <h2 className={s.mineHeading}>My consents</h2>
          <ul className={s.mineList}>
            {mine.map((sub) => {
              const status = sub.status ?? 'Pending';
              const cls =
                status === 'Approved' ? s.badgeApproved
                : status === 'Rejected' ? s.badgeRejected
                : status === 'Withdrawn' || status === 'Expired' ? s.badgeMuted
                : s.badgePending;
              return (
                <li key={sub.id} className={s.mineCard}>
                  <div className={s.mineCardMain}>
                    <span className={s.mineName}>
                      {sub.userName || 'Consent'}
                      {sub.roleName ? ` · ${sub.roleName}` : ''}
                      {sub.siteName ? ` · ${sub.siteName}` : ''}
                    </span>
                    <span className={`${s.badge} ${cls}`}>{status}</span>
                  </div>
                  <p className={s.mineMeta}>
                    Submitted {sub.submissionDate ? formatDateTime(sub.submissionDate) : '—'}
                  </p>

                  {/* Downloads — my uploaded documents + the signed consent agreement (PDF). */}
                  <div className={s.mineDownloads}>
                    {(sub.documents ?? []).map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={s.docChip}
                        onClick={() => handleDownloadDoc(doc)}
                        disabled={docBusyId === doc.id}
                        title={`Download ${doc.name}`}
                      >
                        {docBusyId === doc.id
                          ? <Loader2 size={13} className={s.spin} />
                          : <Paperclip size={13} />}
                        <span className={s.docChipName}>{doc.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={s.pdfBtn}
                      onClick={() => handleDownloadPdf(sub)}
                      disabled={pdfBusyId === sub.id}
                      title="Download the signed consent agreement (PDF)"
                    >
                      {pdfBusyId === sub.id
                        ? <><Loader2 size={13} className={s.spin} /> Preparing…</>
                        : <><Download size={13} /> Consent agreement (PDF)</>}
                    </button>
                  </div>

                  {status === 'Rejected' && sub.rejectionDetails && (
                    <div className={s.rejectBox}>
                      <strong>Rejection reason:</strong> {sub.rejectionDetails.rejectionReason || '—'}
                      {sub.rejectionDetails.customMessage && (
                        <div className={s.rejectMsg}>{sub.rejectionDetails.customMessage}</div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
