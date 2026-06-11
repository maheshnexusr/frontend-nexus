/**
 * SitePersonnelActivationPage — landing page for the link in the
 * "Welcome to {Study} — {Site}" invitation email.
 *
 * Routes (public, outside any layout):
 *   /site/invite/:token                    ← current backend format
 *   /site/:siteId/:env/invite/:token       ← legacy alias
 *
 * Only `:token` is required. Study / site / environment all come from the
 * verify response, so missing URL params are fine.
 *
 * Flow:
 *   1. On mount → GET /api/v1/site/invite/verify?token=...
 *      • Valid    → show form with study/site/user readout + password fields
 *      • Invalid  → "This invitation link is invalid or has expired."
 *   2. Submit password → POST /api/v1/site/invite/activate { token, password }
 *      • Success → store the returned token as a sponsor session and
 *                  redirect into the sponsor workspace for that study
 *      • Failure → inline error, password preserved
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, AlertCircle, FileText, User, Mail, Loader2,
  Eye, EyeOff,
} from 'lucide-react';
import { siteInviteClient } from '@/features/site/api/siteInviteClient';
import styles from './SitePersonnelActivationPage.module.css';

const PWD_MIN = 8;
const PWD_RE  = {
  upper:   /[A-Z]/,
  lower:   /[a-z]/,
  digit:   /\d/,
  symbol:  /[^A-Za-z0-9]/,
};

function validatePassword(pwd) {
  if (!pwd)                     return 'Password is required.';
  if (pwd.length < PWD_MIN)     return `Password must be at least ${PWD_MIN} characters.`;
  if (!PWD_RE.upper.test(pwd))  return 'Password must include an uppercase letter.';
  if (!PWD_RE.lower.test(pwd))  return 'Password must include a lowercase letter.';
  if (!PWD_RE.digit.test(pwd))  return 'Password must include a number.';
  if (!PWD_RE.symbol.test(pwd)) return 'Password must include a symbol.';
  return null;
}

export default function SitePersonnelActivationPage() {
  // siteId / env are only present on the legacy 4-segment alias; the source
  // of truth is the verify response.
  const { token } = useParams();
  const navigate               = useNavigate();

  // verify / activate state
  const [phase,     setPhase]    = useState('verifying'); // verifying | form | activating | success | invalid
  const [meta,      setMeta]     = useState(null);
  const [errorMsg,  setErrorMsg] = useState('');

  // form state
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [pwdError,     setPwdError]     = useState('');
  const [confirmError, setConfirmError] = useState('');

  // ── Verify on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPhase('verifying');
    siteInviteClient.verify(token)
      .then((info) => {
        if (cancelled) return;
        if (!info.valid) {
          setErrorMsg(info.message || 'This invitation link is invalid or has expired.');
          setPhase('invalid');
          return;
        }
        setMeta(info);
        setPhase('form');
      })
      .catch((err) => {
        if (cancelled) return;
        // Distinguish 404 (link doesn't exist) from 410 (used / expired).
        const status   = err?.response?.status;
        const serverMsg = err?.response?.data?.message ?? err?.message;
        let msg;
        if (status === 404)       msg = serverMsg || 'Invitation link not found.';
        else if (status === 410)  msg = serverMsg || 'This invitation has expired or has already been used.';
        else                      msg = serverMsg || 'This invitation link is invalid or has expired.';
        setErrorMsg(msg);
        setPhase('invalid');
      });
    return () => { cancelled = true; };
  }, [token]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setPwdError('');
    setConfirmError('');

    const pwdProblem = validatePassword(password);
    if (pwdProblem) { setPwdError(pwdProblem); return; }
    if (password !== confirm) { setConfirmError('Passwords do not match.'); return; }

    setPhase('activating');
    try {
      // activate() persists the study-agnostic site session internally
      // (session token + refresh token + user + assigned-studies list).
      await siteInviteClient.activate({ token, password });

      setPhase('success');

      // Brief pause, then route to the study picker — the account is active
      // but no study is chosen yet (a site person can be on several studies).
      setTimeout(() => navigate('/site/dashboard', { replace: true }), 1400);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message
          ?? err?.message
          ?? 'Failed to activate your account. Please try again.',
      );
      setPhase('form');
    }
  };

  // ── Render: verifying ──────────────────────────────────────────────────────
  if (phase === 'verifying') {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <Loader2 size={28} className={styles.spinner} />
          <h1 className={styles.title}>Verifying your invitation…</h1>
          <p className={styles.sub}>Just a moment.</p>
        </div>
      </div>
    );
  }

  // ── Render: invalid ────────────────────────────────────────────────────────
  if (phase === 'invalid') {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={`${styles.iconWrap} ${styles.iconError}`}>
            <AlertCircle size={28} />
          </div>
          <h1 className={styles.title}>Invitation link is invalid</h1>
          <p className={styles.sub}>{errorMsg}</p>
          <p className={styles.subMuted}>
            Ask your sponsor to resend the invitation, or contact support if you
            believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: success ────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
            <CheckCircle2 size={28} />
          </div>
          <h1 className={styles.title}>Account activated</h1>
          <p className={styles.sub}>
            Welcome, {meta?.fullName}. Taking you to your site portal…
          </p>
        </div>
      </div>
    );
  }

  // ── Render: activation form ────────────────────────────────────────────────
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.title}>Activate your account</h1>
        <p className={styles.sub}>
          Set a password to activate your SclinNexus site account. After
          activation you'll choose which study to work in.
        </p>

        {/* Read-only summary */}
        <div className={styles.summary}>
          <SummaryRow icon={<User size={14} />}     label="Name"  value={meta?.fullName} />
          <SummaryRow icon={<Mail size={14} />}     label="Email" value={meta?.emailAddress} />
          {Array.isArray(meta?.studies) && meta.studies.length > 0 && (
            <SummaryRow
              icon={<FileText size={14} />}
              label={meta.studies.length === 1 ? 'Study' : 'Studies'}
              value={meta.studies
                .map((s) => s.studyTitle || s.study_title || s.protocolNumber || s.studyId)
                .filter(Boolean)
                .join(', ')}
            />
          )}
        </div>

        {errorMsg && (
          <div className={styles.errorBox}>
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>New password</label>
            <div className={styles.inputWrap}>
              <input
                type={showPwd ? 'text' : 'password'}
                className={`${styles.input} ${pwdError ? styles.inputError : ''}`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwdError(''); }}
                autoComplete="new-password"
                placeholder="At least 8 chars, mixed case, number, symbol"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwdError && <span className={styles.fieldError}>{pwdError}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirm password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              className={`${styles.input} ${confirmError ? styles.inputError : ''}`}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setConfirmError(''); }}
              autoComplete="new-password"
            />
            {confirmError && <span className={styles.fieldError}>{confirmError}</span>}
          </div>

          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={phase === 'activating'}
          >
            {phase === 'activating' ? 'Activating…' : 'Activate Account'}
          </button>
        </form>

        <p className={styles.fineprint}>
          By activating, you agree to the study's terms and the consent form your
          sponsor has assigned to your role. You'll be asked to review and sign
          the consent the first time you sign in.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryIcon}>{icon}</span>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}
