import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Edit3, Info, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { queryKeys } from '../queryClient';
import { useAppFeedback } from '../components/AppFeedback';
import { api } from '../services/api';
import { boolValue, formatDate } from './utils';
import type { ModalKind, SetupResponse } from './types';
import type { PolyvalencePeriod } from '../types';

const levelColorStyle = (color?: string | null): CSSProperties => ({
  '--poly-level-color': color || 'transparent',
} as CSSProperties);

type Props = {
  setup: SetupResponse;
  departmentId: number;
  mode: 'schedules' | 'levels';
  onOpenModal: (kind: ModalKind, item?: Record<string, unknown>) => void;
  onError: (message: string) => void;
};

export function PolyvalenceStandardsPanel(props: Props) {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const schedules = props.setup.schedules.filter(item => Number(item.department_id) === props.departmentId);
  const periods = useQuery({ queryKey: queryKeys.polyvalencePeriods,
    queryFn: () => api.get<PolyvalencePeriod[]>('/api/polyvalence/admin/periods'),
    enabled: props.mode === 'schedules', refetchInterval: props.mode === 'schedules' ? 60_000 : false });
  const openPeriod = periods.data?.find(item => item.department_id === props.departmentId && item.status === 'open');
  const scheduleMutation = useMutation({
    mutationFn: () => api.post<{ opened: number; closed: number; skipped: number; blocked?: Array<{ message: string }>; errors?: Array<{ message: string }> }>('/api/polyvalence/admin/schedules/run', {}),
    onSuccess: async result => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalencePeriods }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceReportGroups }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceOpenGaps }),
      ]);
      if (result.errors?.length) {
        const message = result.errors.map(error => error.message).join('; ');
        props.onError(message); feedback.notifyError(message);
      } else if (result.blocked?.length) feedback.notifyInfo(result.blocked.map(item => item.message).join('; '));
      else feedback.notifySuccess('Takvim kontrol edildi. Açılan: ' + result.opened + ', kapanan: ' + result.closed + ', atlanan: ' + result.skipped);
    },
    onError: error => props.onError(error instanceof Error ? error.message : 'Takvim kontrolü başarısız'),
  });

  if (props.mode === 'levels') return <section className="poly-surface">
    <header className="poly-surface-body"><h2>Seviye tanımları</h2><p className="poly-muted">Tüm bölümlerde kullanılan ortak 0–3 değerlendirme ölçeği. Eğitim verebilir işareti yalnız seviye 3 için kullanılabilir.</p></header>
    {props.setup.levels.map(level => <button type="button" className="poly-level-definition" key={level.level_value} onClick={() => props.onOpenModal('level', level as unknown as Record<string, unknown>)}>
      <span style={levelColorStyle(level.color)}>{level.level_value}</span><div><strong>{level.label}</strong><small>{level.description}</small></div><Edit3 size={16} aria-hidden="true" />
    </button>)}
    {!props.setup.levels.length && <p className="poly-empty">Seviye tanımları bulunamadı.</p>}
  </section>;

  return <div className="poly-section-stack">
    <p className="poly-notice"><Info size={18} /> Aktif takvimler otomatik kontrol edilir. Zamanı gelen dönem açılır, son tarihi geçen açık dönem kapanır. Tarihler Türkiye saatine göredir.</p>
    {openPeriod && <p className="poly-notice" role="status">{openPeriod.name} dönemi açık. Son tarih: {formatDate(openPeriod.due_date)}. Tüm görevler tamamlansa da dönem kapanana kadar yeni dönem açılmaz. Tamamlanan dönemi dönem listesindeki “Dönemi kapat” işlemiyle kapatabilirsiniz.</p>}
    <p className="poly-muted">Hatırlatmalar son teslim tarihine göredir: 7,3,1 seçimi, bitişten 7, 3 ve 1 gün önce tamamlanmamış görevlerin değerlendiricilerine bildirim gönderir. 0 son gün demektir. Bildirim şablonu ve cihaz izni açık olmalıdır.</p>
    <section className="poly-surface">
      <header className="poly-surface-toolbar"><div><h2>Değerlendirme takvimi</h2><p className="poly-muted">Seçili bölümün dönem sıklığı ve hatırlatmaları.</p></div>
        <div className="poly-table-actions">
          <button type="button" className="btn-secondary poly-command" disabled={scheduleMutation.isPending} onClick={() => scheduleMutation.mutate()}><CalendarClock size={17} /> {scheduleMutation.isPending ? 'Kontrol ediliyor…' : 'Tüm takvimleri kontrol et'}</button>
          {!schedules.length && <button type="button" className="btn-primary poly-command" disabled={!props.departmentId} onClick={() => props.onOpenModal('schedule')}><Plus size={17} /> Takvim oluştur</button>}
        </div>
      </header>
      {schedules.map(item => <div key={item.id} className="poly-surface-body poly-schedule-details">
        <span className={boolValue(item.is_active) ? 'poly-tag poly-tag-success' : 'poly-tag'}>{boolValue(item.is_active) ? 'Otomatik dönem akışı aktif' : 'Takvim duraklatıldı'}</span>
        <dl><div><dt>Değerlendirme sıklığı</dt><dd>{item.frequency_months === 1 ? 'Her ay' : item.frequency_months + ' ayda bir'}</dd></div>
          <div><dt>Sonraki başlangıç</dt><dd>{formatDate(item.next_start_date)}</dd></div>
          <div><dt>Değerlendirme süresi</dt><dd>{item.duration_days} gün</dd></div>
          <div><dt>Hatırlatmalar</dt><dd>{item.reminder_days || '—'} gün önce</dd></div></dl>
        <button type="button" className="btn-secondary poly-command" onClick={() => props.onOpenModal('schedule', item as unknown as Record<string, unknown>)}><Edit3 size={16} /> Takvimi düzenle</button>
      </div>)}
      {!schedules.length && <p className="poly-empty">Bu bölümde takvim tanımlanmamış. Otomatik dönem akışı için bir takvim oluşturun.</p>}
    </section>
  </div>;
}
