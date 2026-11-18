import { Plus, Trash2 } from 'lucide-react';
import type { ProfileEducationEntry } from '../../types';

type Props = {
  entries: ProfileEducationEntry[];
  onChange: (entries: ProfileEducationEntry[]) => void;
};

const emptyEntry = (): ProfileEducationEntry => ({ school: '', department: '', start_year: null, end_year: null, is_current: false });
const yearValue = (value?: number | null) => value ? String(value) : '';
const parseYear = (value: string) => value ? Number(value) : null;

export const ProfileEducationEditor = ({ entries, onChange }: Props) => {
  const patch = (index: number, value: Partial<ProfileEducationEntry>) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...value } : entry));
  };

  return (
    <div className="profile-education-editor">
      <div className="profile-education-editor-heading">
        <div><h3>Eğitim Bilgileri</h3><p>Okul ve bölüm bilgilerinizi ayrı kayıtlar halinde ekleyin.</p></div>
        <button type="button" className="btn-secondary" onClick={() => onChange([...entries, emptyEntry()])}><Plus size={16} aria-hidden="true" /> Eğitim Ekle</button>
      </div>
      {entries.length === 0 && <button type="button" className="profile-education-empty" onClick={() => onChange([emptyEntry()])}><Plus size={18} aria-hidden="true" /> İlk eğitim kaydını ekle</button>}
      {entries.map((entry, index) => (
        <fieldset className="profile-education-entry" key={entry.id || index}>
          <legend>{index + 1}. Eğitim</legend>
          <button type="button" className="btn-icon profile-education-remove" aria-label={`${index + 1}. eğitim kaydını sil`} onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}><Trash2 size={17} aria-hidden="true" /></button>
          <label><span className="input-label">Okul</span><input className="form-control" required maxLength={200} value={entry.school} onChange={(event) => patch(index, { school: event.target.value })} /></label>
          <label><span className="input-label">Bölüm</span><input className="form-control" maxLength={200} value={entry.department || ''} onChange={(event) => patch(index, { department: event.target.value })} /></label>
          <div className="profile-education-years">
            <label><span className="input-label">Başlangıç</span><input className="form-control" type="number" min="1900" max="2200" value={yearValue(entry.start_year)} onChange={(event) => patch(index, { start_year: parseYear(event.target.value) })} /></label>
            <label><span className="input-label">Bitiş</span><input className="form-control" type="number" min="1900" max="2200" disabled={entry.is_current} value={yearValue(entry.end_year)} onChange={(event) => patch(index, { end_year: parseYear(event.target.value) })} /></label>
          </div>
          <label className="profile-current-education"><input type="checkbox" checked={entry.is_current} onChange={(event) => patch(index, { is_current: event.target.checked, end_year: event.target.checked ? null : entry.end_year })} />Eğitim devam ediyor</label>
        </fieldset>
      ))}
    </div>
  );
};
