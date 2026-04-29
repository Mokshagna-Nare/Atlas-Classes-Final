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

// Just export the clean client. 
// AuthContext.tsx will handle injecting the token dynamically upon login!
export const supabase = createClient(supabaseUrl, supabaseKey);