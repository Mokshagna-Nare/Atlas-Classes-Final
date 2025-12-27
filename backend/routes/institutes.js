const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Middleware to check for admin role
const isAdmin = async (req, res, next) => {
  // For now, we'll assume a simple header-based token for demo purposes.
  // In a real app, you'd have a proper JWT validation middleware.
  const adminToken = req.headers['authorization'];
  if (adminToken === 'admin-static-token') { // This should be a real token check
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

// Create a new institute and its user
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Create the institute first
    const { data: instituteData, error: instituteError } = await supabase
      .from('institutes')
      .insert([{ name }])
      .select()
      .single();

    if (instituteError) throw instituteError;

    // 2. Create the user for the institute using the admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the user
    });

    if (authError) throw authError;

    // 3. Insert the user profile into 'public.users'
    if (authData.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            name: name, // Institute name is used as the user's name
            role: 'institute',
            institute_id: instituteData.id,
          }
        ]);

      if (dbError) throw dbError;
    }

    res.status(201).json({ message: 'Institute and user created successfully', institute: instituteData });
  } catch (err) {
    console.error("Create Institute Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to create institute' });
  }
});

// Delete an institute and its user
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the user associated with the institute
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('institute_id', id)
      .single();

    if (userError) {
      console.warn("Could not find user for institute, proceeding to delete institute.", userError.message);
    }

    // 2. If a user is found, delete them from Supabase Auth
    if (userData) {
      const { error: authError } = await supabase.auth.admin.deleteUser(userData.id);
      if (authError) {
        // If the user is already deleted or not found, we can ignore the error
        if (authError.message !== 'User not found') {
          throw authError;
        }
      }
    }

    // 3. Delete the institute from the 'institutes' table
    const { error: instituteError } = await supabase
      .from('institutes')
      .delete()
      .eq('id', id);

    if (instituteError) throw instituteError;

    res.status(200).json({ message: 'Institute and associated user deleted successfully' });
  } catch (err) {
    console.error("Delete Institute Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to delete institute' });
  }
});


module.exports = router;
