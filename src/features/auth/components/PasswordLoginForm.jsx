/**
 * PasswordLoginForm — email + password sign-in with react-hook-form + zod.
 * Reads geoInfo from Redux (populated by useGeoIP in the parent page).
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loginAsync, selectGeoInfo } from '@/features/auth/authSlice';
import { getRoleRedirect } from '@/lib/roleRedirect';
import FormField     from '@/components/form/FormField';
import PasswordInput from '@/components/form/PasswordInput';
import styles        from './PasswordLoginForm.module.css';

/* ── Validation schema ───────────────────────────────────────────────────── */
const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/* ── Component ───────────────────────────────────────────────────────────── */
export default function PasswordLoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const geoInfo  = useAppSelector(selectGeoInfo);

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
      const result = await dispatch(loginAsync({ ...data, geoInfo })).unwrap();
      navigate(getRoleRedirect(result?.user));
    } catch (err) {
      setError('root', {
        message: typeof err === 'string'
          ? err
          : (err?.message ?? 'Sign-in failed. Please check your credentials.'),
      });
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="Email Address" name="email" required error={errors.email?.message}>
        <input
          id="email"
          type="email"
          className={styles.input}
          placeholder="you@organisation.com"
          autoComplete="email"
          aria-invalid={errors.email ? 'true' : undefined}
          {...register('email')}
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

      <p className={styles.switchLink}>
        Don&apos;t have an account?{' '}
        <Link to="/signup" className={styles.link}>Create one</Link>
      </p>
    </form>
  );
}
