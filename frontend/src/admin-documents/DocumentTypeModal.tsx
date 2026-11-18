import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import { makeDocumentFieldKey, type DocumentTypeDraft } from './documentTypeSupport';

type Props = {
  editingTypeId: number | null;
  draft: DocumentTypeDraft;
  setDraft: Dispatch<SetStateAction<DocumentTypeDraft>>;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

export function DocumentTypeModal({ editingTypeId, draft, setDraft, onClose, onSubmit }: Props) {
  return (
    <ModalShell onClose={onClose} labelledBy="admin-document-type-title" className="admin-action-modal">
      <div className="admin-modal-header">
        <h3 id="admin-document-type-title" className="document-reset-margin">{editingTypeId ? 'Belge Türünü Düzenle' : 'Yeni Belge Türü'}</h3>
        <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat"><X size={18} /></button>
      </div>
      <form onSubmit={onSubmit} className="admin-document-type-form">
        <div className="responsive-grid-2">
          <div className="input-group document-form-field">
            <label className="input-label">Belge Türü Adı</label>
            <input className="form-control" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required />
          </div>
          <div className="input-group document-form-field">
            <label className="input-label">Sıra</label>
            <input className="form-control" type="number" value={draft.order_index} onChange={event => setDraft({ ...draft, order_index: Number(event.target.value) || 0 })} />
          </div>
        </div>
        <label className="admin-document-checkbox">
          <input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} /> Aktif
        </label>
        <div className="admin-document-fields">
          <strong>Form Alanları</strong>
          {draft.fields.map((field, index) => (
            <div key={index} className="document-field-row">
              <input className="form-control" value={field.label} onChange={event => {
                const next = [...draft.fields];
                next[index] = { ...next[index], label: event.target.value, field_key: makeDocumentFieldKey(event.target.value) };
                setDraft({ ...draft, fields: next });
              }} placeholder="Alan adı" />
              <select className="form-control" value={field.field_type} onChange={event => {
                const next = [...draft.fields];
                next[index] = { ...next[index], field_type: event.target.value };
                setDraft({ ...draft, fields: next });
              }}>
                <option value="text">Kısa metin</option>
                <option value="textarea">Uzun metin</option>
                <option value="date">Tarih</option>
                <option value="number">Sayı</option>
              </select>
              <label className="admin-document-required-field">
                <input type="checkbox" checked={Boolean(field.is_required)} onChange={event => {
                  const next = [...draft.fields];
                  next[index] = { ...next[index], is_required: event.target.checked };
                  setDraft({ ...draft, fields: next });
                }} /> Zorunlu
              </label>
              <button type="button" className="document-danger-button" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, itemIndex) => itemIndex !== index) })} title="Alanı sil"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" className="document-secondary-button admin-document-add-field" onClick={() => setDraft({ ...draft, fields: [...draft.fields, { label: '', field_key: '', field_type: 'text', is_required: false, placeholder: '' }] })}><Plus size={16} /> Alan Ekle</button>
        </div>
        <div className="admin-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Vazgeç</button>
          <button type="submit" className="document-action-button"><Save size={17} /> Kaydet</button>
        </div>
      </form>
    </ModalShell>
  );
}
