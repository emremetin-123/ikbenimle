import { ModulePageHeader } from '../components/ModulePageHeader';
import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProfileAvatarImage } from '../components/ProfileAvatarImage';
import { AchievementBadgeCard } from '../components/AchievementBadgeCard';
import { PaginationControls } from '../components/PaginationControls';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import type { DirectoryEntry, DirectoryBadge } from '../types';
import { Search, User, Award, Mail, Phone, BookOpen, Heart, Briefcase, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';

export const Directory = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const deferredSearch = useDeferredValue(searchQuery.trim());
    const directoryQuery = useQuery({
        queryKey: [...queryKeys.employeeDirectory, page, deferredSearch],
        queryFn: () => {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20',
                sort: 'name',
                order: 'asc'
            });
            if (deferredSearch) params.set('search', deferredSearch);
            return api.list<DirectoryEntry>(`/api/directory?${params.toString()}`);
        }
    });
    const detailQuery = useQuery({
        queryKey: [...queryKeys.employeeDirectoryDetail, selectedUserId],
        queryFn: () => api.get<DirectoryEntry>(`/api/directory/${selectedUserId}`),
        enabled: selectedUserId !== null
    });
    const users = directoryQuery.data?.items || [];
    const selectedUser = detailQuery.data || null;

    const getCallHref = (phone?: string | null) => {
        const normalized = phone?.replace(/[^\d+]/g, '');
        return normalized ? `tel:${normalized}` : null;
    };

    return (
        <div className="directory-page">
            <ModulePageHeader title="Çalışan Rehberi" description="Çalışma arkadaşlarınızı bulun, profillerini ve rozetlerini inceleyin." icon={<User />} />
            <div className="directory-toolbar">

                <div className="directory-search">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="İsim veya departmana göre ara..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="form-control directory-search-input"
                    />
                </div>
            </div>

            <div className="directory-grid">
                {users.map((u, index) => (
                    <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="premium-card directory-card"
                    >
                        <div className="directory-card-avatar">
                            <ProfileAvatarImage photoPath={u.photo_path} seed={u.id || u.name} alt={u.name} className="directory-avatar-image" thumbnailSize={160} loading={index < 6 ? 'eager' : 'lazy'} />
                        </div>
                        <div className="directory-card-content">
                            <h3>{u.name}</h3>
                            <p>{u.department || 'Departman Belirtilmedi'} {u.position ? `· ${u.position}` : ''}</p>
                        </div>
                    </button>
                ))}
                {!directoryQuery.isLoading && users.length === 0 && (
                    <div className="directory-empty">
                        <p>Aradığınız kriterlere uygun çalışan bulunamadı.</p>
                    </div>
                )}
            </div>
            <PaginationControls
                pagination={directoryQuery.data?.pagination}
                onPageChange={setPage}
            />

            {selectedUser && (
                <ModalShell
                    onClose={() => setSelectedUserId(null)}
                    labelledBy="directory-profile-title"
                    overlayClassName="directory-modal-overlay"
                    surfaceClassName="directory-modal"
                >
                        <button
                            onClick={() => setSelectedUserId(null)}
                            className="directory-modal-close"
                            aria-label="Profili kapat"
                        >
                            <X size={20} />
                        </button>

                        <div className="directory-profile-hero">
                            <div className="directory-profile-avatar-frame">
                                <div className="directory-profile-avatar">
                                    <ProfileAvatarImage photoPath={selectedUser.photo_path} seed={selectedUser.id || selectedUser.name} alt={selectedUser.name} className="directory-avatar-image" thumbnailSize={320} loading="eager" />
                                </div>
                            </div>
                            <h2 id="directory-profile-title">{selectedUser.name}</h2>
                            <p>{selectedUser.department || 'Departman Belirtilmedi'} {selectedUser.position ? `· ${selectedUser.position}` : ''}</p>
                            {selectedUser.phone && getCallHref(selectedUser.phone) && (
                                <a
                                    href={getCallHref(selectedUser.phone) || undefined}
                                    aria-label={`${selectedUser.name} adlı kişiyi ara`}
                                    title="Ara"
                                    onClick={(e) => e.stopPropagation()}
                                    className="directory-profile-call"
                                >
                                    <Phone size={19} />
                                </a>
                            )}
                        </div>

                        <div className="directory-profile-body">
                            <div className="directory-profile-grid">
                                <div className="directory-profile-section">
                                    <h4 className="is-contact">
                                        <Phone size={18} /> İletişim
                                    </h4>
                                    <div className="directory-profile-lines">
                                        {selectedUser.personal_email && (
                                            <div><Mail size={16} color="var(--text-muted)" /> {selectedUser.personal_email}</div>
                                        )}
                                        {selectedUser.phone ? (
                                            <div><Phone size={16} color="var(--text-muted)" /> {selectedUser.phone}</div>
                                        ) : (
                                            <div className="directory-profile-muted">İletişim bilgisi paylaşılmıyor.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="directory-profile-section">
                                    <h4 className="is-profile">
                                        <User size={18} /> Profil Bilgileri
                                    </h4>
                                    <div className="directory-profile-lines">
                                        {selectedUser.education && !selectedUser.education_entries?.length && (
                                            <div className="directory-profile-detail-line"><BookOpen size={16} color="var(--text-muted)" /> <span><strong>Eğitim:</strong> {selectedUser.education}</span></div>
                                        )}
                                        {(selectedUser.education_entries ?? []).map((entry, index) => (
                                            <div className="directory-profile-detail-line" key={entry.id || `${entry.school}-${index}`}>
                                                <BookOpen size={16} color="var(--text-muted)" />
                                                <span><strong>{entry.school}</strong>{entry.department ? ` · ${entry.department}` : ''}</span>
                                            </div>
                                        ))}
                                        {(selectedUser.skill_tags?.length || selectedUser.skills) && (
                                            <div className="directory-profile-detail-line"><Briefcase size={16} color="var(--text-muted)" /> <span><strong>Yetenekler:</strong> {selectedUser.skill_tags?.join(', ') || selectedUser.skills}</span></div>
                                        )}
                                        {(selectedUser.hobby_tags?.length || selectedUser.hobbies) && (
                                            <div className="directory-profile-detail-line"><Heart size={16} color="var(--text-muted)" /> <span><strong>Hobiler:</strong> {selectedUser.hobby_tags?.join(', ') || selectedUser.hobbies}</span></div>
                                        )}
                                        {!selectedUser.education && !selectedUser.education_entries?.length && !selectedUser.skills && !selectedUser.skill_tags?.length && !selectedUser.hobbies && !selectedUser.hobby_tags?.length && (
                                            <div className="directory-profile-muted">Ekstra profil bilgisi girilmemiş.</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="directory-profile-section directory-badges-section">
                                <h4 className="is-badges">
                                    <Award size={18} /> Kazanılan Rozetler
                                </h4>
                                {(selectedUser.badges ?? []).length > 0 ? (
                                    <div className="directory-badges">
                                        {(selectedUser.badges ?? []).map((b: DirectoryBadge, index) => (
                                            <AchievementBadgeCard
                                                key={b.id}
                                                title={b.title || 'Eğitim Rozeti'}
                                                category={b.category}
                                                imageUrl={b.badge_image_url}
                                                priority={index < 4}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="directory-badges-empty">Henüz tamamlanmış bir eğitim/rozet bulunmuyor.</p>
                                )}
                            </div>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};
