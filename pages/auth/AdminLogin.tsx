import React from 'react';
import AuthScreen from '../../components/auth/AuthScreen';
import { Squares2X2Icon, ShieldCheckIcon, GlobeAltIcon } from '../../components/icons';

const AdminLogin: React.FC = () => (
  <AuthScreen
    role="admin"
    portalLabel="Admin Console"
    title="Administrator sign-in"
    subtitle="For Atlas Classes staff only."
    emailPlaceholder="admin@example.com"
    headline={<>Run the entire network <span className="bg-gradient-to-r from-emerald-300 to-atlas-primary bg-clip-text text-transparent">from one console.</span></>}
    features={[
      { icon: Squares2X2Icon, title: 'Question bank', text: 'Upload, review, and organize every question.' },
      { icon: ShieldCheckIcon, title: 'Proctoring oversight', text: 'Review flagged attempts across all institutes.' },
      { icon: GlobeAltIcon, title: 'Partner network', text: 'Onboard institutes and manage their access.' },
    ]}
  />
);

export default AdminLogin;
