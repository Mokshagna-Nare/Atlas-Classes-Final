import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import api from '../../services/api';
import { authReturnUrl } from '../../services/authRedirect';
import { useAuth } from '../../contexts/AuthContext';
import { EnvelopeIcon, KeyIcon, EyeIcon, EyeSlashIcon, ArrowLeftIcon, CheckCircleIcon, ShieldCheckIcon, ClipboardIcon } from '../icons';

// Admin console sign-in:
//   1. Google, or email + password (the backend login refuses admins, so this is the only way in)
//   2. Two-step verification with an authenticator app — set up on first sign-in, required every time
//   3. Only accounts marked admin in the users table get through (checked by the backend)
// Forgot password: emailed link → two-step code → new password.

type Step =
  | { name: 'signin' }
  | { name: 'forgot' }
  | { name: 'forgot-sent'; email: string }
  | { name: 'mfa-enroll'; factorId: string; qr: string; secret: string; intent: Intent }
  | { name: 'mfa-verify'; factorId: string; intent: Intent }
  | { name: 'new-password' }
  | { name: 'working'; label: string };

type Intent = 'signin' | 'reset';

const MIN_PASSWORD = 12;

const friendly = (raw: string): string => {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return "That email and password don't match. Check them and try again.";
  if (m.includes('email not confirmed')) return 'This account has not been activated yet.';
  if (m.includes('invalid totp') || m.includes('invalid code') || (m.includes('code') && m.includes('invalid'))) return "That code didn't match. Codes change every 30 seconds — enter the one showing now.";
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('same_password') || m.includes('should be different')) return 'Choose a password different from your current one.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return "This Google account isn't registered as an administrator.";
  if (m.includes('network') || m.includes('failed to fetch')) return "We couldn't reach the server. Check your connection and try again.";
  return raw;
};

const fieldWrap = 'group flex items-center gap-3 px-4 rounded-xl bg-atlas-black/60 border border-white/10 light:bg-paper light:border-field-line/40 focus-within:border-atlas-primary/60 focus-within:ring-4 focus-within:ring-atlas-primary/10 transition-all';
const fieldInput = 'w-full py-3.5 bg-transparent outline-none text-white placeholder-gray-600 text-sm';
const primaryBtn = 'relative w-full overflow-hidden rounded-xl py-3.5 font-black text-sm bg-gradient-to-r from-atlas-primary to-emerald-400 text-atlas-black transition-all duration-300 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.9)] hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0';
const linkBtn = 'text-sm font-bold text-atlas-primary hover:text-emerald-300 transition-colors';

const Spinner = () => <span className="h-4 w-4 rounded-full border-2 border-atlas-black/30 border-t-atlas-black animate-spin" />;

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const ErrorNote: React.FC<{ text: string }> = ({ text }) => (
  <div role="alert" className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300 animate-shake">{text}</div>
);

const Heading: React.FC<{ title: string; text: React.ReactNode }> = ({ title, text }) => (
  <>
    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>
    <p className="text-sm text-gray-500 mt-2 leading-relaxed">{text}</p>
  </>
);

/** Six-digit authenticator code; submits itself once complete. */
const CodeInput: React.FC<{ onComplete: (code: string) => void; disabled: boolean }> = ({ onComplete, disabled }) => {
  const [code, setCode] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!disabled) ref.current?.focus(); }, [disabled]);
  return (
    <input
      ref={ref}
      value={code}
      onChange={e => {
        const next = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(next);
        if (next.length === 6) { onComplete(next); setCode(''); }
      }}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="Six-digit code from your authenticator app"
      placeholder="••••••"
      className="w-full rounded-xl bg-atlas-black/60 border border-white/10 light:bg-paper light:border-field-line/40 py-4 text-center font-mono text-2xl tracking-[0.6em] text-white placeholder-gray-700 outline-none focus:border-atlas-primary/60 focus:ring-4 focus:ring-atlas-primary/10 disabled:opacity-50"
    />
  );
};

const AdminSignInPanel: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>({ name: 'signin' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Is the Google provider switched on in Supabase? (public settings endpoint)
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then(r => r.json())
      .then(s => setGoogleEnabled(Boolean(s?.external?.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // Back from Google or a reset email (see services/authRedirect.ts).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const flow = params.get('flow');
    if (!flow) return;
    navigate('/login/admin', { replace: true });
    const redirectError = params.get('error');
    if (redirectError) {
      supabase.auth.signOut().catch(() => {});
      setError(friendly(redirectError));
      return;
    }
    continueAfterPrimary(flow === 'reset' ? 'reset' : 'signin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = async (message: string) => {
    await supabase.auth.signOut().catch(() => {});
    setStep({ name: 'signin' });
    setBusy(false);
    setError(friendly(message));
  };

  /** Password or Google accepted: confirm the account is an admin, then two-step verification. */
  const continueAfterPrimary = async (intent: Intent) => {
    setError('');
    setStep({ name: 'working', label: 'Checking your account…' });
    try {
      const { data: me } = await api.get('/auth/me');
      if (me?.user?.role !== 'admin') return fail("This account isn't an administrator. Use the student & institute sign-in instead.");

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const verified = factors.totp.find(f => f.status === 'verified');
      if (verified) {
        setStep({ name: 'mfa-verify', factorId: verified.id, intent });
        return;
      }
      // First sign-in: clear any half-finished setup, then start a fresh one.
      for (const f of factors.all.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Atlas admin ${new Date().toISOString().slice(0, 10)}` });
      if (enrollError) throw enrollError;
      setStep({ name: 'mfa-enroll', factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret, intent });
    } catch (e: any) {
      fail(e?.response?.data?.message || e?.message || 'Sign-in could not be completed.');
    }
  };

  const verifyCode = async (factorId: string, code: string, intent: Intent) => {
    setBusy(true);
    setError('');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setBusy(false);
      setError(friendly(verifyError.message));
      return;
    }
    if (intent === 'reset') {
      setBusy(false);
      setStep({ name: 'new-password' });
      return;
    }
    await finish();
  };

  const finish = async () => {
    setStep({ name: 'working', label: 'Opening the admin console…' });
    try {
      await auth!.completeSession('admin');
      navigate('/dashboard/admin', { replace: true });
    } catch (e: any) {
      fail(e?.message || 'Sign-in could not be completed.');
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPassword('');
    if (signInError) {
      setBusy(false);
      setError(friendly(signInError.message));
      return;
    }
    setBusy(false);
    continueAfterPrimary('signin');
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authReturnUrl('google'), queryParams: { prompt: 'select_account' } },
    });
    if (oauthError) {
      setBusy(false);
      setError(friendly(oauthError.message));
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const target = email.trim();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: authReturnUrl('reset') });
    setBusy(false);
    // Same answer whether or not the email exists, so the form can't be used to discover accounts.
    if (resetError && /rate limit|too many/i.test(resetError.message)) return setError(friendly(resetError.message));
    setStep({ name: 'forgot-sent', email: target });
  };

  const passwordProblem =
    newPassword.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.`
    : !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword) ? 'Use letters and at least one number.'
    : confirmPassword && newPassword !== confirmPassword ? "The two passwords don't match."
    : '';

  const saveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || passwordProblem || newPassword !== confirmPassword) return;
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setNewPassword('');
    setConfirmPassword('');
    if (updateError) {
      setBusy(false);
      setError(friendly(updateError.message));
      return;
    }
    await finish();
  };

  const startOver = async () => {
    await supabase.auth.signOut().catch(() => {});
    setError('');
    setBusy(false);
    setStep({ name: 'signin' });
  };

  const backLink = (
    <button type="button" onClick={startOver} className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
      <ArrowLeftIcon className="h-4 w-4" /> Use a different account
    </button>
  );

  switch (step.name) {
    case 'working':
      return (
        <div className="py-10 flex flex-col items-center gap-4 text-sm text-gray-400" role="status">
          <span className="h-9 w-9 rounded-full border-4 border-atlas-primary/20 border-t-atlas-primary animate-spin" />
          {step.label}
        </div>
      );

    case 'mfa-enroll':
      return (
        <>
          <Heading title="Set up two-step verification" text="Admin accounts need a code from an authenticator app every time they sign in. This is a one-time setup." />
          <ol className="mt-6 space-y-5 text-sm text-gray-300">
            <li>
              <span className="font-bold text-white">1. Scan this QR code</span> with Google Authenticator, Microsoft Authenticator, 1Password or Authy.
              <div className="mt-3 flex justify-center rounded-2xl bg-paper p-3 w-fit mx-auto">
                <img src={step.qr} alt="QR code for your authenticator app" className="h-44 w-44" />
              </div>
              <p className="mt-3 text-xs text-gray-500">Can't scan? Enter this key in the app instead:</p>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(step.secret); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl bg-atlas-black/60 border border-white/10 light:bg-paper light:border-field-line/40 px-3.5 py-2.5 font-mono text-xs text-gray-200 hover:border-white/20"
              >
                <span className="break-all text-left">{step.secret}</span>
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-sans font-bold text-atlas-primary">
                  {copied ? <CheckCircleIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
            </li>
            <li>
              <span className="font-bold text-white">2. Enter the 6-digit code</span> the app shows.
              <div className="mt-3"><CodeInput disabled={busy} onComplete={code => verifyCode(step.factorId, code, step.intent)} /></div>
            </li>
          </ol>
          {error && <div className="mt-5"><ErrorNote text={error} /></div>}
          {backLink}
        </>
      );

    case 'mfa-verify':
      return (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-atlas-primary/10 border border-atlas-primary/25 text-atlas-primary mb-5"><ShieldCheckIcon className="h-6 w-6" /></div>
          <Heading title="Two-step verification" text={step.intent === 'reset' ? 'Before you choose a new password, enter the 6-digit code from your authenticator app.' : 'Enter the 6-digit code from your authenticator app.'} />
          <div className="mt-7"><CodeInput disabled={busy} onComplete={code => verifyCode(step.factorId, code, step.intent)} /></div>
          {busy && <p className="mt-3 text-center text-xs text-gray-500">Verifying…</p>}
          {error && <div className="mt-5"><ErrorNote text={error} /></div>}
          <p className="mt-6 text-xs text-gray-500 leading-relaxed">Lost your phone or authenticator app? Ask another administrator to reset your two-step verification.</p>
          {backLink}
        </>
      );

    case 'new-password':
      return (
        <>
          <Heading title="Choose a new password" text={`At least ${MIN_PASSWORD} characters, with letters and a number. Don't reuse a password from another site.`} />
          <form onSubmit={saveNewPassword} className="mt-7 space-y-4">
            <div className={fieldWrap}>
              <KeyIcon className="h-5 w-5 text-gray-600 shrink-0" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" required autoFocus className={fieldInput} />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="p-1 text-gray-500 hover:text-white shrink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <div className={fieldWrap}>
              <KeyIcon className="h-5 w-5 text-gray-600 shrink-0" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" required className={fieldInput} />
            </div>
            {newPassword && passwordProblem && <p className="text-xs text-amber-400">{passwordProblem}</p>}
            {error && <ErrorNote text={error} />}
            <button type="submit" disabled={busy || Boolean(passwordProblem) || newPassword !== confirmPassword} className={primaryBtn}>
              <span className="inline-flex items-center justify-center gap-2">{busy ? <><Spinner /> Saving…</> : 'Save password and sign in'}</span>
            </button>
          </form>
          {backLink}
        </>
      );

    case 'forgot':
      return (
        <>
          <Heading title="Reset your password" text="Enter your admin email and we'll send you a link to choose a new password." />
          <form onSubmit={sendReset} className="mt-7 space-y-5">
            <div className={fieldWrap}>
              <EnvelopeIcon className="h-5 w-5 text-gray-600 shrink-0" />
              <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@atlasclasses.com" required autoFocus className={fieldInput} />
            </div>
            {error && <ErrorNote text={error} />}
            <button type="submit" disabled={busy} className={primaryBtn}>
              <span className="inline-flex items-center justify-center gap-2">{busy ? <><Spinner /> Sending…</> : 'Send reset link'}</span>
            </button>
          </form>
          <button type="button" onClick={() => { setError(''); setStep({ name: 'signin' }); }} className={`mt-6 ${linkBtn}`}>Back to sign in</button>
        </>
      );

    case 'forgot-sent':
      return (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-atlas-primary/10 border border-atlas-primary/25 text-atlas-primary mb-5"><EnvelopeIcon className="h-6 w-6" /></div>
          <Heading title="Check your email" text={<>If <span className="text-gray-300 font-semibold">{step.email}</span> belongs to an administrator, a reset link is on its way. Open it in this browser. The link works once and expires within an hour.</>} />
          <button type="button" onClick={() => setStep({ name: 'signin' })} className={`mt-7 ${linkBtn}`}>Back to sign in</button>
        </>
      );

    default:
      return (
        <>
          <Heading title="Administrator sign-in" text="For Atlas Classes staff only. Two-step verification is required." />

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy || googleEnabled === false}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-paper py-3.5 text-sm font-bold text-ink ring-1 ring-inset ring-white/10 transition-all hover:bg-[#f1f3f4] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GoogleMark /> Continue with Google
          </button>
          {googleEnabled === false && <p className="mt-2 text-center text-[11px] text-gray-600">Google sign-in hasn't been switched on yet.</p>}

          <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">
            <span className="h-px flex-1 bg-white/10" /> or with email <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={signInWithPassword} className="space-y-4">
            <div className={fieldWrap}>
              <EnvelopeIcon className="h-5 w-5 text-gray-600 shrink-0" />
              <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@atlasclasses.com" required className={fieldInput} aria-label="Email address" />
            </div>
            <div className={fieldWrap}>
              <KeyIcon className="h-5 w-5 text-gray-600 shrink-0" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className={fieldInput} aria-label="Password" />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="p-1 text-gray-500 hover:text-white shrink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => { setError(''); setStep({ name: 'forgot' }); }} className="text-xs font-bold text-gray-400 hover:text-atlas-primary transition-colors">Forgot password?</button>
            </div>
            {error && <ErrorNote text={error} />}
            <button type="submit" disabled={busy} className={primaryBtn}>
              <span className="inline-flex items-center justify-center gap-2">{busy ? <><Spinner /> Signing in…</> : 'Sign in'}</span>
            </button>
          </form>
        </>
      );
  }
};

export default AdminSignInPanel;
