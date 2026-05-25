/**
 * sponsorConsentSubmissionClient — submitter-facing consent submission API.
 *
 *   GET  /api/v1/sponsor/workspace/consent-submissions/available-templates
 *        — lists Published consent templates the current user still needs
 *          to submit (excludes Pending / Approved; Rejected ones do appear
 *          again so the user can resubmit with the fix).
 *
 *   POST /api/v1/sponsor/workspace/consent-submissions/submit
 *        — creates a Pending submission row.
 *
 * Read access requires `consent_submission.view`; the submit action requires
 * `consent_submission.submit`. The reviewer endpoints
 * (/consent-submissions/:id/{approve,reject}) live in sponsorConsentReviewClient.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/consent-submissions';

export const sponsorConsentSubmissionClient = {
  /** Templates this user still needs to sign. */
  async listAvailable() {
    const res = await sponsorAxiosClient.get(`${BASE}/available-templates`);
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
    const res = await sponsorAxiosClient.post(`${BASE}/submit`, payload);
    return res?.item ?? res;
  },
};

export default sponsorConsentSubmissionClient;
