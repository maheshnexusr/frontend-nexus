/**
 * SignUpForm — full registration form with zod validation.
 *
 * Features:
 *   - Email duplicate check: debounced API call (500 ms) on blur
 *   - Password strength meter via PasswordInput's showStrengthMeter prop
 *   - Confirm-password cross-field validation in zod refine()
 *   - On success: shows "Check your inbox" confirmation state
 */

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { signupAsync }    from '@/features/auth/authSlice';
import apiClient          from '@/lib/api-client';
import FormField          from '@/components/form/FormField';
import PasswordInput      from '@/components/form/PasswordInput';
import styles             from './SignUpForm.module.css';

/* ── Validation schema ───────────────────────────────────────────────────── */
const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'At least 2 characters').max(100, 'Too long'),
    email:    z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Must contain uppercase, lowercase, number & special character',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path:    ['confirmPassword'],
  });

/* ── Component ───────────────────────────────────────────────────────────── */
export default function SignUpForm() {
  const dispatch  = useAppDispatch();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
  });

  /* Watch password value to feed into PasswordInput for the strength meter */
  const passwordValue = watch('password', '');

  /* ── Email duplicate check (debounced 500 ms) ──────────────────── */
  const emailTimerRef = useRef(null);
  const emailField    = register('email');

  const checkEmailDuplicate = (emailVal) => {
    clearTimeout(emailTimerRef.current);
    if (!emailVal) return;
    emailTimerRef.current = setTimeout(async () => {
      try {
        await apiClient.get(`/auth/check-email?email=${encodeURIComponent(emailVal)}`);
      } catch (err) {
        if (err.response?.status === 409) {
          setError('email', {
            type:    'server',
            message: 'This email is already registered.',
          });
        }
      }
    }, 500);
  };

  /* ── Submit ────────────────────────────────────────────────────── */
  const onSubmit = async ({ fullName, email, password }) => {
    try {
      await dispatch(signupAsync({ fullName, email, password })).unwrap();
      setDone(true);
    } catch (err) {
      setError('root', {
        message: err?.message ?? 'Registration failed. Please try again.',
      });
    }
  };

  /* ── Success state ─────────────────────────────────────────────── */
  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>
          <CheckCircle size={52} strokeWidth={1.5} />
        </div>
        <h2 className={styles.successTitle}>Check your inbox</h2>
        <p className={styles.successSub}>
          We sent a verification link to your email address. Click it to
          activate your account before signing in.
        </p>
        <Link to="/signin" className={styles.successLink}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  /* ── Form ──────────────────────────────────────────────────────── */
  return (
    <div>
      <div className={styles.heading}>
        <h2 className={styles.title}>Create an account</h2>
        <p className={styles.sub}>Join SclinNexus and start capturing clinical data</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Full name */}
        <FormField label="Full Name" name="fullName" required error={errors.fullName?.message}>
          <input
            id="fullName"
            type="text"
            className={styles.input}
            placeholder="Dr. Jane Smith"
            autoComplete="name"
            aria-invalid={errors.fullName ? 'true' : undefined}
            {...register('fullName')}
          />
        </FormField>

        {/* Email */}
        <FormField label="Email Address" name="email" required error={errors.email?.message}>
          <input
            id="email"
            type="email"
            className={styles.input}
            placeholder="jane@organisation.com"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : undefined}
            {...emailField}
            onBlur={(e) => {
              emailField.onBlur(e);               // RHF validation on blur
              checkEmailDuplicate(e.target.value); // server duplicate check
            }}
          />
        </FormField>

        {/* Password + strength meter */}
        <FormField label="Password" name="password" required error={errors.password?.message}>
          <PasswordInput
            {...register('password')}
            value={passwordValue}        /* needed for live strength meter */
            showStrengthMeter
            error={!!errors.password}
            placeholder="Create a strong password"
            autoComplete="new-password"
          />
        </FormField>

        {/* Confirm password */}
        <FormField
          label="Confirm Password"
          name="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            {...register('confirmPassword')}
            error={!!errors.confirmPassword}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </FormField>

        {/* Root-level error */}
        {errors.root && (
          <p className={styles.rootError} role="alert">{errors.root.message}</p>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>

        <p className={styles.switchLink}>
          Already have an account?{' '}
          <Link to="/signin" className={styles.link}>Sign In</Link>
        </p>
      </form>
    </div>
  );
}
