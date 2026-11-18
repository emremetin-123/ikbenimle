import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';

type Props = {
  id: string;
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
};

export const ProfileTagEditor = ({ id, label, values, placeholder, onChange }: Props) => {
  const [input, setInput] = useState('');

  const add = () => {
    const value = input.trim();
    if (!value || values.some((item) => item.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return;
    onChange([...values, value]);
    setInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    add();
  };

  return (
    <div className="profile-tag-editor">
      <label className="input-label" htmlFor={id}>{label}</label>
      <div className="profile-tag-input-row">
        <input id={id} className="form-control" value={input} placeholder={placeholder} maxLength={80} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} onBlur={add} />
        <button type="button" className="btn-secondary profile-tag-add" onClick={add} disabled={!input.trim()}>
          <Plus size={16} aria-hidden="true" /> Ekle
        </button>
      </div>
      {values.length > 0 && (
        <div className="profile-tag-list" aria-label={`${label} listesi`}>
          {values.map((value) => (
            <span className="profile-tag" key={value}>
              {value}
              <button type="button" aria-label={`${value} etiketini kaldır`} onClick={() => onChange(values.filter((item) => item !== value))}>
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
