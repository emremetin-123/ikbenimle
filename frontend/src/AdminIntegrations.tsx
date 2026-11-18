import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Cable,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { ModulePageHeader } from './components/ModulePageHeader';
import { IntegrationDocs } from './admin-integrations/IntegrationDocs';
import {
  actionLabel,
  connectionSummary,
  directionLabels,
  formatDate,
  jobLabels,
  keyExpired,
  resultLabels,
  scopeSummary,
} from './admin-integrations/presentation';
import { AsyncState } from './components/AsyncState';
import { StatusBadge, type StatusBadgeTone } from './components/StatusBadge';
import { PaginationControls } from './components/PaginationControls';
import { ApiKeyModal } from './admin-integrations/ApiKeyModal';
import { IntegrationFlows } from './admin-integrations/IntegrationFlows';
import type {
  ConnectionDraft,
  IntegrationApiKey,
  IntegrationAuditEvent,
  IntegrationConnection,
  IntegrationJob,
  IntegrationScope,
} from './admin-integrations/types';
import type { PaginatedResponse } from './types';
import { useAppFeedback } from './components/AppFeedback';

type Tab = 'flows' | 'activity' | 'setup';

const EMPTY_DRAFT: ConnectionDraft = {
  name: '',
  provider: 'generic_bridge',
  is_enabled: false,
  employee_sync_enabled: true,
  leave_balance_sync_enabled: true,
  leave_request_export_enabled: true,
  leave_export_trigger: 'approved',
};

const jobTone = (status: IntegrationJob['status']): StatusBadgeTone => ({
  completed: 'success',
  dead_letter: 'danger',
  retry: 'warning',
  leased: 'info',
  pending: 'neutral',
}[status] as StatusBadgeTone);

export const AdminIntegrations = () => {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const loadedConnection = useRef<number | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('flows');
  const [selectedId, setSelectedId] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<ConnectionDraft>(EMPTY_DRAFT);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<IntegrationApiKey | null>(null);
  const [jobPage, setJobPage] = useState(1);
  const [jobStatus, setJobStatus] = useState('');

  const connectionsQuery = useQuery({
    queryKey: queryKeys.adminIntegrations,
    queryFn: () => api.get<{ items: IntegrationConnection[] }>('/api/admin/integrations'),
  });
  const connections = useMemo(() => connectionsQuery.data?.items || [], [connectionsQuery.data]);
  const selected = connections.find(connection => connection.id === selectedId) || null;
  const health = connectionSummary(selected);

  useEffect(() => {
    if (selectedId === undefined && connections[0]) setSelectedId(connections[0].id);
  }, [connections, selectedId]);

  useEffect(() => {
    if (!selected || loadedConnection.current === selected.id) return;
    loadedConnection.current = selected.id;
    setDraft({
      name: selected.name,
      provider: selected.provider,
      is_enabled: selected.is_enabled,
      employee_sync_enabled: selected.employee_sync_enabled,
      leave_balance_sync_enabled: selected.leave_balance_sync_enabled,
      leave_request_export_enabled: selected.leave_request_export_enabled,
      leave_export_trigger: selected.leave_export_trigger,
    });
  }, [selected]);

  const keysQuery = useQuery({
    queryKey: [...queryKeys.adminIntegrationKeys, selectedId],
    queryFn: () => api.get<{ items: IntegrationApiKey[] }>(`/api/admin/integrations/${selectedId}/api-keys`),
    enabled: Boolean(selectedId),
  });

  const jobsQuery = useQuery({
    queryKey: [...queryKeys.adminIntegrationJobs, selectedId, jobPage, jobStatus],
    queryFn: () => api.get<PaginatedResponse<IntegrationJob>>(
      `/api/admin/integration-jobs?page=${jobPage}&pageSize=10${selectedId ? `&connection_id=${selectedId}` : ''}${jobStatus ? `&status=${jobStatus}` : ''}`,
    ),
    enabled: tab === 'activity' && Boolean(selectedId),
  });

  const auditQuery = useQuery({
    queryKey: [...queryKeys.adminIntegrationAudit, selectedId],
    queryFn: () => api.get<PaginatedResponse<IntegrationAuditEvent>>(
      `/api/admin/integration-audit?page=1&pageSize=10${selectedId ? `&connection_id=${selectedId}` : ''}`,
    ),
    enabled: tab === 'activity' && Boolean(selectedId),
  });

  const saveMutation = useMutation({
    mutationFn: () => selectedId
      ? api.put<IntegrationConnection>(`/api/admin/integrations/${selectedId}`, { ...draft })
      : api.post<IntegrationConnection>('/api/admin/integrations', { ...draft }),
    onSuccess: async connection => {
      const isNew = !selectedId;
      setSelectedId(connection.id);
      feedback.notifySuccess(isNew ? 'Bağlantı oluşturuldu. Şimdi güvenli erişim anahtarını hazırlayın.' : 'Bağlantı ayarları kaydedildi.');
      if (isNew) setTab('setup');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrations });
    },
    onError: error => feedback.notifyError(error instanceof Error ? error.message : 'Bağlantı kaydedilemedi.'),
  });

  const keyMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      scopes: IntegrationScope[];
      ip_allowlist: string[];
      expires_at: string | null;
    }) => api.post<IntegrationApiKey>(`/api/admin/integrations/${selectedId}/api-keys`, payload),
    onSuccess: async key => {
      setCreatedKey(key);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrationKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrations }),
      ]);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: number) => api.delete(`/api/admin/integrations/${selectedId}/api-keys/${keyId}`),
    onError: error => feedback.notifyError(error instanceof Error ? error.message : 'Erişim anahtarı iptal edilemedi.'),
    onSuccess: async () => {
      feedback.notifySuccess('Erişim anahtarı iptal edildi.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrationKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrations }),
      ]);
    },
  });

  const confirmKeyRevocation = async (key: IntegrationApiKey) => {
    if (await feedback.confirm({
      title: 'Erişim anahtarını iptal et',
      message: `${key.name} anahtarını kullanan uygulama hemen erişimini kaybedecek.`,
      confirmLabel: 'Anahtarı iptal et',
      danger: true,
    })) revokeMutation.mutate(key.id);
  };

  const openNewConnection = () => {
    loadedConnection.current = null;
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setTab('flows');
    setCreatedKey(null);
    setKeyModalOpen(false);
  };

  const selectConnection = (value: string) => {
    const nextId = value ? Number(value) : null;
    loadedConnection.current = null;
    setSelectedId(nextId);
    if (!nextId) setDraft(EMPTY_DRAFT);
    setJobPage(1);
    setCreatedKey(null);
    setKeyModalOpen(false);
  };

  const refreshConnection = () => {
    void connectionsQuery.refetch();
    if (selectedId) void keysQuery.refetch();
    if (tab === 'activity' && selectedId) {
      void jobsQuery.refetch();
      void auditQuery.refetch();
    }
  };

  const initialScopes = useMemo<IntegrationScope[]>(() => {
    const scopes: IntegrationScope[] = ['payrolls:write'];
    if (draft.employee_sync_enabled) scopes.push('employees:write');
    if (draft.leave_balance_sync_enabled) scopes.push('leave-balances:write');
    if (draft.leave_request_export_enabled) scopes.push('leave-requests:read', 'leave-requests:ack');
    return scopes;
  }, [draft.employee_sync_enabled, draft.leave_balance_sync_enabled, draft.leave_request_export_enabled]);

  if (connectionsQuery.isLoading) return <AsyncState kind="loading" title="Entegrasyonlar yükleniyor" />;
  if (connectionsQuery.isError) {
    return <AsyncState kind="error" title="Entegrasyonlar alınamadı" onRetry={() => connectionsQuery.refetch()} />;
  }

  const setupSteps = [
    { label: 'Bağlantıyı kaydet', complete: Boolean(selected) },
    { label: 'Erişim anahtarı oluştur', complete: Boolean(selected?.active_key_count) },
    { label: 'Karşı uygulamadan test et', complete: Boolean(selected?.last_seen_at) },
  ];

  return (
    <div className="integration-admin-page">
      <ModulePageHeader
        title="Entegrasyonlar"
        description="Portalınızı kullandığınız İK veya bordro uygulamasına bağlayın."
        icon={<Cable size={23} />}
        actions={(
          <button type="button" className="btn-secondary" onClick={openNewConnection}>
            <Plus size={17} aria-hidden="true" /> Yeni bağlantı
          </button>
        )}
      />

      <section className="premium-card integration-overview">
        <div className="integration-overview-toolbar">
          <label className="integration-connection-picker">
            <span>Yönetilen bağlantı</span>
            <select className="form-control" value={selectedId || ''} onChange={event => selectConnection(event.target.value)}>
              <option value="">Yeni bağlantı</option>
              {connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" disabled={connectionsQuery.isFetching} onClick={refreshConnection}>
            <RefreshCw size={17} aria-hidden="true" /> {connectionsQuery.isFetching ? 'Yenileniyor...' : 'Durumu yenile'}
          </button>
        </div>

        <div className="integration-overview-main">
          <div className={`integration-health is-${health.tone}`}>
            <span className="integration-health-icon" aria-hidden="true"><Cable size={23} /></span>
            <div>
              <span>{selected?.name || 'Yeni bağlantı'}</span>
              <strong>{health.label}</strong>
              <p>{health.description}</p>
            </div>
            <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
          </div>

          <dl className="integration-metrics">
            <div><dt>Son başarılı aktarım</dt><dd>{formatDate(selected?.last_success_at)}</dd></div>
            <div><dt>Bekleyen izin aktarımı</dt><dd>{selected?.pending_job_count || 0}</dd></div>
            <div>
              <dt>{selected?.last_error_at ? 'Son hata' : 'Son bağlantı'}</dt>
              <dd>{formatDate(selected?.last_error_at || selected?.last_seen_at)}</dd>
            </div>
          </dl>
        </div>

        <ol className="integration-progress" aria-label="Kurulum ilerlemesi">
          {setupSteps.map((step, index) => (
            <li key={step.label} className={step.complete ? 'is-complete' : ''}>
              <span aria-hidden="true">{step.complete ? <Check size={15} /> : <Circle size={15} />}</span>
              <div><small>Adım {index + 1}</small><strong>{step.label}</strong></div>
            </li>
          ))}
        </ol>
      </section>

      <nav className="integration-tabs" aria-label="Entegrasyon bölümleri">
        {([
          ['flows', <Settings2 size={18} aria-hidden="true" />, 'Veri Akışları'],
          ['activity', <Activity size={18} aria-hidden="true" />, 'Aktarım Geçmişi'],
          ['setup', <Wrench size={18} aria-hidden="true" />, 'Teknik Kurulum'],
        ] as const).map(([id, icon, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {icon}<span>{label}</span>
          </button>
        ))}
      </nav>

      {tab === 'flows' && (
        <IntegrationFlows
          draft={draft}
          isSaved={Boolean(selected)}
          pending={saveMutation.isPending}
          onChange={setDraft}
          onSubmit={() => saveMutation.mutate()}
        />
      )}

      {tab === 'activity' && (!selectedId ? (
        <AsyncState kind="empty" title="Önce bir bağlantı oluşturun" message="Aktarım hareketleri bağlantı kurulduktan sonra burada görünür." />
      ) : (
        <div className="integration-tracking-grid">
          <section className="premium-card integration-list-card">
            <div className="integration-section-heading">
              <div><h2>İzin talebi aktarımları</h2><p>Portalda oluşan taleplerin karşı uygulamaya ulaşıp ulaşmadığını izleyin.</p></div>
              <label className="integration-status-filter">Durum
                <select className="form-control" value={jobStatus} onChange={event => { setJobStatus(event.target.value); setJobPage(1); }}>
                  <option value="">Tümü</option>
                  {Object.entries(jobLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {jobsQuery.isLoading ? <AsyncState kind="loading" title="Aktarımlar yükleniyor" /> : jobsQuery.isError ? <AsyncState kind="error" title="Aktarımlar alınamadı" onRetry={() => jobsQuery.refetch()} /> : !jobsQuery.data?.items.length ? <AsyncState kind="empty" title="Henüz izin aktarımı yok" /> : (
              <>
                <div className="integration-job-list">
                  {jobsQuery.data.items.map(job => (
                    <article key={job.id}>
                      <div>
                        <strong>İzin talebi #{job.aggregate_id}</strong>
                        <small>{actionLabel(job.event_type)} · {formatDate(job.created_at)}</small>
                        {job.external_reference && <small>Karşı uygulama kayıt no: {job.external_reference}</small>}
                        {job.last_error_message && <small className="is-error">{job.last_error_message}</small>}
                      </div>
                      <div>
                        <StatusBadge tone={jobTone(job.status)}>{jobLabels[job.status]}</StatusBadge>
                        {job.attempts > 1 && <small>{job.attempts}/{job.max_attempts} deneme</small>}
                      </div>
                    </article>
                  ))}
                </div>
                <PaginationControls pagination={jobsQuery.data.pagination} onPageChange={setJobPage} />
              </>
            )}
          </section>

          <section className="premium-card integration-list-card">
            <div className="integration-section-heading"><div><h2>Son veri hareketleri</h2><p>Çalışan, izin bakiyesi, bordro ve bağlantı işlemleri.</p></div></div>
            {auditQuery.isLoading ? <AsyncState kind="loading" title="Hareketler yükleniyor" /> : auditQuery.isError ? <AsyncState kind="error" title="Hareketler alınamadı" onRetry={() => auditQuery.refetch()} /> : !auditQuery.data?.items.length ? <AsyncState kind="empty" title="Henüz veri hareketi yok" /> : (
              <div className="integration-audit-list">
                {auditQuery.data.items.map(event => (
                  <article key={event.id}>
                    <CheckCircle2 size={17} aria-hidden="true" />
                    <div><strong>{actionLabel(event.action)}</strong><small>{directionLabels[event.direction] || 'Diğer işlem'} · {formatDate(event.created_at)}</small></div>
                    <StatusBadge tone={event.status === 'failed' ? 'danger' : 'success'}>{resultLabels[event.status] || 'Sonuç yok'}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ))}

      {tab === 'setup' && (
        <div className="integration-setup-layout">
          <section className="premium-card integration-list-card">
            <div className="integration-section-heading">
              <div><span className="integration-eyebrow">2. Güvenli erişim</span><h2>Erişim anahtarları</h2><p>Bağlanacak uygulama bu anahtarla yalnız seçtiğiniz bilgileri aktarabilir.</p></div>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedId}
                onClick={() => { keyMutation.reset(); setCreatedKey(null); setKeyModalOpen(true); }}
              >
                <Plus size={17} aria-hidden="true" /> Anahtar oluştur
              </button>
            </div>
            {!selectedId ? <AsyncState kind="empty" title="Önce bağlantıyı kaydedin" message="Veri akışlarını kaydettikten sonra erişim anahtarı oluşturabilirsiniz." /> : keysQuery.isLoading ? <AsyncState kind="loading" title="Anahtarlar yükleniyor" /> : keysQuery.isError ? <AsyncState kind="error" title="Anahtarlar alınamadı" onRetry={() => keysQuery.refetch()} /> : !keysQuery.data?.items.length ? <AsyncState kind="empty" title="Henüz erişim anahtarı yok" message="Bağlanacak uygulamanın kullanması için bir anahtar oluşturun." /> : (
              <div className="integration-key-list">
                {keysQuery.data.items.map(key => (
                  <article key={key.id}>
                    <div><strong>{key.name}</strong><code>{key.key_prefix}••••••••</code><small>{scopeSummary(key.scopes)}</small></div>
                    <div>
                      <StatusBadge tone={key.revoked_at || keyExpired(key) ? 'danger' : 'success'}>{key.revoked_at ? 'İptal edildi' : keyExpired(key) ? 'Süresi doldu' : 'Geçerli'}</StatusBadge>
                      <small>Son kullanım: {formatDate(key.last_used_at)}</small>
                      {!key.revoked_at && (
                        <button type="button" className="btn-icon integration-revoke" aria-label={`${key.name} erişim anahtarını iptal et`} onClick={() => void confirmKeyRevocation(key)}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <IntegrationDocs />
        </div>
      )}

      {keyModalOpen && selectedId && (
        <ApiKeyModal
          createdKey={createdKey}
          error={keyMutation.error instanceof Error ? keyMutation.error.message : undefined}
          pending={keyMutation.isPending}
          initialScopes={initialScopes}
          onClose={() => {
            if (!keyMutation.isPending) {
              setKeyModalOpen(false);
              setCreatedKey(null);
            }
          }}
          onCreate={payload => keyMutation.mutate(payload)}
        />
      )}
    </div>
  );
};
