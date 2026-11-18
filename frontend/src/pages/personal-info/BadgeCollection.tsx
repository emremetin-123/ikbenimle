import { Award } from 'lucide-react';
import { AchievementBadgeCard } from '../../components/AchievementBadgeCard';
import { PaginationControls } from '../../components/PaginationControls';
import type { PaginatedResponse, Video } from '../../types';
import { AsyncState } from '../../components/AsyncState';

type Props = {
  data?: PaginatedResponse<Video>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onSelect: (certificate: Video) => void;
};

export const BadgeCollection = ({ data, loading, error, onRetry, onPageChange, onSelect }: Props) => (
  <section className="profile-badges" aria-labelledby="profile-badges-title">
    <h2 id="profile-badges-title" className="profile-badges-title">
      <Award size={20} aria-hidden="true" /> Rozet Koleksiyonu
    </h2>
    {loading ? <AsyncState kind="loading" title="Rozetler yükleniyor" />
      : error ? <AsyncState kind="error" title="Rozetler alınamadı" onRetry={onRetry} />
      : !data?.items.length ? (
      <p className="profile-badges-empty">Henüz kazanılmış bir rozetiniz bulunmuyor.</p>
    ) : (
      <div className="profile-badge-list">
        {data.items.map((certificate, index) => (
          <AchievementBadgeCard
            key={certificate.assignment_id || certificate.id}
            title={certificate.title || 'Eğitim Rozeti'}
            category={certificate.category}
            imageUrl={certificate.badge_image_url}
            priority={index < 4}
            onClick={() => onSelect(certificate)}
          />
        ))}
      </div>
    )}
    {!loading && !error && <PaginationControls pagination={data?.pagination} onPageChange={onPageChange} />}
  </section>
);
