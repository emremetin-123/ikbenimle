import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, MessageSquare, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type { PolyvalenceAssessment, PolyvalenceTaskDetail, PolyvalenceTaskMember } from '../types';
import { formatDate } from './utils';

type Props = {
  detail: PolyvalenceTaskDetail;
  selectedMemberId: number | null;
  saving: boolean;
  loading: boolean;
  error: string;
  onSelectMember: (id: number) => void;
  onSave: (member: PolyvalenceTaskMember, assessment: PolyvalenceAssessment, value: { level: number | null; can_train: boolean; note: string }) => void;
  onEdit: (member: PolyvalenceTaskMember, assessment: PolyvalenceAssessment) => void;
  onComplete: () => void;
  onReload: () => void;
  onExit: () => void;
};

export function PolyvalenceEvaluationWorkspace(props: Props) {
  const { detail, saving, loading } = props;
  const [memberSearch, setMemberSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [expanded, setExpanded] = useState(false);
  const triggers = useRef(new Map<number, HTMLButtonElement>());
  const locked = detail.status === 'completed' || detail.period_status !== 'open';
  const members = detail.members.map(member => {
    const count = member.assessments.filter(row => row.level != null).length;
    return { member, count, total: member.assessments.length, done: count > 0 && count === member.assessments.length };
  });
  const completed = members.filter(item => item.done).length;
  const visibleMembers = members.filter(item => (filter === 'all' || (filter === 'completed' ? item.done : !item.done)) &&
    (item.member.name + ' ' + (item.member.employee_id || '') + ' ' + (item.member.position || '')).toLocaleLowerCase('tr-TR').includes(memberSearch.toLocaleLowerCase('tr-TR')));
  const levelLabel = (level: number) => detail.levels?.find(item => item.level_value === level)?.label || ['Bilgisi yok', 'Gelişmeli', 'Yeterli', 'Uzman'][level];
  const selectMember = (id: number, focus = false) => {
    props.onSelectMember(id);
    setExpanded(true);
    if (focus) requestAnimationFrame(() => {
      const trigger = triggers.current.get(id);
      trigger?.focus({ preventScroll: true });
      trigger?.scrollIntoView({ block: 'nearest' });
    });
  };

  return <>
    <button type="button" className="poly-text-button poly-back-link" disabled={saving || loading} onClick={props.onExit}><ArrowLeft size={17} /> Değerlendirmelerime dön</button>
    <header className="poly-workspace-heading">
      <div><h1>{detail.department_name}</h1><p>{detail.period_name} · Son tarih {formatDate(detail.due_date)}</p></div>
      <div className="poly-completion"><strong>{completed} / {members.length} çalışan tamamlandı</strong><progress className="poly-progress" max={Math.max(members.length, 1)} value={completed} aria-label="Tamamlanan çalışan oranı" /></div>
    </header>
    {props.error && <div className="poly-alert" role="alert"><span>{props.error}</span><button type="button" disabled={saving || loading} onClick={props.onReload}><RefreshCw size={16} /> Yenile</button></div>}
    {locked && <p className="poly-notice"><CheckCircle2 size={18} /> {detail.period_status !== 'open' ? 'Bu dönem kapalı; değerlendirmeler salt okunur.' : 'Görev tamamlandı. Değişiklik için modül yöneticisinin görevi yeniden açması gerekir.'}</p>}
    <section className="poly-surface poly-evaluation-accordion" aria-busy={saving || loading}>
      <header className="poly-accordion-toolbar">
        <div><h2>Atanan çalışanlar</h2><p>Değerlendirmek için çalışan adına tıklayın.</p></div>
        <label className="poly-search-field"><Search size={17} /><input aria-label="Atanan çalışan ara" placeholder="Çalışan veya sicil ara…" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} /></label>
      </header>
      <div className="poly-employee-tabs" aria-label="Çalışan durumu">
        {([['all', 'Tümü', members.length], ['pending', 'Bekleyen', members.length - completed], ['completed', 'Tamamlanan', completed]] as const).map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}
      </div>
      <div className="poly-accordion-members">{visibleMembers.map(item => {
        const open = expanded && props.selectedMemberId === item.member.id;
        const index = visibleMembers.findIndex(row => row.member.id === item.member.id);
        const panelId = 'poly-member-panel-' + detail.id + '-' + item.member.id;
        const triggerId = panelId + '-toggle';
        const assessments = item.member.assessments;
        const categories = [...new Set(assessments.map(row => row.category || 'Genel'))];
        return <article className={'poly-accordion-member' + (open ? ' is-open' : '')} key={item.member.id}>
          <h3 className="poly-accordion-member-heading"><button type="button" ref={element => { if (element) triggers.current.set(item.member.id, element); else triggers.current.delete(item.member.id); }} id={triggerId} aria-expanded={open} aria-controls={panelId} disabled={saving || loading} onClick={() => open ? setExpanded(false) : selectMember(item.member.id)}>
            <span className="poly-accordion-member-copy"><strong>{item.member.name}</strong><small>{item.member.position || 'Pozisyon belirtilmemiş'} · Sicil {item.member.employee_id || '—'}</small></span>
            <span className={item.done ? 'poly-tag poly-tag-success' : 'poly-tag'}>{item.done ? 'Tamamlandı' : item.count ? 'Devam ediyor' : 'Başlamadı'} · {item.count}/{item.total}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button></h3>
          <div id={panelId} hidden={!open} className="poly-accordion-panel" role="region" aria-labelledby={triggerId}>
            {open && <>
              <div className="poly-compact-skills" role="region" aria-label={item.member.name + ' becerileri'} tabIndex={0}>
                {categories.map(category => <section className="poly-compact-category" key={category}><h4>{category}</h4>
                  {assessments.filter(row => (row.category || 'Genel') === category).map(row => <article className="poly-compact-assessment" key={row.id}>
                    <div className="poly-compact-skill-name"><h5>{row.skill_name}</h5><small className="poly-muted">Hedef: {row.target_level != null ? row.target_level + ' · ' + levelLabel(row.target_level) : 'Tanımlanmamış'}</small></div>
                    <div className="poly-rating-options poly-compact-rating" role="group" aria-label={row.skill_name + ' yetkinlik seviyesi'}>
                      {[0, 1, 2, 3].map(level => <button type="button" key={level} aria-label={level + ' ' + levelLabel(level)} title={level + ' · ' + levelLabel(level)} aria-pressed={row.level === level} disabled={locked || saving || loading} onClick={() => props.onSave(item.member, row, { level, can_train: level === 3 ? row.can_train : false, note: row.note || '' })}><strong>{level}</strong></button>)}
                    </div>
                    <div className="poly-compact-tools">
                      <button type="button" className="poly-text-button poly-compact-comment" disabled={locked || saving || loading} onClick={() => props.onEdit(item.member, row)} aria-label={row.skill_name + ' açıklamasını düzenle'} title={row.note ? 'Yorumu düzenle' : 'Yorum ekle'}><MessageSquare size={18} aria-hidden="true" /></button>
                      {row.level === 3 && <label className="poly-inline-checkbox"><input type="checkbox" checked={row.can_train} disabled={locked || saving || loading} onChange={event => props.onSave(item.member, row, { level: 3, can_train: event.target.checked, note: row.note || '' })} /> Eğitim verebilir</label>}
                    </div>
                    {row.note && <details className="poly-compact-note"><summary>Değerlendirme yorumu</summary><p>{row.note}</p></details>}
                  </article>)}
                </section>)}
                {!categories.length && <p className="poly-empty">Atanmış beceri bulunmuyor.</p>}
              </div>
              <footer className="poly-evaluation-footer">
                <div className="poly-table-actions">
                  <button type="button" className="btn-secondary poly-command" disabled={index <= 0 || saving || loading} onClick={() => selectMember(visibleMembers[index - 1].member.id, true)}><ArrowLeft size={16} /> Önceki çalışan</button>
                  <button type="button" className="btn-secondary poly-command" disabled={saving || loading} onClick={props.onExit}>Kaydedip çık</button>
                  {index < visibleMembers.length - 1 && <button type="button" className="btn-primary poly-command" disabled={saving || loading || (!locked && !item.done)} onClick={() => selectMember(visibleMembers[index + 1].member.id, true)}>Sonraki çalışan <ArrowRight size={16} /></button>}
                </div>
                <small className="poly-muted">{item.count} / {item.total} beceri değerlendirildi. Puan düşürme ve eğitim verebilir değişikliklerinde açıklama gerekir.</small>
              </footer>
            </>}
          </div>
        </article>;
      })}</div>
      {!visibleMembers.length && <p className="poly-empty">Bu filtrede çalışan bulunamadı.</p>}
    </section>
    {!locked && <section className="poly-surface poly-finalize"><div><h2>Değerlendirme görevini tamamla</h2><p className="poly-muted">Tüm çalışanların becerileri puanlandıktan sonra görevi tamamlayın. Tamamlama sonrasında düzenleme kilitlenir.</p></div><button type="button" className="btn-primary poly-command" disabled={saving || loading || !detail.progress.total || detail.progress.completed !== detail.progress.total} onClick={props.onComplete}><ShieldCheck size={17} /> Görevi tamamla</button></section>}
  </>;
}
