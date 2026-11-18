import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { LoadingIndicator } from './LoadingIndicator';

type AsyncStateProps = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function AsyncState({ kind, title, message, onRetry, className = '' }: AsyncStateProps) {
  const isError = kind === 'error';
  const isLoading = kind === 'loading';
  if (isLoading) {
    return <LoadingIndicator compact label={message ? `${title}. ${message}` : title} className={className} />;
  }
  const icon = isError
    ? <AlertCircle aria-hidden="true" />
    : <Inbox aria-hidden="true" />;

  return (
    <div
      className={`ui-async-state is-${kind} ${className}`.trim()}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {icon}
      <div>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
      {isError && onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Yeniden Dene
        </button>
      )}
    </div>
  );
}
