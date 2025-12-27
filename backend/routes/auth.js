
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Register (Institute or Student)
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- DUMMY CREDENTIALS FOR DEMO/TESTING ---
    if (email === 'student@atlas.com' && password === 'password') {
        return res.json({
            token: 'mock-student-token',
            user: {
                id: 's1',
                name: 'Riya Sharma',
                email: 'student@atlas.com',
                role: 'student',
                instituteId: 'i1'
            }
        });
    }

    if (email === 'institute@atlas.com' && password === 'password') {
        return res.json({
            token: 'mock-institute-token',
            user: {
                id: 'i1',
                name: 'ABC School',
                email: 'institute@atlas.com',
                role: 'institute'
            }
        });
    }

    if (email === 'admin@atlas.com' && password === 'password') {
         return res.json({
            token: "admin-static-token",
            user: {
                id: "admin-id",
                name: "Administrator",
                email: email,
                role: "admin",
                instituteId: null
            }
        });
    }
    // -------------------------------------------

    // --- CHECK ADMIN LOGIN (Environment Variables) ---
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      return res.json({
        token: "admin-static-token", // Static token for admin
        user: {
          id: "admin-id",
          name: "Administrator",
          email: email,
          role: "admin",
          instituteId: null
        }
      });
    }

    // --- CHECK SUPABASE LOGIN (Institute/Student) ---
    
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
