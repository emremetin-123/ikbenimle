import type { ReactNode } from 'react';
import { ChevronLeft, Menu } from 'lucide-react';

type Props = {
  title: string;
  icon?: ReactNode;
  onOpenMenu: () => void;
  onBack?: () => void;
  menuLabel?: string;
};

export function MobileHeader({ title, icon, onOpenMenu, onBack, menuLabel = 'Menüyü aç' }: Props) {
  return (
    <header className="mobile-header mobile-only">
      {onBack && <button type="button" className="btn-icon-round mobile-header-back" aria-label="Geri dön" onClick={onBack}><ChevronLeft size={22} aria-hidden="true" /></button>}
      <div className={`mobile-page-title${onBack ? ' has-back' : ''}`} aria-hidden="true">
        {icon}<span>{title}</span>
      </div>
      <button type="button" className="btn-icon-round" onClick={onOpenMenu} aria-label={menuLabel}><Menu size={20} aria-hidden="true" /></button>
    </header>
  );
}
