import { Download, Save, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import type { DocumentRequest, DocumentRequestStatus } from '../types';

type Props = {
  request: DocumentRequest;
  status: DocumentRequestStatus;
  statuses: DocumentRequestStatus[];
  hrNote: string;
  answerLabel: (request: DocumentRequest, key: string) => string;
  fileHref: (path?: string | null) => string;
  onStatusChange: (status: DocumentRequestStatus) => void;
  onHrNoteChange: (note: string) => void;
  onFileChange: (file: File | null) => void;
  onClose: () => void;
  onSave: () => void;
};

export function DocumentRequestModal({
  request,
  status,
  statuses,
  hrNote,
  answerLabel,
  fileHref,
  onStatusChange,
  onHrNoteChange,
  onFileChange,
  onClose,
  onSave,
}: Props) {
  return (
    <ModalShell onClose={onClose} labelledBy="admin-document-request-title" className="admin-action-modal">
      <div className="admin-modal-header">
        <h3 id="admin-document-request-title" className="document-reset-margin">{request.type_name}</h3>
        <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat"><X size={18} /></button>
      </div>
      <div className="admin-document-modal-content">
        <div className="document-muted-text">{request.user_name} ({request.employee_id}) - {request.department || '-'}</div>
        <div className="admin-document-answer-list">
          {Object.entries(request.answers || {}).map(([key, value]) => (
            <div key={key}><strong>{answerLabel(request, key)}:</strong> {value || '-'}</div>
          ))}
        </div>
        <div className="input-group">
          <label className="input-label">Durum</label>
          <select className="form-control" value={status} onChange={event => onStatusChange(event.target.value as DocumentRequestStatus)}>
            {statuses.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">İK Notu</label>
          <textarea className="form-control" rows={3} value={hrNote} onChange={event => onHrNoteChange(event.target.value)} placeholder="Kullanıcıya görünecek açıklama..." />
        </div>
        <div className="input-group">
          <label className="input-label">Hazırlanan Evrak</label>
          <input className="form-control" type="file" accept=".pdf,image/*" onChange={event => onFileChange(event.target.files?.[0] || null)} />
          {request.response_file_path && (
            <button type="button" className="document-secondary-button admin-document-open-file" onClick={() => window.open(fileHref(request.response_file_path), '_blank')}>
              <Download size={16} /> Mevcut evrağı aç
            </button>
          )}
        </div>
        <div className="admin-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Vazgeç</button>
          <button type="button" className="document-action-button" onClick={onSave}><Save size={17} /> Kaydet</button>
        </div>
      </div>
    </ModalShell>
  );
}
