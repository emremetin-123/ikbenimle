import { Trash2, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import { FormField } from '../components/FormField';

interface UserOptionModalProps {
  field: 'department' | 'position';
  value: string;
  options: string[];
  customOptions: string[];
  isInUse: (value: string) => boolean;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  onClose: () => void;
}

export function UserOptionModal({
  field,
  value,
  options,
  customOptions,
  isInUse,
  onValueChange,
  onAdd,
  onRemove,
  onClose,
}: UserOptionModalProps) {
  const label = field === 'department' ? 'Bölüm' : 'Pozisyon';

  const titleId = `admin-${field}-option-modal-title`;

  return (
    <ModalShell className="admin-option-modal" labelledBy={titleId} onClose={onClose}>
        <div className="admin-modal-header">
          <div>
            <h3 id={titleId} className="admin-option-title">Yeni {label} Ekle</h3>
            <p className="admin-option-description">
              Eklediğiniz değer listeye alınır ve formda seçili hale gelir.
            </p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
        <FormField controlId={`admin-${field}-option-name`} label={`${label} Adı`}>
          <input
            id={`admin-${field}-option-name`}
            className="form-control"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAdd();
              }
            }}
            autoFocus
          />
        </FormField>
        <div className="admin-option-list">
          <div className="admin-option-list-title">
            <strong>Kayıtlı seçenekler</strong>
            <small>Kullanımda olan değerler kullanıcı kartından düzeltilmelidir.</small>
          </div>
          {options.length ? options.map((option) => {
            const inUse = isInUse(option);
            const isCustom = customOptions.includes(option);
            const canDelete = isCustom && !inUse;
            return (
              <div className="admin-option-row" key={option}>
                <span>{option}<small>{inUse ? 'Kullanılıyor' : isCustom ? 'Özel seçenek' : 'Kayıtlı değer'}</small></span>
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => onRemove(option)}
                  disabled={!canDelete}
                  title={canDelete ? 'Seçeneği sil' : 'Kullanımda olan veya sistemden gelen değer silinemez'}
                  aria-label={`${option} seçeneğini sil`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          }) : <p className="admin-option-empty">Henüz seçenek bulunmuyor.</p>}
        </div>
        <div className="admin-modal-actions">
          <button type="button" className="btn-cancel admin-user-modal-secondary" onClick={onClose}>İptal</button>
          <button type="button" className="btn-primary admin-user-modal-primary" onClick={onAdd} disabled={!value.trim()}>Listeye Ekle</button>
        </div>
    </ModalShell>
  );
}
