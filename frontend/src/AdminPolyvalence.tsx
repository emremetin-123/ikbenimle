import { ModulePageHeader } from './components/ModulePageHeader';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers3, Settings2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { queryKeys } from './queryClient';
import { useSearchParams } from './router';
import { api } from './services/api';
import type { OpenPeriodGap, ReportPeriodGroup, SetupResponse } from './admin-polyvalence/types';
import { EMPTY_SETUP } from './admin-polyvalence/types';
import type { PolyvalencePeriod } from './types';
import { LoadingIndicator } from './components/LoadingIndicator';

const ReportsPanel = lazy(() => import('./admin-polyvalence/PolyvalenceReportsPanel').then(module => ({ default: module.PolyvalenceReportsPanel })));
const SettingsModal = lazy(() => import('./admin-polyvalence/PolyvalenceSettingsModal').then(module => ({ default: module.PolyvalenceSettingsModal })));

export function AdminPolyvalence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.permissions?.includes('manage_polyvalence') === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(() => canManage && searchParams.get('view') === 'management');
  const [error, setError] = useState('');
  const periodsQuery = useQuery({
    queryKey: queryKeys.polyvalencePeriods,
    queryFn: () => api.get<PolyvalencePeriod[]>('/api/polyvalence/admin/periods'),
  });
  const reportGroupsQuery = useQuery({
    queryKey: queryKeys.polyvalenceReportGroups,
    queryFn: () => api.get<ReportPeriodGroup[]>('/api/polyvalence/admin/report-period-groups'),
  });
  const setupQuery = useQuery({
    queryKey: queryKeys.polyvalenceSetup,
    queryFn: async () => {
      await api.list<SetupResponse['memberships'][number]>('/api/polyvalence/admin/setup?resource=memberships&page=1&pageSize=1');
      return api.get<SetupResponse>('/api/polyvalence/admin/setup?includeLarge=false');
    },
    enabled: canManage && settingsOpen,
  });
  const openGapsQuery = useQuery({
    queryKey: queryKeys.polyvalenceOpenGaps,
    queryFn: () => api.get<OpenPeriodGap[]>('/api/polyvalence/admin/open-period-gaps'),
    enabled: canManage,
  });
  useEffect(() => {
    setSettingsOpen(canManage && searchParams.get('view') === 'management');
  }, [canManage, searchParams]);

  const showSettings = () => {
    setSettingsOpen(true);
    setSearchParams({ view: 'management' });
  };
  const closeSettings = () => {
    setSettingsOpen(false);
    setSearchParams({ view: 'reports' });
  };
  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.polyvalencePeriods }),
      queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceReportGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup }),
      queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceOpenGaps }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'polyvalence', 'report-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'polyvalence', 'period-report'] }),
    ]);
  };
  const reportQueries = [periodsQuery, reportGroupsQuery, openGapsQuery];
  const isLoading = reportQueries.some(query => query.isPending && query.fetchStatus === 'fetching');
  const queryError = reportQueries.find(query => query.error)?.error;
  if (isLoading) return <LoadingIndicator label="Polivalans verileri hazırlanıyor" />;

  return <section className="poly-admin-page poly-workspace">
    <ModulePageHeader title="Dönemler ve Raporlar" description="Değerlendirme dönemlerini ve yetkinlik sonuçlarını takip edin." icon={<Layers3 />} tone="violet" actions={canManage && <button type="button" className="btn-secondary poly-command" aria-haspopup="dialog" onClick={showSettings}><Settings2 size={18} aria-hidden="true" /> Polivalans Ayarları</button>} />
    {(error || queryError) && <div className="poly-alert" role="alert">
      <span>{error || (queryError instanceof Error ? queryError.message : 'Veriler yüklenemedi')}</span>
      {queryError ? <button type="button" onClick={() => reportQueries.forEach(query => { if (query.error) void query.refetch(); })}>Tekrar dene</button> : <button type="button" onClick={() => setError('')}>Kapat</button>}
    </div>}
    <Suspense fallback={<LoadingIndicator compact label="Polivalans bölümü hazırlanıyor" />}>
      <ReportsPanel periods={periodsQuery.data || []} groups={reportGroupsQuery.data || []} openGaps={openGapsQuery.data || []} activeMembershipCount={setupQuery.data?.active_membership_count || 0} canManage={canManage} onError={setError} />
    </Suspense>
    {settingsOpen && canManage && <Suspense fallback={<LoadingIndicator compact label="Ayarlar hazırlanıyor" />}>
      <SettingsModal setup={setupQuery.data || EMPTY_SETUP} loading={setupQuery.isPending} error={setupQuery.error?.message || ''} onRetry={() => void setupQuery.refetch()} onClose={closeSettings} onSaved={refreshData} />
    </Suspense>}
  </section>;
}
