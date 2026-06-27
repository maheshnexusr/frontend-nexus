/**
 * CROProfilePage — /cro/profile (My Profile)
 *
 * View and edit the current user's profile:
 *   - Full Name (editable, required)
 *   - Email (read-only, lock icon)
 *   - Role (display only)
 *   - Photograph (upload / remove, 2 MB max, JPEG/PNG/GIF, preview)
 *   - Contact Number (optional, phone validation)
 *   - Unsaved-changes guard (beforeunload)
 *   - Success / error toasts
 *   - Redux auth.user update after save
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import {
  Camera, Lock, User as UserIcon, Phone,
  Save, X, Pencil, Shield,
} from 'lucide-react';
import { selectCurrentUser, updateUser } from '@/features/auth/authSlice';
import { userService }                   from '@/services/userService';
import { profileClient }                 from '@/api/profileClient';
import { useReadOnlyView }               from '@/features/workspace/hooks/useReadOnlyView';
import { addToast }                      from '@/app/notificationSlice';
import styles from './CROProfilePage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/gif'];
const PHONE_RE        = /^[+\d\s\-().]{7,20}$/;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function roleLabel(role) {
  return { cro_admin: 'CRO Admin', cro: 'CRO User', admin: 'System Admin', sponsor: 'Sponsor' }[role] ?? role ?? '—';
}

function AvatarPlaceholder({ name }) {
  const initials = (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className={styles.avatarInitials}>{initials}</span>;
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════════ */
export default function CROProfilePage() {
  const dispatch = useDispatch();
  const authUser = useSelector(selectCurrentUser);
  const ro       = useReadOnlyView();

  const [editing,       setEditing]       = useState(false);
  const [fullName,      setFullName]      = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [photoPreview,  setPhotoPreview]  = useState(null);
  const [photoFile,     setPhotoFile]     = useState(null);
  const [photoRemoved,  setPhotoRemoved]  = useState(false);
  const [nameErr,       setNameErr]       = useState('');
  const [phoneErr,      setPhoneErr]      = useState('');
  const [saving,        setSaving]        = useState(false);
  const [dirty,         setDirty]         = useState(false);

  // MFA (two-factor) self-service toggle. Scope-aware via profileClient, so the
  // same control works for CRO and sponsor users on this shared page.
  const [mfaEnabled,    setMfaEnabled]    = useState(false);
  const [mfaSaving,     setMfaSaving]     = useState(false);

  const fileInputRef = useRef(null);

  /* load current MFA state */
  useEffect(() => {
    let cancelled = false;
    profileClient.getMfa()
      .then((on) => { if (!cancelled) setMfaEnabled(on); })
      .catch(() => { /* leave default off */ });
    return () => { cancelled = true; };
  }, []);

  const toggleMfa = async () => {
    if (mfaSaving || ro?.isReadOnly) return;
    const next = !mfaEnabled;
    setMfaSaving(true);
    try {
      const saved = await profileClient.setMfa(next);
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

  /* seed from Redux */
  useEffect(() => {
    if (authUser) {
      setFullName(authUser.fullName ?? '');
      setContactNumber(authUser.contactNumber ?? '');
      setPhotoPreview(authUser.photograph ?? null);
      setPhotoFile(null);
      setPhotoRemoved(false);
      setDirty(false);
    }
  }, [authUser]);

  /* unsaved-changes guard */
  useEffect(() => {
    const handler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* cancel */
  const cancelEdit = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    setFullName(authUser?.fullName ?? '');
    setContactNumber(authUser?.contactNumber ?? '');
    setPhotoPreview(authUser?.photograph ?? null);
    setPhotoFile(null);
    setPhotoRemoved(false);
    setNameErr('');
    setPhoneErr('');
    setDirty(false);
    setEditing(false);
  };

  /* photo pick */
  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      dispatch(addToast({ type: 'error', message: 'Only JPEG, PNG, or GIF images are allowed.' }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      dispatch(addToast({ type: 'error', message: 'Photo must be 2 MB or smaller.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target.result);
      setPhotoFile(file);
      setPhotoRemoved(false);
      setDirty(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* validate */
  const validate = () => {
    let ok = true;
    if (!fullName.trim()) { setNameErr('Full name is required.'); ok = false; }
    if (contactNumber.trim() && !PHONE_RE.test(contactNumber.trim())) {
      setPhoneErr('Enter a valid phone number (7–20 chars, digits / + / spaces / dashes).');
      ok = false;
    }
    return ok;
  };

  /* save */
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('fullName', fullName.trim());
      if (contactNumber.trim()) fd.append('contactNumber', contactNumber.trim());
      if (photoRemoved) fd.append('removePhoto', 'true');
      if (photoFile) fd.append('photograph', photoFile);

      const res = await userService.update(fd);
      const photoUrl = photoRemoved ? null : (res?.item?.photograph_path ?? res?.photograph ?? authUser?.photograph ?? null);

      dispatch(updateUser({ fullName: fullName.trim(), contactNumber: contactNumber.trim() || null, photograph: photoUrl }));
      dispatch(addToast({ type: 'success', message: 'Profile updated successfully.' }));
      setDirty(false);
      setEditing(false);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update profile. Please try again.' }));
    } finally {
      setSaving(false);
    }
  }, [fullName, contactNumber, photoFile, photoPreview, photoRemoved, authUser, dispatch]); // eslint-disable-line

  /* ── Render ── */
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.sub}>View and manage your personal account information.</p>
        </div>
        {!editing && (
          <button
            className={styles.editBtn}
            onClick={() => setEditing(true)}
            {...ro.disabledProps('Edit profile')}
          >
            <Pencil size={14} /> Edit Profile
          </button>
        )}
      </div>

      <div className={styles.layout}>

        {/* ── Avatar card ── */}
        <div className={styles.avatarCard}>
          <div className={styles.avatarWrap}>
            {photoPreview
              ? <img src={photoPreview} alt="Profile" className={styles.avatarImg} />
              : <AvatarPlaceholder name={editing ? fullName : authUser?.fullName} />
            }
            {editing && (
              <button className={styles.avatarOverlay} onClick={() => fileInputRef.current?.click()} title="Change photo">
                <Camera size={18} />
                <span>Change</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className={styles.fileInput}
            onChange={handlePhotoPick}
          />

          {editing ? (
            <div className={styles.photoActions}>
              <button className={styles.photoUploadBtn} onClick={() => fileInputRef.current?.click()}>
                <Camera size={13} /> Upload Photo
              </button>
              {photoPreview && (
                <button className={styles.photoRemoveBtn} onClick={() => { setPhotoPreview(null); setPhotoFile(null); setPhotoRemoved(true); setDirty(true); }}>
                  <X size={13} /> Remove
                </button>
              )}
              <p className={styles.photoHint}>JPEG, PNG or GIF · max 2 MB</p>
            </div>
          ) : (
            <div className={styles.avatarMeta}>
              <p className={styles.avatarName}>{authUser?.fullName ?? '—'}</p>
              <span className={styles.roleBadge}>
                <Shield size={11} /> {roleLabel(authUser?.role)}
              </span>
            </div>
          )}
        </div>

        {/* ── Info / form card ── */}
        <div className={styles.infoCard}>

          {/* Full Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <UserIcon size={13} className={styles.labelIcon} />
              Full Name
              {editing && <span className={styles.req}>*</span>}
            </label>
            {editing ? (
              <>
                <input
                  className={`${styles.input} ${nameErr ? styles.inputError : ''}`}
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setDirty(true); if (nameErr) setNameErr(''); }}
                  placeholder="Enter your full name"
                  maxLength={80}
                />
                {nameErr && <p className={styles.errMsg}>{nameErr}</p>}
              </>
            ) : (
              <p className={styles.fieldValue}>{authUser?.fullName || '—'}</p>
            )}
          </div>

          {/* Email — read-only */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Lock size={13} className={styles.labelIcon} />
              Email Address
              <span className={styles.readOnlyTag}>read-only</span>
            </label>
            <p className={styles.fieldValue}>{authUser?.email || '—'}</p>
          </div>

          {/* Role — display only */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Shield size={13} className={styles.labelIcon} />
              Role
            </label>
            <p className={styles.fieldValue}>{roleLabel(authUser?.role)}</p>
          </div>

          {/* Contact Number */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Phone size={13} className={styles.labelIcon} />
              Contact Number
              <span className={styles.optional}>(optional)</span>
            </label>
            {editing ? (
              <>
                <input
                  className={`${styles.input} ${phoneErr ? styles.inputError : ''}`}
                  value={contactNumber}
                  onChange={(e) => { setContactNumber(e.target.value); setDirty(true); if (phoneErr) setPhoneErr(''); }}
                  placeholder="+1 555 000 0000"
                  maxLength={20}
                  type="tel"
                />
                {phoneErr && <p className={styles.errMsg}>{phoneErr}</p>}
              </>
            ) : (
              <p className={styles.fieldValue}>{authUser?.contactNumber || '—'}</p>
            )}
          </div>

          {/* Action bar */}
          {editing && (
            <div className={styles.actionBar}>
              <button className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>
                <X size={14} /> Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={() => !ro.isReadOnly && handleSave()}
                disabled={saving || ro.isReadOnly}
                aria-disabled={saving || ro.isReadOnly}
                title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
              >
                {saving
                  ? <><span className={styles.spinner} /> Saving…</>
                  : <><Save size={14} /> Save Changes</>
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security — two-factor authentication */}
      <div className={styles.infoCard} style={{ marginTop: 18 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}
        >
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
            disabled={mfaSaving || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
            style={{
              flexShrink: 0,
              width: 46, height: 26, borderRadius: 999, border: 'none',
              cursor: (mfaSaving || ro.isReadOnly) ? 'not-allowed' : 'pointer',
              background: mfaEnabled ? '#2563eb' : '#cbd5e1',
              position: 'relative', transition: 'background 0.15s',
              opacity: mfaSaving ? 0.6 : 1,
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3, left: mfaEnabled ? 23 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
