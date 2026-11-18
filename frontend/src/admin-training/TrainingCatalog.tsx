import { Edit, Trash2 } from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import type { PaginationMeta } from '../types';
import type { Video } from '../types';
import { LoadingIndicator } from '../components/LoadingIndicator';

interface TrainingCatalogProps {
  videos: Video[];
  pagination?: PaginationMeta;
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (video: Video) => void;
  onDelete: (video: Video) => void;
}

export function TrainingCatalog({
  videos,
  pagination,
  search,
  loading,
  onSearch,
  onPageChange,
  onEdit,
  onDelete,
}: TrainingCatalogProps) {
  return (
    <div id="training-catalog" className="premium-card training-catalog-card">
      <div className="training-catalog-header">
        <div>
          <h3 className="training-catalog-title">Eğitim Listesi</h3>
          <p className="training-catalog-description">{pagination?.total ?? videos.length} eğitim kaydı</p>
        </div>
        <div className="training-catalog-actions">
          <input
            className="form-control training-catalog-search"
            aria-label="Eğitim ara"
            placeholder="Eğitim ara..."
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <LoadingIndicator compact label="Eğitimler yükleniyor" />
      ) : (
        <>
          <div className="table-container desktop-only">
            <table className="training-catalog-table">
              <thead><tr><th>Eğitim</th><th>Kategori</th><th>Profil</th><th className="training-catalog-action-column">İşlem</th></tr></thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.id}>
                    <td><strong>{video.title}</strong><small className="training-catalog-trainer">{video.trainer_name || 'Eğitmen belirtilmemiş'}</small></td>
                    <td>{video.category || '-'}</td>
                    <td>{video.training_profile || 'standard'}</td>
                    <td className="training-catalog-action-column">
                      <button type="button" onClick={() => onEdit(video)} className="btn-icon" title="Düzenle" aria-label={`${video.title} eğitimini düzenle`}><Edit size={18} /></button>
                      <button type="button" onClick={() => onDelete(video)} className="btn-icon danger" title="Sil veya arşivle" aria-label={`${video.title} eğitimini sil`}><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
                {!videos.length && <tr><td colSpan={4} className="training-catalog-empty">Henüz eğitim eklenmedi.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mobile-only training-catalog-mobile-list">
            {videos.map((video) => (
              <article key={video.id} className="training-catalog-mobile-card">
                <div className="training-catalog-mobile-copy">
                  <strong>{video.title}</strong>
                  <span>{video.trainer_name || 'Eğitmen belirtilmemiş'}</span>
                </div>
                <div className="training-catalog-mobile-meta">
                  <span>{video.category || 'Kategorisiz'}</span>
                  <span>{video.training_profile || 'standard'}</span>
                </div>
                <div className="training-catalog-mobile-actions">
                  <button type="button" onClick={() => onEdit(video)} className="btn-icon" title="Düzenle" aria-label={`${video.title} eğitimini düzenle`}><Edit size={18} /></button>
                  <button type="button" onClick={() => onDelete(video)} className="btn-icon danger" title="Sil veya arşivle" aria-label={`${video.title} eğitimini sil`}><Trash2 size={18} /></button>
                </div>
              </article>
            ))}
            {!videos.length && <div className="training-catalog-empty">Henüz eğitim eklenmedi.</div>}
          </div>
        </>
      )}
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
}
