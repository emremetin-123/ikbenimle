import { useEffect, useId, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { getPhotoUrl } from '../config';

type TrainingCoverUploadProps = {
  kind?: 'cover' | 'badge';
  file: File | null;
  currentUrl?: string;
  onChange: (file: File | null) => void;
  onRemoveCurrent: () => void;
};

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function TrainingCoverUpload({
  kind = 'cover',
  file,
  currentUrl,
  onChange,
  onRemoveCurrent,
}: TrainingCoverUploadProps) {
  const inputId = useId();
  const label = kind === 'badge' ? 'Rozet görseli' : 'Kapak görseli';
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl(getPhotoUrl(currentUrl));
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, currentUrl]);

  const selectFile = (selectedFile?: File) => {
    setError('');
    if (!selectedFile) return;
    if (!ACCEPTED_TYPES.has(selectedFile.type)) {
      setError('JPEG, PNG, GIF veya WebP formatında bir görsel seçin.');
      return;
    }
    if (selectedFile.size > MAX_COVER_SIZE) {
      setError(`${label} en fazla 10 MB olabilir.`);
      return;
    }
    onChange(selectedFile);
  };

  const removeCover = () => {
    setError('');
    if (file) {
      onChange(null);
      return;
    }
    onChange(null);
    onRemoveCurrent();
  };

  return (
    <div className={`training-cover-field${kind === 'badge' ? ' training-badge-field' : ''}`}>
      <div className="training-cover-preview">
        {previewUrl ? (
          <img src={previewUrl} alt={kind === 'badge' ? 'Rozet önizlemesi' : 'Eğitim kapak önizlemesi'} />
        ) : (
          <div className="training-cover-placeholder">
            <ImagePlus size={28} />
            <span>{label} seçilmedi</span>
          </div>
        )}
      </div>
      <div className="training-cover-content">
        <div>
          <strong>{label}{kind === 'badge' ? ' (zorunlu)' : ''}</strong>
          <p>JPEG, PNG, GIF veya WebP · En fazla 10 MB</p>
          {kind === 'badge' && <p>Yüklediğiniz tasarım profilde ve rehberde kullanılır. Kare, şeffaf PNG önerilir.</p>}
        </div>
        <div className="training-cover-actions">
          <input
            id={inputId}
            type="file"
            aria-label={label}
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
            hidden
          />
          <button type="button" onClick={() => document.getElementById(inputId)?.click()} className="btn-secondary training-cover-select" aria-label={`${label} ${previewUrl ? 'değiştir' : 'yükle'}`}>
            <Upload size={17} />
            {previewUrl ? 'Görseli Değiştir' : 'Dosya Seç'}
          </button>
          {previewUrl && (
            <button type="button" className="training-cover-remove" onClick={removeCover}>
              <Trash2 size={17} />
              Kaldır
            </button>
          )}
        </div>
        {file && <small className="training-cover-file-name">{file.name}</small>}
        {error && <small className="training-cover-error" role="alert">{error}</small>}
      </div>
    </div>
  );
}
