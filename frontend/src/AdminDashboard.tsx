import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { BookOpen, Megaphone, FileText, MessageSquare, LogOut, Users, ChevronLeft, Menu, Home, HelpCircle, Newspaper, Briefcase, X, ClipboardList, Utensils, Bot, HeartPulse, Bell, BusFront, Layers3, Cable } from 'lucide-react';
import { Logo } from './components/Logo';
import { LoadingIndicator } from './components/LoadingIndicator';

const AdminAnnouncements = lazy(() => import('./AdminAnnouncements').then(module => ({ default: module.AdminAnnouncements })));
const AdminNews = lazy(() => import('./AdminNews').then(module => ({ default: module.AdminNews })));
const AdminDocuments = lazy(() => import('./AdminDocuments').then(module => ({ default: module.AdminDocuments })));
const AdminFeedback = lazy(() => import('./AdminFeedback').then(module => ({ default: module.AdminFeedback })));
const AdminCareers = lazy(() => import('./AdminCareers').then(module => ({ default: module.AdminCareers })));
const AdminKnowledgePortal = lazy(() => import('./AdminKnowledgePortal').then(module => ({ default: module.AdminKnowledgePortal })));
const AdminSurveys = lazy(() => import('./AdminSurveys').then(module => ({ default: module.AdminSurveys })));
const AdminMealMenu = lazy(() => import('./AdminMealMenu').then(module => ({ default: module.AdminMealMenu })));
const AdminAiSettings = lazy(() => import('./AdminAiSettings').then(module => ({ default: module.AdminAiSettings })));
const AdminMoodAnalytics = lazy(() => import('./AdminMoodAnalytics').then(module => ({ default: module.AdminMoodAnalytics })));
const AdminNotifications = lazy(() => import('./AdminNotifications').then(module => ({ default: module.AdminNotifications })));
const AdminServiceRoutes = lazy(() => import('./AdminServiceRoutes').then(module => ({ default: module.AdminServiceRoutes })));
const AdminPolyvalence = lazy(() => import('./AdminPolyvalence').then(module => ({ default: module.AdminPolyvalence })));
const AdminUsers = lazy(() => import('./AdminUsers').then(module => ({ default: module.AdminUsers })));
const AdminTraining = lazy(() => import('./AdminTraining').then(module => ({ default: module.AdminTraining })));
const AdminIntegrations = lazy(() => import('./AdminIntegrations').then(module => ({ default: module.AdminIntegrations })));
const AdminAuditLogs = lazy(() => import('./AdminAuditLogs').then(module => ({ default: module.AdminAuditLogs })));

type AdminModuleTab = 'egitimler' | 'kullanicilar' | 'duyurular' | 'haberler' | 'belgeler' | 'geribildirim' | 'kariyer' | 'bilgi-portali' | 'anketler' | 'yemek-menusu' | 'servis-guzergahlari' | 'ai-ayarlari' | 'api-entegrasyonlari' | 'duygu-analizi' | 'bildirimler' | 'polivalans' | 'log-kayitlari';

export const AdminDashboard = ({
    embeddedTab,
}: {
    embeddedTab?: AdminModuleTab;
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<AdminModuleTab>(embeddedTab || 'egitimler');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { logout, user } = useAuth();
    const isEmbedded = Boolean(embeddedTab);
    useEffect(() => {
        if (embeddedTab) {
            setActiveTab(embeddedTab);
            return;
        }
        if (user && user.role !== 'admin') {
            const perms = user.permissions || [];
            if (perms.includes('manage_education')) setActiveTab('egitimler');
            else if (perms.includes('manage_users')) setActiveTab('kullanicilar');
            else if (perms.includes('manage_announcements')) setActiveTab('duyurular');
            else if (perms.includes('manage_news')) setActiveTab('haberler');
            else if (perms.includes('manage_documents')) setActiveTab('belgeler');
            else if (perms.includes('manage_feedback')) setActiveTab('geribildirim');
            else if (perms.includes('manage_careers')) setActiveTab('kariyer');
            else if (perms.includes('manage_knowledge_portal')) setActiveTab('bilgi-portali');
            else if (perms.includes('manage_surveys')) setActiveTab('anketler');
            else if (perms.includes('manage_meal_menu')) setActiveTab('yemek-menusu');
            else if (perms.includes('manage_service_routes')) setActiveTab('servis-guzergahlari');
            else if (perms.includes('manage_polyvalence')) setActiveTab('polivalans');
            else if (perms.includes('view_polyvalence_reports')) setActiveTab('polivalans');
            else if (perms.includes('manage_ai_settings')) setActiveTab('ai-ayarlari');
            else if (perms.includes('manage_integrations')) setActiveTab('api-entegrasyonlari');
            else if (perms.includes('manage_mood_analytics')) setActiveTab('duygu-analizi');
            else if (perms.includes('manage_notifications')) setActiveTab('bildirimler');
        }
    }, [embeddedTab, user]);

    const userInitials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'IK';

    return (
        <div className={isEmbedded ? '' : 'dashboard-layout'}>
            {/* Mobile Header */}
            {!isEmbedded && <header className="mobile-header mobile-only">
                <div className="sidebar-brand-mark">
                    <Logo size={40} />
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="btn-icon-round"
                    aria-label="Yönetim menüsünü aç"
                >
                    <Menu size={18} />
                </button>
            </header>}

            {/* Sidebar Overlay */}
            {!isEmbedded && <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />}

            {!isEmbedded && <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-shell-header">
                    <div className="sidebar-identity">
                        <span className="sidebar-context-label">Yönetim</span>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="toggle-btn desktop-only admin-sidebar-toggle"
                        title="Menuyu Kapat"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="toggle-btn mobile-only admin-sidebar-toggle"
                        aria-label="Yönetim menüsünü kapat"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Admin profil + collapse */}
                {!isCollapsed ? (
                    <div className="admin-sidebar-profile">
                        {/* Avatar */}
                        <div className="admin-sidebar-avatar">
                            {userInitials}
                        </div>

                        {/* İsim & rol */}
                        <div className="admin-sidebar-profile-copy">
                            <p className="admin-sidebar-profile-name">
                                {user?.name || 'Admin'}
                            </p>
                            <p className="admin-sidebar-profile-role">
                                Yönetici Yetkisi
                            </p>
                        </div>

                    </div>
                ) : (
                    /* Collapsed: avatar + açma butonu */
                    <div className="admin-sidebar-profile-collapsed">
                        <div className="admin-sidebar-avatar is-collapsed">
                            {userInitials}
                        </div>
                        <button
                            onClick={() => setIsCollapsed(false)}
                            className="toggle-btn desktop-only"
                            title="Menuyu Ac"
                        >
                            <Menu size={18} />
                        </button>
                    </div>
                )}

                <nav className="admin-sidebar-nav">
                    <div className="sidebar-section-label">Yönetim Modülleri</div>
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_education')) && (
                        <button onClick={() => { setActiveTab('egitimler'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'egitimler' ? 'active' : ''}`}>
                            <BookOpen size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Eğitim Yönetimi</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_polyvalence') || user?.permissions?.includes('view_polyvalence_reports')) && (
                        <button onClick={() => { setActiveTab('polivalans'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'polivalans' ? 'active' : ''}`}>
                            <Layers3 size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Polivalans İşlemleri</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_users')) && (
                        <button onClick={() => { setActiveTab('kullanicilar'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'kullanicilar' ? 'active' : ''}`}>
                            <Users size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Kullanıcı Yönetimi</span>}
                        </button>
                    )}
                    {!isCollapsed && ((user?.role === 'admin') || user?.permissions?.includes('manage_announcements') || user?.permissions?.includes('manage_news')) && (
                        <div className="sidebar-section-label">Duyurular ve Haberler</div>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_announcements')) && (
                        <button onClick={() => { setActiveTab('duyurular'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'duyurular' ? 'active' : ''}`}>
                            <Megaphone size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Duyuru İşlemleri</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_news')) && (
                        <button onClick={() => { setActiveTab('haberler'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'haberler' ? 'active' : ''}`}>
                            <Newspaper size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Haber İşlemleri</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_documents')) && (
                        <button onClick={() => { setActiveTab('belgeler'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'belgeler' ? 'active' : ''}`}>
                            <FileText size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Belge Yönetimi</span>}
                        </button>
                    )}
                    {!isCollapsed && ((user?.role === 'admin') || user?.permissions?.includes('manage_feedback') || user?.permissions?.includes('manage_surveys') || user?.permissions?.includes('manage_mood_analytics')) && (
                        <div className="sidebar-section-label">Geri Bildirim</div>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_feedback')) && (
                        <button onClick={() => { setActiveTab('geribildirim'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'geribildirim' ? 'active' : ''}`}>
                            <MessageSquare size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Öneri & Şikayet</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_careers')) && (
                        <button onClick={() => { setActiveTab('kariyer'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'kariyer' ? 'active' : ''}`}>
                            <Briefcase size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Kariyer Merkezi</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_surveys')) && (
                        <button onClick={() => { setActiveTab('anketler'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'anketler' ? 'active' : ''}`}>
                            <ClipboardList size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Anket İşlemleri</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_mood_analytics')) && (
                        <button onClick={() => { setActiveTab('duygu-analizi'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'duygu-analizi' ? 'active' : ''}`}>
                            <HeartPulse size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Duygu Analizi</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_meal_menu')) && (
                        <button onClick={() => { setActiveTab('yemek-menusu'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'yemek-menusu' ? 'active' : ''}`}>
                            <Utensils size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Yemek Menüsü</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_service_routes')) && (
                        <button onClick={() => { setActiveTab('servis-guzergahlari'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'servis-guzergahlari' ? 'active' : ''}`}>
                            <BusFront size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Servis Güzergahları</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_ai_settings')) && (
                        <button onClick={() => { setActiveTab('ai-ayarlari'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'ai-ayarlari' ? 'active' : ''}`}>
                            <Bot size={20} className="admin-nav-icon" /> {!isCollapsed && <span>AI Ayarları</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_notifications')) && (
                        <button onClick={() => { setActiveTab('bildirimler'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'bildirimler' ? 'active' : ''}`}>
                            <Bell size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Bildirimler</span>}
                        </button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_integrations')) && (
                        <button onClick={() => { setActiveTab('api-entegrasyonlari'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'api-entegrasyonlari' ? 'active' : ''}`}>
                            <Cable size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Entegrasyonlar</span>}
                        </button>
                    )}

                    {user?.role === 'admin' && <button onClick={() => { setActiveTab('log-kayitlari'); setIsMobileMenuOpen(false); }} className={'nav-link ' + (activeTab === 'log-kayitlari' ? 'active' : '')}><ClipboardList size={20} className="admin-nav-icon" />{!isCollapsed && <span>Log Kayıtları</span>}</button>}
                    {!isCollapsed && <div className="sidebar-section-label">Genel Alan</div>}
                    <button onClick={() => window.location.href = '/employee/anasayfa'} className="nav-link subtle">
                        <Home size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Çalışma Alanı</span>}
                    </button>
                    {(user?.role === 'admin' || user?.permissions?.includes('manage_knowledge_portal')) && (
                        <button onClick={() => { setActiveTab('bilgi-portali'); setIsMobileMenuOpen(false); }} className={`nav-link ${activeTab === 'bilgi-portali' ? 'active' : ''}`}>
                            <HelpCircle size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Bilgi Portalı Yönetimi</span>}
                        </button>
                    )}
                </nav>

                <button
                    onClick={logout}
                    className={`admin-sidebar-logout${isCollapsed && !isMobileMenuOpen ? ' is-centered' : ''}`}
                    title={isCollapsed ? 'Çıkış Yap' : ''}
                >
                    <LogOut size={20} className="admin-nav-icon" /> {!isCollapsed && <span>Çıkış Yap</span>}
                </button>
            </aside>}
            <main className={isEmbedded ? 'admin-main is-embedded' : 'main-content admin-main'}>
                {!isEmbedded && <h1 className="admin-main-title">Yönetim</h1>}

                <Suspense fallback={<LoadingIndicator label="Yönetim modülü yükleniyor" />}>
                    {activeTab === 'log-kayitlari' && <AdminAuditLogs />}
                    {(activeTab === 'egitimler' && (user?.role === 'admin' || user?.permissions?.includes('manage_education'))) && <AdminTraining />}
                    {(activeTab === 'kullanicilar' && (user?.role === 'admin' || user?.permissions?.includes('manage_users'))) && <AdminUsers />}
                    {(activeTab === 'duyurular' && (user?.role === 'admin' || user?.permissions?.includes('manage_announcements'))) && <AdminAnnouncements />}
                    {(activeTab === 'haberler' && (user?.role === 'admin' || user?.permissions?.includes('manage_news'))) && <AdminNews />}
                    {(activeTab === 'belgeler' && (user?.role === 'admin' || user?.permissions?.includes('manage_documents'))) && <AdminDocuments />}
                    {(activeTab === 'geribildirim' && (user?.role === 'admin' || user?.permissions?.includes('manage_feedback'))) && <AdminFeedback />}
                    {(activeTab === 'kariyer' && (user?.role === 'admin' || user?.permissions?.includes('manage_careers'))) && <AdminCareers />}
                    {(activeTab === 'bilgi-portali' && (user?.role === 'admin' || user?.permissions?.includes('manage_knowledge_portal'))) && <AdminKnowledgePortal />}
                    {(activeTab === 'anketler' && (user?.role === 'admin' || user?.permissions?.includes('manage_surveys'))) && <AdminSurveys />}
                    {(activeTab === 'yemek-menusu' && (user?.role === 'admin' || user?.permissions?.includes('manage_meal_menu'))) && <AdminMealMenu />}
                    {(activeTab === 'servis-guzergahlari' && (user?.role === 'admin' || user?.permissions?.includes('manage_service_routes'))) && <AdminServiceRoutes />}
                    {(activeTab === 'ai-ayarlari' && (user?.role === 'admin' || user?.permissions?.includes('manage_ai_settings'))) && <AdminAiSettings />}
                    {(activeTab === 'duygu-analizi' && (user?.role === 'admin' || user?.permissions?.includes('manage_mood_analytics'))) && <AdminMoodAnalytics />}
                    {(activeTab === 'bildirimler' && (user?.role === 'admin' || user?.permissions?.includes('manage_notifications'))) && <AdminNotifications />}
                    {(activeTab === 'api-entegrasyonlari' && (user?.role === 'admin' || user?.permissions?.includes('manage_integrations'))) && <AdminIntegrations />}
                    {(activeTab === 'polivalans' && (user?.role === 'admin' || user?.permissions?.includes('manage_polyvalence') || user?.permissions?.includes('view_polyvalence_reports'))) && <AdminPolyvalence />}
                </Suspense>

            </main>
        </div>
    );
};
