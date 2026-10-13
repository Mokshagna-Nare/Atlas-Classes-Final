// /// <reference types="vite/client" />

// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file");
// }

// export const supabase = createClient(supabaseUrl, supabaseKey);


/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file");
}

// AuthContext.tsx injects the student/institute session after the backend login.
// PKCE: Google sign-in and password-reset links come back as ?code=… in the query string,
// which (unlike tokens in the URL hash) doesn't collide with the app's #/ routes.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});