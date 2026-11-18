import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Calendar, Droplet, GraduationCap, Heart, Mail, MapPin, Pencil, Phone,
  PhoneCall, Save, Shirt, Star, User, X,
} from 'lucide-react';
import type { Profile } from '../../types';
import { ProfileEducationEditor } from './ProfileEducationEditor';
import { ProfileTagEditor } from './ProfileTagEditor';

type Section = 'contact' | 'about' | 'details';
type Props = { profile: Profile; saving: boolean; onSave: (profile: Profile) => Promise<boolean> };
type CardProps = {
  id: Section; title: string; icon: ReactNode; editing: boolean; saving: boolean;
  onEdit: () => void; onCancel: () => void; children: ReactNode;
};

const SectionCard = ({ id, title, icon, editing, saving, onEdit, onCancel, children }: CardProps) => (
  <section className={`profile-details-card profile-details-card-${id}`} aria-labelledby={`profile-${id}-title`}>
    <header className="profile-details-card-header">
      <div className="profile-details-card-title"><span aria-hidden="true">{icon}</span><h2 id={`profile-${id}-title`}>{title}</h2></div>
      <button
        type="button"
        className="btn-icon profile-card-edit"
        onClick={editing ? onCancel : onEdit}
        aria-label={editing ? `${title} düzenlemesini iptal et` : `${title} bilgilerini düzenle`}
        disabled={saving}
      >
        {editing ? <X size={18} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}
      </button>
    </header>
    {children}
  </section>
);

const Field = ({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) => (
  <label className="profile-form-field">
    <span className="profile-form-field-heading"><span className="profile-form-field-icon" aria-hidden="true">{icon}</span><span className="input-label profile-form-field-label">{label}</span></span>
    {children}
  </label>
);

const ReadValue = ({ label, value, icon }: { label: string; value?: string | null; icon: ReactNode }) => (
  <div className="profile-read-value">
    <span className="profile-read-value-icon" aria-hidden="true">{icon}</span>
    <div><span>{label}</span><strong>{value || 'Belirtilmemiş'}</strong></div>
  </div>
);

const CardActions = ({ saving, onCancel }: { saving: boolean; onCancel: () => void }) => (
  <div className="profile-card-actions">
    <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>İptal</button>
    <button type="submit" className="btn-primary" disabled={saving}><Save size={17} aria-hidden="true" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
  </div>
);

const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const tagsFrom = (values: string[] | undefined, legacy?: string | null) => values?.length
  ? values
  : (legacy || '').split(',').map((item) => item.trim()).filter(Boolean);

export const ProfileDetailsForm = ({ profile, saving, onSave }: Props) => {
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [draft, setDraft] = useState<Profile>(profile);
  const patch = (value: Partial<Profile>) => setDraft((current) => ({ ...current, ...value }));

  const beginEdit = (section: Section) => {
    setDraft({
      ...profile,
      education_entries: profile.education_entries?.map((entry) => ({ ...entry })) || [],
      skill_tags: tagsFrom(profile.skill_tags, profile.skills),
      hobby_tags: tagsFrom(profile.hobby_tags, profile.hobbies),
    });
    setActiveSection(section);
  };
  const cancel = () => { setDraft(profile); setActiveSection(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await onSave({
      ...draft,
      education: draft.education_entries?.length
        ? draft.education_entries.map((entry) => [entry.school, entry.department].filter(Boolean).join(' - ')).join('; ')
        : draft.education,
      skills: draft.skill_tags?.join(', ') || null,
      hobbies: draft.hobby_tags?.join(', ') || null,
    });
    if (saved) setActiveSection(null);
  };

  const skillTags = tagsFrom(profile.skill_tags, profile.skills);
  const hobbyTags = tagsFrom(profile.hobby_tags, profile.hobbies);

  return (
    <div className="profile-details-form">
      <div className="responsive-grid-2 profile-details-primary-grid">
        <SectionCard id="contact" title="İletişim Bilgileri" icon={<Phone size={19} />} editing={activeSection === 'contact'} saving={saving} onEdit={() => beginEdit('contact')} onCancel={cancel}>
          {activeSection === 'contact' ? (
            <form className="profile-card-form" onSubmit={submit}>
              <Field label="E-Posta Adresi" icon={<Mail size={18} />}><input className="form-control" type="email" value={draft.email || ''} onChange={(event) => patch({ email: event.target.value })} /></Field>
              <Field label="Telefon Numarası" icon={<Phone size={18} />}><input className="form-control" value={draft.phone || ''} onChange={(event) => patch({ phone: event.target.value.replace(/\D/g, '') })} /></Field>
              <Field label="Doğum Tarihi" icon={<Calendar size={18} />}><input className="form-control" type="date" value={draft.birth_date || ''} onChange={(event) => patch({ birth_date: event.target.value })} /></Field>
              <Field label="Ev Adresi" icon={<MapPin size={18} />}><textarea className="form-control" rows={2} value={draft.address || ''} onChange={(event) => patch({ address: event.target.value })} /></Field>
              <CardActions saving={saving} onCancel={cancel} />
            </form>
          ) : <div className="profile-read-list"><ReadValue label="E-posta" value={profile.email} icon={<Mail size={17} />} /><ReadValue label="Telefon" value={profile.phone} icon={<Phone size={17} />} /><ReadValue label="Doğum tarihi" value={profile.birth_date} icon={<Calendar size={17} />} /><ReadValue label="Adres" value={profile.address} icon={<MapPin size={17} />} /></div>}
        </SectionCard>

        <SectionCard id="about" title="Hakkımda" icon={<User size={19} />} editing={activeSection === 'about'} saving={saving} onEdit={() => beginEdit('about')} onCancel={cancel}>
          {activeSection === 'about' ? (
            <form className="profile-card-form" onSubmit={submit}>
              <ProfileEducationEditor entries={draft.education_entries || []} onChange={(education_entries) => patch({ education_entries })} />
              <ProfileTagEditor id="profile-skills" label="Yetenekler ve Uzmanlıklar" placeholder="Örn. Excel" values={draft.skill_tags || []} onChange={(skill_tags) => patch({ skill_tags })} />
              <ProfileTagEditor id="profile-hobbies" label="Hobiler ve İlgi Alanları" placeholder="Örn. Fotoğrafçılık" values={draft.hobby_tags || []} onChange={(hobby_tags) => patch({ hobby_tags })} />
              <CardActions saving={saving} onCancel={cancel} />
            </form>
          ) : (
            <div className="profile-about-summary">
              <div className="profile-about-block">
                <h3><GraduationCap size={17} aria-hidden="true" /> Eğitim</h3>
                {(profile.education_entries || []).length > 0 ? profile.education_entries?.map((entry, index) => (
                  <article className="profile-education-summary" key={entry.id || `${entry.school}-${index}`}>
                    <strong>{entry.school}</strong><span>{entry.department || 'Bölüm belirtilmemiş'}</span>
                    {(entry.start_year || entry.end_year || entry.is_current) && <small>{entry.start_year || ''}{entry.start_year ? ' - ' : ''}{entry.is_current ? 'Devam ediyor' : entry.end_year || ''}</small>}
                  </article>
                )) : <p>{profile.education || 'Henüz eğitim bilgisi eklenmemiş.'}</p>}
              </div>
              <div className="profile-about-block"><h3><Star size={17} aria-hidden="true" /> Yetenekler</h3><div className="profile-tag-list">{skillTags.length ? skillTags.map((tag) => <span className="profile-tag profile-tag-readonly" key={tag}>{tag}</span>) : <p>Henüz yetenek eklenmemiş.</p>}</div></div>
              <div className="profile-about-block"><h3><Heart size={17} aria-hidden="true" /> Hobiler</h3><div className="profile-tag-list">{hobbyTags.length ? hobbyTags.map((tag) => <span className="profile-tag profile-tag-readonly" key={tag}>{tag}</span>) : <p>Henüz hobi eklenmemiş.</p>}</div></div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard id="details" title="Detaylı Bilgiler" icon={<Droplet size={19} />} editing={activeSection === 'details'} saving={saving} onEdit={() => beginEdit('details')} onCancel={cancel}>
        {activeSection === 'details' ? (
          <form className="profile-card-form" onSubmit={submit}>
            <div className="responsive-grid-2 profile-details-secondary-grid">
              <div className="profile-details-group"><h3>Acil Durum İletişimi</h3>
                <Field label="Yakın Kişi Adı" icon={<User size={16} />}><input className="form-control" value={draft.emergency_contact_name || ''} onChange={(event) => patch({ emergency_contact_name: event.target.value })} /></Field>
                <Field label="Yakın Kişi Telefonu" icon={<PhoneCall size={16} />}><input className="form-control" value={draft.emergency_contact_phone || ''} onChange={(event) => patch({ emergency_contact_phone: event.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="Kan Grubu" icon={<Droplet size={16} />}><select className="form-control" value={draft.blood_type || ''} onChange={(event) => patch({ blood_type: event.target.value })}><option value="">Seçiniz</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map((group) => <option key={group}>{group}</option>)}</select></Field>
              </div>
              <div className="profile-details-group"><h3>Kıyafet ve Bot Ölçüleri</h3>
                <Field label="Üst Beden" icon={<Shirt size={16} />}><select className="form-control" value={draft.clothing_top || ''} onChange={(event) => patch({ clothing_top: event.target.value })}><option value="">Seçiniz</option>{sizes.map((size) => <option key={size}>{size}</option>)}</select></Field>
                <Field label="Alt Beden" icon={<Shirt size={16} />}><select className="form-control" value={draft.clothing_bottom || ''} onChange={(event) => patch({ clothing_bottom: event.target.value })}><option value="">Seçiniz</option>{sizes.map((size) => <option key={size}>{size}</option>)}</select></Field>
                <Field label="Ayakkabı / Bot No" icon={<Shirt size={16} />}><input className="form-control" value={draft.shoe_size || ''} onChange={(event) => patch({ shoe_size: event.target.value.replace(/\D/g, '') })} /></Field>
              </div>
            </div>
            <CardActions saving={saving} onCancel={cancel} />
          </form>
        ) : (
          <div className="responsive-grid-2 profile-details-read-grid">
            <div><h3>Acil Durum İletişimi</h3><div className="profile-read-list"><ReadValue label="Yakın kişi" value={profile.emergency_contact_name} icon={<User size={17} />} /><ReadValue label="Telefon" value={profile.emergency_contact_phone} icon={<PhoneCall size={17} />} /><ReadValue label="Kan grubu" value={profile.blood_type} icon={<Droplet size={17} />} /></div></div>
            <div><h3>Kıyafet ve Bot Ölçüleri</h3><div className="profile-read-list"><ReadValue label="Üst beden" value={profile.clothing_top} icon={<Shirt size={17} />} /><ReadValue label="Alt beden" value={profile.clothing_bottom} icon={<Shirt size={17} />} /><ReadValue label="Ayakkabı / Bot" value={profile.shoe_size} icon={<Shirt size={17} />} /></div></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
