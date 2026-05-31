/**
 * sponsorSlaClient — SLA settings per workspace feature.
 *
 *   GET /api/v1/sponsor/workspace/sla-settings/:kind
 *   PUT /api/v1/sponsor/workspace/sla-settings/:kind
 *
 * `kind` is 'query_manager' or 'data_verification'. The backend stores one
 * row per kind in the tenant `sla_settings` table.
 *
 * Wire shape (camelCase, normalised by the controller):
 *   {
 *     kind,
 *     statuses: [
 *       { status, days, overdueEnabled },
 *       …
 *     ],
 *     warnDaysBefore,
 *     enabled,
 *     escalateOnBreach, escalateToRoleId,
 *     updatedBy, updatedAt,
 *     isDefault
 *   }
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';

const KINDS = Object.freeze(['query_manager', 'data_verification']);

function requireKind(kind) {
  if (!KINDS.includes(kind)) {
    throw new Error(`Invalid SLA kind '${kind}'. Expected one of: ${KINDS.join(', ')}`);
  }
  return kind;
}

// SLA Settings live in tenant `sla_settings` (per study, one row per kind).
// Both /sponsor/workspace and /site/workspace expose the same routes — pick
// the axios + URL based on which scope's token is live. Mirrors the pattern
// already used by sponsorVerificationClient. Site session wins ONLY when
// there's no sponsor token (so a CRO operator viewing a sponsor study still
// goes through the sponsor route).
function pickScope() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/sla-settings' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return { axios: siteAxiosClient, base: '/api/v1/site/workspace/sla-settings' };
  }
  return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/sla-settings' };
}

export const sponsorSlaClient = {
  KINDS,

  /** Fetch the SLA settings for a kind. Returns the DTO (or defaults). */
  async get(kind) {
    requireKind(kind);
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/${kind}`);
    return res?.settings ?? res?.item ?? res;
  },

  /**
   * Upsert the SLA settings for a kind.
   *
   * payload: {
   *   statuses: [{ status, days, overdueEnabled }, …]
   *   warnDaysBefore,
   *   enabled,
   *   escalateOnBreach?, escalateToRoleId?
   * }
   */
  async update(kind, payload) {
    requireKind(kind);
    const { axios, base } = pickScope();
    const res = await axios.put(
      `${base}/${kind}`,
      {
        statuses:         payload.statuses,
        warnDaysBefore:   payload.warnDaysBefore,
        enabled:          payload.enabled,
        escalateOnBreach: payload.escalateOnBreach,
        escalateToRoleId: payload.escalateToRoleId || null,
      },
    );
    return res?.settings ?? res?.item ?? res;
  },
};

export default sponsorSlaClient;
