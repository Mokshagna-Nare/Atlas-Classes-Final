const express = require('express'); 
const router = express.Router();
const { supabase, supabaseAdmin } = require('../supabaseClient'); 

// 1. CREATE INSTITUTE
router.post('/create-institute', async (req, res) => {
  try {
    const { name, email, password, logo_url } = req.body;
    console.log("--- INCOMING REQUEST ---");
    console.log("Logo URL Received:", logo_url ? logo_url : "None");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    });

    if (authError) throw new Error(authError.message);

    const userId = authData.user.id;

    const { data: instData, error: instError } = await supabaseAdmin
      .from('institutes')
      .insert([{ id: userId, name: name, logo_url: logo_url }])
      .select()
      .single();

    if (instError) throw new Error(instError.message);

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        institute_id: userId,
        role: 'institute',
        email: email,
        name: name,
        logo_url: logo_url
      }]);

    if (userError) throw new Error(userError.message);

    res.status(201).json({ message: 'Institute created successfully', user: authData.user });

  } catch (err) {
    console.error("Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to create institute' });
  }
});

// ---------------------------------------------------------
// 2. DELETE INSTITUTE & USER COMPLETELY
// ---------------------------------------------------------
router.delete('/delete-institute/:id', async (req, res) => {
  try {
    const { id } = req.params; 
    console.log(`Attempting to delete institute with ID: ${id}`);

    // 1. Get the actual user ID from the users table using the institute_id
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('institute_id', id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw new Error(userError.message);
    }

    const actualUserId = userRecord ? userRecord.id : id;

    // 2. Delete from public.users FIRST
    const { error: userTableDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', actualUserId);
      
    if (userTableDeleteError) {
        console.warn("Could not delete from users table:", userTableDeleteError.message);
    }

    // 3. Delete from public.institutes SECOND
    const { error: instDeleteError } = await supabaseAdmin
      .from('institutes')
      .delete()
      .eq('id', id);

    if (instDeleteError) {
        console.warn("Could not delete from institutes table:", instDeleteError.message);
    }

    // 4. Finally, Delete from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(actualUserId);
    if (authDeleteError) {
        console.warn("Could not delete from Auth:", authDeleteError.message);
    }

    console.log(`Successfully deleted institute with ID: ${id}`);
    res.status(200).json({ message: 'Institute permanently deleted from all tables' });

  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to delete institute' });
  }
});

// ---------------------------------------------------------
// 3. UNIVERSAL LOGIN (Handles Admin, Institute, and Student)
// ---------------------------------------------------------
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

    // 3. IF NO LOGO IN USERS, FETCH IT FROM INSTITUTES TABLE (Fallback)
    let logoUrl = userProfile.logo_url;
    
    if (!logoUrl && userProfile.role === 'institute') {
       const { data: instData } = await supabase
         .from('institutes')
         .select('logo_url')
         .eq('id', userProfile.institute_id)
         .single();
         
       if (instData && instData.logo_url) {
           logoUrl = instData.logo_url;
       }
    }

    // 4. Return JSON exactly as frontend expects (ADDED refreshToken)
    res.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token, // Added for frontend session injection
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        institute_id: userProfile.institute_id,
        class_id: userProfile.class_id || null,
        roll_no: userProfile.roll_no || null,
        logo_url: logoUrl || null
      }
    });

  } catch (err) {
    console.error("Login Error:", err.message);
    const msg = err.message || 'Invalid credentials';
    res.status(400).json({ message: msg });
  }
});

// ---------------------------------------------------------
// 4. UPDATE INSTITUTE DETAILS
// ---------------------------------------------------------
router.put('/update-institute/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, logo_url } = req.body;
    
    console.log(`Attempting to update institute: ${id}`);

    // 1. Find the associated Auth user ID
    const { data: userRecord, error: userRecordError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('institute_id', id)
      .single();

    if (userRecordError && userRecordError.code !== 'PGRST116') {
       throw new Error(userRecordError.message);
    }

    // 2. Update Supabase Auth Email/Password
    if (userRecord && userRecord.id && (email || password)) {
        const updateAuthData = {
           email_confirm: true,
           user_metadata: { password_updated: new Date().toISOString() }
        };
        
        if (email) updateAuthData.email = email;
        if (password) updateAuthData.password = password;
        
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            userRecord.id, 
            updateAuthData
        );

        if (authUpdateError) throw new Error(authUpdateError.message);
    }

    // 3. Update public.institutes table
    const updateInstData = {};
    if (name) updateInstData.name = name;
    if (logo_url !== undefined) updateInstData.logo_url = logo_url;

    if (Object.keys(updateInstData).length > 0) {
      const { error: instError } = await supabaseAdmin
        .from('institutes')
        .update(updateInstData)
        .eq('id', id);

      if (instError) throw new Error(instError.message);
    }

    // 4. Update public.users table
    if (userRecord && userRecord.id) {
       const updateUserData = {};
       if (name) updateUserData.name = name;
       if (email) updateUserData.email = email;
       if (logo_url !== undefined) updateUserData.logo_url = logo_url;
       if (password) updateUserData.password = password;

       if (Object.keys(updateUserData).length > 0) {
          await supabaseAdmin
            .from('users')
            .update(updateUserData)
            .eq('id', userRecord.id);
       }
    }

    console.log(`Successfully updated institute: ${id}`);
    res.status(200).json({ message: 'Institute updated successfully' });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to update institute' });
  }
});

// ---------------------------------------------------------
// 5. CREATE STUDENT (institute/admin provisions a student login)
// ---------------------------------------------------------
router.post('/create-student', async (req, res) => {
  try {
    const { name, email, password, institute_id, class_id, roll_no } = req.body;

    if (!name || !email || !password || !institute_id) {
      return res.status(400).json({ message: 'name, email, password and institute_id are required.' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw new Error(authError.message);

    const userId = authData.user.id;

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        institute_id,
        class_id: class_id || null,
        roll_no: roll_no || null,
        role: 'student',
        email,
        name,
        password
      }]);

    if (userError) {
      // Roll back the auth user so we don't leave an orphaned login
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(userError.message);
    }

    res.status(201).json({ message: 'Student created successfully', user: { id: userId, name, email, institute_id, class_id, roll_no } });
  } catch (err) {
    console.error("Create Student Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to create student' });
  }
});

// ---------------------------------------------------------
// 5b. BULK CREATE STUDENTS (from an uploaded spreadsheet)
// ---------------------------------------------------------
router.post('/bulk-create-students', async (req, res) => {
  const { institute_id, students } = req.body;

  if (!institute_id || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: 'institute_id and a non-empty students array are required.' });
  }
  if (students.length > 500) {
    return res.status(400).json({ message: 'Please upload at most 500 students per file.' });
  }

  const results = [];

  // Sequential, not Promise.all: Supabase Auth admin.createUser is rate-limited,
  // and we want a clean per-row success/failure report either way.
  for (const row of students) {
    const { name, email, password, class_id, roll_no } = row || {};
    if (!name || !email || !password) {
      results.push({ email: email || '(missing)', success: false, message: 'Missing name, email, or password.' });
      continue;
    }
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (authError) throw new Error(authError.message);

      const userId = authData.user.id;
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert([{ id: userId, institute_id, class_id: class_id || null, roll_no: roll_no || null, role: 'student', email, name, password }]);

      if (userError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(userError.message);
      }

      results.push({ id: userId, name, email, password, class_id: class_id || null, roll_no: roll_no || null, success: true });
    } catch (err) {
      results.push({ email, success: false, message: err.message || 'Failed to create this student.' });
    }
  }

  const successCount = results.filter(r => r.success).length;
  res.status(200).json({
    message: `Created ${successCount} of ${students.length} students.`,
    results
  });
});

// ---------------------------------------------------------
// 6. UPDATE STUDENT
// ---------------------------------------------------------
router.put('/update-student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, class_id, roll_no } = req.body;

    if (email || password) {
      const updateAuthData = {};
      if (email) updateAuthData.email = email;
      if (password) updateAuthData.password = password;
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, updateAuthData);
      if (authUpdateError) throw new Error(authUpdateError.message);
    }

    const updateUserData = {};
    if (name !== undefined) updateUserData.name = name;
    if (email !== undefined) updateUserData.email = email;
    if (password !== undefined) updateUserData.password = password;
    if (class_id !== undefined) updateUserData.class_id = class_id;
    if (roll_no !== undefined) updateUserData.roll_no = roll_no;

    if (Object.keys(updateUserData).length > 0) {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update(updateUserData)
        .eq('id', id)
        .eq('role', 'student');
      if (userError) throw new Error(userError.message);
    }

    res.status(200).json({ message: 'Student updated successfully' });
  } catch (err) {
    console.error("Update Student Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to update student' });
  }
});

// ---------------------------------------------------------
// 7. DELETE STUDENT
// ---------------------------------------------------------
router.delete('/delete-student/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error: userDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
      .eq('role', 'student');
    if (userDeleteError) console.warn("Could not delete from users table:", userDeleteError.message);

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authDeleteError) console.warn("Could not delete from Auth:", authDeleteError.message);

    res.status(200).json({ message: 'Student permanently deleted' });
  } catch (err) {
    console.error("Delete Student Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to delete student' });
  }
});

module.exports = router;