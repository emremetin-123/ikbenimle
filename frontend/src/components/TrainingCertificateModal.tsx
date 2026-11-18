import { useEffect, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import type { Video } from '../types';
import { api } from '../services/api';
import { ModalShell } from './ModalShell';
import { LoadingIndicator } from './LoadingIndicator';

type Props = { certificate: Video; onClose: () => void };

export function TrainingCertificateModal({ certificate, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const available = Boolean(certificate.assignment_id && certificate.reference_id
    && certificate.certificate_enabled !== 0 && certificate.certificate_enabled !== false);

  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    let objectUrl = '';
    api.download(`/api/assignment/${certificate.assignment_id}/certificate.pdf`, { signal: controller.signal })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Sertifika yüklenemedi.');
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [available, certificate.assignment_id, attempt]);

  return <ModalShell onClose={onClose} labelledBy="training-certificate-title" overlayClassName="training-certificate-overlay" surfaceClassName="training-certificate-modal">
    <header className="training-certificate-header">
      <div><h2 id="training-certificate-title">Eğitim Sertifikası</h2><p>{certificate.title}</p></div>
      <button type="button" className="btn-icon" aria-label="Sertifikayı kapat" onClick={onClose}><X size={20} /></button>
    </header>
    {!available ? <p className="training-certificate-state" role="status">Bu eğitim için onaylanmış bir sertifika bulunmuyor.</p>
      : error ? <div className="training-certificate-state"><p role="alert">{error}</p><button type="button" className="btn-secondary" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Tekrar Dene</button></div>
        : !url ? <div className="training-certificate-state"><LoadingIndicator label="Sertifika yükleniyor" /></div>
          : <>
            <div className="training-certificate-toolbar">
              <p>Önizleme açılmıyorsa sertifikayı yeni sekmede açabilir veya indirebilirsiniz.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary"><ExternalLink size={17} /> Yeni Sekmede Aç</a>
              <a href={url} download={`Sertifika_${certificate.reference_id}.pdf`} className="btn-primary"><Download size={17} /> PDF İndir</a>
            </div>
            <iframe src={url} title={`${certificate.title} sertifikası`} className="training-certificate-preview" />
          </>}
  </ModalShell>;
}
