import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '../types';
import { IconButton } from './IconButton';

export function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination?: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <nav className="pagination-controls" aria-label="Sayfalama">
      <span>
        {pagination.total} kayıt · Sayfa {pagination.page}/{pagination.totalPages}
      </span>
      <div>
        <IconButton
          label="Önceki sayfa"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Sonraki sayfa"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </IconButton>
      </div>
    </nav>
  );
}
