/**
 * ForgotPasswordPage — route: /forgot-password
 *
 * OTP-based password reset, all in one screen:
 *   step 'email'    → enter a registered email, "Send OTP"
 *   step 'otp'      → enter the 6-digit code that was emailed, verify it
 *   step 'password' → choose a new password (only reachable once OTP is valid)
 *   step 'done'     → confirmation, redirect to sign in
 *
 * Backend contract (all public):
 *   POST /auth/forgot-password/otp/request { email }      → 404 if no account
 *   POST /auth/forgot-password/otp/verify  { email, otp } → { reset_token }
 *   POST /auth/forgot-password/otp/reset   { reset_token, password }
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import OTPInput from '../components/OTPInput';
import styles   from './ForgotPasswordPage.module.css';

// Mirrors the backend EMAIL_REGEX closely enough for inline feedback.
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_LEN        = 8;
const COOLDOWN_SECS  = 60;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step,  setStep]  = useState('email');   // email | otp | password | done
  const [email, setEmail] = useState('');
  const [otp,   setOtp]   = useState('');
  const [resetToken, setResetToken] = useState('');

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [cooldown, setCooldown] = useState(0);

  /* ── Resend cooldown tick ──────────────────────────────────────── */
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ── Step 1: request OTP ───────────────────────────────────────── */
  const sendOtp = async (isResend = false) => {
    const trimmed = email.trim();
    // Requirement 4 — invalid format message.
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await authService.forgotPasswordRequestOtp({ email: trimmed });
      // Requirement 6 — success message comes from the backend.
      setInfo(res?.message ?? 'An OTP has been sent to your registered email address.');
      setStep('otp');
      setCooldown(COOLDOWN_SECS);
      if (isResend) setOtp('');
    } catch (err) {
      // Requirement 5 — "No account found…" surfaces here verbatim from the API.
      setError(err?.message ?? 'Unable to send the OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendOtp(false);
  };

  /* ── Step 2: verify OTP ────────────────────────────────────────── */
  const verifyOtp = async (code) => {
    const otpCode = (code ?? otp).trim();
    if (otpCode.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await authService.forgotPasswordVerifyOtp({ email: email.trim(), otp: otpCode });
      setResetToken(res?.reset_token ?? '');
      setInfo('');
      setStep('password');
    } catch (err) {
      // Requirement 9 — invalid/expired OTP message.
      setError(err?.message ?? 'The OTP entered is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: set new password ──────────────────────────────────── */
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_LEN) {
      setError(`Password must be at least ${MIN_LEN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.forgotPasswordResetWithOtp({ resetToken, password });
      setStep('done');
      setTimeout(() => navigate('/signin'), 2200);
    } catch (err) {
      setError(err?.message ?? 'Could not reset your password. Please request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Done ──────────────────────────────────────────────────────── */
  if (step === 'done') {
    return (
      <div className={styles.sentWrapper}>
        <div className={styles.sentIcon}>
          <CheckCircle2 size={48} strokeWidth={1.5} />
        </div>
        <h2 className={styles.title}>Password reset</h2>
        <p className={styles.sub}>Your password has been updated. Redirecting you to sign in…</p>
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

      {/* ── Step 1: email ─────────────────────────────────────────── */}
      {step === 'email' && (
        <div>
          <div className={styles.heading}>
            <h2 className={styles.title}>Reset your password</h2>
            <p className={styles.sub}>
              Enter your registered email address and we&apos;ll send you a
              one-time password (OTP) to reset your password.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="forgot-email" className={styles.label}>
                Email Address <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <input
                id="forgot-email"
                type="email"
                className={styles.input}
                placeholder="you@organisation.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'forgot-error' : undefined}
                autoFocus
              />
              {error && (
                <p id="forgot-error" className={styles.fieldError} role="alert">{error}</p>
              )}
            </div>

            {/* Requirement 3 — Send OTP stays disabled while the email is blank. */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        </div>
      )}

      {/* ── Step 2: OTP ───────────────────────────────────────────── */}
      {step === 'otp' && (
        <div>
          <div className={styles.heading}>
            <h2 className={styles.title}>Enter the OTP</h2>
          </div>

          <div className={styles.form}>
            <div className={styles.otpHeader}>
              <p className={styles.sentMsg}>A 6-digit code was sent to</p>
              <p className={styles.sentEmail}>{email.trim()}</p>
              <button
                type="button"
                className={styles.changeEmailBtn}
                onClick={() => {
                  setStep('email'); setOtp(''); setError(''); setInfo(''); setCooldown(0);
                }}
                disabled={loading}
              >
                Change email
              </button>
            </div>

            {info && !error && <p className={styles.successText}>{info}</p>}

            <OTPInput
              length={6}
              onComplete={verifyOtp}
              onChange={(v) => { setOtp(v); setError(''); }}
              disabled={loading}
              error={!!error}
            />

            {error && <p className={styles.rootError} role="alert">{error}</p>}

            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => verifyOtp()}
              disabled={loading || otp.length < 6}
            >
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>

            <div className={styles.resendRow}>
              {cooldown > 0 ? (
                <span className={styles.cooldownText}>
                  Resend OTP in <strong>{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.resendBtn}
                  onClick={() => sendOtp(true)}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: new password ──────────────────────────────────── */}
      {step === 'password' && (
        <div>
          <div className={styles.heading}>
            <h2 className={styles.title}>Choose a new password</h2>
            <p className={styles.sub}>Enter and confirm your new password below.</p>
          </div>

          <form className={styles.form} onSubmit={handlePasswordSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="new-password" className={styles.label}>New password</label>
              <div className={styles.pwWrap}>
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm-password" className={styles.label}>Confirm password</label>
              <input
                id="confirm-password"
                type={showPw ? 'text' : 'password'}
                className={styles.input}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
              />
            </div>

            {error && <p className={styles.fieldError} role="alert">{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
