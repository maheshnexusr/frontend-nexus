/**
 * ConsentSubmissionPage — submitter-facing consent flow.
 *
 *   /sponsor/:studyId/consent/submit
 *
 * Lists Published consent templates the current user hasn't yet submitted
 * (or has had rejected). Selecting one shows the template content + per-
 * section acknowledgment checkboxes + signature pad. Submitting POSTs to
 * /consent-submissions/submit which writes a Pending row that the sponsor
 * reviewer (separate role) then approves or rejects.
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
import { FileText, ChevronLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { sponsorConsentSubmissionClient } from '@/features/sponsor/api/sponsorConsentSubmissionClient';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import { usePermissions } from '@/features/auth/usePermissions';
import SignaturePad from '@/components/form/SignaturePad';
import { formatDateTime } from '@/utils/formatDate';
import s from './ConsentSubmissionPage.module.css';

export default function ConsentSubmissionPage() {
  const dispatch    = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const { has }     = usePermissions();
  const canSubmit   = has('consent_submission', 'submit');

  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [acks,         setAcks]         = useState({});
  const [signature,    setSignature]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState(null);

  const selected = useMemo(
    () => items.find((it) => it.templateId === selectedId) ?? null,
    [items, selectedId],
  );

  const load = () => {
    setLoading(true);
    setLoadError(null);
    sponsorConsentSubmissionClient.listAvailable()
      .then((rows) => setItems(rows))
      .catch((err) => setLoadError(err?.message ?? 'Failed to load consents to sign.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Reset the per-template form state when the user picks a different template
  // or returns to the list.
  useEffect(() => {
    setAcks({});
    setSignature('');
    setSubmitError(null);
  }, [selectedId]);

  // Required acknowledgments come from the template's `sections` (each section
  // with isMandatory=true must be ticked before submit). We tolerate several
  // template shapes since the builder schema has evolved.
  const requiredSectionIds = useMemo(() => {
    if (!selected) return [];
    const sections = selected.content?.sections ?? selected.content?.paragraphs ?? [];
    return sections.filter((s_) => s_.isMandatory || s_.is_mandatory).map((s_) => s_.id ?? s_.section_id);
  }, [selected]);

  const allRequiredAcked = requiredSectionIds.every((id) => acks[id] === true);
  const canSubmitNow     = canSubmit && Boolean(signature) && allRequiredAcked && !submitting;

  const handleSubmit = async () => {
    if (!canSubmitNow || !selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await sponsorConsentSubmissionClient.submit({
        consentFormId:    selected.templateId,
        version:          selected.version,
        signatureDataUrl: signature,
        acknowledgments:  acks,
        userName:         currentUser?.fullName ?? '',
        userEmail:        currentUser?.email    ?? '',
      });
      dispatch(addToast({
        type:    'success',
        message: `Consent submitted for review (${selected.templateName}).`,
      }));
      setSelectedId(null);
      load();
    } catch (err) {
      setSubmitError(err?.message ?? 'Failed to submit consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─ Detail view (a single template selected) ───────────────────────────────
  if (selected) {
    const sections = selected.content?.sections ?? selected.content?.paragraphs ?? [];
    const fields   = selected.content?.fields ?? [];
    return (
      <div className={s.page}>
        <div className={s.detailHeader}>
          <button type="button" className={s.backBtn} onClick={() => setSelectedId(null)}>
            <ChevronLeft size={14} /> Back to list
          </button>
          <div>
            <h1 className={s.title}>{selected.templateName}</h1>
            <p className={s.sub}>
              Version {selected.version}
              {selected.language ? ` · ${selected.language}` : ''}
              {selected.updatedAt ? ` · Updated ${formatDateTime(selected.updatedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className={s.detailBody}>
          {/* Template content */}
          {sections.length === 0 ? (
            <p className={s.empty}>This consent template has no content yet.</p>
          ) : (
            sections.map((sec) => {
              const id    = sec.id ?? sec.section_id;
              const title = sec.title ?? sec.section_title ?? sec.heading ?? 'Section';
              const body  = sec.content ?? sec.body ?? '';
              const mandatory = sec.isMandatory ?? sec.is_mandatory ?? false;
              return (
                <section key={id} className={s.section}>
                  <h3 className={s.sectionTitle}>
                    {title}
                    {mandatory && <span className={s.mandatoryDot} title="Mandatory">*</span>}
                  </h3>
                  {body && <div className={s.sectionBody} dangerouslySetInnerHTML={{ __html: body }} />}
                  <label className={s.ackRow}>
                    <input
                      type="checkbox"
                      checked={!!acks[id]}
                      onChange={(e) => setAcks((prev) => ({ ...prev, [id]: e.target.checked }))}
                    />
                    <span>
                      I have read and understood this section
                      {mandatory ? ' (required)' : ''}.
                    </span>
                  </label>
                </section>
              );
            })
          )}

          {/* Optional fields the builder added — render labels only; the page
              isn't a generic CRF runtime, just a sign-and-submit surface. */}
          {fields.length > 0 && (
            <section className={s.section}>
              <h3 className={s.sectionTitle}>Additional fields</h3>
              <ul className={s.fieldsList}>
                {fields.map((f) => (
                  <li key={f.id ?? f.label}>{f.label ?? f.id}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Signature */}
          <section className={s.section}>
            <h3 className={s.sectionTitle}>Your signature</h3>
            <p className={s.signatureNote}>
              Draw your signature below. Submission will record the date, time,
              and signature image.
            </p>
            <SignaturePad value={signature} onChange={setSignature} disabled={!canSubmit} />
          </section>

          {submitError && (
            <div className={s.error} role="alert">
              <AlertCircle size={14} /> {submitError}
            </div>
          )}

          <div className={s.detailFooter}>
            <button type="button" className={s.cancelBtn} onClick={() => setSelectedId(null)} disabled={submitting}>
              Cancel
            </button>
            {canSubmit ? (
              <button
                type="button"
                className={s.submitBtn}
                onClick={handleSubmit}
                disabled={!canSubmitNow}
                title={
                  !signature ? 'Please sign before submitting'
                  : !allRequiredAcked ? 'Acknowledge every mandatory section first'
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
          <p className={s.sub}>Sign and submit the consents you need to complete for this study.</p>
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
          <CheckCircle2 size={28} className={s.emptyIcon} />
          <h3 className={s.emptyTitle}>You're all caught up</h3>
          <p className={s.emptyBody}>No consents are waiting for your signature right now.</p>
        </div>
      ) : (
        <ul className={s.list}>
          {items.map((it) => (
            <li key={it.templateId} className={s.card}>
              <div className={s.cardIcon}><FileText size={18} /></div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle}>{it.templateName}</h3>
                <p className={s.cardMeta}>
                  Version {it.version}
                  {it.language ? ` · ${it.language}` : ''}
                  {it.updatedAt ? ` · Updated ${formatDateTime(it.updatedAt)}` : ''}
                </p>
              </div>
              <button
                type="button"
                className={s.cardBtn}
                onClick={() => setSelectedId(it.templateId)}
              >
                Review &amp; sign →
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
