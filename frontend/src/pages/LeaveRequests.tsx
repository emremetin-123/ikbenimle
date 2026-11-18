import { ModulePageHeader } from '../components/ModulePageHeader';
import { CalendarCheck } from 'lucide-react';
import { LeaveRequestForm } from '../components/LeaveRequestForm';
import { LeaveRequestsTable } from '../components/LeaveRequestsTable';

export const LeaveRequests = () => {
    return (
        <div className="leave-requests-page">
            <ModulePageHeader title="İzin Talebi ve Takip" description="Yeni izin talebi oluşturabilir ve önceki taleplerinizin durumunu takip edebilirsiniz." icon={<CalendarCheck />} tone="violet" />

            <div className="leave-requests-page-content">
                <LeaveRequestForm />
                <LeaveRequestsTable />
            </div>
        </div>
    );
};
