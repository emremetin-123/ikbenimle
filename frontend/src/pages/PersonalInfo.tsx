import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, UserCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ProfileAvatarImage } from '../components/ProfileAvatarImage';
import type { EmployeeTrainingSummary, Profile, Video } from '../types';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { profileUpdatePayload } from './personal-info/personalInfoSupport';
import { BadgeCollection } from './personal-info/BadgeCollection';
import { TrainingCertificateModal } from '../components/TrainingCertificateModal';
import { ProfileDetailsForm } from './personal-info/ProfileDetailsForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { AsyncState } from '../components/AsyncState';
import { ModulePageHeader } from '../components/ModulePageHeader';
import { ProfileSummary } from './personal-info/ProfileSummary';

export const PersonalInfo = () => {
  const { user, touchSession } = useAuth();
  const queryClient = useQueryClient();
  const [badgePage, setBadgePage] = useState(1);
  const [message, setMessage] = useState('');
  const [certificate, setCertificate] = useState<Video | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: queryKeys.employeeProfile,
    queryFn: () => api.get<Profile>('/api/user/profile'),
  });
  const summaryQuery = useQuery({
    queryKey: queryKeys.employeeTrainingSummary,
    queryFn: () => api.get<EmployeeTrainingSummary>('/api/videos/summary'),
  });
  const badgesQuery = useQuery({
    queryKey: [...queryKeys.employeeTrainings, 'badges', badgePage],
    queryFn: () => api.list<Video>(
      `/api/videos?status=completed&badge=awarded&page=${badgePage}&pageSize=12&sort=completed_at&order=desc`,
    ),
    placeholderData: (previous) => previous,
  });
  const profile = profileQuery.data ?? null;

  const updateMutation = useMutation({
    mutationFn: (body: ReturnType<typeof profileUpdatePayload>) =>
      api.put<{ profile: Profile }>('/api/user/profile', body),
    onSuccess: ({ profile: saved }) => {
      queryClient.setQueryData(queryKeys.employeeProfile, saved);
      setMessage('Profiliniz başarıyla güncellendi.');
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Profil güncellenemedi.'),
  });
  const photoMutation = useMutation({
    mutationFn: (body: FormData) =>
      api.upload<{ photo_path: string }>('/api/personal-info/photo', body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employeeProfile }),
        touchSession(),
      ]);
      setMessage('Profil fotoğrafı güncellendi.');
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Fotoğraf yüklenemedi.'),
  });

  const saveProfile = async (nextProfile: Profile) => {
    setMessage('');
    try {
      await updateMutation.mutateAsync(profileUpdatePayload(nextProfile));
      return true;
    } catch {
      return false;
    }
  };
  const uploadPhoto = (file?: File) => {
    if (!file) return;
    setMessage('');
    const body = new FormData();
    body.append('photo', file);
    photoMutation.mutate(body);
  };

  return (
    <div className="profile-page">
      <ModulePageHeader title="Profilim" description="Kişisel bilgilerin ve başarıların tek bir yerde." icon={<UserCircle size={24} />} tone="violet" />
      <div className="profile-canvas">
        <section className="profile-hero" aria-labelledby="profile-name">
          <div className="profile-avatar-shell">
            <ProfileAvatarImage
              photoPath={profile?.photo_path ?? user?.photo_url}
              seed={user?.employee_id}
              alt="Profil"
              className="profile-avatar-image"
              thumbnailSize={320}
            />
            <button type="button" onClick={() => photoInput.current?.click()} disabled={photoMutation.isPending || !profile} className="btn-icon profile-avatar-edit" aria-label="Profil fotoğrafını değiştir" aria-busy={photoMutation.isPending}>
              <span className="profile-avatar-edit-mark"><Camera aria-hidden="true" /></span>
            </button>
            <input
              ref={photoInput}
              aria-label="Profil fotoğrafı"
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => { uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }}
            />
          </div>
          <div className="profile-identity">
            <h2 id="profile-name" className="profile-hero-title">{user?.name}</h2>
            <p className="profile-hero-subtitle">
              {user?.department || 'Bölüm Yok'} {user?.position ? `· ${user.position}` : ''}
            </p>
          </div>
          <span className="profile-employee-id">Sicil: {user?.employee_id || '—'}</span>
        </section>

        {message && (
          <div className="profile-message" role="status">
            {message}
          </div>
        )}
        <ProfileSummary summary={summaryQuery.data} loading={summaryQuery.isPending} error={summaryQuery.isError} employeeId={user?.employee_id} onRetry={() => void summaryQuery.refetch()} />
        <BadgeCollection data={badgesQuery.data} loading={badgesQuery.isPending} error={badgesQuery.isError} onRetry={() => void badgesQuery.refetch()} onPageChange={setBadgePage} onSelect={setCertificate} />
        {profileQuery.isPending && <LoadingIndicator label="Profil bilgileri yükleniyor" />}
        {profileQuery.isError && <AsyncState kind="error" title="Profil bilgileri alınamadı" message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />}
        {profile && (
          <ProfileDetailsForm
            profile={profile}
            saving={updateMutation.isPending}
            onSave={saveProfile}
          />
        )}
      </div>
      {certificate && (
        <TrainingCertificateModal key={certificate.assignment_id || certificate.id} certificate={certificate} onClose={() => setCertificate(null)} />
      )}
    </div>
  );
};
