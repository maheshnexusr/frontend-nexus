/**
 * AccountActivationPage — /activate?token=<jwt>
 *
 * Reads `token` from the URL query string.
 * Lets the user set their password, then calls POST /api/v1/auth/activate.
 */

import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { activateAccountAsync } from '@/features/auth/authSlice';
import styles from './AccountActivationPage.module.css';

/* ── Password rules ──────────────────────────────────────────────────────── */
const RULES = [
  { id: 'len',     label: 'At least 8 characters',                   test: (v) => v.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',               test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',               test: (v) => /[a-z]/.test(v) },
  { id: 'number',  label: 'One number (0–9)',                         test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character (!@#$%^&*…)',        test: (v) => /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(v) },
];

/* ── Password field with show/hide toggle ────────────────────────────────── */
function PwdField({ id, value, onChange, placeholder, hasError, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.pwdWrap}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`${styles.input} ${hasError ? styles.inputError : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
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

/* ── Requirement checklist ───────────────────────────────────────────────── */
function RequirementList({ password }) {
  if (!password) return null;
  return (
    <ul className={styles.ruleList}>
      {RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={`${styles.ruleItem} ${ok ? styles.ruleOk : styles.ruleFail}`}>
            {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════════ */
export default function AccountActivationPage() {
  const dispatch        = useAppDispatch();
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get('token');

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors,          setErrors]          = useState({});
  const [submitting,      setSubmitting]      = useState(false);
  const [apiError,        setApiError]        = useState('');
  const [done,            setDone]            = useState(false);

  const allRulesPassed = useMemo(() => RULES.every((r) => r.test(password)), [password]);

  /* ── No token in URL ── */
  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconError}><XCircle size={52} strokeWidth={1.5} /></div>
          <h1 className={styles.title}>Invalid activation link</h1>
          <p className={styles.sub}>
            This link is missing required information. Please use the link sent to
            your email, or contact your administrator for a new invitation.
          </p>
          <Link to="/signin" className={styles.primaryBtn}>Back to Sign In</Link>
        </div>
      </div>
    );
  }

  /* ── Success state ── */
  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconSuccess}><CheckCircle2 size={52} strokeWidth={1.5} /></div>
          <h1 className={styles.title}>Account activated!</h1>
          <p className={styles.sub}>
            Your account has been activated successfully. You can now sign in with
            your new password.
          </p>
          <Link to="/signin" className={styles.primaryBtn}>Sign In</Link>
        </div>
      </div>
    );
  }

  /* ── Validate ── */
  const validate = () => {
    const errs = {};
    if (!password)                         errs.password = 'Password is required.';
    else if (!allRulesPassed)              errs.password = 'Password does not meet all requirements.';
    if (!confirmPassword)                  errs.confirm  = 'Please confirm your password.';
    else if (password !== confirmPassword) errs.confirm  = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await dispatch(activateAccountAsync({ token, password, confirmPassword })).unwrap();
      setDone(true);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message ?? '');
      if (/expired/i.test(msg)) {
        setApiError(
          'This activation link has expired. Please contact your administrator to request a new invitation.',
        );
      } else if (/invalid|already used|not found/i.test(msg)) {
        setApiError(
          'This activation link is invalid or has already been used. Please contact your administrator for a new invitation.',
        );
      } else {
        setApiError(msg || 'Activation failed. Please try again or contact your administrator.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Form ── */
  return (
    <div className={styles.page}>
      <div className={styles.formCard}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}><ShieldCheck size={28} /></div>
          <h1 className={styles.title}>Activate your account</h1>
          <p className={styles.sub}>Create a password to complete your account setup.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* API error banner */}
          {apiError && (
            <div className={styles.errorBanner} role="alert">
              <XCircle size={15} />
              <span>{apiError}</span>
            </div>
          )}

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="act-password">
              Password <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <PwdField
              id="act-password"
              value={password}
              onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); setApiError(''); }}
              placeholder="Create a strong password"
              hasError={!!errors.password}
              autoComplete="new-password"
            />
            {errors.password && <p className={styles.fieldError}>{errors.password}</p>}
            <RequirementList password={password} />
          </div>

          {/* Confirm Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="act-confirm">
              Confirm Password <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <PwdField
              id="act-confirm"
              value={confirmPassword}
              onChange={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirm: undefined })); }}
              placeholder="Re-enter your password"
              hasError={!!errors.confirm}
              autoComplete="new-password"
            />
            {errors.confirm && <p className={styles.fieldError}>{errors.confirm}</p>}
          </div>

          {/* Submit */}
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting
              ? <><Loader2 size={15} className={styles.spinner} /> Activating…</>
              : 'Activate Account'
            }
          </button>

        </form>

        <p className={styles.signinLink}>
          Already activated?{' '}
          <Link to="/signin" className={styles.link}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
