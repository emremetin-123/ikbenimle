import { BookOpen, Briefcase, CalendarDays, FileText, Lightbulb, Megaphone, UserCircle, Users } from 'lucide-react';
import { NavLink } from '../../router';

const quickActions = [
    { icon: CalendarDays, label: 'İzin Talebi', path: '/employee/izinler', tone: 'violet' },
    { icon: FileText, label: 'Belgelerim', path: '/employee/belgelerim', tone: 'teal' },
    { icon: Lightbulb, label: 'Öneri Gönder', path: '/employee/oneri-sikayet', tone: 'violet' },
    { icon: BookOpen, label: 'Eğitimlerim', path: '/employee/egitimler', tone: 'violet' },
    { icon: Briefcase, label: 'Kariyer', path: '/employee/kariyer', tone: 'teal' },
    { icon: Megaphone, label: 'Duyurular', path: '/employee/duyurular', tone: 'coral' },
    { icon: Users, label: 'Şirket Rehberi', path: '/employee/rehber', tone: 'violet' },
    { icon: UserCircle, label: 'Profilim', path: '/employee/kisisel-bilgiler', tone: 'violet' },
];

export function HomeQuickActions() {
    return (
        <section className="home-surface home-quick-actions" aria-labelledby="home-quick-actions-title">
            <h2 id="home-quick-actions-title" className="home-section-title">Hızlı Erişim</h2>
            <nav className="home-quick-grid" aria-label="Hızlı erişim bağlantıları">
                {quickActions.map(({ icon: Icon, label, path, tone }) => (
                    <NavLink key={path} to={path} className={`home-quick-link home-quick-link--${tone}`}>
                        <Icon size={25} aria-hidden="true" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
        </section>
    );
}
