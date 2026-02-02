
import { Course, FacultyMember, Testimonial, Student, Test, TestResult, Payment, Institute, AdminQuestionPaper } from './types';

export const NAV_LINKS = [
  { name: 'Home', href: 'home' },
  { name: 'Courses', href: 'courses' },
  { name: 'Benefits', href: 'benefits' },
  { name: 'Mission', href: 'mission' },
  { name: 'Team', href: 'faculty' },
  { name: 'Careers', href: 'careers' },
  { name: 'Contact', href: 'contact' },
];

export const COURSES_DATA: Course[] = [
  {
    id: 1,
    title: 'COMPASS – Foundation for IIT-JEE',
    description: 'Focused conceptual foundation for Grades 6–10 aspiring for IIT-JEE, building strong analytical and problem-solving skills from an early age.',
  },
  {
    id: 2,
    title: 'AXIS – Foundation for NEET',
    description: 'Specialized medical foundation for Grades 6–10 aligned with NEET preparation, emphasizing biology, chemistry, and physics.',
  },
  {
    id: 3,
    title: 'NEXUS – Comprehensive Foundation',
    description: 'An integrated program covering both IIT-JEE and NEET base subjects, offering a holistic approach for students exploring both streams.',
  },
];

export const FACULTY_DATA: FacultyMember[] = [
  { id: 1, name: 'Prof Gopal Krishna', subject: 'Academic Head', subjects: ['Curriculum'], photoUrl: 'https://ui-avatars.com/api/?name=Gopal+Krishna&background=10B981&color=fff', bio: 'Academic lead focusing on curriculum excellence.' },
  { id: 2, name: 'Dr S. Vali', subject: 'Academic Head', subjects: ['Pedagogy'], photoUrl: 'https://ui-avatars.com/api/?name=S+Vali&background=10B981&color=fff', bio: 'Pedagogy expert dedicated to innovative teaching methods.' },
  { id: 3, name: 'Prof N. Lakshmi Rajesh', subject: 'Academic Head', subjects: ['Planning'], photoUrl: 'https://ui-avatars.com/api/?name=Lakshmi+Rajesh&background=10B981&color=fff', bio: 'Standardization lead ensuring academic planning consistency.' },
  { id: 4, name: 'Prof Mohanrao', subject: 'Academic Head', subjects: ['Strategy', 'Mentorship'], photoUrl: 'https://ui-avatars.com/api/?name=Prof+Mohanrao&background=10B981&color=fff', bio: 'Expert academician specializing in curriculum strategy and student success.' },
  { id: 5, name: 'Kranthi', subject: 'Head (South Region)', subjects: ['Operations', 'Growth'], photoUrl: 'https://ui-avatars.com/api/?name=Kranthi&background=10B981&color=fff', bio: 'Overseeing operations and regional expansion across South India.' },
  { id: 6, name: 'Dr K.Reddy', subject: 'Marketing Head', subjects: ['Branding', 'Outreach'], photoUrl: 'https://ui-avatars.com/api/?name=K+Reddy&background=10B981&color=fff', bio: 'Leading strategic marketing initiatives and brand outreach for Atlas Classes.' },
  { id: 7, name: 'Mokshagna', subject: 'Technical Head', subjects: ['Technology'], photoUrl: 'https://ui-avatars.com/api/?name=Mokshagna&background=10B981&color=fff', bio: 'Technology lead driving digital innovation in learning.' },
];

export const TESTIMONIALS_DATA: Testimonial[] = [
  {
    id: 1,
    quote: 'Atlas Classes transformed our students’ learning approach with their structured curriculum and continuous assessments. The results have been outstanding.',
    author: 'Principal, ABC School',
    title: 'Partner Institute',
    rating: 5,
  },
  {
    id: 2,
    quote: 'I improved my confidence and scores significantly with their detailed assessment system. The micro-planning helped me stay on track.',
    author: 'Aarav, Grade 10',
    title: 'Student',
    rating: 5,
  },
  {
    id: 3,
    quote: 'The teacher empowerment program is exceptional. Our faculty feels more equipped and motivated to deliver high-quality education.',
    author: 'Director, XYZ Academy',
    title: 'Partner Institute',
    rating: 4,
  },
];

export const INSTITUTES_DATA: Institute[] = [
  { id: 'i1', name: 'ABC School', email: 'institute@atlas.com' },
  { id: 'i2', name: 'Global Tech Academy', email: 'admin@gta.edu' },
  { id: 'i3', name: 'Future Leaders Institute', email: 'contact@fli.org' },
];

export const ADMIN_QUESTION_PAPERS: AdminQuestionPaper[] = [];

export const INSTITUTE_STUDENTS: Student[] = [
  { id: 's1', name: 'Riya Sharma', instituteId: 'i1' },
  { id: 's2', name: 'Arjun Verma', instituteId: 'i1' },
  { id: 's3', name: 'Priya Patel', instituteId: 'i1' },
  { id: 's4', name: 'Rohan Kumar', instituteId: 'i1' },
];

// Cleared dummy tests
export const STUDENT_TESTS: Test[] = [];

// Cleared dummy results
export const STUDENT_RESULTS: TestResult[] = [];

export let ALL_RESULTS: TestResult[] = [];

export const STUDENT_PAYMENTS: Payment[] = [
  { id: 'p1', date: '2024-08-01', amount: 5000, status: 'Paid' },
  { id: 'p2', date: '2024-09-01', amount: 5000, status: 'Paid' },
  { id: 'p3', date: '2024-10-01', amount: 5000, status: 'Due' },
];
