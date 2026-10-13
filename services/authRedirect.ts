import { supabase } from './supabase';

export type AuthFlow = 'google' | 'reset';

/** Where Google and password-reset emails send people back to, e.g. https://atlasclasses.com/?auth=google */
export const authReturnUrl = (flow: AuthFlow) => `${window.location.origin}${window.location.pathname}?auth=${flow}`;

/**
 * Runs once before the app renders. When the page was opened from Google sign-in or a
 * password-reset email (?auth=…), finish creating the session, strip the one-time code from
 * the address bar and continue on the admin sign-in screen (#/login/admin?flow=…).
 *
 * Accepts both link styles Supabase can send:
 *   ?code=…                       PKCE (Google, and the default reset email) — must open in the same browser
 *   ?token_hash=…&type=recovery   reset email template using {{ .TokenHash }} — works in any browser
 */
export async function completeAuthRedirect(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const flow = params.get('auth');
  if (flow !== 'google' && flow !== 'reset') return;

  let error = params.get('error_description') || params.get('error') || '';
  try {
    const tokenHash = params.get('token_hash');
    if (!error && tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (verifyError) error = verifyError.message;
    } else if (!error) {
      // The client exchanges ?code= while it starts up; getSession waits for that to finish.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        error = flow === 'reset'
          ? 'This reset link has expired or was opened in a different browser. Request a new link and open it in this browser.'
          : 'Google sign-in could not be completed. Please try again.';
      }
    }
  } catch (e: any) {
    error = e?.message || 'Sign-in could not be completed.';
  }

  const next = new URLSearchParams({ flow });
  if (error) next.set('error', error);
  window.history.replaceState(null, '', `${window.location.pathname}#/login/admin?${next.toString()}`);
}
