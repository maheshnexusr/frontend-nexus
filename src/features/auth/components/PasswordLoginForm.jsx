/**
 * PasswordLoginForm — email + password sign-in with react-hook-form + zod.
 *
 * A single POST /api/v1/auth/login/password covers both CRO and sponsor
 * scopes. loginAsync detects the role from the response and, when the user
 * is a sponsor, mirrors the returned tokens into sponsor-scope storage so
 * sponsorAxiosClient can attach them to /sponsor/** requests. Routing is
 * role-driven via getRoleRedirect.
 *
 * Multi-identity flow (CRO + Site under one email, etc.):
 *   1. POST /auth/login/password  →  { requires_choice: true, choice_token, identities[] }
 *   2. user picks an identity in the picker UI
 *   3. POST /auth/login/choose-identity { choice_token, identity_id } → real session
 *
 * We hold the choice_token in a ref (not state) so it never leaks into
 * devtools / time-travel. It expires in ~2 min on the backend — if the
 * user dawdles, Step 2 returns 401 and we kick them back to Step 1.
 */

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { loginAsync, chooseIdentityAsync } from '@/features/auth/authSlice';
import { getRoleRedirect } from '@/utils/roleRedirect';
import FormField     from '@/components/form/FormField';
import PasswordInput from '@/components/form/PasswordInput';
import styles        from './PasswordLoginForm.module.css';

/* ── Validation schema ───────────────────────────────────────────────────── */
const loginSchema = z.object({
  emailAddress: z.string().email('Enter a valid email address'),
  password:     z.string().min(1, 'Password is required'),
});

/* ── Component ───────────────────────────────────────────────────────────── */
export default function PasswordLoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // When the backend returns `requires_choice: true`, the user has more
  // than one identity (e.g. CRO + Site under the same email). We pause
  // the flow, hold the backend-issued choice_token in a ref (NOT in
  // component state to avoid leaking it into devtools / time-travel),
  // and render an identity picker. Picking one POSTs the choice_token
  // + identity_id to /auth/login/choose-identity — see chooseIdentityAsync.
  // The ref is cleared as soon as the choose-identity call resolves
  // (success or fail-then-back).
  const [identities,        setIdentities]        = useState(null);
  const [choosing,          setChoosing]          = useState(null);
  const choiceTokenRef                            = useRef(null); // short-lived JWT from Step 1

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data) => {
    try {
      const result = await dispatch(loginAsync(data)).unwrap();
      if (result?.requiresChoice) {
        // Stash the short-lived choice_token for Step 2. Cleared after
        // choose-identity completes or when the user backs out.
        choiceTokenRef.current = result.choiceToken ?? null;
        setIdentities(result.identities ?? []);
        return; // wait for the user to pick one
      }
      navigate(getRoleRedirect(result?.user));
    } catch (err) {
      setError('root', {
        message: typeof err === 'string'
          ? err
          : (err?.message ?? 'Sign-in failed. Please check your credentials.'),
      });
    }
  };

  const onPickIdentity = async (identity) => {
    const choiceToken = choiceTokenRef.current;
    if (!choiceToken) {
      // No choice_token in memory — likely a page reload between steps,
      // or the backend Step 1 response didn't include it. Send the user
      // back to the email/password screen.
      setIdentities(null);
      return;
    }
    setChoosing(identity.identity_id);
    try {
      const result = await dispatch(chooseIdentityAsync({
        identityId:  identity.identity_id,
        choiceToken,
      })).unwrap();
      choiceTokenRef.current = null;
      navigate(getRoleRedirect(result?.user));
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : (err?.message ?? 'Failed to switch identity.');
      setError('root', { message });
      setChoosing(null);
      // If the choice_token expired (>2 min) the backend returns 401 and
      // the thunk surfaces "Your sign-in selection expired...". Drop back
      // to Step 1 so the user re-enters their password.
      if (/expired|sign in again/i.test(message)) {
        choiceTokenRef.current = null;
        setIdentities(null);
      }
    }
  };

  // ── Identity-picker view ────────────────────────────────────────────────
  if (identities) {
    return (
      <div className={styles.form}>
        <header style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Choose how to sign in</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
            Your account is linked to more than one workspace. Pick one to continue.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {identities.map((id) => {
            const isBusy = choosing === id.identity_id;
            return (
              <button
                key={id.identity_id}
                type="button"
                onClick={() => onPickIdentity(id)}
                disabled={!!choosing}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  cursor: choosing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  opacity: choosing && !isBusy ? 0.55 : 1,
                }}
                onMouseEnter={(e) => { if (!choosing) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                  {id.display_label || `${(id.user_type ?? '').toUpperCase()} identity`}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {(id.user_type ?? '').toUpperCase()}
                  {id.environment ? ` · ${id.environment}` : ''}
                  {isBusy ? ' · Signing in…' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {errors.root && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#dc2626' }}>{errors.root.message}</p>
        )}

        <button
          type="button"
          onClick={() => { setIdentities(null); setChoosing(null); choiceTokenRef.current = null; }}
          disabled={!!choosing}
          style={{
            marginTop: 14,
            background: 'transparent', border: 0, color: '#64748b',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          ← Back to sign-in
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="Email Address" name="emailAddress" required error={errors.emailAddress?.message}>
        <input
          id="emailAddress"
          type="email"
          className={styles.input}
          placeholder="you@organisation.com"
          autoComplete="email"
          aria-invalid={errors.emailAddress ? 'true' : undefined}
          {...register('emailAddress')}
        />
      </FormField>

      <FormField label="Password" name="password" required error={errors.password?.message}>
        <PasswordInput
          {...register('password')}
          error={!!errors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
        />
      </FormField>

      {/* Forgot password */}
      <div className={styles.forgotRow}>
        <Link to="/forgot-password" className={styles.forgotLink}>
          Forgot password?
        </Link>
      </div>

      {/* Root-level error (wrong credentials etc.) */}
      {errors.root && (
        <p className={styles.rootError} role="alert">{errors.root.message}</p>
      )}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>

      {/* CRO self-service sign-up — temporarily disabled
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
        Don&apos;t have an account?{' '}
        <Link to="/signup" className={styles.forgotLink}>Create one</Link>
      </p>
      */}

    </form>
  );
}
