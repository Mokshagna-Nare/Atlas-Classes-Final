import React, { useMemo, useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useInstituteAnalytics } from '../../../../hooks/useInstituteAnalytics';
import StudentRoster from '../../../../components/students/StudentRoster';
import { PageHeader } from '../../../../components/ui/admin';
import BulkImportStudentsModal from './BulkImportStudentsModal';

// Institute panel → Students: the full roster with performance, profiles and management.
const ManageStudents: React.FC = () => {
  const { classes, refreshStudents } = useData();
  const { user } = useAuth()!;
  const instituteId = user?.id || '';
  const { analytics, loading, refresh } = useInstituteAnalytics(instituteId);
  const [bulkOpen, setBulkOpen] = useState(false);
  const instituteClasses = useMemo(() => classes.filter(c => c.institute_id === instituteId), [classes, instituteId]);

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        eyebrow="Students"
        title="Student management"
        subtitle={instituteClasses.length
          ? 'Every student, their class and how they are doing. Click a student for their full test history.'
          : 'No classes yet — add classes under Academics so students can be grouped.'}
      />
      <StudentRoster
        instituteId={instituteId}
        analytics={analytics}
        loading={loading}
        onChanged={refresh}
        onBulkImport={() => setBulkOpen(true)}
      />
      {bulkOpen && (
        <BulkImportStudentsModal
          instituteId={instituteId}
          classes={instituteClasses}
          onClose={() => setBulkOpen(false)}
          onImported={async () => { await refreshStudents(); refresh(); }}
        />
      )}
    </div>
  );
};

export default ManageStudents;
