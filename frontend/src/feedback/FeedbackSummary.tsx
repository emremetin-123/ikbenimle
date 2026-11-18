import { Download } from 'lucide-react';
import { API_BASE } from '../config';
import { detailsOf, typeText, typeKey, type FeedbackItem } from './feedbackModel';

export function FeedbackSummary({ item, own = false }: { item: FeedbackItem; own?: boolean }) {
    const details = detailsOf(item);
    return <section className="fb-card fb-summary">
        <div className="fb-section-heading"><h2>{own ? 'Talebim' : 'Talebin özeti'}</h2><span className={`fb-pill fb-${typeKey(item.type)}`}>{typeText(item.type)}</span></div>
        {details ? <dl className="fb-fields">
            <div><dt>İlgili birim</dt><dd>{details.department || item.assigned_department || '—'}</dd></div>
            <div><dt>Mevcut durum</dt><dd>{details.currentSituation || '—'}</dd></div>
            <div><dt>{own ? 'Önerdiğim çözüm' : 'Önerilen çözüm'}</dt><dd>{details.proposedSituation || '—'}</dd></div>
            <div><dt>Kategori</dt><dd>{details.category || '—'}</dd></div>
            {(details.investment || details.estimatedCost) && <div><dt>Yatırım / Öngörülen tutar</dt><dd>{details.investment || '—'} / {details.estimatedCost || '—'}</dd></div>}
        </dl> : <p className="fb-prose">{item.content}</p>}
        {item.file_path && <a className="fb-attachment" href={item.file_path.startsWith('http') ? item.file_path : `${API_BASE}${item.file_path}`} target="_blank" rel="noopener noreferrer"><Download size={18} /> Ek dosyayı aç</a>}
        {item.public_response && <div className="fb-response"><h3>Resmi yanıt</h3><p>{item.public_response}</p></div>}
    </section>;
}
