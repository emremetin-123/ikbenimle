import { Award, GraduationCap, IdCard } from 'lucide-react';
import { AsyncState } from '../../components/AsyncState';
import type { EmployeeTrainingSummary } from '../../types';

type Props = {
  summary?: EmployeeTrainingSummary;
  employeeId?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

export function ProfileSummary({ summary, employeeId, loading, error, onRetry }: Props) {
  const value = (count?: number) => loading ? '…' : error ? '—' : count ?? '—';
  const cards = [
    { tone: 'violet', label: 'Tamamlanan Eğitim', value: value(summary?.completed), icon: GraduationCap },
    { tone: 'teal', label: 'Kazanılan Rozet', value: value(summary?.badges), icon: Award },
    { tone: 'coral', label: 'Sicil Numarası', value: employeeId || '—', icon: IdCard },
  ];

  return (
    <section aria-label="Profil özeti" className="profile-summary-section">
      <div className="profile-summary" aria-busy={loading}>
        {cards.map(({ tone, label, value, icon: Icon }) => (
          <div key={tone} className={`profile-summary-card profile-summary-card--${tone}`}>
            <Icon size={32} aria-hidden="true" />
            <div><span>{label}</span><strong>{value}</strong></div>
          </div>
        ))}
      </div>
      {error && <AsyncState kind="error" title="Eğitim özeti alınamadı" onRetry={onRetry} />}
    </section>
  );
}
