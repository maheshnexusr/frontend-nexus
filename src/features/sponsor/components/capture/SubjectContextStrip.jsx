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
  const siteCode =
       subject?.siteCode   ?? subject?.site_code
    ?? subject?.siteNumber ?? subject?.site_number
    ?? '—';
  const subjectNumber =
       subject?.subjectNumber ?? subject?.subject_number
    ?? subject?.subjectCode  ?? subject?.subject_code
    ?? '—';
  const initials =
       subject?.subjectInitials ?? subject?.subject_initials
    ?? '—';

  return (
    <div className={s.strip} data-snapshot-ignore="true">
      <table className={s.table}>
        <thead>
          <tr>
            <th>Protocol Number</th>
            <th>Site Code</th>
            <th>Subject Number</th>
            <th>Subject Initials</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{protocolNumber}</td>
            <td>{siteCode}</td>
            <td>{subjectNumber}</td>
            <td>{initials}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

SubjectContextStrip.propTypes = {
  studyId:   PropTypes.string,
  subjectId: PropTypes.string,
};

SubjectContextStrip.defaultProps = {
  studyId:   '',
  subjectId: '',
};
