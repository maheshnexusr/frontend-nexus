/**
 * SiteProfilePage — "My Profile" for site personnel.
 *
 * The site workspace previously routed /site/profile to a generic placeholder,
 * so site users had no profile screen (and no way to manage MFA). This page
 * shows their account details and the two-factor (MFA) self-service toggle,
 * mirroring the CRO/sponsor profile page.
 *
 * Data: GET /site/auth/me (name / email / last login) with the cached site
 * session as a fallback. MFA state: GET/PUT /site/auth/mfa.
 */

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { User as UserIcon, Mail, Shield, Clock } from 'lucide-react';
import siteAxiosClient from '@/api/siteAxiosClient';
import { getSiteAuthUser } from '@/features/site/authStore';
import { addToast } from '@/app/notificationSlice';
import { formatDateTime } from '@/utils/formatDate';

function initialsOf(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function SiteProfilePage() {
  const dispatch = useDispatch();
  const cached = getSiteAuthUser() ?? {};

  const [profile, setProfile] = useState({
    fullName: cached.fullName ?? '',
    email: cached.emailAddress ?? '',
    status: cached.status ?? 'Active',
    lastLoginAt: null,
  });
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSaving, setMfaSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    siteAxiosClient.get('/api/v1/site/auth/me')
      .then((res) => {
        const u = res?.user ?? res ?? {};
        if (cancelled) return;
        setProfile((p) => ({
          ...p,
          fullName: u.full_name ?? u.fullName ?? p.fullName,
          email: u.email ?? u.email_address ?? p.email,
          status: u.status ?? p.status,
          lastLoginAt: u.lastLoginAt ?? u.last_login_at ?? null,
        }));
      })
      .catch(() => { /* keep cached values */ });

    siteAxiosClient.get('/api/v1/site/auth/mfa')
      .then((res) => { if (!cancelled) setMfaEnabled(Boolean((res ?? {}).mfa_enabled)); })
      .catch(() => { /* leave default off */ });

    return () => { cancelled = true; };
  }, []);

  const toggleMfa = async () => {
    if (mfaSaving) return;
    const next = !mfaEnabled;
    setMfaSaving(true);
    try {
      const res = await siteAxiosClient.put('/api/v1/site/auth/mfa', { enabled: next });
      const saved = Boolean((res ?? {}).mfa_enabled);
      setMfaEnabled(saved);
      dispatch(addToast({
        type: 'success',
        message: `Two-factor authentication ${saved ? 'enabled' : 'disabled'}.`,
      }));
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message ?? err?.message ?? 'Could not update MFA setting.',
      }));
    } finally {
      setMfaSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
          View your account information and manage your sign-in security.
        </p>
      </header>

      {/* Account details */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={avatar}>{initialsOf(profile.fullName)}</div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              {profile.fullName || '—'}
            </p>
            <span style={statusBadge}>{profile.status}</span>
          </div>
        </div>

        <Field icon={<UserIcon size={13} />} label="Full Name" value={profile.fullName} />
        <Field icon={<Mail size={13} />} label="Email" value={profile.email} />
        <Field
          icon={<Clock size={13} />}
          label="Last Login"
          value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '—'}
        />
      </section>

      {/* Security — MFA */}
      <section style={{ ...card, marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} /> Two-Factor Authentication (MFA)
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#64748b', maxWidth: 460, lineHeight: 1.5 }}>
              When enabled, we email a 6-digit verification code after each password
              sign-in. You&apos;ll enter it to finish logging in.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mfaEnabled}
            onClick={toggleMfa}
            disabled={mfaSaving}
            style={{
              flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none',
              cursor: mfaSaving ? 'not-allowed' : 'pointer',
              background: mfaEnabled ? '#2563eb' : '#cbd5e1',
              position: 'relative', transition: 'background 0.15s', opacity: mfaSaving ? 0.6 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: mfaEnabled ? 23 : 3,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ icon, label, value }) {
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginBottom: 4 }}>
        {icon} {label}
      </label>
      <p style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>{value || '—'}</p>
    </div>
  );
}

const card = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 20,
};

const avatar = {
  width: 56, height: 56, borderRadius: '50%', background: '#2563eb', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 20, fontWeight: 700, flexShrink: 0,
};

const statusBadge = {
  display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999,
  background: '#ecfdf5', color: '#047857', fontSize: 11.5, fontWeight: 600,
};
