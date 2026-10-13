/**
 * Route guard: only signed-in users with one of the given roles get through.
 *
 *   router.post('/create-institute', requireAuth('admin'), handler)
 *   router.post('/create-student', requireAuth('admin', 'institute'), handler)
 *
 * The caller sends its Supabase access token as "Authorization: Bearer <token>".
 * The token is checked with Supabase Auth (a forged or expired token fails), the role
 * comes from our `users` table (never from the request), and admins must have finished
 * two-step verification: their token has to be at assurance level aal2.
 *
 * On success the handler gets req.auth = { userId, role, instituteId, aal }.
 */
const { supabaseAdmin } = require('../supabaseClient');

/** Claims inside a token Supabase has already verified (used only to read the MFA level). */
function claimsOf(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

async function identify(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { status: 401, message: 'Please sign in again.' };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { status: 401, message: 'Your session has expired. Please sign in again.' };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, role, institute_id')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !profile) return { status: 403, message: 'This account has no Atlas Classes profile.' };

  return { auth: { userId: profile.id, role: profile.role, instituteId: profile.institute_id, aal: claimsOf(token).aal || 'aal1' } };
}

const requireAuth = (...roles) => async (req, res, next) => {
  try {
    const result = await identify(req);
    if (!result.auth) return res.status(result.status).json({ message: result.message });
    const { auth } = result;
    if (!roles.includes(auth.role)) return res.status(403).json({ message: "Your account isn't allowed to do this." });
    if (auth.role === 'admin' && auth.aal !== 'aal2') {
      return res.status(403).json({ message: 'Two-step verification is required for admin actions.', code: 'mfa_required' });
    }
    req.auth = auth;
    next();
  } catch (err) {
    console.error('Auth check failed:', err.message);
    res.status(500).json({ message: 'Could not verify your session.' });
  }
};

module.exports = { requireAuth, identify };
