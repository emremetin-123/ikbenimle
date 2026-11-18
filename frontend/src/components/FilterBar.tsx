import type { HTMLAttributes, ReactNode } from 'react';

type FilterBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  ariaLabel: string;
  children: ReactNode;
};

export function FilterBar({
  ariaLabel,
  children,
  className = '',
  ...props
}: FilterBarProps) {
  return (
    <div
      className={`ui-filter-bar ${className}`.trim()}
      role="search"
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </div>
  );
}
