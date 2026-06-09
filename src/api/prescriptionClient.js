/**
 * prescriptionClient — subject prescription references (doctor/PI uploads shown
 * at the top of the data-capture form). Scope-aware so the same component works
 * on both the site and sponsor capture forms:
 *
 *   scope 'site'    → /api/v1/site/workspace/subjects/:id/prescriptions
 *   scope 'sponsor' → /api/v1/sponsor/workspace/subjects/:id/prescriptions
 *
 * The file bytes are uploaded separately via uploadFormFile (/api/v1/form-files);
 * these endpoints only persist the returned reference { url, name, type, size }.
 * Both axios clients auto-inject the active study context + token.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient from '@/api/siteAxiosClient';

function resolve(scope) {
  return scope === 'site'
    ? { client: siteAxiosClient, base: '/api/v1/site/workspace' }
    : { client: sponsorAxiosClient, base: '/api/v1/sponsor/workspace' };
}

export async function listPrescriptions(scope, subjectId) {
  const { client, base } = resolve(scope);
  const res = await client.get(`${base}/subjects/${subjectId}/prescriptions`);
  return res?.prescriptions ?? [];
}

export async function addPrescription(scope, subjectId, fileRef) {
  const { client, base } = resolve(scope);
  const res = await client.post(`${base}/subjects/${subjectId}/prescriptions`, fileRef);
  return res?.prescriptions ?? [];
}

export async function removePrescription(scope, subjectId, prescriptionId) {
  const { client, base } = resolve(scope);
  const res = await client.delete(`${base}/subjects/${subjectId}/prescriptions/${prescriptionId}`);
  return res?.prescriptions ?? [];
}
