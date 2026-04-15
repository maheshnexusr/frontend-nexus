/**
 * SignUpForm — CRO user registration.
 *
 * POST /api/v1/auth/register
 * The API does NOT take a password at registration.
 * An activation email is sent; the user sets their password on the activate page.
 *
 * Required: fullName, emailAddress
 * Optional: contactNumber, jobTitle, organizationCode, organizationName
 */

import { useState } from 'react';
import { useForm }  from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }        from 'zod';
import { Link }     from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { signupAsync }    from '@/features/auth/authSlice';
import FormField          from '@/components/form/FormField';
import styles             from './SignUpForm.module.css';

/* ── Validation schema ───────────────────────────────────────────────────── */
const signUpSchema = z.object({
  fullName:         z.string().min(2, 'At least 2 characters').max(100, 'Too long'),
  emailAddress:     z.string().email('Enter a valid email address'),
  contactNumber:    z.string().optional(),
  jobTitle:         z.string().optional(),
  organizationName: z.string().optional(),
  organizationCode: z.string().optional(),
});

/* ── Component ───────────────────────────────────────────────────────────── */
export default function SignUpForm() {
  const dispatch      = useAppDispatch();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
  });

  /* ── Submit ── */
  const onSubmit = async (data) => {
    try {
      await dispatch(signupAsync(data)).unwrap();
      setDone(true);
    } catch (err) {
      setError('root', {
        message: err?.message ?? 'Registration failed. Please try again.',
      });
    }
  };

  /* ── Success state ── */
  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>
          <CheckCircle size={52} strokeWidth={1.5} />
        </div>
        <h2 className={styles.successTitle}>Check your inbox</h2>
        <p className={styles.successSub}>
          We sent an activation link to your email address. Click it to set
          your password and activate your account.
        </p>
        <Link to="/signin" className={styles.successLink}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div>
      <div className={styles.heading}>
        <h2 className={styles.title}>Create an account</h2>
        <p className={styles.sub}>Join SclinNexus and start capturing clinical data</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>

        <FormField label="Full Name" name="fullName" required error={errors.fullName?.message}>
          <input
            id="fullName"
            type="text"
            className={styles.input}
            placeholder="Dr. Jane Smith"
            autoComplete="name"
            {...register('fullName')}
          />
        </FormField>

        <FormField label="Email Address" name="emailAddress" required error={errors.emailAddress?.message}>
          <input
            id="emailAddress"
            type="email"
            className={styles.input}
            placeholder="jane@organisation.com"
            autoComplete="email"
            {...register('emailAddress')}
          />
        </FormField>

        <FormField label="Contact Number" name="contactNumber" error={errors.contactNumber?.message}>
          <input
            id="contactNumber"
            type="tel"
            className={styles.input}
            placeholder="+1 555 000 0000"
            autoComplete="tel"
            {...register('contactNumber')}
          />
        </FormField>

        <FormField label="Job Title" name="jobTitle" error={errors.jobTitle?.message}>
          <input
            id="jobTitle"
            type="text"
            className={styles.input}
            placeholder="Clinical Research Associate"
            {...register('jobTitle')}
          />
        </FormField>

        <FormField label="Organization Name" name="organizationName" error={errors.organizationName?.message}>
          <input
            id="organizationName"
            type="text"
            className={styles.input}
            placeholder="Acme Clinical Research"
            {...register('organizationName')}
          />
        </FormField>

        <FormField label="Organization Code" name="organizationCode" error={errors.organizationCode?.message}>
          <input
            id="organizationCode"
            type="text"
            className={styles.input}
            placeholder="ACR-001"
            {...register('organizationCode')}
          />
        </FormField>

        {errors.root && (
          <p className={styles.rootError} role="alert">{errors.root.message}</p>
        )}

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? 'Registering…' : 'Create Account'}
        </button>

        <p className={styles.switchLink}>
          Already have an account?{' '}
          <Link to="/signin" className={styles.link}>Sign In</Link>
        </p>
      </form>
    </div>
  );
}
