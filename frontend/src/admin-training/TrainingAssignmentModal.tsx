import React, { useDeferredValue, useId, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { API_BASE } from '../config';
import type { AdminUser, Video } from '../types';
import { ModalShell } from '../components/ModalShell';
import { isUserActive } from '../admin-users/userConfig';
import { useAppFeedback } from '../components/AppFeedback';
import { api } from '../services/api';
import { PaginationControls } from '../components/PaginationControls';

interface TrainingAssignmentModalProps {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function TrainingAssignmentModal({ onClose, onSaved }: TrainingAssignmentModalProps) {
  const feedback = useAppFeedback();
  const [userIds, setUserIds] = useState<number[]>([]);
  const [videoId, setVideoId] = useState('');
  const [selectedVideoOption, setSelectedVideoOption] = useState<{ id: number; title: string } | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const [videoSearch, setVideoSearch] = useState('');
  const [videoSearchOpen, setVideoSearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const videoSelectId = useId();
  const videoSearchId = useId();
  const userSearchId = useId();
  const deferredSearch = useDeferredValue(search.trim());
  const deferredVideoSearch = useDeferredValue(videoSearch.trim());

  const usersQuery = useQuery({
    queryKey: ['admin', 'training-assignment-users', { page, search: deferredSearch, department, position }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (deferredSearch) params.set('search', deferredSearch);
      if (department) params.set('department', department);
      if (position) params.set('position', position);
      return api.list<AdminUser>(`/api/admin/assignment-user-options?${params.toString()}`);
    },
    placeholderData: previous => previous,
  });
  const filtersQuery = useQuery({
    queryKey: ['admin', 'training-assignment-filters'],
    queryFn: () => api.get<{ departments: string[]; positions: string[] }>('/api/admin/assignment-user-filters'),
    staleTime: 5 * 60_000,
  });
  const videosQuery = useQuery({
    queryKey: ['admin', 'training-video-options', deferredVideoSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (deferredVideoSearch) params.set('search', deferredVideoSearch);
      return api.list<Video>(`/api/admin/all-videos/options?${params.toString()}`);
    },
    staleTime: 5 * 60_000,
  });

  const users = usersQuery.data?.items || [];
  const videos = videosQuery.data?.items || [];

  const filteredUsers = users.filter(isUserActive);
  const departments = filtersQuery.data?.departments || [];
  const positions = filtersQuery.data?.positions || [];

  const toggleVideoSearch = () => {
    setVideoSearchOpen((current) => {
      if (current) setVideoSearch('');
      return !current;
    });
  };

  const toggleUserSearch = () => {
    setUserSearchOpen((current) => {
      if (current) {
        setSearch('');
        setPage(1);
      }
      return !current;
    });
  };

  const assignMutation = useMutation<{ created: number; skipped: number }>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/admin/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, video_id: videoId, due_date: dueDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Atama yapılamadı');
      return data;
    },
    onSuccess: async (result) => {
      await onSaved();
      if (result.skipped > 0 && result.created === 0) {
        feedback.notifyInfo(`${result.skipped} çalışan için mevcut aktif atama bulunduğundan yeni atama yapılmadı. Gerekirse eski atamayı Atama Kayıtları'ndan iptal edip yeniden atayın.`);
      } else if (result.skipped > 0) {
        feedback.notifyInfo(`${result.created} atama oluşturuldu; ${result.skipped} çalışan mevcut aktif ataması nedeniyle atlandı.`);
      } else {
        feedback.notifySuccess(`${result.created} eğitim ataması oluşturuldu.`);
      }
      onClose();
    },
    onError: (error: Error) => feedback.notifyError(`Atama hatası: ${error.message}`),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!userIds.length) return feedback.notifyInfo('En az bir çalışan seçin.');
    if (!videoId) return feedback.notifyInfo('Bir eğitim seçin.');
    assignMutation.mutate();
  };

  return (
    <ModalShell className="admin-action-modal training-assignment-modal" ariaLabel="Eğitim atama" onClose={onClose}>
        <div className="admin-modal-header">
          <div>
            <h3 className="training-modal-title">Eğitim Atama</h3>
            <p className="training-assignment-modal-description">Eğitimi, tamamlanma tarihini ve atanacak çalışanları seçin.</p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat" aria-label="Kapat"><X size={18} /></button>
        </div>
        <form className="training-assignment-form" onSubmit={handleSubmit}>
          <div className="responsive-grid-2 training-assignment-filters training-assignment-primary-fields">
            <div className="input-group training-assignment-searchable-field">
              <label className="input-label" htmlFor={videoSelectId}>Eğitim</label>
              <div className="training-assignment-control-row">
                <select id={videoSelectId} className="form-control" value={videoId} onChange={(event) => {
                  const nextId = event.target.value;
                  const nextVideo = videos.find((video) => String(video.id) === nextId);
                  setVideoId(nextId);
                  setSelectedVideoOption(nextVideo ? { id: nextVideo.id, title: nextVideo.title } : null);
                  setVideoSearch('');
                  setVideoSearchOpen(false);
                }} required>
                  <option value="">{videosQuery.isFetching ? 'Eğitimler yükleniyor...' : deferredVideoSearch && !videos.length ? 'Eşleşen eğitim bulunamadı' : 'Eğitim seçin'}</option>
                  {selectedVideoOption && !videos.some((video) => video.id === selectedVideoOption.id) && (
                    <option value={selectedVideoOption.id}>{selectedVideoOption.title}</option>
                  )}
                  {videos.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
                </select>
                <button
                  type="button"
                  className={`training-assignment-search-toggle${videoSearchOpen ? ' is-active' : ''}`}
                  aria-label={videoSearchOpen ? 'Eğitim aramasını kapat' : 'Eğitim ara'}
                  aria-expanded={videoSearchOpen}
                  aria-controls={videoSearchId}
                  title={videoSearchOpen ? 'Aramayı kapat' : 'Eğitim ara'}
                  onClick={toggleVideoSearch}
                >
                  {videoSearchOpen ? <X size={18} /> : <Search size={19} />}
                </button>
              </div>
              {videoSearchOpen && (
                <input
                  id={videoSearchId}
                  className="form-control training-assignment-search-input"
                  value={videoSearch}
                  onChange={(event) => setVideoSearch(event.target.value)}
                  placeholder="Eğitim adı veya kategori"
                  aria-label="Eğitim arama metni"
                  type="search"
                  autoComplete="off"
                  autoFocus
                />
              )}
              {videosQuery.isError && <small className="training-assignment-field-status is-error" role="alert">Eğitim listesi yüklenemedi.</small>}
            </div>
            <div className="input-group"><label className="input-label">Son Tamamlama Tarihi</label><input className="form-control" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          </div>
          <section className="training-assignment-employee-section" aria-labelledby="training-assignment-employees-title">
          <div className="training-assignment-employee-heading">
            <div>
              <h4 id="training-assignment-employees-title">Çalışanlar</h4>
              <span>Atanacak çalışanları filtreleyip seçin</span>
            </div>
            <button
              type="button"
              className={`training-assignment-search-toggle${userSearchOpen ? ' is-active' : ''}`}
              aria-label={userSearchOpen ? 'Çalışan aramasını kapat' : 'Çalışan ara'}
              aria-expanded={userSearchOpen}
              aria-controls={userSearchId}
              title={userSearchOpen ? 'Aramayı kapat' : 'Çalışan ara'}
              onClick={toggleUserSearch}
            >
              {userSearchOpen ? <X size={18} /> : <Search size={19} />}
            </button>
          </div>
          {userSearchOpen && (
            <div className="training-assignment-employee-search">
              <label className="sr-only" htmlFor={userSearchId}>Çalışan arama metni</label>
              <input
                id={userSearchId}
                className="form-control"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Ad, sicil, bölüm veya pozisyon"
                type="search"
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
          <div className="responsive-grid-2 training-assignment-filters training-assignment-employee-filters">
            <div className="input-group"><label className="input-label">Bölüm</label><select className="form-control" value={department} onChange={(event) => { setDepartment(event.target.value); setPosition(''); setPage(1); }}><option value="">Tüm bölümler</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="input-group"><label className="input-label">Pozisyon</label><select className="form-control" value={position} onChange={(event) => { setPosition(event.target.value); setPage(1); }}><option value="">Tüm pozisyonlar</option>{positions.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
          </div>
          <div className="training-assignment-summary" aria-live="polite">
            <span>{usersQuery.isFetching ? 'Çalışanlar yükleniyor...' : `${filteredUsers.length} çalışan gösteriliyor`}</span>
            <strong>{userIds.length} çalışan seçildi</strong>
          </div>
          <div className="training-assignment-user-list" aria-busy={usersQuery.isFetching}>
            {usersQuery.isError && <div className="training-assignment-empty is-error" role="alert">Çalışan listesi yüklenemedi. Filtreleri değiştirerek tekrar deneyin.</div>}
            {!usersQuery.isError && filteredUsers.map((user) => (
              <label key={user.id} className="training-assignment-user">
                <input type="checkbox" checked={userIds.includes(user.id)} onChange={(event) => setUserIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />
                <span><strong>{user.name}</strong><small>#{user.employee_id} · {user.department || '-'} · {user.position || '-'}</small></span>
              </label>
            ))}
            {!usersQuery.isFetching && !usersQuery.isError && !filteredUsers.length && (
              <div className="training-assignment-empty">Filtrelerle eşleşen çalışan bulunamadı.</div>
            )}
          </div>
          <PaginationControls pagination={usersQuery.data?.pagination} onPageChange={setPage} />
          </section>
          <div className="admin-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>İptal</button>
            <button type="submit" className="btn-primary" disabled={assignMutation.isPending}>{assignMutation.isPending ? 'Atanıyor...' : `${userIds.length} Çalışana Ata`}</button>
          </div>
        </form>
    </ModalShell>
  );
}
