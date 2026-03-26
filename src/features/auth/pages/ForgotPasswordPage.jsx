/**
 * ForgotPasswordPage — route: /forgot-password
 *
 * Sends POST /api/auth/forgot-password with the provided email.
 * Two render states:
 *   - form  : email input
 *   - sent  : confirmation message (same regardless of whether email exists,
 *             to prevent user-enumeration attacks)
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api-client';
import styles    from './ForgotPasswordPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [sent,     setSent]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed)               return setError('Email is required.');
    if (!EMAIL_RE.test(trimmed)) return setError('Enter a valid email address.');
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: trimmed });
      setSent(true);
    } catch {
      // Show same success UI regardless of 404/other errors to prevent enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Back link */}
      <Link to="/signin" className={styles.backLink}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Sign In
      </Link>

      {sent ? (
        /* ── Sent confirmation ──────────────────────────────────── */
        <div className={styles.sentWrapper}>
          <div className={styles.sentIcon}>
            <Mail size={48} strokeWidth={1.5} />
          </div>
          <h2 className={styles.title}>Check your email</h2>
          <p className={styles.sub}>
            If an account exists for <strong>{email}</strong>, we sent a
            password-reset link. Check your spam folder if it doesn&apos;t arrive
            within a few minutes.
          </p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => { setSent(false); setEmail(''); }}
          >
            Try a different email
          </button>
        </div>
      ) : (
        /* ── Email form ─────────────────────────────────────────── */
        <div>
          <div className={styles.heading}>
            <h2 className={styles.title}>Reset your password</h2>
            <p className={styles.sub}>
              Enter your email address and we&apos;ll send you a link to create
              a new password.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
                <p id="forgot-error" className={styles.fieldError} role="alert">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
