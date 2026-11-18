import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';
import type { PolyvalencePeriod } from '../types';

type ReportRow = {
  employee_id_snapshot: string; employee_name_snapshot: string;
  position_snapshot?: string; role_name_snapshot?: string; evaluator_name_snapshot?: string;
  skill_name_snapshot: string; category_name_snapshot?: string;
  target_level_snapshot: number | null; level_value: number | null; can_train: boolean; note?: string;
};
type Report = {
  period: PolyvalencePeriod;
  rows: ReportRow[];
  tasks: Array<{ id: number; evaluator_name: string; member_count: number; status: string; total: number; completed: number }>;
};
type Props = { periodId: number; position: string; canManage: boolean; onError: (message: string) => void };

export function PolyvalenceReportDetails({ periodId, position, canManage, onError }: Props) {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'polyvalence', 'period-report', periodId],
    queryFn: () => api.get<Report>(`/api/polyvalence/admin/periods/${periodId}/report`),
    refetchInterval: data => data.state.data?.period.status === 'open' ? 60_000 : false,
  });
  const reopen = useMutation({
    mutationFn: async (taskId: number) => {
      const reason = await feedback.prompt({ title: 'Görevi yeniden aç', label: 'Yeniden açma gerekçesi', message: 'Tamamlanan değerlendirme tekrar düzenlenebilir olacak. İşlem tarihçeye kaydedilir.', required: true, confirmLabel: 'Yeniden aç' });
      if (!reason) return;
      await api.post(`/api/polyvalence/admin/tasks/${taskId}/reopen`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'polyvalence'] }),
    onError: error => onError(error.message),
  });
  if (query.isPending) return <LoadingIndicator compact label="Çalışan sonuçları hazırlanıyor" />;
  if (query.error) return <div className="poly-alert" role="alert">{query.error.message}<button type="button" onClick={() => void query.refetch()}>Tekrar dene</button></div>;
  const data = query.data;
  if (!data) return null;
  const employees = new Map<string, ReportRow[]>();
  data.rows.filter(row => position === 'all' || (row.role_name_snapshot || row.position_snapshot || 'Pozisyon yok') === position).forEach(row => {
    const key = String(row.employee_id_snapshot);
    employees.set(key, [...(employees.get(key) || []), row]);
  });
  return <>
    <section className="poly-surface">
      <header className="poly-surface-body"><h2>Çalışan bazında sonuçlar</h2><p className="poly-muted">Değerlendirilen beceri sayısı ile hedefi karşılayan beceri sayısı ayrı gösterilir.</p></header>
      <div className="poly-table-scroll" role="region" aria-label="Çalışan sonuçları" tabIndex={0}>
        <table className="poly-data-table"><thead><tr><th>Çalışan</th><th>Pozisyon</th><th>Değerlendirilen</th><th>Hedefi karşılayan</th><th>İşlem</th></tr></thead><tbody>
          {[...employees.entries()].map(([id, rows], index) => {
            const row = rows[0];
            const assessed = rows.filter(item => item.level_value != null).length;
            const targeted = rows.filter(item => item.target_level_snapshot != null);
            const met = targeted.filter(item => item.level_value != null && Number(item.level_value) >= Number(item.target_level_snapshot)).length;
            return <Fragment key={id}><tr><td><strong>{row.employee_name_snapshot}</strong><small>Sicil {id}</small></td><td>{row.role_name_snapshot || row.position_snapshot || '—'}</td><td>{assessed} / {rows.length} beceri</td><td>{met} / {targeted.length} hedef</td><td><button type="button" className="poly-text-button" aria-expanded={expanded === id} aria-controls={`poly-employee-result-${index}`} onClick={() => setExpanded(expanded === id ? null : id)}>Detay <ChevronDown size={16} /></button></td></tr>
              {expanded === id && <tr><td colSpan={5}><section id={`poly-employee-result-${index}`} className="poly-employee-result"><h3>{row.employee_name_snapshot} · Beceri detayları</h3><p className="poly-muted">Değerlendirici: {row.evaluator_name_snapshot || '—'}</p>
                <table className="poly-data-table"><thead><tr><th>Beceri</th><th>Seviye</th><th>Hedef</th><th>Eğitim verebilir</th><th>Açıklama</th></tr></thead><tbody>{rows.map((item, i) => <tr key={i}><td>{item.skill_name_snapshot}<small>{item.category_name_snapshot || 'Genel'}</small></td><td>{item.level_value ?? 'Değerlendirilmedi'}</td><td>{item.target_level_snapshot ?? 'Tanımsız'}</td><td>{item.can_train ? 'Evet' : 'Hayır'}</td><td>{item.note || '—'}</td></tr>)}</tbody></table>
              </section></td></tr>}
            </Fragment>;
          })}
        </tbody></table>
        {!employees.size && <p className="poly-empty">Bu kapsamda çalışan sonucu bulunmuyor.</p>}
      </div>
    </section>
    <details className="poly-surface poly-category-settings"><summary>Değerlendirici görevleri <span>{data.tasks.length} görev</span></summary><div className="poly-surface-body">
      {data.tasks.map(task => <div className="poly-settings-row" key={task.id}><div><strong>{task.evaluator_name}</strong><small>{task.member_count} çalışan · {task.completed}/{task.total} beceri · {task.status === 'completed' ? 'Tamamlandı' : task.status === 'pending' ? 'Bekliyor' : 'Devam ediyor'}</small></div>
        {canManage && data.period.status === 'open' && task.status === 'completed' && <button type="button" className="btn-secondary poly-command" disabled={reopen.isPending} onClick={() => reopen.mutate(task.id)}><RotateCcw size={16} /> Yeniden aç</button>}
      </div>)}
      {!data.tasks.length && <p className="poly-muted">Değerlendirici görevi bulunmuyor.</p>}
    </div></details>
  </>;
}
