/**
 * SubjectContextStrip — read-only summary table that sits at the top of the
 * data-capture form (CaptureFormPage / SiteSubjectFormPage). Shows the five
 * spec-required identity fields plus an Audit Log launcher.
 *
 *   <SubjectContextStrip studyId={studyId} subjectId={subjectId} />
 *
 * Fetches subject + study lazily once, then renders the table. Failure is
 * silent (the form still loads); only the strip is omitted on error so a
 * subject-fetch hiccup never blocks data entry.
 *
 * The Audit Log button is gated by `data_capture.activity_log` — same gate
 * as the History icon on CapturePage's subject row.
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import s from './SubjectContextStrip.module.css';

// Scope-aware fetchers. CaptureFormPage (sponsor) and SiteCaptureFormPage both
// render this strip; pick the right backend based on which workspace the URL
// is in so the same component works on either side.
async function fetchSubjectByScope(scope, subjectId) {
  if (scope === 'site') {
    const res = await siteWorkspaceClient.getSubject(subjectId);
    return res?.subject ?? res?.item ?? res;
  }
  const res = await sponsorAxiosClient.get(`/api/v1/sponsor/workspace/subjects/${subjectId}`);
  return res?.subject ?? res?.item ?? res;
}

async function fetchStudyByScope(scope) {
  if (scope === 'site') {
    const res = await siteWorkspaceClient.dashboard();
    return res?.study ?? res?.item ?? res;
  }
  const res = await sponsorAxiosClient.get('/api/v1/sponsor/workspace/studies/dashboard');
  return res?.study ?? res?.item ?? res;
}

export default function SubjectContextStrip({ studyId, subjectId }) {
  const location = useLocation();
  const scope = location.pathname.startsWith('/site/') ? 'site' : 'sponsor';

  const [subject, setSubject] = useState(null);
  const [study,   setStudy]   = useState(null);

  useEffect(() => {
    if (!subjectId) return undefined;
    let cancelled = false;
    fetchSubjectByScope(scope, subjectId)
      .then((row) => { if (!cancelled) setSubject(row); })
      .catch(() => { /* silent — strip just won't render below */ });
    return () => { cancelled = true; };
  }, [scope, subjectId]);

  useEffect(() => {
    if (!studyId) return undefined;
    let cancelled = false;
    // The dashboard endpoint already returns the study's protocol number /
    // protocol id in its summary header — cheaper than a full study fetch.
    fetchStudyByScope(scope)
      .then((row) => { if (!cancelled) setStudy(row); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [scope, studyId]);

  // Subject not loaded yet (or doesn't exist) — render nothing rather than a
  // skeleton, to keep the form's vertical rhythm intact.
  if (!subject && !study) return null;

  const protocolNumber =
       study?.protocolNumber  ?? study?.protocol_number
    ?? subject?.protocolNumber ?? subject?.protocol_number
    ?? '—';
  const studyTitle =
       study?.studyTitle ?? study?.study_title ?? study?.title
    ?? subject?.studyTitle ?? subject?.study_title
    ?? '';
  const siteCode =
       subject?.siteCode   ?? subject?.site_code
    ?? subject?.siteNumber ?? subject?.site_number
    ?? '—';
  const siteName =
       subject?.siteName ?? subject?.site_name ?? '';
  const subjectNumber =
       subject?.subjectNumber ?? subject?.subject_number
    ?? subject?.subjectCode  ?? subject?.subject_code
    ?? '';
  const initials =
       subject?.subjectInitials ?? subject?.subject_initials
    ?? '';
  // Randomisation (allocation) number, snapshotted onto the subject when the
  // eCRF's randomization field is saved. The study-level toggle decides whether
  // the cell exists at all; a blank value shows as "—" (enabled but not yet
  // entered, or the designer never placed the field).
  const randomizationNumber =
       subject?.randomizationNumber ?? subject?.randomization_number
    ?? '';
  // The study flag is the intended gate, but the study fetch above is best-effort
  // and fails silently. An existing number is itself proof the feature is on, so
  // treat it as a fallback — otherwise a study-fetch hiccup would hide a number
  // the subject demonstrably has.
  const randomizationEnabled =
       Boolean(study?.randomizationEnabled ?? study?.randomization_enabled ?? false)
    || Boolean(randomizationNumber);

  // Each cell stacks a PRIMARY identifier (the CODE — emphasised) over a
  // SECONDARY descriptor (the name/initials — de-emphasised):
  //   Protocol Code → Study Title · Site Code → Site Name · Subject Code → Initials.
  const cells = [
    { label: 'Protocol', primary: protocolNumber,    secondary: studyTitle },
    { label: 'Site',     primary: siteCode,          secondary: siteName },
    { label: 'Subject',  primary: subjectNumber || '—', secondary: initials },
    ...(randomizationEnabled
      ? [{ label: 'Randomisation No.', primary: randomizationNumber || '—', secondary: '' }]
      : []),
  ];

  return (
    <div className={s.strip} data-snapshot-ignore="true">
      {cells.map((c) => (
        <div key={c.label} className={s.cell}>
          <span className={s.cellLabel}>{c.label}</span>
          <span className={s.cellPrimary}>{c.primary}</span>
          {c.secondary && <span className={s.cellSecondary}>{c.secondary}</span>}
        </div>
      ))}
    </div>
  );
}

/* Layout lives in SubjectContextStrip.module.css — it was inline here, which
   meant no media query could reach it and the four cells stayed on one row at
   every width, ellipsising every value to nothing on a phone. */

SubjectContextStrip.propTypes = {
  studyId:   PropTypes.string,
  subjectId: PropTypes.string,
};

SubjectContextStrip.defaultProps = {
  studyId:   '',
  subjectId: '',
};
