import { LoaderCircle } from 'lucide-react';

type LoadingIndicatorProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

export function LoadingIndicator({
  label = 'İçerik yükleniyor',
  compact = false,
  className = '',
}: LoadingIndicatorProps) {
  return (
    <div
      className={`ui-loading-indicator${compact ? ' is-compact' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoaderCircle className="ui-loading-spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
