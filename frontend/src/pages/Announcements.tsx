import { ModulePageHeader } from '../components/ModulePageHeader';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPhotoUrl } from '../config';
import type { Announcement } from '../types';
import { CalendarDays, ChevronDown, FileText, Image, Megaphone, UserRound } from 'lucide-react';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { AsyncState } from '../components/AsyncState';
import { PaginationControls } from '../components/PaginationControls';

export const Announcements = () => {
    const [page, setPage] = useState(1);
    const announcementsQuery = useQuery({
        queryKey: [...queryKeys.employeeAnnouncements, page],
        queryFn: () => api.list<Announcement>(
            `/api/announcements?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const announcements = announcementsQuery.data?.items || [];
    const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('tr-TR') : '-');
    const attachmentIcon = (type?: string | null) => type?.startsWith('image/') ? <Image size={17} /> : <FileText size={17} />;

    return (
        <div className="announcements-page">
            <ModulePageHeader title="Şirket Duyuruları" description="Şirket duyurularını ve güncel bilgilendirmeleri takip edin." icon={<Megaphone />} />

            {announcementsQuery.isLoading ? (
                <AsyncState
                    kind="loading"
                    title="Duyurular yükleniyor"
                    className="announcements-loading"
                />
            ) : announcementsQuery.isError ? (
                <AsyncState
                    kind="error"
                    title="Duyurular yüklenemedi"
                    message="Bağlantınızı kontrol edip yeniden deneyin."
                    onRetry={() => void announcementsQuery.refetch()}
                    className="announcements-loading"
                />
            ) : announcements.length === 0 ? (
                <AsyncState
                    kind="empty"
                    title="Aktif duyuru bulunmuyor"
                    message="Yayınlanan yeni duyurular burada görüntülenecek."
                    className="announcements-empty-state"
                />
            ) : (
                <div className="announcements-list">
                    {announcements.map(ann => (
                        <details key={`${page}-${ann.id}`} className="premium-card announcement-card">
                            <summary className="announcement-card-summary">
                                <h2 className="announcement-card-title">{ann.title}</h2>
                                <span className="announcement-meta-item">
                                    <CalendarDays size={16} aria-hidden="true" /> {formatDate(ann.created_at)}
                                </span>
                                <ChevronDown size={20} className="announcement-card-chevron" aria-hidden="true" />
                            </summary>
                            <div className="announcement-card-accent" aria-hidden="true" />
                            <div className="announcement-card-details">
                                {ann.author_name && (
                                    <div className="announcement-card-meta">
                                        <span className="announcement-meta-item">
                                            <UserRound size={16} aria-hidden="true" /> {ann.author_name}
                                        </span>
                                    </div>
                                )}
                                <p className="announcement-card-content">
                                    {ann.content}
                                </p>
                                {ann.attachment_path && (
                                    <a
                                        href={getPhotoUrl(ann.attachment_path)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary announcement-attachment-link"
                                    >
                                        {attachmentIcon(ann.attachment_type)} {ann.attachment_name || 'Duyuru eki'}
                                    </a>
                                )}
                            </div>
                        </details>
                    ))}
                    <PaginationControls
                        pagination={announcementsQuery.data?.pagination}
                        onPageChange={setPage}
                    />
                </div>
            )}
        </div>
    );
};
