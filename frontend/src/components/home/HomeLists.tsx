import { ArrowRight, Cake, Megaphone } from 'lucide-react';
import { NavLink } from '../../router';
import type { Announcement, DirectoryEntry } from '../../types';
import { ProfileAvatarImage } from '../ProfileAvatarImage';

type ListProps<T> = { items: T[]; loading: boolean; error: boolean };

export function HomeAnnouncements({ items, loading, error }: ListProps<Announcement>) {
    return (
        <section className="home-surface home-announcements" aria-labelledby="home-announcements-title">
            <div className="home-section-header">
                <h2 id="home-announcements-title" className="home-section-title"><Megaphone size={20} aria-hidden="true" />Son Duyurular</h2>
                <NavLink to="/employee/duyurular" className="home-text-link">Tümü <ArrowRight size={15} aria-hidden="true" /></NavLink>
            </div>
            {items.length ? (
                <ul className="home-announcement-list">
                    {items.map(item => {
                        const date = item.created_at ? new Date(item.created_at) : null;
                        return (
                            <li key={item.id}>
                                <NavLink to="/employee/duyurular" className="home-announcement-link">
                                    <span className="home-date-chip" aria-hidden="true">
                                        <strong>{date ? date.toLocaleDateString('tr-TR', { day: '2-digit' }) : '—'}</strong>
                                        <span>{date?.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                                    </span>
                                    <span className="home-announcement-title">{item.title}</span>
                                    {date && <span className="sr-only">{date.toLocaleDateString('tr-TR')}</span>}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="home-empty">{loading ? 'Duyurular yükleniyor…' : error ? 'Duyurular yüklenemedi.' : 'Güncel duyuru bulunmuyor.'}</p>
            )}
        </section>
    );
}

export function HomeBirthdays({ items, loading, error }: ListProps<DirectoryEntry>) {
    return (
        <section className="home-surface home-birthdays" aria-labelledby="home-birthdays-title">
            <div className="home-section-header">
                <h2 id="home-birthdays-title" className="home-section-title"><Cake size={20} aria-hidden="true" />Bugün Doğanlar</h2>
                <NavLink to="/employee/rehber" className="home-text-link">Rehber <ArrowRight size={15} aria-hidden="true" /></NavLink>
            </div>
            {items.length ? (
                <ul className="home-birthday-list">
                    {items.map(person => (
                        <li key={person.id}>
                            <ProfileAvatarImage photoPath={person.photo_url} seed={person.id || person.name} alt={person.name} className="home-birthday-avatar" />
                            <div className="home-birthday-info">
                                <strong>{person.name}</strong>
                                <span>{person.department || 'Çalışan'}</span>
                            </div>
                            <Cake size={20} className="home-birthday-cake" aria-hidden="true" />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="home-empty">{loading ? 'Doğum günleri yükleniyor…' : error ? 'Doğum günleri yüklenemedi.' : 'Bugün doğum günü olan çalışanımız bulunmuyor.'}</p>
            )}
        </section>
    );
}
