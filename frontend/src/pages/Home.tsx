import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Home as HomeIcon } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { NavLink } from '../router';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import type { Announcement, CompanyNews, DirectoryEntry } from '../types';
import { ModulePageHeader } from '../components/ModulePageHeader';
import { NotificationPermissionCard } from '../components/NotificationPermissionCard';
import { ProfileAvatarImage } from '../components/ProfileAvatarImage';
import { HomeSummary } from '../components/home/HomeSummary';
import { HomeQuickActions } from '../components/home/HomeQuickActions';
import { HomeAnnouncements, HomeBirthdays } from '../components/home/HomeLists';
import { HomeMealCard } from '../components/home/HomeMealCard';
import { NewsSlider } from '../components/home/NewsSlider';
import { MoodCheckCard } from '../components/home/MoodCheckCard';
import { WeatherStrip } from '../components/home/WeatherStrip';
import { ReminderWidget } from '../components/home/ReminderWidget';
import '../home.css';
import '../styles/module-home-widgets.css';
import '../styles/module-home-reminders.css';

export const Home = () => {
    const { user } = useAuth();
    const today = new Date();
    const news = useQuery({
        queryKey: [...queryKeys.employeeNews, 'home'],
        queryFn: () => api.list<CompanyNews>('/api/news/home-preview'),
    });
    const announcements = useQuery({
        queryKey: [...queryKeys.employeeAnnouncements, 'home'],
        queryFn: () => api.list<Announcement>('/api/announcements/home-preview'),
    });
    const birthdays = useQuery({
        queryKey: queryKeys.employeeBirthdaysToday,
        queryFn: () => api.list<DirectoryEntry>('/api/directory/birthdays/today?page=1&pageSize=20'),
    });

    return (
        <div className="home-dashboard">
            <ModulePageHeader
                title="Ana Sayfa"
                description="İş gününe dair her şey tek bir yerde."
                icon={<HomeIcon size={24} />}
                tone="violet"
                actions={
                    <time className="home-header-date" dateTime={today.toLocaleDateString('en-CA')}>
                        <CalendarDays size={18} aria-hidden="true" />
                        {today.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                    </time>
                }
            />

            <div className="home-canvas">
                <section className="home-welcome" aria-labelledby="home-welcome-title">
                    <div className="home-welcome-copy">
                        <h2 id="home-welcome-title">Hoş geldin{user?.name ? `, ${user.name}` : ''}!</h2>
                        <p>İyi çalışmalar dileriz.</p>
                    </div>
                    <NavLink to="/employee/kisisel-bilgiler" className="home-profile-link" aria-label="Profilimi görüntüle">
                        <ProfileAvatarImage
                            photoPath={user?.photo_url}
                            seed={user?.employee_id}
                            alt="Profil fotoğrafım"
                            className="home-profile-photo"
                            thumbnailSize={320}
                            loading="eager"
                        />
                    </NavLink>
                    <WeatherStrip />
                </section>

                <HomeSummary />
                <MoodCheckCard />
                <HomeQuickActions />

                <div className="home-feed-grid">
                    <NewsSlider news={news.data?.items ?? []} loading={news.isPending} error={news.isError} />
                    <HomeAnnouncements
                        items={announcements.data?.items ?? []}
                        loading={announcements.isPending}
                        error={announcements.isError}
                    />
                </div>

                <div className="home-details-grid">
                    <HomeMealCard />
                    <HomeBirthdays
                        items={birthdays.data?.items ?? []}
                        loading={birthdays.isPending}
                        error={birthdays.isError}
                    />
                    <ReminderWidget />
                </div>

                <NotificationPermissionCard />
            </div>
        </div>
    );
};
