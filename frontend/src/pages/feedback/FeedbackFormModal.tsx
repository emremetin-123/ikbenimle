import { type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AlertOctagon, FileText, Lightbulb, Send, Upload, X } from 'lucide-react';
import { ModalShell } from '../../components/ModalShell';
import { AiEditButton, CATEGORIES, DEPARTMENTS, type FormTab } from './feedbackSupport';

export type ComplaintForm = {
    title: string;
    content: string;
    is_anonymous: boolean;
};

export type SuggestionForm = {
    title: string;
    department: string;
    currentSituation: string;
    proposedSituation: string;
    category: string;
    investment: string;
    estimatedCost: string;
    is_anonymous: boolean;
    file: File | null;
};

type FeedbackFormModalProps = {
    open: boolean;
    busy?: boolean;
    formTab: FormTab;
    status: string | null;
    aiLoading: string | null;
    complaintForm: ComplaintForm;
    suggestionForm: SuggestionForm;
    setComplaintForm: Dispatch<SetStateAction<ComplaintForm>>;
    setSuggestionForm: Dispatch<SetStateAction<SuggestionForm>>;
    onClose: () => void;
    onComplaintSubmit: (event: FormEvent) => void;
    onSuggestionSubmit: (event: FormEvent) => void;
    improveText: (field: string, text: string, context: string, apply: (value: string) => void) => void;
};

export const FeedbackFormModal = ({
    open,
    busy = false,
    formTab,
    status,
    aiLoading,
    complaintForm,
    suggestionForm,
    setComplaintForm,
    setSuggestionForm,
    onClose,
    onComplaintSubmit,
    onSuggestionSubmit,
    improveText,
}: FeedbackFormModalProps) => {
    if (!open) return null;

    return (
        <ModalShell
            className="admin-action-modal employee-feedback-form-modal"
            labelledBy="employee-feedback-modal-title"
            onClose={onClose}
        >
                <div className="admin-modal-header employee-feedback-modal-header">
                    <div>
                        <h3 id="employee-feedback-modal-title">
                            {formTab === 'sikayet'
                                ? <><AlertOctagon size={22} /> Şikayet Bildir</>
                                : <><Lightbulb size={22} /> Öneri Formu</>}
                        </h3>
                        <p>{formTab === 'sikayet'
                            ? 'Yaşadığınız durumu güvenle ve ayrıntılı biçimde iletin.'
                            : 'Fikrinizi mevcut ve önerilen durumla birlikte paylaşın.'}</p>
                    </div>
                    <button type="button" className="admin-modal-close" disabled={busy || aiLoading !== null} onClick={onClose} title="Kapat" aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>

                {status && <div className="feedback-status-message" role="status">{status}</div>}
                <fieldset className="fb-form-fields" disabled={busy || aiLoading !== null}>

                {formTab === 'sikayet' ? (
                    <form className="employee-feedback-form" onSubmit={onComplaintSubmit}>
                        <p>Şirket içi yaşadığınız bir sorunu veya şikayetinizi buradan güvenle iletebilirsiniz.</p>
                        <label className="employee-feedback-check">
                            <input type="checkbox" checked={complaintForm.is_anonymous} onChange={(event) => setComplaintForm(previous => ({ ...previous, is_anonymous: event.target.checked }))} />
                            <span>Anonim Gönder</span>
                        </label>
                        <div className="input-group">
                            <label className="input-label" htmlFor="fb-complaint-title">Konu Başlığı</label>
                            <input id="fb-complaint-title" type="text" maxLength={255} required value={complaintForm.title} onChange={(event) => setComplaintForm(previous => ({ ...previous, title: event.target.value }))} className="form-control" placeholder="Şikayetinizi kısaca özetleyin" />
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="fb-complaint-content">Şikayetiniz / Mesajınız</label>
                            <div className="feedback-ai-action-row">
                                <AiEditButton field="complaint-content" activeField={aiLoading} onClick={() => improveText('complaint-content', complaintForm.content, 'şikayet metni', value => setComplaintForm(previous => ({ ...previous, content: value })))} />
                            </div>
                            <textarea id="fb-complaint-content" maxLength={10000} required value={complaintForm.content} onChange={(event) => setComplaintForm(previous => ({ ...previous, content: event.target.value }))} rows={8} className="form-control" placeholder="Detaylı geri bildiriminizi buraya yazabilirsiniz" />
                        </div>
                        <button type="submit" className="btn-primary employee-feedback-submit complaint-submit"><Send size={20} /> {busy ? 'Gönderiliyor…' : 'Şikayeti Gönder'}</button>
                    </form>
                ) : (
                    <form className="employee-feedback-form" onSubmit={onSuggestionSubmit}>
                        <p>İş süreçlerimizi daha iyi hale getirecek her türlü fikir bizim için değerlidir.</p>
                        <label className="input-group">Konu Başlığı<input className="form-control" required maxLength={255} value={suggestionForm.title} onChange={e => setSuggestionForm(previous => ({ ...previous, title: e.target.value }))} placeholder="Önerinizi kısaca özetleyin" /></label>
                        <div className="employee-feedback-department-row">
                            <div className="input-group">
                                <label className="input-label" htmlFor="fb-suggestion-department">İlgili Müdürlük</label>
                                <select id="fb-suggestion-department" required value={suggestionForm.department} onChange={(event) => setSuggestionForm(previous => ({ ...previous, department: event.target.value }))} className="form-control">
                                    <option value="">Seçiniz...</option>
                                    {DEPARTMENTS.map(department => <option key={department} value={department}>{department}</option>)}
                                </select>
                            </div>
                            <label className="employee-feedback-check">
                                <input type="checkbox" checked={suggestionForm.is_anonymous} onChange={(event) => setSuggestionForm(previous => ({ ...previous, is_anonymous: event.target.checked }))} />
                                <span>Anonim Gönder</span>
                            </label>
                        </div>

                        <div className="employee-feedback-situation-grid">
                            <div className="input-group">
                                <label className="input-label" htmlFor="fb-current-situation">Önce (Mevcut Durum)</label>
                                <div className="feedback-ai-action-row">
                                    <AiEditButton field="suggestion-current" activeField={aiLoading} onClick={() => improveText('suggestion-current', suggestionForm.currentSituation, 'öneri formu mevcut durum açıklaması', value => setSuggestionForm(previous => ({ ...previous, currentSituation: value })))} />
                                </div>
                                <textarea id="fb-current-situation" maxLength={5000} required value={suggestionForm.currentSituation} onChange={(event) => setSuggestionForm(previous => ({ ...previous, currentSituation: event.target.value }))} rows={4} className="form-control" placeholder="Şu anki işleyiş/durum nasıl?" />
                            </div>
                            <div className="input-group">
                                <label className="input-label" htmlFor="fb-proposed-situation">Sonra (Önerilen Durum)</label>
                                <div className="feedback-ai-action-row">
                                    <AiEditButton field="suggestion-proposed" activeField={aiLoading} onClick={() => improveText('suggestion-proposed', suggestionForm.proposedSituation, 'öneri formu önerilen durum açıklaması', value => setSuggestionForm(previous => ({ ...previous, proposedSituation: value })))} />
                                </div>
                                <textarea id="fb-proposed-situation" maxLength={5000} required value={suggestionForm.proposedSituation} onChange={(event) => setSuggestionForm(previous => ({ ...previous, proposedSituation: event.target.value }))} rows={4} className="form-control" placeholder="Sizin öneriniz nedir? Ne değişmeli?" />
                            </div>
                        </div>

                        <div>
                            <span className="input-label">Öneri Kategorisi</span>
                            <div className="employee-feedback-category-grid">
                                {CATEGORIES.map(category => (
                                    <label key={category} className={`employee-feedback-category ${suggestionForm.category === category ? 'active' : ''}`}>
                                        <input type="radio" name="suggestion_category" value={category} checked={suggestionForm.category === category} onChange={(event) => setSuggestionForm(previous => ({ ...previous, category: event.target.value }))} required />
                                        {category}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="employee-feedback-investment-grid">
                            <div className="input-group">
                                <label className="input-label" htmlFor="fb-investment">Yapılacak Yatırım Açıklaması</label>
                                <input id="fb-investment" maxLength={2000} type="text" value={suggestionForm.investment} onChange={(event) => setSuggestionForm(previous => ({ ...previous, investment: event.target.value }))} className="form-control" placeholder="Yeni ekipman, yazılım vb." />
                            </div>
                            <div className="input-group">
                                <label className="input-label" htmlFor="fb-estimated-cost">Öngörülen Tutar</label>
                                <input id="fb-estimated-cost" maxLength={255} type="text" value={suggestionForm.estimatedCost} onChange={(event) => setSuggestionForm(previous => ({ ...previous, estimatedCost: event.target.value }))} className="form-control" placeholder="Örn: 10.000 TL" />
                            </div>
                        </div>

                        <div className="employee-feedback-upload-wrap">
                            <label htmlFor="file-upload" className="input-label"><Upload size={18} /> Destekleyici Dosyalar</label>
                            <input type="file" id="file-upload" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setSuggestionForm(previous => ({ ...previous, file: event.target.files?.[0] || null }))} />
                            <label htmlFor="file-upload" className="employee-feedback-upload">
                                <FileText size={30} />
                                <strong>{suggestionForm.file ? suggestionForm.file.name : 'Dosya yüklemek için tıklayın'}</strong>
                                <span>PDF, PNG, JPG (Maks. 10MB)</span>
                            </label>
                        </div>

                        <button type="submit" className="btn-primary employee-feedback-submit"><Send size={20} /> {busy ? 'Gönderiliyor…' : 'Önerimi Şirkete Sun'}</button>
                    </form>
                )}
                </fieldset>
        </ModalShell>
    );
};
