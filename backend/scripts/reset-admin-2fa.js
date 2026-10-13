/**
 * Removes an administrator's two-step verification (authenticator app), e.g. after a lost phone.
 * Their next sign-in asks them to set it up again with a new QR code.
 *
 *   node scripts/reset-admin-2fa.js someone@atlasclasses.com
 *
 * Confirm the request really comes from that person (call them) before running this.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) throw new Error('Usage: node scripts/reset-admin-2fa.js <admin email>');

  const { data: profile, error } = await db.from('users').select('id, role').ilike('email', email).eq('role', 'admin').maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error(`No admin account for ${email}`);

  const { data: factors, error: listError } = await db.auth.admin.mfa.listFactors({ userId: profile.id });
  if (listError) throw listError;
  for (const f of factors.factors) {
    const { error: deleteError } = await db.auth.admin.mfa.deleteFactor({ userId: profile.id, id: f.id });
    if (deleteError) throw deleteError;
  }
  console.log(`Removed ${factors.factors.length} two-step method(s) for ${email}. They will set it up again at next sign-in.`);
})().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
