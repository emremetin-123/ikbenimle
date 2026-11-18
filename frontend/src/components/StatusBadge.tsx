import type { ReactNode } from 'react';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
};

export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`ui-status-badge is-${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}
