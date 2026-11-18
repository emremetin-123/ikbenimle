import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, RotateCcw, UserCog, UserRoundCheck, UserRoundX } from 'lucide-react';
import { queryKeys } from '../queryClient';
import { useAppFeedback } from '../components/AppFeedback';
import { api } from '../services/api';
import { boolValue } from './utils';
import type { ModalKind, SetupResponse } from './types';
import type { Membership } from './types';
import { PaginationControls } from '../components/PaginationControls';

type Props = {
  setup: SetupResponse;
  onOpenModal: (kind: ModalKind, item?: Record<string, unknown>) => void;
  onError: (message: string) => void;
};

export function PolyvalenceMembershipPanel(props: Props) {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const membershipsQuery = useQuery({
    queryKey: [...queryKeys.polyvalenceMemberships, { page, search: deferredSearch }],
    queryFn: () => {
      const params = new URLSearchParams({ resource: 'memberships', page: String(page), pageSize: '25' });
      if (deferredSearch) params.set('search', deferredSearch);
      return api.list<Membership>(`/api/polyvalence/admin/setup?${params.toString()}`);
    },
    placeholderData: previous => previous,
  });
  const memberships = membershipsQuery.data?.items || [];
  const resetMutation = useMutation({
    mutationFn: (membershipId: number) =>
      api.delete(`/api/polyvalence/admin/memberships/${membershipId}/override`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup });
      await queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceMemberships });
      feedback.notifySuccess('Manuel eşleşme kaldırıldı; kullanıcının bölüm ve üst amir bilgisi yeniden kullanılıyor.');
    },
    onError: (error) =>
      props.onError(error instanceof Error ? error.message : 'Eşleşme varsayılana döndürülemedi'),
  });
  const statusMutation = useMutation({
    mutationFn: ({ item, active }: { item: Membership; active: boolean }) =>
      api.put('/api/polyvalence/admin/memberships', {
        user_id: item.user_id,
        department_id: item.department_id,
        role_id: item.role_id || null,
        evaluator_user_id: item.evaluator_user_id || null,
        is_active: active,
      }),
    onSuccess: async (_data, { active }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup });
      await queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceMemberships });
      feedback.notifySuccess(active ? 'Eşleşme yeniden etkinleştirildi.' : 'Eşleşme sonraki dönemler için kaldırıldı.');
    },
    onError: (error) =>
      props.onError(error instanceof Error ? error.message : 'Eşleşme durumu değiştirilemedi'),
  });

  const resetOverride = async (membershipId: number) => {
    const accepted = await feedback.confirm({
      title: 'Manuel eşleşmeyi kaldır',
      message: 'Çalışanın değerlendirecek kişisi, kullanıcı tanımındaki üst amirine döndürülecek.',
      confirmLabel: 'Varsayılana Dön',
    });
    if (accepted) resetMutation.mutate(membershipId);
  };

  const changeStatus = async (item: Membership, active: boolean) => {
    if (!active) {
      const accepted = await feedback.confirm({
        title: 'Eşleşmeyi kaldır',
        message: 'Bu çalışan sonraki polivalans dönemlerine alınmayacak. Açılmış dönemler ve geçmiş değerlendirmeler değişmez.',
        confirmLabel: 'Eşleşmeyi Kaldır',
      });
      if (!accepted) return;
    }
    statusMutation.mutate({ item, active });
  };

  return (
    <div className="poly-section-stack">
      <div className="poly-toolbar">
        <div><h3>Çalışan ve amir eşleşmeleri</h3><p>Eşleşmeler kullanıcı bölümünden ve üst amirinden otomatik gelir. Yalnız istisna gerektiğinde düzenleyin.</p></div>
        <div className="poly-toolbar-actions">
          <button type="button" className="btn-primary poly-command" onClick={() => props.onOpenModal('membership')}><UserCog size={18} /> Manuel Eşleşme</button>
        </div>
      </div>
      <input className="form-control" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Çalışan eşleşmelerinde ara" placeholder="Çalışan, sicil, bölüm, pozisyon veya amir ara..." />
      <div className="poly-member-list">
        {memberships.map((item) => {
          const isManual = boolValue(item.is_manual_override);
          const isActive = item.is_active === undefined || boolValue(item.is_active);
          return <article key={item.id}>
            <div className="poly-avatar-letter">{item.user_name.slice(0, 1)}</div>
            <div><strong>{item.user_name}</strong><small>#{item.employee_id} · {item.position || '-'}</small>{!isActive && <span className="poly-member-inactive">Pasif</span>}</div>
            <div><small>Bölüm</small><strong>{item.department_name}</strong><span className={`poly-auto-chip ${boolValue(item.is_department_auto) ? '' : 'manual'}`}>{boolValue(item.is_department_auto) ? 'Otomatik' : 'Manuel'}</span></div>
            <div><small>Pozisyon profili</small><strong>{item.role_name || 'Tanımsız'}</strong></div>
            <div><small>Değerlendirecek amir</small><strong>{item.evaluator_name || 'Eksik'}</strong><span className={`poly-auto-chip ${boolValue(item.is_evaluator_auto) ? '' : 'manual'}`}>{boolValue(item.is_evaluator_auto) ? 'Üst amir' : 'Manuel'}</span></div>
            <span className="poly-member-actions">
              {isManual && <button type="button" className="poly-member-action" disabled={resetMutation.isPending || statusMutation.isPending} onClick={() => void resetOverride(item.id)} title="Kullanıcının üst amirine dön"><RotateCcw size={16} /> Otomatiğe Dön</button>}
              <button type="button" className="poly-member-action" disabled={statusMutation.isPending || resetMutation.isPending} onClick={() => void changeStatus(item, !isActive)} title={isActive ? 'Gelecek dönemler için eşleşmeyi kaldır' : 'Eşleşmeyi yeniden etkinleştir'}>{isActive ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}{isActive ? 'Eşleşmeyi Kaldır' : 'Yeniden Ekle'}</button>
              <button type="button" className="btn-icon-round" onClick={() => props.onOpenModal('membership', item as unknown as Record<string, unknown>)} title="Eşleşmeyi düzenle" aria-label="Eşleşmeyi düzenle"><Edit3 size={17} /></button>
            </span>
          </article>;
        })}
        {membershipsQuery.isLoading && <div className="poly-loading">Eşleşmeler yükleniyor...</div>}
        {!membershipsQuery.isLoading && !memberships.length && <div className="empty-state">Henüz çalışan eşleşmesi yapılmadı.</div>}
      </div>
      <PaginationControls pagination={membershipsQuery.data?.pagination} onPageChange={setPage} />
    </div>
  );
}
