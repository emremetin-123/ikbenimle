import { useEffect, useState, type CSSProperties } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useAppFeedback } from '../components/AppFeedback';
import { api } from '../services/api';
import type { PolyvalenceCategory, PolyvalenceSkill } from '../types';
import { PolyvalenceModal } from './PolyvalenceModal';
import { boolValue } from './utils';
import type { Membership, ModalKind, SetupResponse } from './types';
import { PolyvalenceMembershipFields } from './PolyvalenceMembershipFields';

const levelColorStyle = (color: unknown): CSSProperties => ({
  '--poly-level-color': String(color || '#2563eb'),
} as CSSProperties);

type Props = {
  kind: ModalKind;
  editing: Record<string, unknown> | null;
  setup: SetupResponse;
  definitionDepartmentId: number;
  targetDepartmentId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
};

const titles: Record<ModalKind, string> = {
  period: 'Yeni Değerlendirme Dönemi',
  department: 'Yeni Bölüm',
  role: 'Yeni Pozisyon Profili',
  category: 'Yeni Beceri Kategorisi',
  skill: 'Yeni Beceri',
  membership: 'Çalışan Eşleşmesi',
  target: 'Pozisyon Hedefi',
  schedule: 'Değerlendirme Sıklığı',
  level: 'Seviye Ölçütü',
};

function getInitialForm(
  kind: ModalKind,
  editing: Record<string, unknown> | null,
  setup: SetupResponse,
  definitionDepartmentId: number,
  targetDepartmentId: number,
) {
  const departments = setup.departments.filter((item) => !boolValue(item.is_archived));
  if (kind === 'period') {
    return {
      department_id: departments[0]?.id || '',
      name: '',
      start_date: '',
      end_date: '',
      due_date: '',
    };
  }
  if (kind === 'department') return editing || { name: '', source_department_name: '' };
  if (kind === 'role') {
    return editing || { department_id: definitionDepartmentId || departments[0]?.id || '', name: '' };
  }
  if (kind === 'category') {
    const category = editing as PolyvalenceCategory | null;
    return category
      ? { department_id: category.department_id, name: category.name }
      : { department_id: definitionDepartmentId || departments[0]?.id || '', name: '' };
  }
  if (kind === 'skill') {
    const skill = editing as PolyvalenceSkill | null;
    return skill
      ? {
          department_id: skill.department_id,
          category_id: skill.category_id || '',
          name: skill.name,
          description: skill.description || '',
          training_ids: setup.training_links
            .filter((link) => link.skill_id === skill.id)
            .map((link) => link.video_id),
        }
      : {
          department_id: definitionDepartmentId || departments[0]?.id || '',
          category_id: '',
          name: '',
          description: '',
          training_ids: [],
        };
  }
  if (kind === 'membership') {
    const membership = editing as Membership | null;
    return membership
      ? { ...membership }
      : {
          user_id: '',
          department_id: departments[0]?.id || '',
          role_id: '',
          evaluator_user_id: '',
          is_active: true,
        };
  }
  if (kind === 'target') {
    const target = editing as { skill_id?: number } | null;
    const targetSkill = target?.skill_id
      ? setup.skills.find((skill) => skill.id === target.skill_id)
      : undefined;
    const departmentId =
      Number(targetSkill?.department_id) || targetDepartmentId || departments[0]?.id || '';
    const firstSkill = setup.skills.find(
      (skill) => Number(skill.department_id) === Number(departmentId) && !boolValue(skill.is_archived),
    );
    const firstRole = setup.roles.find(
      (role) => Number(role.department_id) === Number(departmentId) && !boolValue(role.is_archived),
    );
    return editing
      ? { ...editing, department_id: departmentId }
      : {
          department_id: departmentId,
          skill_id: firstSkill?.id || '',
          role_id: firstRole?.id || '',
          target_level: 2,
          criticality: 'normal',
          min_qualified_count: 1,
        };
  }
  if (kind === 'schedule') {
    return (
      editing || {
        department_id: definitionDepartmentId || departments[0]?.id || '',
        frequency_months: 6,
        next_start_date: '',
        duration_days: 30,
        reminder_days: '7,3,1',
        is_active: true,
      }
    );
  }
  return editing || {};
}

async function saveForm(
  kind: ModalKind,
  editing: Record<string, unknown> | null,
  form: Record<string, unknown>,
) {
  if (kind === 'period') return api.post('/api/polyvalence/admin/periods', form);
  if (kind === 'department') {
    const payload = { name: form.name, source_department_name: form.source_department_name || null };
    return editing?.id
      ? api.put(`/api/polyvalence/admin/departments/${editing.id}`, payload)
      : api.post('/api/polyvalence/admin/departments', payload);
  }
  if (kind === 'role') {
    return editing?.id
      ? api.put(`/api/polyvalence/admin/roles/${editing.id}`, { name: form.name })
      : api.post('/api/polyvalence/admin/roles', {
          department_id: form.department_id,
          name: form.name,
        });
  }
  if (kind === 'category') {
    return editing?.id
      ? api.put(`/api/polyvalence/admin/categories/${editing.id}`, { name: form.name })
      : api.post('/api/polyvalence/admin/categories', {
          department_id: form.department_id,
          name: form.name,
        });
  }
  if (kind === 'skill') {
    const payload = {
      department_id: form.department_id,
      category_id: form.category_id || null,
      name: form.name,
      description: form.description || null,
    };
    const saved = editing?.id
      ? await api.put<PolyvalenceSkill>(`/api/polyvalence/admin/skills/${editing.id}`, {
          category_id: payload.category_id,
          name: payload.name,
          description: payload.description,
        })
      : await api.post<PolyvalenceSkill>('/api/polyvalence/admin/skills', payload);
    return api.put(`/api/polyvalence/admin/skills/${saved.id}/trainings`, {
      video_ids: form.training_ids || [],
    });
  }
  if (kind === 'membership') {
    return api.put('/api/polyvalence/admin/memberships', {
      user_id: form.user_id,
      department_id: form.department_id || null,
      role_id: form.role_id || null,
      evaluator_user_id: form.evaluator_user_id || null,
      is_active: form.is_active !== false,
    });
  }
  if (kind === 'target') {
    return api.put('/api/polyvalence/admin/targets', {
      skill_id: form.skill_id,
      role_id: form.role_id,
      target_level: form.target_level,
      criticality: form.criticality || 'normal',
      min_qualified_count: form.min_qualified_count || 1,
    });
  }
  if (kind === 'schedule') {
    const saved = await api.put<{ id: number }>('/api/polyvalence/admin/schedules', {
      department_id: form.department_id,
      frequency_months: form.frequency_months || 12,
      next_start_date: form.next_start_date || '',
      duration_days: form.duration_days || 30,
      reminder_days: form.reminder_days || '7,3,1',
      is_active: form.is_active !== false,
    });
    try {
      const result = await api.post<{
        errors: Array<{ schedule_id?: number; message: string }>;
        blocked?: Array<{ schedule_id?: number; message: string }>;
      }>('/api/polyvalence/admin/schedules/run', {});
      return {
        scheduleActivationErrors: [...result.errors, ...(result.blocked || [])]
          .filter((error) => error.schedule_id === saved.id)
          .map((error) => error.message),
      };
    } catch (error) {
      return {
        scheduleActivationErrors: [
          error instanceof Error ? error.message : 'Otomatik dönem kontrolü yapılamadı.',
        ],
      };
    }
  }
  return api.put(`/api/polyvalence/admin/levels/${form.level_value}`, {
    label: form.label,
    description: form.description || null,
    color: form.color || null,
  });
}

export function PolyvalenceFormModal(props: Props) {
  const feedback = useAppFeedback();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const departments = props.setup.departments.filter((item) => !boolValue(item.is_archived));

  useEffect(() => {
    setForm(
      getInitialForm(
        props.kind,
        props.editing,
        props.setup,
        props.definitionDepartmentId,
        props.targetDepartmentId,
      ),
    );
  }, [
    props.kind,
    props.editing,
    props.setup,
    props.definitionDepartmentId,
    props.targetDepartmentId,
  ]);

  const mutation = useMutation({
    mutationFn: () => saveForm(props.kind, props.editing, form),
    onSuccess: async (result) => {
      props.onClose();
      await props.onSaved();
      if (props.kind === 'schedule' && result && typeof result === 'object'
        && 'scheduleActivationErrors' in result) {
        const errors = result.scheduleActivationErrors as string[];
        if (errors.length) {
          const message = `Takvim kaydedildi ancak değerlendirme açılamadı: ${errors.join('; ')}`;
          props.onError(message);
          feedback.notifyError(message);
        }
      }
    },
    onError: (error) =>
      props.onError(error instanceof Error ? error.message : 'Kayıt işlemi başarısız'),
  });
  const setField = (key: string, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));
  const title =
    props.editing && ['department', 'role', 'category', 'skill'].includes(props.kind)
      ? titles[props.kind].replace('Yeni', '').trim() + ' Düzenle'
      : titles[props.kind];

  return (
    <PolyvalenceModal title={title} onClose={props.onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="poly-form"
      >
        <PolyvalenceFields
          kind={props.kind}
          editing={props.editing}
          form={form}
          setup={props.setup}
          departments={departments}
          targetDepartmentId={props.targetDepartmentId}
          setField={setField}
          setForm={setForm}
        />
        {mutation.error && <div className="poly-inline-error" role="alert">{mutation.error.message}</div>}
        <footer className="poly-modal-actions">
          <button type="button" className="btn-cancel" onClick={props.onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn-primary poly-command" disabled={mutation.isPending}>
            {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </footer>
      </form>
    </PolyvalenceModal>
  );
}

type FieldsProps = {
  kind: ModalKind;
  editing: Record<string, unknown> | null;
  form: Record<string, unknown>;
  setup: SetupResponse;
  departments: SetupResponse['departments'];
  targetDepartmentId: number;
  setField: (key: string, value: unknown) => void;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

function PolyvalenceFields(props: FieldsProps) {
  const { kind, editing, form, setup, departments, targetDepartmentId, setField, setForm } = props;
  const activeRoles = (departmentId: unknown) =>
    setup.roles.filter(
      (item) => item.department_id === Number(departmentId) && !boolValue(item.is_archived),
    );
  const activeSkills = (departmentId: unknown) =>
    setup.skills.filter(
      (item) => Number(item.department_id) === Number(departmentId) && !boolValue(item.is_archived),
    );

  if (kind === 'period') {
    return (
      <>
        <label>Bölüm<select value={String(form.department_id || '')} onChange={(e) => setField('department_id', Number(e.target.value))} required>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Dönem adı<input value={String(form.name || '')} onChange={(e) => setField('name', e.target.value)} required /></label>
        <div className="poly-form-grid">
          <label>Başlangıç<input type="date" value={String(form.start_date || '')} onChange={(e) => setField('start_date', e.target.value)} required /></label>
          <label>Bitiş<input type="date" value={String(form.end_date || '')} onChange={(e) => setField('end_date', e.target.value)} required /></label>
        </div>
        <label>Değerlendirme son tarihi<input type="date" value={String(form.due_date || '')} onChange={(e) => setField('due_date', e.target.value)} required /></label>
      </>
    );
  }
  if (kind === 'department') {
    return <><label>Bölüm adı<input value={String(form.name || '')} onChange={(e) => setField('name', e.target.value)} required /></label><label>Kullanıcı kayıtlarındaki bölüm adı<input value={String(form.source_department_name || '')} onChange={(e) => setField('source_department_name', e.target.value)} placeholder="Örn. Üretim" /></label></>;
  }
  if (kind === 'role' || kind === 'category') {
    return <><label>Bölüm<select aria-label="Bölüm" value={String(form.department_id || '')} onChange={(e) => setField('department_id', Number(e.target.value))} disabled={Boolean(editing)} required>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{kind === 'role' ? 'Pozisyon profili' : 'Kategori adı'}<input value={String(form.name || '')} onChange={(e) => setField('name', e.target.value)} required /></label></>;
  }
  if (kind === 'skill') {
    const values = Array.isArray(form.training_ids) ? (form.training_ids as number[]) : [];
    return <><div className="poly-form-grid"><label>Bölüm<select value={String(form.department_id || '')} onChange={(e) => setForm((current) => ({ ...current, department_id: Number(e.target.value), category_id: '' }))} disabled={Boolean(editing)} required>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Kategori<select value={String(form.category_id || '')} onChange={(e) => setField('category_id', Number(e.target.value) || '')}><option value="">Genel</option>{setup.categories.filter((item) => item.department_id === Number(form.department_id) && !boolValue(item.is_archived)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label>Beceri adı<input value={String(form.name || '')} onChange={(e) => setField('name', e.target.value)} required /></label><label>Açıklama<textarea value={String(form.description || '')} onChange={(e) => setField('description', e.target.value)} rows={3} /></label><fieldset className="poly-training-links"><legend><Link2 size={16} /> İlişkili eğitimler (isteğe bağlı)</legend>{setup.videos.map((video) => <label key={video.id}><input type="checkbox" checked={values.includes(video.id)} onChange={(e) => setField('training_ids', e.target.checked ? [...values, video.id] : values.filter((id) => id !== video.id))} /><span>{video.title}<small>{video.category || 'Kategori yok'}</small></span></label>)}{!setup.videos.length && <p>Henüz eğitim bulunmuyor.</p>}</fieldset></>;
  }
  if (kind === 'membership') {
    return <PolyvalenceMembershipFields editing={editing as Membership | null} form={form} setup={setup} departments={departments} setField={setField} setForm={setForm} />;
  }
  if (kind === 'target') {
    const departmentId = form.department_id || targetDepartmentId;
    return <><label>Bölüm<select value={String(departmentId || '')} onChange={(e) => { const id = Number(e.target.value); setForm((current) => ({ ...current, department_id: id, skill_id: activeSkills(id)[0]?.id || '', role_id: activeRoles(id)[0]?.id || '' })); }} required>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Beceri<select value={String(form.skill_id || '')} onChange={(e) => setField('skill_id', Number(e.target.value))} required>{activeSkills(departmentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Pozisyon profili<select value={String(form.role_id || '')} onChange={(e) => setField('role_id', Number(e.target.value))} required><option value="">Seçiniz</option>{activeRoles(departmentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="poly-form-grid"><label>Hedef seviye<select value={String(form.target_level ?? 2)} onChange={(e) => setField('target_level', Number(e.target.value))}>{[0, 1, 2, 3].map((level) => <option key={level} value={level}>{level}</option>)}</select></label><label>Asgari yetkin kişi<input type="number" min="1" value={String(form.min_qualified_count ?? 1)} onChange={(e) => setField('min_qualified_count', Number(e.target.value))} /></label></div><label>Kritiklik<select value={String(form.criticality || 'normal')} onChange={(e) => setField('criticality', e.target.value)}><option value="normal">Standart</option><option value="critical">Kritik beceri</option></select></label></>;
  }
  if (kind === 'schedule') {
    return <><label>Bölüm<select aria-label="Bölüm" value={String(form.department_id || '')} onChange={(e) => setField('department_id', Number(e.target.value))} disabled={Boolean(editing)}>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="poly-form-grid"><label>Değerlendirme sıklığı<select value={String(form.frequency_months ?? 12)} onChange={(e) => setField('frequency_months', Number(e.target.value))}><option value="12">Yılda 1 kez</option><option value="6">Yılda 2 kez</option><option value="3">3 ayda bir</option><option value="1">Her ay</option></select></label><label>Değerlendirme süresi (gün)<input type="number" min="1" value={String(form.duration_days ?? 30)} onChange={(e) => setField('duration_days', Number(e.target.value))} /></label></div><label>İlk değerlendirme başlangıcı<input type="date" value={String(form.next_start_date || '').slice(0, 10)} onChange={(e) => setField('next_start_date', e.target.value)} /></label><label>Hatırlatma günleri<input value={String(form.reminder_days || '7,3,1')} onChange={(e) => setField('reminder_days', e.target.value)} placeholder="7,3,1" /></label></>;
  }
  return <><div className="poly-level-edit-badge" style={levelColorStyle(form.color)}>{String(form.level_value)}</div><label>Seviye adı<input value={String(form.label || '')} onChange={(e) => setField('label', e.target.value)} required /></label><label>Açıklama<textarea value={String(form.description || '')} onChange={(e) => setField('description', e.target.value)} rows={3} /></label><label>Renk<input type="color" value={String(form.color || '#2563eb')} onChange={(e) => setField('color', e.target.value)} /></label></>;
}
