import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, BookOpen, CalendarDays } from 'lucide-react';
import { queryKeys } from '../../queryClient';
import { NavLink } from '../../router';
import { api } from '../../services/api';
import type { EmployeeTrainingSummary } from '../../types';
import { usePersonalReminders } from './usePersonalReminders';

type LeaveBalance = {
    available: boolean;
    balance_days: number | null;
    stale?: boolean;
};

export function HomeSummary() {
    const leave = useQuery({
        queryKey: queryKeys.employeeLeaveBalance,
        queryFn: () => api.get<LeaveBalance>('/api/leave-requests/balance'),
    });
    const training = useQuery({
        queryKey: queryKeys.employeeTrainingSummary,
        queryFn: () => api.get<EmployeeTrainingSummary>('/api/videos/summary'),
    });
    const reminders = usePersonalReminders();
    const activeCount = reminders.data?.items.filter(item => !item.completed).length ?? 0;
    const leaveValue = leave.isPending ? '…' : leave.data?.available && leave.data.balance_days !== null
        ? `${leave.data.balance_days} Gün` : '—';

    return (
        <section className="home-summary" aria-label="Kişisel özetim">
            <NavLink to="/employee/izinler" className="home-summary-card home-summary-card--violet">
                <CalendarDays className="home-summary-icon" aria-hidden="true" />
                <span className="home-summary-label">Kalan izin bakiyesi</span>
                <strong className="home-summary-value">{leaveValue}</strong>
                <span className="home-summary-detail">
                    {leave.isError ? 'Bakiye alınamadı' : leave.data?.stale ? 'Bakiye güncel olmayabilir' : 'İzinlerimi görüntüle'}
                    <ArrowRight size={16} aria-hidden="true" />
                </span>
            </NavLink>
            <NavLink to="/employee/egitimler" className="home-summary-card home-summary-card--teal">
                <BookOpen className="home-summary-icon" aria-hidden="true" />
                <span className="home-summary-label">Bekleyen eğitimler</span>
                <strong className="home-summary-value">{training.isPending ? '…' : training.isError ? '—' : `${training.data.pending} Adet`}</strong>
                <span className="home-summary-detail">
                    {training.isError ? 'Eğitim bilgisi alınamadı' : 'Eğitimlerime git'}
                    <ArrowRight size={16} aria-hidden="true" />
                </span>
            </NavLink>
            <a href="#home-reminders" className="home-summary-card home-summary-card--coral">
                <Bell className="home-summary-icon" aria-hidden="true" />
                <span className="home-summary-label">Hatırlatmalar</span>
                <strong className="home-summary-value">{reminders.isPending ? '…' : reminders.isError ? '—' : `${activeCount} Adet`}</strong>
                <span className="home-summary-detail">
                    {reminders.isError ? 'Hatırlatmalar alınamadı' : 'Hatırlatmalarımı görüntüle'}
                    <ArrowRight size={16} aria-hidden="true" />
                </span>
            </a>
        </section>
    );
}
