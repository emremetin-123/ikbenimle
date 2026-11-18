import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';

export function PolyvalenceModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalShell onClose={onClose} ariaLabel={title} className="poly-modal">
        <header className="poly-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            title="Kapat"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </header>
        {children}
    </ModalShell>
  );
}
