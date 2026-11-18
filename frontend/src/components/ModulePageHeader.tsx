import type { ReactNode } from 'react';

type ModulePageHeaderProps = {
  title: string;
  description: string;
  icon: ReactNode;
  actions?: ReactNode;
  tone?: 'blue' | 'teal' | 'violet';
};

export function ModulePageHeader({ title, description, icon, actions, tone = 'blue' }: ModulePageHeaderProps) {
  return (
    <header className={`module-page-header module-page-header--${tone}`}>
      <div className="module-page-header-main">
        <span className="module-page-header-icon" aria-hidden="true">{icon}</span>
        <div className="module-page-header-copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {actions && <div className="module-page-header-actions">{actions}</div>}
    </header>
  );
}
