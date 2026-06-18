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

  // Each cell stacks a PRIMARY identifier (the CODE — emphasised) over a
  // SECONDARY descriptor (the name/initials — de-emphasised):
  //   Protocol Code → Study Title · Site Code → Site Name · Subject Code → Initials.
  const cells = [
    { label: 'Protocol', primary: protocolNumber,    secondary: studyTitle },
    { label: 'Site',     primary: siteCode,          secondary: siteName },
    { label: 'Subject',  primary: subjectNumber || '—', secondary: initials },
  ];

  return (
    <div className={s.strip} data-snapshot-ignore="true" style={STRIP}>
      {cells.map((c, i) => (
        <div key={c.label} style={i === 0 ? CELL_FIRST : CELL}>
          <span style={CELL_LABEL}>{c.label}</span>
          <span style={CELL_PRIMARY}>{c.primary}</span>
          {c.secondary && <span style={CELL_SECONDARY}>{c.secondary}</span>}
        </div>
      ))}
    </div>
  );
}

const STRIP = {
  display: 'flex', alignItems: 'stretch', gap: 20,
  padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
  background: '#fff',
};
// Each cell grows to share the strip width equally so there is no empty space
// left over on the right; a divider sits between adjacent cells.
const CELL = {
  display: 'flex', flexDirection: 'column', gap: 1,
  flex: '1 1 0', minWidth: 0, paddingLeft: 18, borderLeft: '1px solid #eef2f7',
};
const CELL_FIRST = { ...CELL, paddingLeft: 0, borderLeft: 'none' };
const CELL_LABEL = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8',
};
// PRIMARY identifier (Protocol/Site/Subject CODE): the strongest element in the
// cell — bold + larger — but NORMAL text colour, not blue. The emphasis comes
// from weight/size, not a highlight colour, so the code reads as the primary
// identifier without the descriptive values looking more prominent.
const CELL_PRIMARY = {
  fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.25,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const CELL_SECONDARY = {
  fontSize: 12, color: '#475569', lineHeight: 1.3,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
};

SubjectContextStrip.propTypes = {
  studyId:   PropTypes.string,
  subjectId: PropTypes.string,
};

SubjectContextStrip.defaultProps = {
  studyId:   '',
  subjectId: '',
};
