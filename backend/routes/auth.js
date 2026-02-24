const express = require('express');
const router = express.Router();
// Import both the standard client and the admin client
const { supabase, supabaseAdmin } = require('../supabaseClient');

// Register (Student or self-signup Institute)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, instituteId } = req.body;

    // 1. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (authData.user) {
      // 2. Insert profile into 'public.users' table
      const { error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            name: name,
            role: role,
            institute_id: instituteId || null // Use snake_case for DB column
          }
        ]);

      if (dbError) throw dbError;
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error("Signup Error:", err.message);
    res.status(400).json({ message: err.message || 'Signup failed' });
  }
});

// Admin-Only Route: Programmatically Create an Institute Account
router.post('/create-institute', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Create the user using the Admin API
    // We strictly use the admin API which doesn't alter local sessions
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    });

    if (authError) {
      console.error("Auth Creation Error:", authError);
      throw new Error(authError.message);
    }

    const newUserId = authData.user.id;

    // 2. Insert the new Institute into the public.institutes table
    const { data: instituteData, error: instituteError } = await supabaseAdmin
      .from('institutes')
      .insert([{ name: name }])
      .select()
      .single();

    if (instituteError) {
       // Cleanup the auth user if db insert fails (optional but good practice)
       await supabaseAdmin.auth.admin.deleteUser(newUserId);
       throw new Error(instituteError.message);
    }

    // 3. Link the new Auth user and the Institute in the public.users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: newUserId,
        email: email,
        name: name,
        role: 'institute',
        institute_id: instituteData.id 
      }]);

    if (dbError) {
       await supabaseAdmin.auth.admin.deleteUser(newUserId);
       await supabaseAdmin.from('institutes').delete().eq('id', instituteData.id);
       throw new Error(dbError.message);
    }

    // 4. Return ONLY safe data. NEVER return authData.session or authData tokens here
    res.status(201).json({ 
      message: 'Institute created successfully',
      institute: {
        id: instituteData.id,
        name: instituteData.name,
        email: email
        // Notice we do not send any access_tokens back!
      }
    });

  } catch (err) {
    console.error("Create Institute Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to create institute' });
  }
});

// Universal Login (Handles Admin, Institute, and Student)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;

    // 2. Fetch User Profile from 'users' table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ message: 'User profile not found in database.' });
    }

    // 3. Return JSON exactly as frontend expects
    // Note: Mapping 'institute_id' (DB) to 'instituteId' (Frontend)
    res.json({
      token: authData.session.access_token,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        instituteId: userProfile.institute_id 
      }
    });

  } catch (err) {
    console.error("Login Error:", err.message);
    const msg = err.message || 'Invalid credentials';
    res.status(400).json({ message: msg });
  }
});

module.exports = router;
