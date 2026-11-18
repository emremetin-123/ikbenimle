import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from '../router';
import { useAuth } from '../AuthContext';
import { BottomNav } from '../components/BottomNav';
import { MobileHeader } from '../components/MobileHeader';
import { PortalChatbot } from '../components/PortalChatbot';
import { ProfileAvatarImage } from '../components/ProfileAvatarImage';
import { queryKeys } from '../queryClient';
import { api } from '../services/api';
import {
    BookOpen, UserCircle, FileText, Megaphone,
    MessageSquare, LogOut, ChevronLeft, ChevronRight, Home, Briefcase, HelpCircle, Users, Newspaper, ClipboardList, Utensils, CalendarCheck, Bot, HeartPulse, Bell, BusFront, Layers3, Cable
} from 'lucide-react';
import '../index.css';

type SidebarItem = {
    to: string;
    icon: React.ReactNode;
    label: string;
    show: boolean;
};

type SidebarGroup = {
    id: string;
    label: string;
    icon: React.ReactNode;
    items: SidebarItem[];
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/employee/anasayfa';
    const isProfile = location.pathname === '/employee/kisisel-bilgiler';
    const isPersonalPage = isHome || isProfile;
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const polyvalenceTasksQuery = useQuery({
        queryKey: queryKeys.employeePolyvalenceTasks,
        queryFn: () => api.get<{ has_tasks: boolean }>('/api/polyvalence/my-tasks/summary'),
        enabled: Boolean(user?.id),
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const hasPolyvalenceTasks = Boolean(polyvalenceTasksQuery.data?.has_tasks);

    const closeMobile = () => setIsMobileOpen(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const can = (permission: string) => Boolean(user?.role === 'admin' || user?.permissions?.includes(permission as never));
    const currentRoute = `${location.pathname}${location.search}`;
    const isItemActive = (to: string) => to.includes('?') ? currentRoute === to : location.pathname === to;
    const sidebarGroups: SidebarGroup[] = [
        { id: 'home', label: 'Ana Sayfa', icon: <Home size={18} />, items: [{ to: '/employee/anasayfa', icon: <Home size={18} />, label: 'Ana Sayfa', show: true }] },
        {
            id: 'personal',
            label: 'Kişisel',
            icon: <UserCircle size={18} />,
            items: [
                { to: '/employee/kisisel-bilgiler', icon: <UserCircle size={18} />, label: 'Profilim', show: true },
                { to: '/employee/izinler', icon: <CalendarCheck size={18} />, label: 'İzinlerim', show: true }
            ]
        },
        {
            id: 'services',
            label: 'Servisler',
            icon: <BusFront size={18} />,
            items: [
                { to: '/employee/servis-guzergahlari', icon: <BusFront size={18} />, label: 'Servis Güzergahlarım', show: true },
                { to: '/employee/moduller/servis-guzergahlari', icon: <BusFront size={18} />, label: 'Servis İşlemleri', show: can('manage_service_routes') }
            ]
        },
        {
            id: 'announcements',
            label: 'Duyurular ve Haberler',
            icon: <Megaphone size={18} />,
            items: [
                { to: '/employee/duyurular', icon: <Megaphone size={18} />, label: 'Duyurular', show: can('view_announcements') },
                { to: '/employee/moduller/duyurular', icon: <Megaphone size={18} />, label: 'Duyuru İşlemleri', show: can('manage_announcements') },
                { to: '/employee/moduller/haberler', icon: <Newspaper size={18} />, label: 'Haber İşlemleri', show: can('manage_news') }
            ]
        },
        {
            id: 'education',
            label: 'Eğitim',
            icon: <BookOpen size={18} />,
            items: [
                { to: '/employee/egitimler', icon: <BookOpen size={18} />, label: 'Eğitimlerim', show: can('view_education') },
                { to: '/employee/moduller/egitimler', icon: <BookOpen size={18} />, label: 'Eğitim İşlemleri', show: can('manage_education') }
            ]
        },
        {
            id: 'polyvalence',
            label: 'Polivalans',
            icon: <Layers3 size={18} />,
            items: [
                { to: '/employee/polivalans', icon: <ClipboardList size={18} />, label: 'Ekibimi Değerlendir', show: hasPolyvalenceTasks },
                { to: '/employee/moduller/polivalans?view=reports', icon: <Layers3 size={18} />, label: 'Polivalans Raporları', show: can('manage_polyvalence') || can('view_polyvalence_reports') }
            ]
        },
        {
            id: 'documents',
            label: 'Belgeler',
            icon: <FileText size={18} />,
            items: [
                { to: '/employee/belgelerim', icon: <FileText size={18} />, label: 'Belgelerim', show: can('view_documents') },
                { to: '/employee/moduller/belgeler', icon: <FileText size={18} />, label: 'Belge İşlemleri', show: can('manage_documents') }
            ]
        },
        {
            id: 'feedback',
            label: 'Geri Bildirim',
            icon: <MessageSquare size={18} />,
            items: [
                { to: '/employee/oneri-sikayet', icon: <MessageSquare size={18} />, label: 'Öneri & Şikayet', show: true },
                { to: '/employee/moduller/geribildirim', icon: <MessageSquare size={18} />, label: 'Geri Bildirimler', show: can('manage_feedback') },
                { to: '/employee/anketler', icon: <ClipboardList size={18} />, label: 'Anketler', show: can('view_surveys') },
                { to: '/employee/moduller/anketler', icon: <ClipboardList size={18} />, label: 'Anket İşlemleri', show: can('manage_surveys') },
                { to: '/employee/moduller/duygu-analizi', icon: <HeartPulse size={18} />, label: 'Duygu Analizi', show: can('manage_mood_analytics') }
            ]
        },
        {
            id: 'career',
            label: 'Kariyer',
            icon: <Briefcase size={18} />,
            items: [
                { to: '/employee/kariyer', icon: <Briefcase size={18} />, label: 'Kariyer Merkezi', show: can('view_careers') },
                { to: '/employee/moduller/kariyer', icon: <Briefcase size={18} />, label: 'Kariyer İşlemleri', show: can('manage_careers') }
            ]
        },
        {
            id: 'knowledge',
            label: 'Bilgi Portalı',
            icon: <HelpCircle size={18} />,
            items: [
                { to: '/employee/bilgi-portali', icon: <HelpCircle size={18} />, label: 'Bilgi Portalı', show: can('view_knowledge_portal') },
                { to: '/employee/moduller/bilgi-portali', icon: <HelpCircle size={18} />, label: 'Bilgi İşlemleri', show: can('manage_knowledge_portal') }
            ]
        },
        { id: 'meal-menu', label: 'Yemek Menüsü', icon: <Utensils size={18} />, items: [{ to: '/employee/moduller/yemek-menusu', icon: <Utensils size={18} />, label: 'Yemek Menüsü', show: can('manage_meal_menu') }] },
        {
            id: 'system',
            label: 'Sistem',
            icon: <Users size={18} />,
            items: [
                { to: '/employee/moduller/kullanicilar', icon: <Users size={18} />, label: 'Kullanıcılar', show: can('manage_users') },
                { to: '/employee/moduller/bildirimler', icon: <Bell size={18} />, label: 'Bildirimler', show: can('manage_notifications') },
                { to: '/employee/moduller/ai-ayarlari', icon: <Bot size={18} />, label: 'AI Ayarları', show: can('manage_ai_settings') },
                { to: '/employee/moduller/api-entegrasyonlari', icon: <Cable size={18} />, label: 'Entegrasyonlar', show: can('manage_integrations') },
                { to: '/employee/moduller/log-kayitlari', icon: <ClipboardList size={18} />, label: 'Log Kayıtları', show: user?.role === 'admin' }
            ]
        }
    ];

    const visibleGroups = sidebarGroups
        .map(group => ({ ...group, items: group.items.filter(item => item.show) }))
        .filter(group => group.items.length > 0);
    const sidebarItems = sidebarGroups.flatMap(group => group.items);
    const activeItem = sidebarItems.find(item => isItemActive(item.to))
        ?? sidebarItems.find(item => item.to.split('?')[0] === location.pathname);
    const isJobDetail = location.pathname.startsWith('/employee/kariyer/');
    const mobileTitle = isJobDetail ? 'İlan Detayı' : activeItem?.label || 'Çalışan Portalı';
    const mobileIcon = isJobDetail ? <Briefcase size={21} /> : activeItem?.icon || <Home size={21} />;

    return (
        <div className={`dashboard-layout${isPersonalPage ? ' dashboard-layout--personal' : ''}`}>
            <MobileHeader title={mobileTitle} icon={mobileIcon} onOpenMenu={() => setIsMobileOpen(true)} />

            {isMobileOpen && (
                <div className="sidebar-overlay active" onClick={closeMobile} />
            )}

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-user-card">
                    <div className="sidebar-avatar">
                        <ProfileAvatarImage
                            photoPath={user?.photo_url}
                            seed={user?.employee_id}
                            alt={user?.name || 'Profil'}
                        />
                    </div>
                    {!isCollapsed && (
                        <div className="sidebar-identity">
                            <p className="sidebar-user-name">{user?.name}</p>
                            <p className="sidebar-user-meta">{user?.department || 'Calisan'} / #{user?.employee_id}</p>
                        </div>
                    )}
                    <div className="sidebar-toggle-stack">
                        <button
                            onClick={() => setIsCollapsed((value) => !value)}
                            className="toggle-btn desktop-only"
                            title={isCollapsed ? 'Menuyu Ac' : 'Menuyu Kapat'}
                            aria-label={isCollapsed ? 'Menuyu Ac' : 'Menuyu Kapat'}
                        >
                            {isCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
                        </button>
                    </div>
                </div>

                <nav className="employee-sidebar-nav">
                    <div className="sidebar-section-label">Modüller</div>
                    {visibleGroups.map((group) => {
                        if (group.items.length === 1 || isCollapsed) {
                            const item = group.items[0];
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={closeMobile}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${isCollapsed ? 'is-centered' : ''}`}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    {item.icon}
                                    {!isCollapsed && <span>{item.label}</span>}
                                </NavLink>
                            );
                        }

                        const hasActiveChild = group.items.some(item => isItemActive(item.to));
                        const isOpen = openGroups[group.id] ?? hasActiveChild;
                        return (
                            <div key={group.id} className="nav-group">
                                <button
                                    type="button"
                                    className={`nav-link nav-group-toggle ${isOpen ? 'open' : ''}`}
                                    onClick={() => setOpenGroups(current => ({ ...current, [group.id]: !isOpen }))}
                                >
                                    {group.icon}
                                    <span>{group.label}</span>
                                    <ChevronRight size={16} className="nav-group-chevron" />
                                </button>
                                {isOpen && (
                                    <div className="nav-submenu">
                                        {group.items.map(item => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                onClick={closeMobile}
                                                className={() => isItemActive(item.to) ? 'nav-sublink active' : 'nav-sublink'}
                                            >
                                                <span>{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                </nav>

                <div className="employee-sidebar-footer">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className={`nav-link employee-sidebar-logout ${isCollapsed ? 'is-centered' : ''}`}
                        title={isCollapsed ? 'Çıkış' : undefined}
                    >
                        <LogOut size={18} />
                        {!isCollapsed && <span>Çıkış</span>}
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <div className="dashboard-content-frame">
                    {children}
                </div>
            </main>

            <BottomNav />
            <PortalChatbot />
        </div>
    );
};
