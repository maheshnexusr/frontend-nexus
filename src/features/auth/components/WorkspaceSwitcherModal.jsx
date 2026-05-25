/**
 * WorkspaceSwitcherModal — unified in-app workspace switcher.
 *
 * Two kinds of switches surface here, both single-click (no password):
 *
 *   1. Navigation switches
 *      The user is a CRO team-member with assigned studies. The CRO
 *      workspace and each `assignedStudies` entry are switchable contexts
 *      within the SAME session — just navigate the URL and the relevant
 *      layout picks up the per-study sponsorPermissions automatically.
 *
 *   2. Identity switches (no password)
 *      The same email maps to more than one identity on the backend (CRO +
 *      Site, multiple sponsors, etc.). The user is already authenticated, so
 *      switching just calls POST /auth/switch-identity with the picked
 *      identity_id — the backend mints that identity's session after
 *      confirming it shares the signed-in user's email. We only fetch and
 *      render this section if the backend lists alternate identities.
 *
 * Either way the user just clicks a workspace — there is no password prompt.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, MapPin, Beaker, X, Loader2, FlaskConical } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchIdentitiesAsync,
  switchIdentityAsync,
  selectCurrentUser,
} from '@/features/auth/authSlice';
import { enterSponsorWorkspaceAsync, exitSponsorView, selectIsViewingSponsor } from '@/features/workspace/store/sponsorViewSlice';
import { profileService } from '@/services/profileService';
import { sponsorStudyContextStore } from '@/services/sponsorAuthService';
import { normalizePermissionsResponse } from '@/api/profileClient';
import { applyPermissions } from '@/features/auth/applyPermissions';
import { getRoleRedirect } from '@/utils/roleRedirect';

// localStorage keys owned by each auth scope. The shared `authUser` /
// `authPermissions*` display keys are intentionally absent — the switch thunk
// rewrites those for whichever scope we just entered.
const SCOPE_KEYS = {
  cro: ['accessToken', 'refreshToken', 'authPermissions', 'authPermissionsTree'],
  sponsor: [
    'sponsorAccessToken', 'sponsorRefreshToken', 'sponsorAuthUser',
    'sponsorStudyContext', 'sponsorViewToken', 'sponsorViewMeta', 'sponsorViewFlash',
  ],
  site: [
    'siteAccessToken', 'siteRefreshToken', 'siteWorkspaceToken',
    'siteAuthUser', 'siteStudies', 'siteStudyContext',
  ],
};

/** Drop tokens for every scope except `keep`, so a stale token from the
 *  workspace we just left can't shadow the one we switched into. */
function clearOtherScopes(keep) {
  for (const [scope, keys] of Object.entries(SCOPE_KEYS)) {
    if (scope === keep) continue;
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }
}

const TYPE_ICON = {
  cro:     Building2,
  sponsor: Beaker,
  site:    MapPin,
  study:   FlaskConical,
};

function IdentityIcon({ type }) {
  const Icon = TYPE_ICON[type] ?? Building2;
  return <Icon size={16} />;
}

const COLOR_BY_TYPE = {
  cro:     { bg: '#dbeafe', fg: '#1d4ed8' },
  sponsor: { bg: '#ede9fe', fg: '#6d28d9' },
  site:    { bg: '#dcfce7', fg: '#15803d' },
  study:   { bg: '#fef3c7', fg: '#b45309' },
};

export default function WorkspaceSwitcherModal({ open, onClose }) {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const location    = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);
  // True when a CRO operator is currently impersonating a sponsor via
  // /workspace/sponsors/:id/enter. This — together with the URL — is how we
  // detect a "real CRO session" vs a direct sponsor/site login. A stale
  // `accessToken` in localStorage from a prior CRO session is NOT reliable.
  const isViewingSponsor = useAppSelector(selectIsViewingSponsor);

  const [loading,    setLoading]    = useState(false);
  const [identities, setIdentities] = useState([]);
  const [error,      setError]      = useState(null);
  // identity_id currently being switched into (null = idle). Drives the
  // per-card spinner and disables every other card during the round-trip.
  const [switchingId, setSwitchingId] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setSwitchingId(null);
    dispatch(fetchIdentitiesAsync())
      .unwrap()
      .then((list) => { if (alive) setIdentities(list); })
      .catch((e)   => { if (alive) setError(typeof e === 'string' ? e : null); /* identities is optional */ })
      .finally(()  => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, dispatch]);

  // ── Build the unified workspace list ─────────────────────────────────────
  // The CRO Workspace anchor is only visible to genuine CRO operators —
  // either currently inside the CRO app (/cro/*) or impersonating a sponsor
  // via /workspace/sponsors/:id/enter (isViewingSponsor=true). A direct
  // sponsor or site login must NOT see it: elevating to CRO from inside the
  // app is forbidden (super-admin can switch down to admin, not the reverse).
  const assignedStudies = Array.isArray(currentUser?.assignedStudies)
    ? currentUser.assignedStudies
    : [];

  const onPath = location.pathname;
  const isOnCro = onPath.startsWith('/cro/');
  const hasCroSession = isOnCro || isViewingSponsor;

  const navWorkspaces = useMemo(() => {
    const out = [];
    if (hasCroSession) {
      out.push({
        key:    'cro-home',
        kind:   'nav',
        type:   'cro',
        label:  'CRO Workspace',
        sub:    currentUser?.email || '',
        path:   '/cro/dashboard',
        active: isOnCro,
      });
    }
    for (const s of assignedStudies) {
      out.push({
        key:       `study-${s.studyId}`,
        kind:      'nav',
        type:      'study',
        label:     s.studyTitle || `Study ${s.studyId}`,
        sub:       s.sponsorName || 'Assigned study workspace',
        path:      `/sponsor/${s.studyId}/dashboard`,
        studyId:   s.studyId,
        sponsorId: s.sponsorId,
        active:    onPath.includes(`/sponsor/${s.studyId}`),
      });
    }
    return out;
  }, [hasCroSession, currentUser?.email, assignedStudies, isOnCro, onPath]);

  // Filter the alternate-identity list:
  //   • Always hide CRO identities for a session without a CRO token — a
  //     sponsor/site user can't elevate to CRO from inside the app.
  //   • Hide CRO entries that point to the CRO scope we're already in —
  //     redundant with the "CRO Workspace" nav item above.
  const altIdentities = (identities ?? []).filter((i) => {
    const type = (i.user_type ?? '').toLowerCase();
    if (type === 'cro' && !hasCroSession) return false;
    if (type === 'cro' && isOnCro)        return false;
    return true;
  });

  if (!open) return null;

  const busy = !!switchingId;

  const onNavSwitch = async (item) => {
    if (busy) return;

    // CRO workspace — leave any active sponsor view and re-sync CRO
    // permissions, then navigate. (Entering a sponsor workspace can leave the
    // CRO permission array emptied; this restores it on the way back.)
    if (item.type !== 'study') {
      setError(null);
      setSwitchingId(item.key);
      dispatch(exitSponsorView());
      try {
        const perms = await profileService.getPermissions();
        applyPermissions(normalizePermissionsResponse(perms));
      } catch { /* non-fatal — keep cached CRO permissions */ }
      onClose?.();
      navigate(item.path);
      return;
    }

    // Assigned sponsor study — the sponsor workspace's API calls need a
    // sponsor-scope token. Mint one via /workspace/sponsors/:id/enter before
    // navigating, otherwise every /api/v1/sponsor/* request 401s.
    if (!item.sponsorId) {
      setError('This study has no linked sponsor — cannot open its workspace.');
      return;
    }
    setError(null);
    setSwitchingId(item.key);
    try {
      // Re-sync the per-study permission trees with the CRO token first, so
      // the sponsor sidebar reflects the LATEST assignment. authUser
      // .assignedStudies otherwise only refreshes while in the CRO workspace,
      // so a permission change made after this user logged in would be missed.
      try {
        const perms = await profileService.getPermissions();
        applyPermissions(normalizePermissionsResponse(perms));
      } catch { /* non-fatal — fall back to cached assignedStudies */ }

      const entered = await dispatch(enterSponsorWorkspaceAsync(item.sponsorId)).unwrap();

      // Persist the study context (studyId + environment) BEFORE navigating.
      // The sponsor dashboard and every /sponsor/workspace/* call need
      // `environment`, which they read from this context — the CRO switcher
      // skips the study picker that would normally set it. The /enter
      // response carries each assigned study's environment.
      const enteredStudy = (entered?.studies ?? []).find((s) => s.id === item.studyId);
      sponsorStudyContextStore.set({
        studyId:     item.studyId,
        environment: enteredStudy?.environment || 'UAT',
      });

      onClose?.();
      navigate(item.path);
    } catch (e2) {
      setError(typeof e2 === 'string' ? e2 : 'Failed to open that study workspace.');
      setSwitchingId(null);
    }
  };

  /** Identity switch — no password. The backend mints the picked identity's
   *  session from the current login; we then drop the old scope's tokens and
   *  reload into the new workspace. */
  const onPickIdentity = async (identity) => {
    if (busy) return;
    setError(null);
    setSwitchingId(identity.identity_id);
    try {
      const result = await dispatch(switchIdentityAsync({
        identityId: identity.identity_id,
      })).unwrap();

      // Drop the previous scope's tokens BEFORE resolving the destination, so
      // getRoleRedirect can't match a stale token and route us back.
      clearOtherScopes((identity.user_type ?? '').toLowerCase());

      onClose?.();
      navigate(getRoleRedirect(result?.user ?? result?.session ?? result), { replace: true });
      window.location.reload();
    } catch (e2) {
      setError(typeof e2 === 'string' ? e2 : 'Failed to switch workspace.');
      setSwitchingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return createPortal(
    <div
      role="dialog"
      aria-label="Switch workspace"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 16,
      }}
      onClick={busy ? undefined : onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
          boxShadow: '0 22px 50px rgba(15, 23, 42, 0.3)',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Switch workspace
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              Pick a workspace to continue working in.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 0, background: 'transparent',
              color: '#64748b', cursor: busy ? 'not-allowed' : 'pointer', borderRadius: 6,
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Section 1: navigation workspaces */}
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Your workspaces
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {navWorkspaces.map((w) => {
              const color = COLOR_BY_TYPE[w.type] ?? COLOR_BY_TYPE.cro;
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => onNavSwitch(w)}
                  disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    textAlign: 'left', padding: 12,
                    background: w.active ? '#f1f5f9' : '#fff',
                    border: w.active ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                    borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy && switchingId !== w.key ? 0.6 : 1,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = w.active ? '#cbd5e1' : '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: 8,
                      background: color.bg, color: color.fg, flex: '0 0 auto',
                    }}
                  >
                    <IdentityIcon type={w.type} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{w.sub}</div>
                  </div>
                  {switchingId === w.key ? (
                    <Loader2 size={15} style={{ color: '#2563eb', animation: 'rt-spin 700ms linear infinite', flex: '0 0 auto' }} />
                  ) : w.active ? (
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Active</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Section 2: alternate identities — single-click, no password */}
          {(altIdentities.length > 0 || loading) && (
            <>
              <div style={{
                fontSize: 11, color: '#64748b', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.4,
                marginTop: 18, marginBottom: 8,
              }}>
                Switch to another workspace
              </div>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                  <Loader2 size={14} style={{ animation: 'rt-spin 700ms linear infinite' }} />
                  Loading…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {altIdentities.map((id) => {
                    const type  = (id.user_type ?? '').toLowerCase();
                    const color = COLOR_BY_TYPE[type] ?? COLOR_BY_TYPE.cro;
                    const isThisSwitching = switchingId === id.identity_id;
                    return (
                      <button
                        key={id.identity_id}
                        type="button"
                        onClick={() => onPickIdentity(id)}
                        disabled={busy}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          textAlign: 'left', padding: 12,
                          background: '#fff', border: '1px solid #e2e8f0',
                          borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy && !isThisSwitching ? 0.6 : 1,
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 36, borderRadius: 8,
                            background: color.bg, color: color.fg, flex: '0 0 auto',
                          }}
                        >
                          <IdentityIcon type={type} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {id.display_label || `${type.toUpperCase()} workspace`}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {type.toUpperCase()}
                            {id.environment ? ` · ${id.environment}` : ''}
                          </div>
                        </div>
                        {isThisSwitching && (
                          <Loader2 size={15} style={{ color: '#2563eb', animation: 'rt-spin 700ms linear infinite', flex: '0 0 auto' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {error && (
            <p style={{ marginTop: 12, fontSize: 12.5, color: '#dc2626' }}>{error}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
