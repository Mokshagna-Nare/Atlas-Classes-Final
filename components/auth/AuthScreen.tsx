import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EnvelopeIcon, KeyIcon, EyeIcon, EyeSlashIcon, ArrowLeftIcon, CheckCircleIcon } from '../icons';

export type AuthRole = 'student' | 'institute' | 'admin';

interface AuthScreenProps {
  role: AuthRole;
  portalLabel: string;
  title: string;
  subtitle: string;
  headline: React.ReactNode;
  features: { icon: React.FC<{ className?: string }>; title: string; text: string }[];
  emailPlaceholder: string;
  brand?: React.ReactNode;
}

const SWITCHABLE: { role: AuthRole; label: string; path: string }[] = [
  { role: 'student', label: 'Student', path: '/login/student' },
  { role: 'institute', label: 'Institute', path: '/login/institute' },
];

// Supabase/Express error strings → plain language.
const friendlyError = (raw: string, portal: string, role: AuthRole): string => {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) return "That email and password don't match. Please check them and try again.";
  if (msg.includes('email not confirmed')) return 'This account hasn’t been activated yet. Please contact your institute.';
  if (msg.includes('unauthorized') || msg.includes('this login is for')) {
    return role === 'admin'
      ? `This account doesn't have access to the ${portal}. Use the student & institute sign-in below.`
      : `This account doesn't have access to the ${portal}. Try the other sign-in tab.`;
  }
  if (msg.includes('profile not found')) return 'Your login exists but your profile is missing. Please contact your institute.';
  if (msg.includes('network error') || msg.includes('failed to fetch')) return "We couldn't reach the server. Check your connection and try again.";
  return raw;
};

const DEFAULT_BRAND =<img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" alt="Atlas Classes" className="h-14 w-auto object-contain" />;

const AuthScreen: React.FC<AuthScreenProps> = ({ role, portalLabel, title, subtitle, headline, features, emailPlaceholder, brand = DEFAULT_BRAND }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const navigate = useNavigate();
  const auth = useAuth();

  const switchIndex = SWITCHABLE.findIndex(s => s.role === role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await auth.login({ email: email.trim(), password }, role);
      setSuccess(true);
      setTimeout(() => navigate(`/dashboard/${role}`), 650);
    } catch (err: any) {
      setError(friendlyError(err?.message || 'Sign-in failed. Please check your email and password.', portalLabel, role));
      setShakeKey(k => k + 1);
      setSubmitting(false);
    }
  };

  const detectCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="min-h-screen bg-atlas-black text-white flex">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between overflow-hidden border-r border-white/5 p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(52,211,153,0.12),transparent_40%)]" />
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-atlas-primary/10 blur-3xl animate-pulse-slow" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

        <div className="relative animate-auth-in">{brand}</div>

        <div className="relative max-w-lg">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-atlas-primary mb-5 animate-auth-in" style={{ animationDelay: '0.1s' }}>{portalLabel}</p>
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.08] tracking-tight animate-auth-in" style={{ animationDelay: '0.2s' }}>{headline}</h1>
          <div className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title: ft, text }, i) => (
              <div key={ft} className="flex items-start gap-4 animate-auth-in" style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
                <div className="p-2.5 rounded-xl bg-atlas-primary/10 border border-atlas-primary/20 text-atlas-primary shrink-0"><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-white">{ft}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-gray-600">© {new Date().getFullYear()} Atlas Classes. All rights reserved.</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="absolute inset-0 lg:hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%)]" />

        <div className="relative w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8 animate-auth-in">{brand}</div>

          {role !== 'admin' ? (
            <div className="relative grid grid-cols-2 p-1 mb-8 rounded-2xl bg-white/[0.03] border border-white/5 animate-auth-in" role="tablist" aria-label="Choose portal">
              <span
                className="absolute top-1 bottom-1 left-1 rounded-xl bg-atlas-primary/15 border border-atlas-primary/30 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: 'calc(50% - 0.25rem)', transform: `translateX(${switchIndex * 100}%)` }}
              />
              {SWITCHABLE.map(s => (
                <button
                  key={s.role}
                  role="tab"
                  aria-selected={s.role === role}
                  onClick={() => s.role !== role && navigate(s.path)}
                  className={`relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors ${s.role === role ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-center mb-8 animate-auth-in">
              <span className="px-4 py-1.5 rounded-full bg-atlas-primary/10 border border-atlas-primary/25 text-[11px] font-black uppercase tracking-[0.3em] text-atlas-primary">Restricted access</span>
            </div>
          )}

          <div key={role} className="rounded-[2rem] bg-atlas-dark/80 backdrop-blur-xl border border-white/5 p-7 sm:p-9 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] animate-auth-in" style={{ animationDelay: '0.08s' }}>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>
            <p className="text-sm text-gray-500 mt-2">{subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="block text-xs font-bold text-gray-400 mb-2">Email address</span>
                <div className="group flex items-center gap-3 px-4 rounded-xl bg-atlas-black/60 border border-white/10 focus-within:border-atlas-primary/60 focus-within:ring-4 focus-within:ring-atlas-primary/10 transition-all">
                  <EnvelopeIcon className="h-5 w-5 text-gray-600 group-focus-within:text-atlas-primary transition-colors shrink-0" />
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    required
                    autoFocus
                    className="w-full py-3.5 bg-transparent outline-none text-white placeholder-gray-600 text-sm"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-gray-400 mb-2">Password</span>
                <div className="group flex items-center gap-3 px-4 rounded-xl bg-atlas-black/60 border border-white/10 focus-within:border-atlas-primary/60 focus-within:ring-4 focus-within:ring-atlas-primary/10 transition-all">
                  <KeyIcon className="h-5 w-5 text-gray-600 group-focus-within:text-atlas-primary transition-colors shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyUp={detectCaps}
                    onKeyDown={detectCaps}
                    placeholder="Enter your password"
                    required
                    className="w-full py-3.5 bg-transparent outline-none text-white placeholder-gray-600 text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="p-1 text-gray-500 hover:text-white transition-colors shrink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {capsLock && <span className="block text-[11px] text-amber-400 mt-2">Caps Lock is on.</span>}
              </label>

              {error && (
                <div key={shakeKey} role="alert" className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300 animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`relative w-full overflow-hidden rounded-xl py-3.5 font-black text-sm transition-all duration-300 active:scale-[0.99] ${
                  success ? 'bg-emerald-400 text-atlas-black' : 'bg-gradient-to-r from-atlas-primary to-emerald-400 text-atlas-black hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.9)] hover:-translate-y-0.5'
                } disabled:cursor-wait`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {success ? (
                    <><CheckCircleIcon className="h-5 w-5" /> Signed in — opening your dashboard</>
                  ) : submitting ? (
                    <><span className="h-4 w-4 rounded-full border-2 border-atlas-black/30 border-t-atlas-black animate-spin" /> Signing in…</>
                  ) : (
                    'Sign in'
                  )}
                </span>
              </button>
            </form>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 text-sm animate-auth-in" style={{ animationDelay: '0.2s' }}>
            {role === 'admin' && (
              <p className="text-gray-500">Not an administrator? <Link to="/login/student" className="font-bold text-atlas-primary hover:text-emerald-300 transition-colors">Student &amp; institute sign-in</Link></p>
            )}
            <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeftIcon className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthScreen;
