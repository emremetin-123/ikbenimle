import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Info, Link2 } from 'lucide-react';
import { api } from '../services/api';
import type { PolyvalenceSkill } from '../types';
import type { SetupResponse } from './types';
import { boolValue } from './utils';
import { PolyvalenceModal } from './PolyvalenceModal';

type Props = {
  setup: SetupResponse;
  departmentId: number;
  roleId: number;
  skillId?: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function PolyvalenceSkillTargetModal(props: Props) {
  const { setup, departmentId, roleId } = props;
  const initialValues = (id?: number) => {
    const skill = setup.skills.find(item => item.id === id);
    const target = setup.targets.find(item => item.skill_id === id && item.role_id === roleId);
    return {
      skillId: id || 0, name: skill?.name || '', description: skill?.description || '',
      categoryId: skill?.category_id || '',
      trainingIds: setup.training_links.filter(item => item.skill_id === id).map(item => item.video_id),
      targetLevel: target?.target_level ?? 2, criticality: target?.criticality || 'normal',
      minQualified: target?.min_qualified_count ?? 1,
    };
  };
  const [form, setForm] = useState(() => initialValues(props.skillId));
  // A retry after a later request fails must update the created skill, not create it twice.
  const savedSkillId = useRef(props.skillId || 0);
  const [skillSaved, setSkillSaved] = useState(false);
  const roles = setup.roles.find(item => item.id === roleId);
  const department = setup.departments.find(item => item.id === departmentId);
  const activeSkills = setup.skills.filter(item => Number(item.department_id) === departmentId && !boolValue(item.is_archived));
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name.trim(), category_id: form.categoryId || null, description: form.description.trim() || null };
      const skill = savedSkillId.current
        ? await api.put<PolyvalenceSkill>(`/api/polyvalence/admin/skills/${savedSkillId.current}`, payload)
        : await api.post<PolyvalenceSkill>('/api/polyvalence/admin/skills', { ...payload, department_id: departmentId });
      savedSkillId.current = skill.id;
      setSkillSaved(true);
      await api.put(`/api/polyvalence/admin/skills/${skill.id}/trainings`, { video_ids: form.trainingIds });
      await api.put('/api/polyvalence/admin/targets', {
        skill_id: skill.id, role_id: roleId, target_level: form.targetLevel,
        criticality: form.criticality, min_qualified_count: form.minQualified,
      });
    },
    onSuccess: async () => { await props.onSaved(); props.onClose(); },
  });

  return <PolyvalenceModal title={props.skillId ? 'Beceri ve Hedefi Düzenle' : 'Beceri ve Hedef Ekle'} onClose={() => { if (!mutation.isPending) { void props.onSaved(); props.onClose(); } }}>
    <form className="poly-form" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
      <p className="poly-notice"><Info size={18} /> {department?.name} · {roles?.name}. Beceri bilgileri bölümde ortaktır; hedef yalnız bu pozisyona aittir.</p>
      {!props.skillId && <label>Beceri seçimi<select value={form.skillId} disabled={mutation.isPending || skillSaved} onChange={event => {
        const id = Number(event.target.value); savedSkillId.current = id; setForm(initialValues(id)); mutation.reset();
      }}><option value="0">Yeni beceri oluştur</option>{activeSkills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>}
      <fieldset className="poly-form-section" disabled={mutation.isPending}>
        <legend>Beceri bilgileri</legend>
        <label>Beceri adı<input required maxLength={255} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Kategori<select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: Number(event.target.value) || '' })}>
          <option value="">Genel</option>{setup.categories.filter(item => Number(item.department_id) === departmentId && (!boolValue(item.is_archived) || item.id === form.categoryId)).map(item => <option key={item.id} value={item.id}>{item.name}{boolValue(item.is_archived) ? ' (Arşivlenmiş)' : ''}</option>)}
        </select></label>
        <label>Açıklama<textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      </fieldset>
      <fieldset className="poly-form-section" disabled={mutation.isPending}>
        <legend>Pozisyon hedefi</legend>
        <div className="poly-form-grid"><label>Hedef seviye<select value={form.targetLevel} onChange={event => setForm({ ...form, targetLevel: Number(event.target.value) })}>
          {[0, 1, 2, 3].map(level => <option key={level} value={level}>{level} · {setup.levels.find(item => item.level_value === level)?.label || ['Bilgisiz', 'Gelişmeli', 'Yeterli', 'Uzman'][level]}</option>)}
        </select></label><label>Asgari yetkin kişi<input required type="number" min="1" step="1" value={form.minQualified} onChange={event => setForm({ ...form, minQualified: Number(event.target.value) })} /></label></div>
        <label>Kritiklik<select value={form.criticality} onChange={event => setForm({ ...form, criticality: event.target.value === 'critical' ? 'critical' : 'normal' })}><option value="normal">Standart</option><option value="critical">Kritik</option></select></label>
      </fieldset>
      <details className="poly-training-disclosure"><summary><Link2 size={16} /> İlişkili eğitimler · {form.trainingIds.length}</summary>
        <fieldset className="poly-training-links" disabled={mutation.isPending}><legend>Eğitim bağlantıları (isteğe bağlı)</legend>
          {setup.videos.map(video => <label key={video.id}><input type="checkbox" checked={form.trainingIds.includes(video.id)} onChange={event => setForm({ ...form, trainingIds: event.target.checked ? [...form.trainingIds, video.id] : form.trainingIds.filter(id => id !== video.id) })} /><span>{video.title}<small>{video.category}</small></span></label>)}
          {!setup.videos.length && <p>Henüz eğitim bulunmuyor.</p>}
        </fieldset>
      </details>
      {mutation.error && <div className="poly-inline-error" role="alert">{mutation.error.message}{skillSaved && <p>Beceri bilgileri kaydedildi. Kalan işlemleri tamamlamak için tekrar Kaydet düğmesine basın.</p>}</div>}
      <footer className="poly-modal-actions"><button type="button" className="btn-cancel" disabled={mutation.isPending} onClick={() => { void props.onSaved(); props.onClose(); }}>Vazgeç</button><button type="submit" className="btn-primary poly-command" disabled={mutation.isPending}>{mutation.isPending ? 'Kaydediliyor…' : 'Beceri ve hedefi kaydet'}</button></footer>
    </form>
  </PolyvalenceModal>;
}
