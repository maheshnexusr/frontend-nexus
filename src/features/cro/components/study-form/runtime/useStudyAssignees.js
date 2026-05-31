/**
 * useStudyAssignees — list of people a query/verification can be assigned to
 * inside the current study workspace.
 *
 * Picks the right endpoint based on which scope's token is live:
 *   - Sponsor workspace (incl. CRO impersonator) → /sponsor/workspace/site-personnel
 *   - Site workspace                             → /site/workspace/site-personnel
 *
 * Returned shape (per row):
 *   { id, fullName, email, role, siteName }
 *
 * Cached at module level for the lifetime of the page so opening multiple
 * Query drawers in a row doesn't re-fetch. Use `refresh()` if you ever need to
 * bust the cache (e.g. after inviting a new person).
 */

import { useEffect, useState, useCallback } from 'react';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';

let cache = null;

function detectScope() {
  // Sponsor scope wins over site. A CRO operator impersonating a sponsor holds
  // a `sponsorViewToken` (NOT a `sponsorAccessToken`), so we must accept either
  // — same rule used by every other sponsor-scope client (pickScope, axios,
  // useSiteRolePermissions, …). Checking only sponsorAccessToken left the Raise
  // Query "Associated" dropdown empty for CRO-as-sponsor users.
  try {
    if (localStorage.getItem('sponsorAccessToken') || localStorage.getItem('sponsorViewToken')) return 'sponsor';
    if (localStorage.getItem('siteAccessToken'))    return 'site';
  } catch { /* ignore */ }
  return null;
}

// Status field — needed for the searchable assignee dropdown which filters
// to Active personnel (same pattern as the site master). Inactive rows are
// retained in the cache so a row referencing an Inactive person still
// resolves the name, but they're filtered out of the assignment options.
async function fetchAssignees() {
  const scope = detectScope();
  if (scope === 'sponsor') {
    // lookup() — drops the site_personnel.view gate so Query-Manager-only
    // roles still see the Associated dropdown populated.
    const res = await sponsorPersonnelClient.lookup();
    const rows = Array.isArray(res) ? res : (res?.personnel ?? res?.items ?? res ?? []);
    return rows.map((r) => ({
      id:       r.id ?? r.personnelId ?? r.personnel_id,
      fullName: r.fullName ?? r.full_name ?? '',
      email:    r.email ?? r.emailAddress ?? r.email_address ?? '',
      role:     r.role ?? r.roleName ?? r.role_name ?? '',
      siteId:   r.siteId ?? r.site_id ?? '',
      siteIds:  r.siteIds ?? r.site_ids
                  ?? [r.siteId ?? r.site_id, ...(r.additional_site_ids ?? r.additionalSiteIds ?? [])].filter(Boolean),
      siteName: r.siteName ?? r.site_name ?? '',
      status:   r.status ?? r.activeStatus ?? r.active_status ?? 'Active',
    }));
  }
  if (scope === 'site') {
    const res = await siteWorkspaceClient.listPersonnel();
    const rows = res?.personnel ?? res?.items ?? res ?? [];
    return rows.map((r) => ({
      id:       r.personnel_id ?? r.personnelId ?? r.id,
      fullName: r.full_name ?? r.fullName ?? '',
      email:    r.email_address ?? r.email ?? '',
      role:     r.role_name ?? r.role ?? r.roleName ?? '',
      siteId:   r.site_id ?? r.siteId ?? '',
      siteIds:  r.site_ids ?? r.siteIds
                  ?? [r.site_id ?? r.siteId, ...(r.additional_site_ids ?? r.additionalSiteIds ?? [])].filter(Boolean),
      siteName: r.site_name ?? r.siteName ?? '',
      status:   r.status ?? r.active_status ?? r.activeStatus ?? 'Active',
    }));
  }
  return [];
}

export function useStudyAssignees() {
  const [items, setItems]     = useState(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAssignees();
      cache = rows;
      setItems(rows);
    } catch (e) {
      setError(e?.message ?? 'Failed to load assignees.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache === null) load();
  }, [load]);

  return { items, loading, error, refresh: load };
}

/** Bust the module-level cache — call after invite/edit/delete personnel. */
export function clearStudyAssigneesCache() {
  cache = null;
}
