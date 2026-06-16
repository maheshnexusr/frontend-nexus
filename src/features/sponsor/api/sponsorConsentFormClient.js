/**
 * sponsorConsentFormClient — single per-study consent form (drag-and-drop builder).
 *
 *   GET  /consent/form          — the study's consent form_structure (or null)
 *   PUT  /consent/form          — save the form_structure (returns to Draft)
 *   POST /consent/form/publish  — publish (Draft → Published)
 *
 * The consent form is one form_structure per study ({ blocks, submissionControls }),
 * authored with the same drag-and-drop primitives as the study CRF. Mounted under
 * BOTH workspaces; pickScope() selects the live token (site wins only when no
 * sponsor token). Gated by consent_builder.{view,edit,publish}.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';
import { normalizeConsentContent } from '@/utils/consentContent';

function pickScope() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent/form' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return { axios: siteAxiosClient, base: '/api/v1/site/workspace/consent/form' };
  }
  return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent/form' };
}

export const sponsorConsentFormClient = {
  /** Fetch the study's consent form (or null if none authored yet). */
  async getForm() {
    const { axios, base } = pickScope();
    const res = await axios.get(base);
    const form = res?.form ?? null;
    if (!form) return null;
    // Content is persisted snake_case (the axios client snakes request bodies);
    // deep-camel it so the builder slice / preview read field appearance + layout
    // (fieldWidth, headingAlign, helpText, …) instead of silently dropping them.
    return { ...form, content: normalizeConsentContent(form.content) };
  },

  /** Save the form_structure. `content` = { blocks, submissionControls }. */
  async saveForm(content) {
    const { axios, base } = pickScope();
    const res = await axios.put(base, { content });
    return res?.form ?? res;
  },

  /** Publish the consent form (makes it available to site personnel). */
  async publishForm() {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/publish`, {});
    return res;
  },
};

export default sponsorConsentFormClient;
