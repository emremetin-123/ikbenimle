import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit3, Info, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { queryKeys } from '../queryClient';
import { useAppFeedback } from '../components/AppFeedback';
import { api } from '../services/api';
import { boolValue } from './utils';
import type { ModalKind, SetupResponse } from './types';
import { PolyvalenceSkillTargetModal } from './PolyvalenceSkillTargetModal';

type Props = {
  setup: SetupResponse;
  departmentId: number;
  onOpenModal: (kind: ModalKind, item?: Record<string, unknown>) => void;
  onError: (message: string) => void;
};

export function PolyvalenceCatalogPanel({ setup, departmentId, onOpenModal, onError }: Props) {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [showArchived, setShowArchived] = useState(false);
  const [roleId, setRoleId] = useState(0);
  const [editor, setEditor] = useState<{ skillId?: number } | null>(null);
  const roles = setup.roles.filter(item => Number(item.department_id) === departmentId && !boolValue(item.is_archived));
  const selectedRole = roles.find(item => item.id === roleId) || roles[0];
  const categories = setup.categories.filter(item => Number(item.department_id) === departmentId && (showArchived || !boolValue(item.is_archived)));
  const skills = setup.skills.filter(item => Number(item.department_id) === departmentId && (showArchived || !boolValue(item.is_archived)));
  const targets = setup.targets.filter(item => item.role_id === selectedRole?.id);
  const linkedCount = skills.filter(skill => targets.some(target => target.skill_id === skill.id) && !boolValue(skill.is_archived)).length;
  const archiveMutation = useMutation({
    mutationFn: async ({ type, id, archived }: { type: 'categories' | 'skills'; id: number; archived: boolean }) => {
      const reason = type === 'skills' && archived ? await feedback.prompt({
        title: 'Beceriyi arşivle', message: 'Geçmiş raporlar korunur. Arşivleme gerekçesini yazın.',
        label: 'Arşivleme gerekçesi', confirmLabel: 'Arşivle', required: true,
      }) : '';
      if (type === 'skills' && archived && !reason) return;
      await api.post('/api/polyvalence/admin/' + type + '/' + id + '/archive', { archived, reason: reason || '' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup }),
    onError: error => onError(error instanceof Error ? error.message : 'Arşivleme başarısız'),
  });

  return <div className="poly-section-stack">
    <p className="poly-notice"><Info size={18} aria-hidden="true" /> Değişiklikler sonraki değerlendirme dönemlerine uygulanır. Açık dönemler yalnız açıkça döneme dahil etme işlemiyle güncellenir.</p>
    <div className="poly-catalog-layout">
      <section className="poly-surface">
        <header className="poly-surface-toolbar">
          <label className="poly-field">Pozisyon
            <select value={selectedRole?.id || ''} onChange={event => setRoleId(Number(event.target.value))}>
              {!roles.length && <option value="">Pozisyon bulunmuyor</option>}
              {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-primary poly-command" disabled={!selectedRole} onClick={() => setEditor({})}><Plus size={17} /> Beceri ve hedef ekle</button>
        </header>
        <div className="poly-surface-body"><h2>Pozisyon becerileri</h2>
          <p className="poly-muted">Bölümdeki beceriler ve seçili pozisyonun hedefleri birlikte gösterilir. Hedefi olmayan beceriler bu pozisyonun değerlendirmesine alınmaz.</p>
        </div>
        <div className="poly-table-scroll" role="region" aria-label="Pozisyon becerileri" tabIndex={0}>
          <table className="poly-data-table">
            <thead><tr><th>Beceri</th><th>Kategori</th><th>Hedef seviye</th><th>Asgari yetkin kişi</th><th>Kritiklik</th><th>İşlem</th></tr></thead>
            <tbody>{skills.map(skill => {
              const target = targets.find(item => item.skill_id === skill.id);
              const level = setup.levels.find(item => item.level_value === target?.target_level);
              const trainingCount = setup.training_links.filter(item => item.skill_id === skill.id).length;
              const archived = boolValue(skill.is_archived);
              return <tr key={skill.id} className={archived ? 'poly-archived-row' : ''}>
                <td><strong>{skill.name}</strong><small>{archived ? 'Arşivlenmiş' : trainingCount ? trainingCount + ' ilişkili eğitim' : 'İlişkili eğitim yok'}</small></td>
                <td>{skill.category_name || setup.categories.find(item => item.id === skill.category_id)?.name || 'Genel'}</td>
                <td>{target ? String(target.target_level ?? '—') + (level ? ' · ' + level.label : '') : <span className="poly-tag">Hedef tanımlanmamış</span>}</td>
                <td>{target ? target.min_qualified_count + ' kişi' : '—'}</td>
                <td>{target ? <span className={target.criticality === 'critical' ? 'poly-tag poly-tag-critical' : 'poly-tag'}>{target.criticality === 'critical' ? 'Kritik' : 'Standart'}</span> : '—'}</td>
                <td><div className="poly-table-actions">
                  <button type="button" className="poly-text-button" disabled={!selectedRole || archived} onClick={() => setEditor({ skillId: skill.id })} aria-label={skill.name + ' beceri ve hedefini düzenle'}><Edit3 size={15} /> Düzenle</button>
                  <button type="button" className="poly-icon-button" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate({ type: 'skills', id: skill.id, archived: !archived })} aria-label={skill.name + (archived ? ' arşivden çıkar' : ' arşivle')}>{archived ? <RotateCcw size={16} /> : <Archive size={16} />}</button>
                </div></td>
              </tr>;
            })}</tbody>
          </table>
          {!skills.length && <p className="poly-empty">Bu bölümde henüz beceri bulunmuyor. Pozisyon seçip ilk beceri ve hedefi ekleyin.</p>}
        </div>
        <footer className="poly-surface-toolbar">
          <button type="button" className="btn-secondary poly-command" aria-pressed={showArchived} onClick={() => setShowArchived(value => !value)}><Archive size={16} /> {showArchived ? 'Arşivlenenleri gizle' : 'Arşivlenenleri göster'}</button>
        </footer>
      </section>
      <aside className="poly-surface poly-position-summary">
        <h2>Pozisyon özeti</h2><strong>{selectedRole?.name || 'Pozisyon seçilmedi'}</strong>
        <dl><div><dt>Hedefli beceri</dt><dd>{linkedCount}</dd></div><div><dt>Bölümdeki aktif beceri</dt><dd>{skills.filter(item => !boolValue(item.is_archived)).length}</dd></div></dl>
        <p className="poly-muted">Hedefler, bu pozisyona eşleşen çalışanların sonraki dönem değerlendirmelerine uygulanır.</p>
        {!roles.length && <p className="poly-notice">Pozisyonlar kullanıcı kayıtlarından otomatik oluşur. Çalışanların pozisyon bilgisini kontrol edin.</p>}
      </aside>
    </div>
    <details className="poly-surface poly-category-settings"><summary><Settings2 size={17} /> Kategorileri yönet <span>{categories.length} kategori</span></summary>
      <div className="poly-surface-body"><button type="button" className="btn-secondary poly-command" disabled={!departmentId} onClick={() => onOpenModal('category')}><Plus size={16} /> Kategori ekle</button>
        {categories.map(item => <div className="poly-settings-row" key={item.id}><strong>{item.name}{boolValue(item.is_archived) ? ' · Arşivlenmiş' : ''}</strong><div className="poly-table-actions">
          <button type="button" className="poly-icon-button" onClick={() => onOpenModal('category', item as unknown as Record<string, unknown>)} aria-label={item.name + ' kategorisini düzenle'}><Edit3 size={16} /></button>
          <button type="button" className="poly-icon-button" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate({ type: 'categories', id: item.id, archived: !boolValue(item.is_archived) })} aria-label={item.name + (boolValue(item.is_archived) ? ' kategorisi arşivden çıkar' : ' kategorisi arşivle')}>{boolValue(item.is_archived) ? <RotateCcw size={16} /> : <Archive size={16} />}</button>
        </div></div>)}
        {!categories.length && <p className="poly-muted">Bu bölümde kategori tanımlanmamış.</p>}
      </div>
    </details>
    {editor && selectedRole && <PolyvalenceSkillTargetModal key={departmentId + '-' + selectedRole.id + '-' + (editor.skillId || 'new')} setup={setup} departmentId={departmentId} roleId={selectedRole.id} skillId={editor.skillId} onClose={() => setEditor(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup })} />}
  </div>;
}
