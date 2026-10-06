import React from 'react';
import AuthScreen from '../../components/auth/AuthScreen';
import { UserGroupIcon, ChartBarIcon, DocumentDuplicateIcon } from '../../components/icons';

const InstituteLogin: React.FC = () => (
  <AuthScreen
    role="institute"
    portalLabel="Institute Console"
    title="Institute sign-in"
    subtitle="Manage your students, classes, and results."
    emailPlaceholder="institute@example.com"
    brand={
      <div className="flex items-center gap-4">
        <img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" alt="Atlas Classes" className="h-12 w-auto object-contain" />
        <div className="h-10 w-px bg-white/10" />
        <img src="https://i.postimg.cc/Y9jSSdVL/Logo-(ilearn).png" alt="iLearn" className="w-32 h-auto object-contain" />
      </div>
    }
    headline={<>Your whole campus, <span className="bg-gradient-to-r from-emerald-300 to-atlas-primary bg-clip-text text-transparent">in one view.</span></>}
    features={[
      { icon: UserGroupIcon, title: 'Student roster', text: 'Enroll students one by one or import a whole class from Excel.' },
      { icon: ChartBarIcon, title: 'Campus analytics', text: 'See how every class performs across tests.' },
      { icon: DocumentDuplicateIcon, title: 'Papers & tests', text: 'Access question papers and the tests shared with you.' },
    ]}
  />
);

export default InstituteLogin;
