/**
 * ChangePasswordPage — /cro/profile/password
 *
 * Allows authenticated users to change their account password securely.
 * Features:
 *   - Current / New / Confirm password fields (all masked, toggleable)
 *   - Real-time password strength meter (Weak / Medium / Strong)
 *   - Full validation per spec (required, length, strength, match, same-as-current)
 *   - Demo mode: verifies against mock credential without hitting backend
 *   - Success / error toasts + redirect to profile on success
 */

import { useState, useMemo } from 'react';
import { useDispatch }       from 'react-redux';
import { useNavigate }       from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { userService } from '@/services/userService';
import { addToast }          from '@/app/notificationSlice';
import styles from './ChangePasswordPage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MIN_LEN = 8;
const MAX_LEN         = 64;

const RULES = [
  { id: 'len',     label: `At least ${MIN_LEN} characters`,           test: (v) => v.length >= MIN_LEN },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',                test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',                test: (v) => /[a-z]/.test(v) },
  { id: 'number',  label: 'One number (0–9)',                          test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character (!@#$%^&*…)',         test: (v) => /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(v) },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function strengthOf(password) {
  const passed = RULES.filter((r) => r.test(password)).length;
  if (!password) return null;
  if (passed <= 2) return 'weak';
  if (passed <= 4) return 'medium';
  return 'strong';
}

/* ── Password field with show/hide toggle ────────────────────────────────── */
function PwdField({ id, value, onChange, placeholder, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.pwdWrap}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={MAX_LEN}
      />
      <button
        type="button"
        className={styles.eyeBtn}
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/* ── Strength meter ──────────────────────────────────────────────────────── */
function StrengthMeter({ password }) {
  const strength = strengthOf(password);
  const passedIds = new Set(RULES.filter((r) => r.test(password)).map((r) => r.id));

  if (!password) return null;

  return (
    <div className={styles.strengthWrap}>
      {/* Bar */}
      <div className={styles.strengthBars}>
        <div className={`${styles.strengthBar} ${strength !== null ? styles[`bar_${strength}`] : ''}`} />
        <div className={`${styles.strengthBar} ${strength === 'medium' || strength === 'strong' ? styles[`bar_${strength}`] : ''}`} />
        <div className={`${styles.strengthBar} ${strength === 'strong' ? styles.bar_strong : ''}`} />
      </div>
      <span className={`${styles.strengthLabel} ${styles[`label_${strength}`]}`}>
        {strength === 'weak' && 'Weak'}
        {strength === 'medium' && 'Medium'}
        {strength === 'strong' && 'Strong'}
      </span>

      {/* Rule checklist */}
      <ul className={styles.ruleList}>
        {RULES.map((r) => {
          const ok = passedIds.has(r.id);
          return (
            <li key={r.id} className={`${styles.ruleItem} ${ok ? styles.ruleOk : styles.ruleFail}`}>
              {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════════ */
export default function ChangePasswordPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  const [current,  setCurrent]  = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);

  /* ── Validate ── */
  const validate = () => {
    const errs = {};

    if (!current.trim() || !newPwd.trim() || !confirm.trim()) {
      errs.global = 'All fields are required.';
    }

    if (!errs.global) {
      const strength = strengthOf(newPwd);
      const allRulesPassed = RULES.every((r) => r.test(newPwd));

      if (!allRulesPassed || newPwd.length < MIN_LEN) {
        errs.newPwd = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
      }
      if (newPwd !== confirm) {
        errs.confirm = 'New password and confirmation do not match.';
      }
      if (!errs.newPwd && newPwd === current) {
        errs.newPwd = 'New password must be different from your current password.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    try {
      await userService.changePassword({
        currentPassword:    current,
        newPassword:        newPwd,
        confirmNewPassword: confirm,
      });
      dispatch(addToast({ type: 'success', message: 'Your password has been changed successfully.' }));
      navigate('/cro/profile');
    } catch (err) {
      const msg = err?.message ?? '';
      if (/incorrect|invalid|wrong|current/i.test(msg)) {
        setErrors({ current: 'Current password is incorrect.' });
      } else {
        dispatch(addToast({ type: 'error', message: msg || 'Failed to change password. Please try again.' }));
      }
    } finally {
      setSaving(false);
    }
  };

  /* ── Cancel ── */
  const handleCancel = () => navigate('/cro/profile');

  /* ── Render ── */
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <ShieldCheck size={22} className={styles.headerIcon} />
        <div>
          <h1 className={styles.title}>Change Password</h1>
          <p className={styles.sub}>Keep your account secure by using a strong, unique password.</p>
        </div>
      </div>

      <form className={styles.card} onSubmit={handleSubmit} noValidate>

        {/* Global error */}
        {errors.global && (
          <div className={styles.globalErr}>
            <XCircle size={14} /> {errors.global}
          </div>
        )}

        {/* Current Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="cp-current">
            <Lock size={13} className={styles.labelIcon} /> Current Password
          </label>
          <PwdField
            id="cp-current"
            value={current}
            onChange={(v) => { setCurrent(v); if (errors.current || errors.global) setErrors({}); }}
            placeholder="Enter your current password"
            autoComplete="current-password"
            error={!!errors.current}
          />
          {errors.current && <p className={styles.errMsg}>{errors.current}</p>}
        </div>

        {/* New Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="cp-new">
            <Lock size={13} className={styles.labelIcon} /> New Password
          </label>
          <PwdField
            id="cp-new"
            value={newPwd}
            onChange={(v) => { setNewPwd(v); if (errors.newPwd || errors.global) setErrors((p) => ({ ...p, newPwd: undefined, global: undefined })); }}
            placeholder="Enter your new password"
            autoComplete="new-password"
            error={!!errors.newPwd}
          />
          {errors.newPwd && <p className={styles.errMsg}>{errors.newPwd}</p>}
          <StrengthMeter password={newPwd} />
        </div>

        {/* Confirm New Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="cp-confirm">
            <Lock size={13} className={styles.labelIcon} /> Confirm New Password
          </label>
          <PwdField
            id="cp-confirm"
            value={confirm}
            onChange={(v) => { setConfirm(v); if (errors.confirm || errors.global) setErrors((p) => ({ ...p, confirm: undefined, global: undefined })); }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            error={!!errors.confirm}
          />
          {errors.confirm && <p className={styles.errMsg}>{errors.confirm}</p>}
        </div>

        {/* Actions */}
        <div className={styles.actionBar}>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving
              ? <><span className={styles.spinner} /> Changing…</>
              : 'Change Password'
            }
          </button>
        </div>
      </form>
    </div>
  );
}
