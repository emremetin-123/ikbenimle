import { getPhotoUrl } from '../config';

type AchievementBadgeCardProps = {
  title: string;
  category?: string | null;
  imageUrl?: string | null;
  onClick?: () => void;
  priority?: boolean;
};

export function AchievementBadgeCard({ title, category, imageUrl, onClick, priority = false }: AchievementBadgeCardProps) {
  const src = getPhotoUrl(imageUrl) + (imageUrl?.startsWith('/uploads/videos/') ? (imageUrl.includes('?') ? '&' : '?') + 'badgeSize=256' : '');
  const content = (
    <>
      {imageUrl ? <img src={src} alt={onClick ? '' : title} className="achievement-collection-image" width={256} height={256} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
        : <strong className="achievement-collection-title">{title}</strong>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={'achievement-collection-card is-interactive' + (imageUrl ? ' has-image' : '')}
        aria-label={title}
        title={category ? `${title} · ${category}` : title}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={'achievement-collection-card' + (imageUrl ? ' has-image' : '')} title={category ? `${title} · ${category}` : title}>
      {content}
    </div>
  );
}
