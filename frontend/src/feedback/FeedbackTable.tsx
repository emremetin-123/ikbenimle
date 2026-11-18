import { ChevronRight, FileText, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { dateText, feedbackStatus, feedbackStatuses, roleText, statusText, typeKey, typeText, type FeedbackItem } from './feedbackModel';

export function FeedbackTable({ items, title, mode = 'mine', userId, onSelect, selectedId, busy = false, activeStatus, onFilterChange, actions }: {
    items: FeedbackItem[]; title: string; mode?: 'mine' | 'participating' | 'admin'; userId?: number;
    onSelect: (item: FeedbackItem) => void; selectedId?: number | null; busy?: boolean; activeStatus?: string;
    onFilterChange?: (filters: { search: string; type: string; status: string }) => void;
    actions?: ReactNode;
}) {
    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [localStatus, setStatus] = useState('');
    const status = activeStatus ?? localStatus;
    const [role, setRole] = useState('');
    const changeFilter = (key: 'search' | 'type' | 'status', value: string) => {
        if (key === 'search') setSearch(value);
        if (key === 'type') setType(value);
        if (key === 'status' && activeStatus === undefined) setStatus(value);
        onFilterChange?.({ search, type, status, [key]: value });
    };
    const filtered = items.filter(item => (!type || typeKey(item.type) === type)
        && (!status || feedbackStatus(item) === status)
        && (!role || roleText(item, userId) === role)
        && `${item.id} ${item.title} ${item.content} ${item.user_name || ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
    return <section className="fb-card fb-list" aria-label={title}>
        <div className="fb-section-heading"><h2>{title}</h2><div className="fb-section-heading-actions"><span className="fb-muted">{filtered.length} kayıt</span>{actions}</div></div>
        <div className="fb-filters">
            <label className="fb-search"><Search size={18} aria-hidden="true" /><input aria-label="Taleplerde ara" placeholder="Talep veya konu ara…" value={search} onChange={e => changeFilter('search', e.target.value)} /></label>
            <label><span className="sr-only">Tür</span><select aria-label="Tür" value={type} onChange={e => changeFilter('type', e.target.value)}><option value="">Tür: Tümü</option><option value="suggestion">Öneri</option><option value="complaint">Şikâyet</option></select></label>
            <label><span className="sr-only">Durum</span><select aria-label="Durum" value={status} onChange={e => changeFilter('status', e.target.value)}><option value="">Durum: Tümü</option>{feedbackStatuses.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
            {mode === 'participating' && <label><span className="sr-only">Rolüm</span><select aria-label="Rolüm" value={role} onChange={e => setRole(e.target.value)}><option value="">Rolüm: Tümü</option><option>Sorumlu</option><option>Katılımcı</option></select></label>}
        </div>
        <table className="fb-table">
            <thead><tr><th>Talep No</th><th>Tür</th><th>Konu</th>{mode === 'participating' && <><th>Gönderen</th><th>Rolüm</th></>}<th>Durum</th>{mode !== 'admin' && <th>Son işlem</th>}<th><span className="sr-only">Detay</span></th></tr></thead>
            <tbody>{filtered.map(item => <tr key={item.id} className={selectedId === item.id ? 'fb-selected' : ''}>
                <td data-label="Talep No">#{item.id}</td><td data-label="Tür"><span className={`fb-pill fb-${typeKey(item.type)}`}>{typeText(item.type)}</span></td>
                <td data-label="Konu" className="fb-subject"><button type="button" disabled={busy} onClick={() => onSelect(item)}>{item.title}</button>{mode === 'admin' && <><small>Gönderen: {item.user_name || 'Anonim'}</small><small>{item.assigned_to_name ? `Sorumlu: ${item.assigned_to_name}` : 'Atama bekliyor'}</small></>}</td>
                {mode === 'participating' && <td data-label="Gönderen">{item.user_name || 'Anonim'}</td>}
                {mode === 'participating' && <td data-label="Rolüm"><span className="fb-pill fb-role">{roleText(item, userId)}</span></td>}
                <td data-label="Durum"><span className={`fb-pill fb-state-${feedbackStatus(item)}`}>{statusText(feedbackStatus(item))}</span></td>
                {mode !== 'admin' && <td data-label="Son işlem">{dateText(item.updated_at || item.created_at, true)}</td>}
                <td className="fb-open"><button type="button" className="fb-icon-button" aria-label={`#${item.id} ${item.title} detayını aç`} disabled={busy} onClick={() => onSelect(item)}><ChevronRight size={19} /></button></td>
            </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="fb-empty"><FileText size={28} aria-hidden="true" /><h3>{items.length ? 'Aramanıza uygun talep yok' : 'Henüz kayıt yok'}</h3><p>{items.length ? 'Arama veya filtrelerinizi değiştirebilirsiniz.' : 'Talepleriniz burada listelenecek.'}</p></div>}
        <p className="fb-list-count">Toplam {filtered.length} talep</p>
    </section>;
}
