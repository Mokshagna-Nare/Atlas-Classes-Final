/**
 * QA students for walking the admin → institute → student workflow with real schools.
 *
 *   npm run seed:schools          → create (or refresh) the classes and 4 students below
 *   npm run seed:schools:remove   → delete those 4 students (logins, profiles, attempts)
 *
 * Two students per school, in different classes. Students are created exactly the way the
 * institute portal's "Add student" does it (Supabase Auth login + `users` profile row).
 * Every student email ends in @qa.atlasclasses.test so they are easy to spot and remove.
 * Classes are created only if missing and are left in place on --remove (Class 6 at Akshara
 * existed before this script).
 *
 * All four students sign in on the Student login with the password in QA_STUDENT_PASSWORD
 * (backend/.env.local, which git ignores — this repository is public, so the password is never committed).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = process.env.QA_STUDENT_PASSWORD;
const QA_DOMAIN = '@qa.atlasclasses.test';
const CLASS_SUBJECTS = ['Mathematics', 'Science', 'Social'];

// Schools are found by their institute login email (names have duplicates, e.g. two "Akshara" rows).
const SCHOOLS = [
  {
    instituteEmail: 'narayana@gmail.com',
    students: [
      { name: 'Arjun Sharma', email: `arjun.sharma${QA_DOMAIN}`, roll_no: 'NHS-6-01', className: 'Class 6' },
      { name: 'Meera Patil', email: `meera.patil${QA_DOMAIN}`, roll_no: 'NHS-7-01', className: 'Class 7' },
    ],
  },
  {
    instituteEmail: 'aksharaglobalpucollege1@gmail.com',
    students: [
      { name: 'Kavya Hegde', email: `kavya.hegde${QA_DOMAIN}`, roll_no: 'AGPU-6-01', className: 'Class 6' },
      { name: 'Nikhil Rao', email: `nikhil.rao${QA_DOMAIN}`, roll_no: 'AGPU-7-01', className: 'Class 7' },
    ],
  },
];

async function instituteFor(email) {
  const { data, error } = await db.from('users').select('id, name').eq('email', email).eq('role', 'institute').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No institute login found for ${email}`);
  return data;
}

async function ensureClass(instituteId, name) {
  const { data: existing } = await db.from('classes').select('id').eq('institute_id', instituteId).eq('name', name).maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await db.from('classes').insert({ institute_id: instituteId, name, subjects: CLASS_SUBJECTS }).select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

async function ensureStudent(instituteId, classId, s) {
  const { data: existing } = await db.from('users').select('id').eq('email', s.email).maybeSingle();
  if (existing) {
    const { error } = await db.from('users').update({ name: s.name, institute_id: instituteId, class_id: classId, roll_no: s.roll_no }).eq('id', existing.id);
    if (error) throw error;
    await db.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    return 'updated';
  }
  // Same two steps as POST /api/auth/create-student.
  const { data: auth, error: authError } = await db.auth.admin.createUser({ email: s.email, password: PASSWORD, email_confirm: true });
  if (authError) throw authError;
  const { error } = await db.from('users').insert({
    id: auth.user.id, institute_id: instituteId, class_id: classId, roll_no: s.roll_no, role: 'student', email: s.email, name: s.name, password: PASSWORD,
  });
  if (error) {
    await db.auth.admin.deleteUser(auth.user.id).catch(() => {});
    throw error;
  }
  return 'created';
}

async function seed() {
  if (!PASSWORD) throw new Error('Set QA_STUDENT_PASSWORD in backend/.env.local first.');
  for (const school of SCHOOLS) {
    const inst = await instituteFor(school.instituteEmail);
    console.log(`\n${inst.name}`);
    for (const s of school.students) {
      const cls = await ensureClass(inst.id, s.className);
      const status = await ensureStudent(inst.id, cls.id, s);
      console.log(`  ${s.className.padEnd(8)} ${cls.created ? '(new class) ' : ''}${s.roll_no.padEnd(10)} ${s.name.padEnd(14)} ${s.email}  [${status}]`);
    }
  }
  console.log(`\nStudent password: QA_STUDENT_PASSWORD in backend/.env.local.`);
}

async function remove() {
  const { data: users, error } = await db.from('users').select('id, email').like('email', `%${QA_DOMAIN}`);
  if (error) throw error;
  for (const u of users || []) {
    await db.from('test_attempts').delete().eq('student_id', u.id);
    await db.from('users').delete().eq('id', u.id);
    await db.auth.admin.deleteUser(u.id).catch(() => {});
    console.log(`removed ${u.email}`);
  }
  if (!users?.length) console.log('nothing to remove');
}

(process.argv.includes('--remove') ? remove() : seed()).catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
