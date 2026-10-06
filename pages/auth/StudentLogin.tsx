import React from 'react';
import AuthScreen from '../../components/auth/AuthScreen';
import { ChartPieIcon, ClipboardCheckIcon, TrophyIcon } from '../../components/icons';

const StudentLogin: React.FC = () => (
  <AuthScreen
    role="student"
    portalLabel="Student Portal"
    title="Welcome back"
    subtitle="Sign in with the email and password your institute gave you."
    emailPlaceholder="you@example.com"
    headline={<>Every test you take, <span className="bg-gradient-to-r from-emerald-300 to-atlas-primary bg-clip-text text-transparent">turned into progress.</span></>}
    features={[
      { icon: ClipboardCheckIcon, title: 'Proctored online tests', text: 'Take the tests assigned to your class, right in your browser.' },
      { icon: ChartPieIcon, title: '360° analytics', text: 'Subjects, concepts, difficulty, and growth — test by test.' },
      { icon: TrophyIcon, title: 'Know where you stand', text: 'Track your class rank and how it changes over time.' },
    ]}
  />
);

export default StudentLogin;
