/**
 * EmailVerificationPage — route: /verify/:token
 *
 * Dispatches verifyEmailAsync({ token }) on mount and shows one of:
 *   - loading  : spinner while the API call is in-flight
 *   - success  : green checkmark, "Email verified" message, link to sign in
 *   - error    : red X, error message, link to resend verification
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { verifyEmailAsync } from '@/features/auth/authSlice';
import styles from './EmailVerificationPage.module.css';

const STATES = { loading: 'loading', success: 'success', error: 'error' };

export default function EmailVerificationPage() {
  const { token }   = useParams();
  const dispatch    = useAppDispatch();
  const [status, setStatus]   = useState(STATES.loading);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus(STATES.error);
      setMessage('Verification link is missing or malformed.');
      return;
    }

    dispatch(verifyEmailAsync({ token }))
      .unwrap()
      .then(() => setStatus(STATES.success))
      .catch((err) => {
        setStatus(STATES.error);
        setMessage(err?.message ?? 'This link may have expired or already been used.');
      });
  }, [token, dispatch]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ── Loading ─────────────────────────────────────────── */}
        {status === STATES.loading && (
          <>
            <div className={styles.iconLoading}>
              <Loader2 size={48} strokeWidth={1.5} className={styles.spinner} />
            </div>
            <h1 className={styles.title}>Verifying your email…</h1>
            <p className={styles.sub}>Just a moment, please.</p>
          </>
        )}

        {/* ── Success ─────────────────────────────────────────── */}
        {status === STATES.success && (
          <>
            <div className={styles.iconSuccess}>
              <CheckCircle size={52} strokeWidth={1.5} />
            </div>
            <h1 className={styles.title}>Email verified!</h1>
            <p className={styles.sub}>
              Your account is now active. You can sign in and start using SclinNexus.
            </p>
            <Link to="/signin" className={styles.primaryBtn}>
              Sign In
            </Link>
          </>
        )}

        {/* ── Error ───────────────────────────────────────────── */}
        {status === STATES.error && (
          <>
            <div className={styles.iconError}>
              <XCircle size={52} strokeWidth={1.5} />
            </div>
            <h1 className={styles.title}>Verification failed</h1>
            <p className={styles.sub}>{message}</p>
            <div className={styles.actions}>
              <Link to="/signup" className={styles.primaryBtn}>
                Create a new account
              </Link>
              <Link to="/signin" className={styles.secondaryBtn}>
                Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
