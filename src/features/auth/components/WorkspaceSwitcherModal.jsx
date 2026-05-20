/**
 * WorkspaceSwitcherModal — unified in-app workspace switcher.
 *
 * Two kinds of switches surface here:
 *
 *   1. Navigation switches (no re-auth)
 *      The user is a CRO team-member with assigned studies. The CRO
 *      workspace and each `assignedStudies` entry are switchable contexts
 *      within the SAME session — just navigate the URL and the relevant
 *      layout picks up the per-study sponsorPermissions automatically.
 *
 *   2. Identity switches (re-auth required)
 *      The same email maps to more than one identity on the backend (CRO +
 *      Site, multiple sponsors, etc.). Switching needs a fresh
 *      choice_token, which means re-entering the password. We only fetch
 *      and render this section if the backend lists alternate identities.
 *
 * The modal shows both sections when both apply, but for the common case
 * (a CRO team-member with one assigned study and no alternate identities)
 * it's just a quick list of clickable workspaces with no password prompt.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, MapPin, Beaker, X, Loader2, ArrowLeft, FlaskConical } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchIdentitiesAsync,
  chooseIdentityAsync,
  loginAsync,
  selectCurrentUser,
} from '@/features/auth/authSlice';
import { getRoleRedirect } from '@/utils/roleRedirect';

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

  const [loading,    setLoading]    = useState(false);
  const [identities, setIdentities] = useState([]);
  const [error,      setError]      = useState(null);

  // Two-step UX for identity switches: list → confirm password
  const [pendingIdentity, setPendingIdentity] = useState(null);
  const [password,        setPassword]        = useState('');
  const [switching,       setSwitching]       = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setPendingIdentity(null);
    setPassword('');
    dispatch(fetchIdentitiesAsync())
      .unwrap()
      .then((list) => { if (alive) setIdentities(list); })
      .catch((e)   => { if (alive) setError(typeof e === 'string' ? e : null); /* identities is optional */ })
      .finally(()  => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, dispatch]);

  // ── Build the unified workspace list ─────────────────────────────────────
  // Always includes a "CRO Workspace" anchor (the always-available home).
  // Each assignedStudies entry becomes a study workspace card. Identities
  // that aren't the current CRO user surface in their own section below
  // (they need re-auth).
  const assignedStudies = Array.isArray(currentUser?.assignedStudies)
    ? currentUser.assignedStudies
    : [];

  const onPath = location.pathname;
  const isOnCro = onPath.startsWith('/cro/');

  const navWorkspaces = useMemo(() => {
    const out = [];
    out.push({
      key:    'cro-home',
      kind:   'nav',
      type:   'cro',
      label:  'CRO Workspace',
      sub:    currentUser?.email || '',
      path:   '/cro/dashboard',
      active: isOnCro,
    });
    for (const s of assignedStudies) {
      out.push({
        key:    `study-${s.studyId}`,
        kind:   'nav',
        type:   'study',
        label:  s.studyTitle || `Study ${s.studyId}`,
        sub:    s.sponsorName || 'Assigned study workspace',
        path:   `/sponsor/${s.studyId}/dashboard`,
        active: onPath.includes(`/sponsor/${s.studyId}`),
      });
    }
    return out;
  }, [currentUser?.email, assignedStudies, isOnCro, onPath]);

  // Hide alternate identities that point to the CRO scope we're already in —
  // those are redundant with the "CRO Workspace" nav item above.
  const altIdentities = (identities ?? []).filter(
    (i) => (i.user_type ?? '').toLowerCase() !== 'cro' || !isOnCro
  );

  if (!open) return null;

  const onNavSwitch = (item) => {
    onClose?.();
    navigate(item.path);
  };

  const onPickIdentity = (identity) => {
    setError(null);
    setPassword('');
    setPendingIdentity(identity);
  };

  const onConfirmSwitch = async (e) => {
    e?.preventDefault?.();
    if (!pendingIdentity || !password) return;
    setSwitching(true);
    setError(null);
    try {
      const step1 = await dispatch(loginAsync({
        emailAddress: currentUser?.email,
        password,
      })).unwrap();

      if (!step1?.requiresChoice) {
        onClose?.();
        navigate(getRoleRedirect(step1?.user), { replace: true });
        window.location.reload();
        return;
      }

      const result = await dispatch(chooseIdentityAsync({
        identityId:  pendingIdentity.identity_id,
        choiceToken: step1.choiceToken,
      })).unwrap();

      onClose?.();
      navigate(getRoleRedirect(result?.user ?? result?.session ?? result), { replace: true });
      window.location.reload();
    } catch (e2) {
      setError(typeof e2 === 'string' ? e2 : 'Failed to switch workspace.');
      setSwitching(false);
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
      onClick={onClose}
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
          {pendingIdentity && (
            <button
              type="button"
              onClick={() => { setPendingIdentity(null); setPassword(''); setError(null); }}
              disabled={switching}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, border: 0, background: 'transparent',
                color: '#64748b', cursor: switching ? 'not-allowed' : 'pointer', borderRadius: 6,
              }}
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {pendingIdentity ? 'Confirm password' : 'Switch workspace'}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              {pendingIdentity
                ? 'Re-enter your password to switch identities securely.'
                : 'Pick a workspace to continue working in.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={switching}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 0, background: 'transparent',
              color: '#64748b', cursor: switching ? 'not-allowed' : 'pointer', borderRadius: 6,
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        {/* ── List view ──────────────────────────────────────────────────── */}
        {!pendingIdentity && (
          <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
            {/* Section 1: navigation workspaces (no re-auth) */}
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      textAlign: 'left', padding: 12,
                      background: w.active ? '#f1f5f9' : '#fff',
                      border: w.active ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                      borderRadius: 10, cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; }}
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
                    {w.active && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Active</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Section 2: alternate identities (re-auth required) */}
            {(altIdentities.length > 0 || loading) && (
              <>
                <div style={{
                  fontSize: 11, color: '#64748b', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  marginTop: 18, marginBottom: 8,
                }}>
                  Switch to another identity
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
                      return (
                        <button
                          key={id.identity_id}
                          type="button"
                          onClick={() => onPickIdentity(id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            textAlign: 'left', padding: 12,
                            background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: 10, cursor: 'pointer',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; }}
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
        )}

        {/* ── Password confirm view ──────────────────────────────────────── */}
        {pendingIdentity && (
          <form onSubmit={onConfirmSwitch} style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 12, marginBottom: 14,
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 8,
                  background: (COLOR_BY_TYPE[(pendingIdentity.user_type ?? '').toLowerCase()] ?? COLOR_BY_TYPE.cro).bg,
                  color:      (COLOR_BY_TYPE[(pendingIdentity.user_type ?? '').toLowerCase()] ?? COLOR_BY_TYPE.cro).fg,
                  flex: '0 0 auto',
                }}
              >
                <IdentityIcon type={(pendingIdentity.user_type ?? '').toLowerCase()} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>
                  {pendingIdentity.display_label || `${(pendingIdentity.user_type ?? '').toUpperCase()} workspace`}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {(pendingIdentity.user_type ?? '').toUpperCase()}
                  {pendingIdentity.environment ? ` · ${pendingIdentity.environment}` : ''}
                </div>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 6 }}>
              Password for <strong style={{ color: '#0f172a' }}>{currentUser?.email}</strong>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={switching}
              placeholder="Enter your password"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #cbd5e1', borderRadius: 8,
                fontSize: 14, outline: 'none',
                background: switching ? '#f1f5f9' : '#fff',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
            />

            {error && (
              <p style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={switching || !password}
              style={{
                marginTop: 14, width: '100%',
                padding: '10px 14px',
                background: switching || !password ? '#94a3b8' : '#2563eb',
                color: '#fff', border: 0, borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                cursor: switching || !password ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {switching && <Loader2 size={14} style={{ animation: 'rt-spin 700ms linear infinite' }} />}
              {switching ? 'Switching…' : 'Switch workspace'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
