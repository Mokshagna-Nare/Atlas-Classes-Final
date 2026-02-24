const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
  console.error("Missing SUPABASE variables in .env file");
}

// 1. Normal client for standard operations (uses browser tokens)
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Admin client to bypass RLS and create user accounts
// CRITICAL FIX: Disable auth auto-login so it doesn't log the Admin out!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,     // <--- THIS STOPS THE LOGOUT ISSUE
    detectSessionInUrl: false
  }
});

module.exports = { supabase, supabaseAdmin };
