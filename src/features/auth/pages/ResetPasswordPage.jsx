/**
 * ResetPasswordPage — route: /reset-password?token=<jwt>
 *
 * Lands here from the "Forgot password" email link. Reads the signed reset
 * `token` from the query string, lets the user set a new password, and calls
 * POST /api/v1/auth/reset-password. Works for every account type (cro / sponsor
 * / site) — the token carries which one. On success it bounces to /signin.
 */
import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '@/api/axiosClient';
import styles    from './ForgotPasswordPage.module.css';

// Mirror the backend ensurePasswordStrength minimum so the user gets inline
// feedback before submitting.
const MIN_LEN = 8;

export default function ResetPasswordPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token)                  return setError('This reset link is missing its token. Request a new one.');
    if (password.length < MIN_LEN) return setError(`Password must be at least ${MIN_LEN} characters.`);
    if (password !== confirm)    return setError('Passwords do not match.');
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/api/v1/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/signin'), 2200);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not reset your password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className={styles.sentWrapper}>
        <div className={styles.sentIcon}>
          <CheckCircle2 size={48} strokeWidth={1.5} />
        </div>
        <h2 className={styles.title}>Password reset</h2>
        <p className={styles.sub}>
          Your password has been updated. Redirecting you to sign in…
        </p>
        <Link to="/signin" className={styles.retryBtn}>Go to Sign In</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/signin" className={styles.backLink}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Sign In
      </Link>

      <div className={styles.heading}>
        <h2 className={styles.title}>Choose a new password</h2>
        <p className={styles.sub}>Enter and confirm your new password below.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="new-password" className={styles.label}>New password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="new-password"
              type={show ? 'text' : 'password'}
              className={styles.input}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8', display: 'inline-flex' }}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm-password" className={styles.label}>Confirm password</label>
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            className={styles.input}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />
        </div>

        {error && <p className={styles.fieldError} role="alert">{error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={16} />}
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
