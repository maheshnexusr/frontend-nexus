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

const KINDS = Object.freeze(['query_manager', 'data_verification']);

function requireKind(kind) {
  if (!KINDS.includes(kind)) {
    throw new Error(`Invalid SLA kind '${kind}'. Expected one of: ${KINDS.join(', ')}`);
  }
  return kind;
}

export const sponsorSlaClient = {
  KINDS,

  /** Fetch the SLA settings for a kind. Returns the DTO (or defaults). */
  async get(kind) {
    requireKind(kind);
    const res = await sponsorAxiosClient.get(`/api/v1/sponsor/workspace/sla-settings/${kind}`);
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
    const res = await sponsorAxiosClient.put(
      `/api/v1/sponsor/workspace/sla-settings/${kind}`,
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
