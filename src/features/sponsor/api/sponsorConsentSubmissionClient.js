/**
 * sponsorConsentSubmissionClient — submitter-facing consent submission API.
 *
 *   GET  /consent-submissions/available-templates
 *        — lists Published consent templates the current user still needs
 *          to submit (excludes Pending / Approved; Rejected ones do appear
 *          again so the user can resubmit with the fix).
 *
 *   GET  /consent-submissions/mine
 *        — the current user's OWN submissions (all statuses) so they can see
 *          their status + rejection reason.
 *
 *   POST /consent-submissions/submit
 *        — creates a submission row (Pending, or auto-Approved when the study
 *          has consent review disabled).
 *
 * Read access requires `consent_submission.view`; the submit action requires
 * `consent_submission.submit`. The submission page is mounted under BOTH the
 * sponsor and site workspaces; pickScope() selects the right axios + URL prefix
 * based on which scope's token is live (site wins only when no sponsor token).
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';

function pickScope() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent-submissions' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return { axios: siteAxiosClient, base: '/api/v1/site/workspace/consent-submissions' };
  }
  return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent-submissions' };
}

export const sponsorConsentSubmissionClient = {
  /** Templates this user still needs to sign. */
  async listAvailable() {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/available-templates`);
    return res?.items ?? res?.data ?? [];
  },

  /** The current user's own submissions (all statuses) — status + reason. */
  async listMine() {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/mine`);
    return res?.items ?? res?.data ?? [];
  },

  /**
   * Submit a signed consent. Payload shape:
   *   {
   *     consentFormId,           // template_id from listAvailable()
   *     version,                 // optional override; defaults to 1
   *     signatureDataUrl,        // base64 PNG of the drawn signature
   *     acknowledgments,         // { [sectionId]: boolean }
   *     submittedData,           // free-form extras (witness name, etc.)
   *     siteId, userName,        // optional display fields
   *     userEmail, roleName,
   *     witness,                 // { name, signature, date } when applicable
   *   }
   */
  async submit(payload) {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/submit`, payload);
    return res?.item ?? res;
  },

  /**
   * Download the consent-agreement PDF for one of the current user's OWN
   * submissions. Gated by consent_submission.view; the backend enforces that the
   * submission belongs to the caller. Returns a Blob (application/pdf).
   */
  async downloadMine(submissionId) {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/mine/${submissionId}/download`, {
      responseType: 'blob',
    });
    return res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
  },

  /**
   * Download the consent agreement (the form itself) as a PDF for a published
   * template. Available to anyone with consent_submission.view — including
   * read-only viewers who haven't submitted. Returns a Blob (application/pdf).
   */
  async downloadAgreement(templateId) {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/templates/${templateId}/agreement`, {
      responseType: 'blob',
    });
    return res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
  },

  /**
   * List ALL submitted consents in the study (everyone's). For view-only users
   * (no submit) on the Consent Submission page — an oversight list with
   * downloads. Gated by consent_submission.view.
   */
  async listAll() {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/all`);
    return res?.items ?? res?.data ?? [];
  },

  /** Download any submission's filled consent PDF (oversight). */
  async downloadAny(submissionId) {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/all/${submissionId}/download`, {
      responseType: 'blob',
    });
    return res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
  },
};

export default sponsorConsentSubmissionClient;
