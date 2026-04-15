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

  const fileInputRef = useRef(null);

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
          <button className={styles.editBtn} onClick={() => setEditing(true)}>
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
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className={styles.spinner} /> Saving…</>
                  : <><Save size={14} /> Save Changes</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
