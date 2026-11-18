import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Send, Settings } from 'lucide-react';
import {
  EventTemplateModal, RoutineModal, SettingsModal,
} from './admin-notifications/NotificationModals';
import {
  EventTemplatesSection, RoutinesSection,
} from './admin-notifications/NotificationSections';
import type {
  EventTemplate, NotificationRoutine, NotificationSettings, NotificationStats,
  RoutineDraft, SendResult,
} from './admin-notifications/types';
import { queryKeys } from './queryClient';
import { api } from './services/api';
import { useAppFeedback } from './components/AppFeedback';
import { NotificationSubscribersModal } from './admin-notifications/NotificationSubscribersModal';

const emptyRoutine = (): RoutineDraft => ({
  title: 'Bugün kendini nasıl hissediyorsun?',
  body: 'Günlük duygu durumunu paylaşmak ister misin?',
  url: '/employee/anasayfa',
  target: 'all',
  department: '',
  schedule_type: 'daily',
  scheduled_date: '',
  scheduled_time: '09:00',
  is_active: true,
});
const resultMessage = (prefix: string, result: SendResult) => (
  result.skipped
    ? `${prefix} gönderilemedi: ${result.reason || 'gönderim atlandı'}`
    : `${prefix} ${result.sent} cihaza gönderildi${result.failed ? `, ${result.failed} başarısız` : ''}.`
);
const errorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export const AdminNotifications = () => {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [routinePage, setRoutinePage] = useState(1);
  const [routineSearch, setRoutineSearch] = useState('');
  const [routineStatus, setRoutineStatus] = useState<'all' | 'active' | 'passive'>('all');
  const [templatePage, setTemplatePage] = useState(1);
  const [templateSearch, setTemplateSearch] = useState('');
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(emptyRoutine());
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [subscriberStatus, setSubscriberStatus] = useState<'all' | 'active' | null>(null);
  const [eventDraft, setEventDraft] = useState<EventTemplate | null>(null);
  const [routineMessage, setRoutineMessage] = useState('');
  const [eventMessage, setEventMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsDraft, setSettingsDraft] = useState({
    vapid_public_key: '',
    vapid_subject: 'mailto:ik@example.com',
  });

  const statsQuery = useQuery({
    refetchInterval: 60_000,
    queryKey: queryKeys.adminNotificationStats,
    queryFn: () => api.get<NotificationStats>('/api/notifications/admin/stats'),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.adminNotificationSettings,
    queryFn: () => api.get<NotificationSettings>('/api/notifications/admin/settings'),
  });
  const routinesQuery = useQuery({
    queryKey: [
      ...queryKeys.adminNotificationRoutines,
      routinePage,
      routineSearch,
      routineStatus,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(routinePage),
        pageSize: '10',
        status: routineStatus,
        sort: 'scheduled_time',
        order: 'asc',
      });
      if (routineSearch.trim()) params.set('search', routineSearch.trim());
      return api.list<NotificationRoutine>(
        `/api/notifications/admin/routines?${params.toString()}`,
      );
    },
  });
  const templatesQuery = useQuery({
    refetchInterval: 60_000,
    queryKey: [...queryKeys.adminNotificationTemplates, templatePage, templateSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(templatePage),
        pageSize: '10',
        status: 'all',
      });
      if (templateSearch.trim()) params.set('search', templateSearch.trim());
      return api.list<EventTemplate>(
        `/api/notifications/admin/event-templates?${params.toString()}`,
      );
    },
  });

  const stats = statsQuery.data || { total: 0, active: 0, departments: [] };
  const statsSummary = useMemo(() => [
    { label: 'Aktif cihaz', value: stats.active, icon: <Bell size={18} /> },
    { label: 'Toplam abonelik', value: stats.total, icon: <Send size={18} /> },
  ], [stats.active, stats.total]);
  const invalidateRoutines = () => queryClient.invalidateQueries({
    queryKey: queryKeys.adminNotificationRoutines,
  });
  const invalidateTemplates = () => queryClient.invalidateQueries({
    queryKey: queryKeys.adminNotificationTemplates,
  });
  const invalidateStats = () => queryClient.invalidateQueries({
    queryKey: queryKeys.adminNotificationStats,
  });

  const saveRoutineMutation = useMutation({
    mutationFn: (draft: RoutineDraft) => {
      const payload = {
        title: draft.title,
        body: draft.body,
        url: draft.url,
        target: draft.target,
        department: draft.target === 'department' ? draft.department : null,
        schedule_type: draft.schedule_type,
        scheduled_date: draft.schedule_type === 'once' ? draft.scheduled_date : null,
        scheduled_time: draft.scheduled_time,
        is_active: draft.is_active,
      };
      return draft.id
        ? api.put(`/api/notifications/admin/routines/${draft.id}`, payload)
        : api.post('/api/notifications/admin/routines', payload);
    },
    onSuccess: async () => {
      setRoutineMessage(routineDraft.id ? 'Rutin güncellendi.' : 'Rutin oluşturuldu.');
      setRoutineModalOpen(false);
      setRoutineDraft(emptyRoutine());
      await invalidateRoutines();
    },
    onError: error => setRoutineMessage(errorMessage(error, 'Rutin kaydedilemedi.')),
  });
  const deleteRoutineMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/notifications/admin/routines/${id}`),
    onSuccess: async () => {
      setRoutineMessage('Rutin silindi.');
      await invalidateRoutines();
    },
    onError: error => setRoutineMessage(errorMessage(error, 'Rutin silinemedi.')),
  });
  const sendRoutineMutation = useMutation({
    mutationFn: (id: number) => api.post<SendResult>(
      `/api/notifications/admin/routines/${id}/send-now`,
      {},
    ),
    onSuccess: async result => {
      setRoutineMessage(resultMessage('Rutin', result));
      await invalidateStats();
    },
    onError: error => setRoutineMessage(errorMessage(error, 'Rutin gönderilemedi.')),
  });
  const saveTemplateMutation = useMutation({
    mutationFn: (draft: EventTemplate) => api.put(
      `/api/notifications/admin/event-templates/${draft.key}`,
      {
        enabled: draft.enabled,
        time: draft.scheduled_time || '',
        title: draft.title,
        body: draft.body,
        url: draft.url,
      },
    ),
    onSuccess: async () => {
      setEventMessage('Olay bildirimi güncellendi.');
      setEventDraft(null);
      await invalidateTemplates();
    },
    onError: error => setEventMessage(
      errorMessage(error, 'Olay bildirimi kaydedilemedi.'),
    ),
  });
  const sendBirthdayMutation = useMutation({
    mutationFn: () => api.post<SendResult>(
      '/api/notifications/admin/send-birthday-now',
      {},
    ),
    onSuccess: async result => {
      setEventMessage(resultMessage('Doğum günü bildirimi', result));
      await invalidateStats();
    },
    onError: error => setEventMessage(
      errorMessage(error, 'Doğum günü bildirimi gönderilemedi.'),
    ),
  });
  const saveSettingsMutation = useMutation({
    mutationFn: () => api.put('/api/notifications/admin/settings', settingsDraft),
    onSuccess: async () => {
      setSettingsMessage('Teknik ayarlar kaydedildi.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminNotificationSettings,
      });
    },
    onError: error => setSettingsMessage(
      errorMessage(error, 'Teknik ayarlar kaydedilemedi.'),
    ),
  });

  const openNewRoutine = () => {
    setRoutineDraft({
      ...emptyRoutine(),
      department: stats.departments[0]?.department || '',
    });
    setRoutineMessage('');
    setRoutineModalOpen(true);
  };
  const openEditRoutine = (routine: NotificationRoutine) => {
    setRoutineDraft({
      ...routine,
      department: routine.department || '',
      scheduled_date: routine.scheduled_date
        ? String(routine.scheduled_date).slice(0, 10)
        : '',
    });
    setRoutineMessage('');
    setRoutineModalOpen(true);
  };
  const openSettings = () => {
    setSettingsDraft({
      vapid_public_key: settingsQuery.data?.vapid_public_key || '',
      vapid_subject: settingsQuery.data?.vapid_subject || 'mailto:ik@example.com',
    });
    setSettingsMessage('');
    setSettingsModalOpen(true);
  };

  return (
    <div className="notify-admin">
      <header className="notify-page-head">
        <div>
          <h3>Bildirimler</h3>
          <p>Otomatik olay bildirimlerini ve planlı rutinleri yönetin.</p>
        </div>
        <div className="notify-head-actions">
          <button type="button" className="notify-ghost-btn" onClick={openSettings}>
            <Settings size={17} /><span>Teknik Ayarlar</span>
          </button>
          <button type="button" className="notify-primary-btn" onClick={openNewRoutine}>
            <Plus size={18} /><span>Yeni Rutin</span>
          </button>
        </div>
      </header>
      <div className="notify-stats-grid">
        {statsSummary.map(item => (
          <button type="button" key={item.label} className="notify-stat-card notify-stat-button" aria-label={item.label + ' listesini gör'} onClick={() => setSubscriberStatus(item.label === 'Aktif cihaz' ? 'active' : 'all')}>
            <span>{item.icon}</span>
            <div><small>{item.label}</small><strong>{item.value}</strong></div>
            <small>Listeyi gör →</small>
          </button>
        ))}
      </div>
      {subscriberStatus && <NotificationSubscribersModal initialStatus={subscriberStatus} onClose={() => setSubscriberStatus(null)} />}
      <EventTemplatesSection
        templates={templatesQuery.data?.items || []}
        pagination={templatesQuery.data?.pagination}
        search={templateSearch}
        message={eventMessage}
        error={templatesQuery.isError
          ? errorMessage(templatesQuery.error, 'Olay bildirimleri alınamadı.')
          : ''}
        birthdaySending={sendBirthdayMutation.isPending}
        onSearch={value => {
          setTemplateSearch(value);
          setTemplatePage(1);
        }}
        onPage={setTemplatePage}
        onEdit={setEventDraft}
        onSendBirthday={() => sendBirthdayMutation.mutate()}
      />
      <RoutinesSection
        routines={routinesQuery.data?.items || []}
        pagination={routinesQuery.data?.pagination}
        search={routineSearch}
        status={routineStatus}
        message={routineMessage}
        error={routinesQuery.isError
          ? errorMessage(routinesQuery.error, 'Rutinler alınamadı.')
          : ''}
        loading={routinesQuery.isLoading}
        sending={sendRoutineMutation.isPending}
        deleting={deleteRoutineMutation.isPending}
        onSearch={value => {
          setRoutineSearch(value);
          setRoutinePage(1);
        }}
        onStatus={value => {
          setRoutineStatus(value);
          setRoutinePage(1);
        }}
        onPage={setRoutinePage}
        onEdit={openEditRoutine}
        onSend={id => sendRoutineMutation.mutate(id)}
        onDelete={async id => {
          if (await feedback.confirm({
            title: 'Bildirim rutinini sil',
            message: 'Bu rutin kalıcı olarak silinecek ve artık çalışmayacak.',
            confirmLabel: 'Rutini Sil',
            danger: true,
          })) deleteRoutineMutation.mutate(id);
        }}
      />
      {routineModalOpen && (
        <RoutineModal
          draft={routineDraft}
          setDraft={setRoutineDraft}
          stats={stats}
          saving={saveRoutineMutation.isPending}
          onClose={() => setRoutineModalOpen(false)}
          onSave={() => saveRoutineMutation.mutate(routineDraft)}
        />
      )}
      {eventDraft && (
        <EventTemplateModal
          draft={eventDraft}
          setDraft={setEventDraft}
          saving={saveTemplateMutation.isPending}
          onClose={() => setEventDraft(null)}
          onSave={() => saveTemplateMutation.mutate(eventDraft)}
        />
      )}
      {settingsModalOpen && (
        <SettingsModal
          publicKey={settingsDraft.vapid_public_key}
          subject={settingsDraft.vapid_subject}
          privateKeyConfigured={Boolean(
            settingsQuery.data?.vapid_private_key_configured,
          )}
          message={settingsMessage}
          saving={saveSettingsMutation.isPending}
          onPublicKeyChange={value => setSettingsDraft(current => ({
            ...current,
            vapid_public_key: value,
          }))}
          onSubjectChange={value => setSettingsDraft(current => ({
            ...current,
            vapid_subject: value,
          }))}
          onClose={() => setSettingsModalOpen(false)}
          onSave={() => saveSettingsMutation.mutate()}
        />
      )}
    </div>
  );
};
