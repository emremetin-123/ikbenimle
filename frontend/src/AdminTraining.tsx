import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, UserPlus } from 'lucide-react';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import type { Video } from './types';
import { ModulePageHeader } from './components/ModulePageHeader';
import { TrainingAssignmentModal } from './admin-training/TrainingAssignmentModal';
import { TrainingCatalog } from './admin-training/TrainingCatalog';
import { TrainingCreateModal } from './admin-training/TrainingCreateModal';
import { TrainingEditorModal } from './admin-training/TrainingEditorModal';
import { TrainingReport } from './admin-training/TrainingReport';
import { useAppFeedback } from './components/AppFeedback';

export function AdminTraining() {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [panel, setPanel] = useState<'create' | 'assign' | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const deferredCatalogSearch = useDeferredValue(catalogSearch.trim());

  const videosQuery = useQuery({
    queryKey: [...queryKeys.adminVideos, { page: catalogPage, search: deferredCatalogSearch }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(catalogPage),
        pageSize: '20',
        sort: 'id',
        order: 'desc',
      });
      if (deferredCatalogSearch) params.set('search', deferredCatalogSearch);
      return api.list<Video>(`/api/admin/all-videos?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });

  const refreshTraining = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminVideos }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserOptions }),
    ]);
  };

  const deleteMutation = useMutation({
    mutationFn: (videoId: number) => api.delete<{ archived?: boolean }>(`/api/admin/video/${videoId}`),
    onSuccess: async (data) => {
      await refreshTraining();
      feedback.notifySuccess(data.archived ? 'Eğitim geçmiş kayıtlar korunarak arşivlendi.' : 'Eğitim silindi.');
    },
    onError: (error: Error) => feedback.notifyError(`Eğitim silinemedi: ${error.message}`),
  });

  const deleteVideo = async (video: Video) => {
    if (await feedback.confirm({
      title: 'Eğitimi kaldır',
      message: `"${video.title}" eğitimi silinecek veya geçmiş kaydı varsa arşivlenecek.`,
      confirmLabel: 'Eğitimi Kaldır',
      danger: true,
    })) {
      deleteMutation.mutate(video.id);
    }
  };

  const hasLoadError = videosQuery.isError;

  return (
    <section className="training-admin-page">
      <ModulePageHeader
        icon={<BookOpen size={22} />}
        title="Eğitim İşlemleri"
        description="Eğitim içeriklerini, atamaları ve tamamlanma durumlarını yönetin."
        tone="violet"
        actions={(
          <>
            <button type="button" className="btn-primary training-page-action training-assign-button" onClick={() => setPanel('assign')}>
              <UserPlus size={18} /> Eğitim Ata
            </button>
            <button type="button" className="btn-secondary training-page-action" onClick={() => setPanel('create')}>
              <Plus size={18} /> Yeni Eğitim Ekle
            </button>
          </>
        )}
      />
      {hasLoadError && (
        <div className="premium-card training-load-error">
          Eğitim verilerinin bir bölümü yüklenemedi.
          <button type="button" className="btn-secondary training-load-retry" onClick={refreshTraining}>Tekrar Dene</button>
        </div>
      )}
      <TrainingReport
        trainingCount={videosQuery.data?.pagination.total || 0}
        onChanged={refreshTraining}
      />
      <TrainingCatalog
        videos={videosQuery.data?.items || []}
        pagination={videosQuery.data?.pagination}
        search={catalogSearch}
        loading={videosQuery.isLoading}
        onSearch={(value) => {
          setCatalogSearch(value);
          setCatalogPage(1);
        }}
        onPageChange={setCatalogPage}
        onEdit={setEditingVideo}
        onDelete={deleteVideo}
      />
      {panel === 'create' && <TrainingCreateModal onClose={() => setPanel(null)} onSaved={refreshTraining} />}
      {panel === 'assign' && (
        <TrainingAssignmentModal
          onClose={() => setPanel(null)}
          onSaved={refreshTraining}
        />
      )}
      {editingVideo && (
        <TrainingEditorModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSaved={refreshTraining}
        />
      )}
    </section>
  );
}
