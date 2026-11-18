import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
  className?: string;
  variant?: 'plain' | 'surface';
};

export function PageHeader({
  title,
  description,
  icon,
  actions,
  notice,
  className = '',
  variant = 'plain',
}: PageHeaderProps) {
  return (
    <header className={`${variant === 'surface' ? 'premium-card ' : ''}ui-page-header is-${variant} ${className}`.trim()}>
      <div className="ui-page-header-main">
        <div className="ui-page-header-copy">
          <h2 className="ui-page-header-title">
            {icon && <span className="ui-page-header-icon" aria-hidden="true">{icon}</span>}
            {title}
          </h2>
          {description && <p className="ui-page-header-description">{description}</p>}
        </div>
        {actions && <div className="ui-page-header-actions">{actions}</div>}
      </div>
      {notice && <div className="ui-page-header-notice">{notice}</div>}
    </header>
  );
}
