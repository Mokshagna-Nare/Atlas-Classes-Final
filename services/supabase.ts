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

// 1. Get your custom token from local storage
const atlasToken = localStorage.getItem('atlas-token');

// 2. Pass it into the global headers so Supabase knows you are authenticated
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: atlasToken ? { Authorization: `Bearer ${atlasToken}` } : {},
  },
});
