/**
 * SignUpPage — /signup
 *
 * CRO self-service registration. Creates a pending CRO account via
 * POST /api/v1/auth/register; the backend emails an activation link
 * (/activate?token=…) where the user sets a password.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import styles from './AccountActivationPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = {
  fullName: '',
  emailAddress: '',
  organizationName: '',
  contactNumber: '',
  jobTitle: '',
};

export default function SignUpPage() {
  const [form,       setForm]       = useState(EMPTY);
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');
  const [done,       setDone]       = useState(false);

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setApiError('');
  };

  /* ── Success state ── */
  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconSuccess}><CheckCircle2 size={52} strokeWidth={1.5} /></div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            Your account has been created. We&apos;ve sent an activation link to{' '}
            <strong>{form.emailAddress}</strong> — open it to set your password and
            finish setting up your CRO account.
          </p>
          <Link to="/signin" className={styles.primaryBtn}>Back to Sign In</Link>
        </div>
      </div>
    );
  }

  /* ── Validate ── */
  const validate = () => {
    const errs = {};
    if (!form.fullName.trim())                 errs.fullName = 'Full Name is required.';
    if (!form.emailAddress.trim())             errs.emailAddress = 'Email Address is required.';
    else if (!EMAIL_RE.test(form.emailAddress.trim()))
                                               errs.emailAddress = 'Enter a valid email address.';
    if (!form.organizationName.trim())         errs.organizationName = 'Organization Name is required.';
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
      await authService.register({
        fullName:         form.fullName.trim(),
        emailAddress:     form.emailAddress.trim(),
        organizationName: form.organizationName.trim(),
        contactNumber:    form.contactNumber.trim(),
        jobTitle:         form.jobTitle.trim(),
      });
      setDone(true);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message ?? '');
      if (/already (registered|exists)/i.test(msg)) {
        setErrors((p) => ({ ...p, emailAddress: 'This email is already registered. Try signing in instead.' }));
      } else {
        setApiError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Form ── */
  return (
    <div className={styles.page}>
      <div className={styles.formCard}>

        <div className={styles.header}>
          <div className={styles.headerIcon}><UserPlus size={28} /></div>
          <h1 className={styles.title}>Create your CRO account</h1>
          <p className={styles.sub}>Register your organization to get started with SclinNexus.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {apiError && (
            <div className={styles.errorBanner} role="alert">
              <XCircle size={15} />
              <span>{apiError}</span>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="su-name">
              Full Name <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="su-name"
              className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
              value={form.fullName}
              onChange={setField('fullName')}
              placeholder="e.g. Jane Smith"
              autoComplete="name"
            />
            {errors.fullName && <p className={styles.fieldError}>{errors.fullName}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="su-email">
              Email Address <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="su-email"
              type="email"
              className={`${styles.input} ${errors.emailAddress ? styles.inputError : ''}`}
              value={form.emailAddress}
              onChange={setField('emailAddress')}
              placeholder="you@organization.com"
              autoComplete="email"
            />
            {errors.emailAddress && <p className={styles.fieldError}>{errors.emailAddress}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="su-org">
              Organization Name <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="su-org"
              className={`${styles.input} ${errors.organizationName ? styles.inputError : ''}`}
              value={form.organizationName}
              onChange={setField('organizationName')}
              placeholder="e.g. Acme Clinical Research"
              autoComplete="organization"
            />
            {errors.organizationName && <p className={styles.fieldError}>{errors.organizationName}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="su-contact">Contact Number</label>
            <input
              id="su-contact"
              className={styles.input}
              value={form.contactNumber}
              onChange={setField('contactNumber')}
              placeholder="Optional"
              autoComplete="tel"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="su-job">Job Title</label>
            <input
              id="su-job"
              className={styles.input}
              value={form.jobTitle}
              onChange={setField('jobTitle')}
              placeholder="Optional"
              autoComplete="organization-title"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting
              ? <><Loader2 size={15} className={styles.spinner} /> Creating account…</>
              : 'Create Account'}
          </button>

        </form>

        <p className={styles.signinLink}>
          Already have an account?{' '}
          <Link to="/signin" className={styles.link}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
