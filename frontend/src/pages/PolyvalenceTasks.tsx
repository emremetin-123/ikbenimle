import { ModulePageHeader } from '../components/ModulePageHeader';
import { useEffect, useState } from 'react';
import { Award, Check, CheckCircle2, ChevronRight, ClipboardCheck, RefreshCw, Search, Target, X } from 'lucide-react';
import { api } from '../services/api';
import { ModalShell } from '../components/ModalShell';
import type { PolyvalenceAssessment, PolyvalenceLevelDefinition, PolyvalenceTaskDetail, PolyvalenceTaskMember, PolyvalenceTaskSummary } from '../types';
import { PolyvalenceEvaluationWorkspace } from '../admin-polyvalence/PolyvalenceEvaluationWorkspace';

type EditorState = { member: PolyvalenceTaskMember; assessment: PolyvalenceAssessment; level: number | null; can_train: boolean; note: string };
const defaultLevels = ['Bilgisi yok', 'Gelişmeli', 'Yeterli', 'Uzman'];
const statusLabel: Record<string, string> = { pending: 'Bekliyor', in_progress: 'Devam ediyor', completed: 'Tamamlandı' };

function AssessmentEditor({ state, levels, saving, error, onChange, onSave, onClose }: {
    state: EditorState; levels?: PolyvalenceLevelDefinition[]; saving: boolean; error: string;
    onChange: (next: EditorState) => void; onSave: () => void; onClose: () => void;
}) {
    return <ModalShell onClose={() => { if (!saving) onClose(); }} ariaLabel="Yetkinlik değerlendirmesi" className="poly-assessment-modal">
        <header className="poly-modal-header"><div><span>{state.member.name}</span><h3>{state.assessment.skill_name}</h3></div><button type="button" className="admin-modal-close" disabled={saving} onClick={onClose} aria-label="Kapat"><X size={18} /></button></header>
        <div className="poly-assessment-context"><span><Target size={16} /> Hedef: {state.assessment.target_level ?? 'Tanımsız'}</span><span>{state.assessment.category}</span></div>
        <fieldset className="poly-level-picker" disabled={saving}><legend>Yetkinlik seviyesi</legend>
            <button type="button" aria-pressed={state.level === null} className={state.level === null ? 'active empty' : ''} onClick={() => onChange({ ...state, level: null, can_train: false })}>—<small>Değerlendirilmedi</small></button>
            {[0, 1, 2, 3].map(level => <button type="button" key={level} aria-pressed={state.level === level} className={state.level === level ? 'active level-' + level : ''} onClick={() => onChange({ ...state, level, can_train: level === 3 ? state.can_train : false })}>{level}<small>{levels?.find(item => item.level_value === level)?.label || defaultLevels[level]}</small></button>)}
        </fieldset>
        <label className={'poly-trainer-toggle' + (state.level !== 3 ? ' disabled' : '')}><input type="checkbox" checked={state.can_train} disabled={state.level !== 3 || saving} onChange={event => onChange({ ...state, can_train: event.target.checked })} /><span><Award size={20} /><strong>Eğitim verebilir</strong><small>Yalnız seviye 3 için; değişiklikte açıklama zorunludur.</small></span></label>
        <label className="poly-editor-note">Değerlendirme açıklaması<textarea maxLength={4000} disabled={saving} rows={4} value={state.note} onChange={event => onChange({ ...state, note: event.target.value })} placeholder="Gözlem veya değişiklik gerekçesi…" /></label>
        {error && <div className="poly-inline-error" role="alert">{error}</div>}
        <footer className="poly-modal-actions"><button type="button" className="btn-cancel" disabled={saving} onClick={onClose}>Vazgeç</button><button type="button" className="btn-primary poly-command" disabled={saving} onClick={onSave}>{saving ? 'Kaydediliyor…' : <><Check size={17} /> Değerlendirmeyi kaydet</>}</button></footer>
    </ModalShell>;
}

export function PolyvalenceTasks() {
    const [tasks, setTasks] = useState<PolyvalenceTaskSummary[]>([]);
    const [detail, setDetail] = useState<PolyvalenceTaskDetail | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [taskSearch, setTaskSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editor, setEditor] = useState<EditorState | null>(null);
    const loadTasks = async () => {
        setLoading(true); setError('');
        try { setTasks(await api.get<PolyvalenceTaskSummary[]>('/api/polyvalence/my-tasks')); }
        catch (err) { setError(err instanceof Error ? err.message : 'Görevler yüklenemedi'); }
        finally { setLoading(false); }
    };
    useEffect(() => { void loadTasks(); }, []);
    const openTask = async (taskId: number) => {
        setLoading(true); setError('');
        try {
            const data = await api.get<PolyvalenceTaskDetail>('/api/polyvalence/tasks/' + taskId);
            setDetail(data); setSelectedMemberId(data.members[0]?.id || null);
        } catch (err) { setError(err instanceof Error ? err.message : 'Değerlendirme yüklenemedi'); }
        finally { setLoading(false); }
    };
    const isLocked = detail?.status === 'completed' || detail?.period_status !== 'open';
    const saveAssessmentValue = async (member: PolyvalenceTaskMember, assessment: PolyvalenceAssessment, next: { level: number | null; can_train: boolean; note: string }) => {
        if (!detail || isLocked || saving) return false;
        setSaving(true); setError('');
        try {
            const updated = await api.put<{ level_value?: number | null; can_train: boolean; note?: string | null; version_no: number; updated_at?: string }>(
                '/api/polyvalence/tasks/' + detail.id + '/assessments/' + assessment.id, { ...next, version_no: assessment.version_no });
            setDetail(current => {
                if (!current) return current;
                const members = current.members.map(item => item.id !== member.id ? item : { ...item, assessments: item.assessments.map(row => row.id !== assessment.id ? row : {
                    ...row, level: updated.level_value, can_train: updated.can_train, note: updated.note || '', version_no: updated.version_no, updated_at: updated.updated_at,
                }) });
                const flat = members.flatMap(item => item.assessments);
                const completed = flat.filter(item => item.level !== null && item.level !== undefined).length;
                return { ...current, status: current.status === 'pending' ? 'in_progress' : current.status, members, progress: { completed, total: flat.length, percent: flat.length ? Math.round(completed / flat.length * 100) : 0 } };
            });
            return true;
        } catch (err) { setError(err instanceof Error ? err.message : 'Değerlendirme kaydedilemedi'); return false; }
        finally { setSaving(false); }
    };
    const editAssessment = (member: PolyvalenceTaskMember, assessment: PolyvalenceAssessment) => {
        if (isLocked || saving) return;
        setError(''); setEditor({ member, assessment, level: assessment.level ?? null, can_train: assessment.can_train, note: assessment.note || '' });
    };
    const quickSave = (member: PolyvalenceTaskMember, assessment: PolyvalenceAssessment, next: { level: number | null; can_train: boolean; note: string }) => {
        const requiresReason = (assessment.level != null && next.level != null && next.level < assessment.level) || assessment.can_train !== next.can_train;
        if (requiresReason && !next.note.trim()) {
            setEditor({ member, assessment, ...next }); setError('Puan düşürme ve eğitim verebilir değişikliklerinde açıklama zorunludur.'); return;
        }
        void saveAssessmentValue(member, assessment, next);
    };
    const completeTask = async () => {
        if (!detail || isLocked || saving) return;
        setSaving(true); setError('');
        try {
            await api.post('/api/polyvalence/tasks/' + detail.id + '/complete');
            setDetail(current => current ? { ...current, status: 'completed' } : current);
            await loadTasks();
        } catch (err) { setError(err instanceof Error ? err.message : 'Görev tamamlanamadı'); }
        finally { setSaving(false); }
    };
    if (loading && !detail) return <div className="poly-loading"><RefreshCw className="spin" size={22} /> Değerlendirmeler hazırlanıyor…</div>;
    if (detail) return <section className="poly-task-page poly-workspace">
        <PolyvalenceEvaluationWorkspace detail={detail} selectedMemberId={selectedMemberId} saving={saving} loading={loading} error={editor ? '' : error}
            onSelectMember={setSelectedMemberId} onSave={quickSave} onEdit={editAssessment} onComplete={() => void completeTask()} onReload={() => void openTask(detail.id)}
            onExit={() => { setDetail(null); void loadTasks(); }} />
        {editor && <AssessmentEditor state={editor} levels={detail.levels} saving={saving} error={error} onChange={setEditor} onClose={() => { setEditor(null); setError(''); }} onSave={() => {
            void saveAssessmentValue(editor.member, editor.assessment, { level: editor.level, can_train: editor.can_train, note: editor.note }).then(saved => { if (saved) setEditor(null); });
        }} />}
    </section>;

    const filteredTasks = tasks.filter(task => !taskSearch || (task.period_name + ' ' + task.department_name + ' ' + statusLabel[task.status]).toLocaleLowerCase('tr-TR').includes(taskSearch.toLocaleLowerCase('tr-TR')));
    return <section className="poly-task-page poly-workspace">
        <ModulePageHeader title="Ekibimi Değerlendir" description="Yalnızca size atanan çalışanların değerlendirmeleri burada yer alır." icon={<ClipboardCheck />} tone="violet" />
        {error && <div className="poly-alert" role="alert">{error}<button type="button" onClick={() => void loadTasks()} aria-label="Görevleri yeniden yükle"><RefreshCw size={16} /></button></div>}
        <label className="poly-search-field"><Search size={18} /><input aria-label="Değerlendirme ara" value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Dönem veya bölüm ara…" /></label>
        <div className="poly-task-card-list">{filteredTasks.map(task => <button type="button" className={'poly-task-card ' + task.status} key={task.id} onClick={() => void openTask(task.id)}>
            <span className="poly-task-card-icon">{task.status === 'completed' ? <Check size={24} /> : <ClipboardCheck size={24} />}</span>
            <span className="poly-task-card-body"><span className="poly-task-card-status">{statusLabel[task.status]}</span><strong>{task.period_name}</strong><small>{task.department_name} · {task.member_count} çalışan · Son tarih {new Date(task.due_date).toLocaleDateString('tr-TR')}</small><progress className="poly-progress" max="100" value={task.progress_percent} aria-label="Değerlendirme ilerlemesi" /></span><ChevronRight size={20} />
        </button>)}</div>
        {!tasks.length && <div className="poly-empty"><CheckCircle2 size={30} /><h2>Atanmış değerlendirme bulunmuyor</h2><p>Yeni dönem göreviniz oluşturulduğunda burada görünecek.</p></div>}
        {tasks.length > 0 && !filteredTasks.length && <p className="poly-empty">Aramanıza uygun görev bulunamadı.</p>}
    </section>;
}
