/**
 * OTPLoginForm — two-step passwordless sign-in.
 *
 * Step 1: Enter email → dispatch requestOtpAsync → start 60 s cooldown.
 * Step 2: Enter 6-digit OTP (auto-submits on completion) → dispatch loginWithOtpAsync.
 *
 * Resend is disabled during the 60 s cooldown; a countdown timer shows remaining time.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { requestOtpAsync, loginWithOtpAsync } from '@/features/auth/authSlice';
import { getRoleRedirect } from '@/utils/roleRedirect';
import OTPInput from './OTPInput';
import styles   from './OTPLoginForm.module.css';

const COOLDOWN_SECONDS = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OTPLoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [step,     setStep]     = useState(1);        // 1 = email, 2 = otp
  const [emailAddress, setEmailAddress] = useState('');
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [otpErr,   setOtpErr]   = useState('');
  const [cooldown, setCooldown] = useState(0);

  /* ── Countdown tick ────────────────────────────────────────────── */
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ── Step 1: request OTP ───────────────────────────────────────── */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    const trimmed = emailAddress.trim();
    if (!trimmed)                return setEmailErr('Email is required.');
    if (!EMAIL_RE.test(trimmed)) return setEmailErr('Enter a valid email address.');
    setEmailErr('');
    setLoading(true);
    try {
      await dispatch(requestOtpAsync({ emailAddress: trimmed })).unwrap();
      setStep(2);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setEmailErr(err?.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: verify OTP ────────────────────────────────────────── */
  const handleVerifyOtp = async (code) => {
    const otpCode = (code ?? otp).trim();
    if (otpCode.length < 6) return;
    setOtpErr('');
    setLoading(true);
    try {
      const result = await dispatch(loginWithOtpAsync({ emailAddress, otp: otpCode })).unwrap();
      navigate(getRoleRedirect(result?.user));
    } catch (err) {
      setOtpErr(err?.message ?? 'Invalid or expired code. Please try again.');
      setLoading(false);
    }
  };

  /* ── Resend OTP ────────────────────────────────────────────────── */
  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setOtpErr('');
    setOtp('');
    setLoading(true);
    try {
      await dispatch(requestOtpAsync({ emailAddress })).unwrap();
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setOtpErr(err?.message ?? 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 1 render ─────────────────────────────────────────────── */
  if (step === 1) {
    return (
      <form className={styles.form} onSubmit={handleSendOtp} noValidate>
        <div className={styles.field}>
          <label htmlFor="otp-email" className={styles.label}>
            Email Address <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="otp-email"
            type="email"
            className={styles.input}
            placeholder="you@organisation.com"
            value={emailAddress}
            onChange={(e) => { setEmailAddress(e.target.value); setEmailErr(''); }}
            autoComplete="email"
            aria-invalid={emailErr ? 'true' : undefined}
            aria-describedby={emailErr ? 'otp-email-error' : undefined}
            autoFocus
          />
          {emailErr && (
            <p id="otp-email-error" className={styles.fieldError} role="alert">
              {emailErr}
            </p>
          )}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Sending…' : 'Send OTP'}
        </button>

        <p className={styles.switchLink}>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className={styles.link}>Create one</Link>
        </p>
      </form>
    );
  }

  /* ── Step 2 render ─────────────────────────────────────────────── */
  return (
    <div className={styles.form}>
      {/* Email summary + change */}
      <div className={styles.otpHeader}>
        <p className={styles.sentMsg}>A 6-digit code was sent to</p>
        <p className={styles.sentEmail}>{emailAddress}</p>
        <button
          type="button"
          className={styles.changeEmailBtn}
          onClick={() => { setStep(1); setEmailAddress(''); setOtp(''); setOtpErr(''); }}
          disabled={loading}
        >
          Change email
        </button>
      </div>

      {/* OTP boxes */}
      <OTPInput
        length={6}
        onComplete={handleVerifyOtp}
        onChange={setOtp}
        disabled={loading}
        error={!!otpErr}
      />

      {otpErr && (
        <p className={styles.rootError} role="alert">{otpErr}</p>
      )}

      {/* Manual verify button (in case user didn't auto-complete) */}
      <button
        type="button"
        className={styles.submitBtn}
        onClick={() => handleVerifyOtp()}
        disabled={loading || otp.length < 6}
      >
        {loading ? 'Verifying…' : 'Verify & Sign In'}
      </button>

      {/* Resend / countdown */}
      <div className={styles.resendRow}>
        {cooldown > 0 ? (
          <span className={styles.cooldownText}>
            Resend code in <strong>{cooldown}s</strong>
          </span>
        ) : (
          <button
            type="button"
            className={styles.resendBtn}
            onClick={handleResend}
            disabled={loading}
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );
}
