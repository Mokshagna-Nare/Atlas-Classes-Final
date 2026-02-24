const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Your anon key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You must add this to your .env file!

if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
  console.error("Missing SUPABASE variables in .env file");
}

// Normal client for standard operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client to bypass RLS and create user accounts
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase, supabaseAdmin };
