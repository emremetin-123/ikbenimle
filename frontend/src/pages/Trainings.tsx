import { ModulePageHeader } from '../components/ModulePageHeader';
import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPhotoUrl } from '../config';
import { useNavigate } from '../router';
import { Award, BookOpen } from 'lucide-react';
import type { EmployeeTrainingSummary, Video } from '../types';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { PaginationControls } from '../components/PaginationControls';
import { AsyncState } from '../components/AsyncState';
import { TrainingCertificateModal } from '../components/TrainingCertificateModal';

const TrainingCover = ({ video }: { video: Video }) => {
    const [failed, setFailed] = useState(false);
    const coverUrl = getPhotoUrl(video.cover_image_url);

    if (!coverUrl || failed) {
        return (
            <div className="employee-training-cover-placeholder">
                <BookOpen size={30} aria-hidden="true" />
                <span>Kapak görseli yok</span>
            </div>
        );
    }

    return <img src={coverUrl} alt={`${video.title} kapak görseli`} onError={() => setFailed(true)} />;
};

export const Trainings = () => {
    const [certificate, setCertificate] = useState<Video | null>(null);
    const [pendingPage, setPendingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('recent');
    const deferredSearch = useDeferredValue(search.trim());
    const navigate = useNavigate();

    const trainingListParams = (status: 'pending' | 'completed', page: number) => {
        const params = new URLSearchParams({
            status,
            page: String(page),
            pageSize: '12',
        });
        if (deferredSearch) params.set('search', deferredSearch);
        if (sort === 'title') {
            params.set('sort', 'title');
            params.set('order', 'asc');
        } else if (sort === 'due') {
            params.set('sort', 'due_date');
            params.set('order', 'asc');
        } else {
            params.set('sort', status === 'completed' ? 'completed_at' : 'assigned_at');
            params.set('order', 'desc');
        }
        return params.toString();
    };

    const summaryQuery = useQuery({
        queryKey: queryKeys.employeeTrainingSummary,
        queryFn: () => api.get<EmployeeTrainingSummary>('/api/videos/summary')
    });
    const pendingQuery = useQuery({
        queryKey: [...queryKeys.employeeTrainings, 'pending', pendingPage, deferredSearch, sort],
        queryFn: () => api.list<Video>(
            `/api/videos?${trainingListParams('pending', pendingPage)}`
        ),
        placeholderData: previous => previous
    });
    const completedQuery = useQuery({
        queryKey: [...queryKeys.employeeTrainings, 'completed', completedPage, deferredSearch, sort],
        queryFn: () => api.list<Video>(
            `/api/videos?${trainingListParams('completed', completedPage)}`
        ),
        placeholderData: previous => previous
    });
    const pending = pendingQuery.data?.items || [];
    const completed = completedQuery.data?.items || [];
    const pendingCount = summaryQuery.data?.pending ?? pendingQuery.data?.pagination.total ?? 0;
    const completedCount = summaryQuery.data?.completed ?? completedQuery.data?.pagination.total ?? 0;

    const handleSelectVideo = (id: number) => {
        navigate(`/employee/egitimler/${id}`);
    };

    const certificateEnabled = (video: Video) => video.certificate_enabled !== 0 && video.certificate_enabled !== false;

    return (
        <div className="employee-trainings-page">
            <ModulePageHeader title="Eğitimlerim" description="Atanan eğitimlerinizi, ilerlemenizi ve tamamladığınız eğitimleri takip edin." icon={<BookOpen />} />
            <div className="employee-training-toolbar">
                <label className="employee-training-search">
                    <span className="sr-only">Eğitim ara</span>
                    <input
                        className="form-control"
                        type="search"
                        placeholder="Eğitim, kategori veya eğitmen ara..."
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPendingPage(1);
                            setCompletedPage(1);
                        }}
                    />
                </label>
                <label className="employee-training-sort">
                    <span className="sr-only">Eğitimleri sırala</span>
                    <select
                        className="form-control"
                        value={sort}
                        onChange={(event) => {
                            setSort(event.target.value);
                            setPendingPage(1);
                            setCompletedPage(1);
                        }}
                    >
                        <option value="recent">En güncel</option>
                        <option value="due">Son tarihe göre</option>
                        <option value="title">Ada göre</option>
                    </select>
                </label>
            </div>

            {/* Atanan Eğitimler Section */}
            <section className="employee-training-section">
                <h2 className="employee-training-section-title">
                    <span className="employee-training-section-dot is-pending" aria-hidden="true" />
                    Atanan ve Devam Eden Eğitimler
                    <span className="employee-training-count">
                        {pendingCount}
                    </span>
                </h2>
                {pendingQuery.isLoading && (
                    <AsyncState kind="loading" title="Eğitimler yükleniyor" />
                )}
                {pendingQuery.isError && (
                    <AsyncState
                        kind="error"
                        title="Eğitimler yüklenemedi"
                        message="Bağlantınızı kontrol edip yeniden deneyin."
                        onRetry={() => void pendingQuery.refetch()}
                    />
                )}
                {!pendingQuery.isLoading && !pendingQuery.isError && <div className="grid-responsive">
                    {pending.map((video) => {
                        const isExpired = video.due_date && new Date(video.due_date) < new Date();
                        return (
                            <button
                                type="button"
                                key={video.assignment_id || video.id}
                                className={`premium-card employee-training-card${isExpired ? ' is-expired' : ''}`}
                                onClick={() => !isExpired && handleSelectVideo(video.id)}
                                disabled={Boolean(isExpired)}
                            >
                                <div className="employee-training-media">
                                    <TrainingCover video={video} />
                                    {isExpired && (
                                        <div className="employee-training-expired-overlay">
                                            <span>
                                                SÜRESİ DOLDU
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="employee-training-body">
                                    <div className="employee-training-meta">
                                        <span className={`badge ${isExpired ? 'badge-expired' : 'badge-pending'}`}>
                                            {isExpired ? 'Süresi Doldu' : 'Beklemede'}
                                        </span>
                                        <span className="employee-training-category is-pending">{video.category || 'GENEL'}</span>
                                    </div>

                                    <h3 className="employee-training-title">{video.title}</h3>
                                    <p className="employee-training-description">
                                        {video.description}
                                    </p>

                                    <div className="employee-training-details">
                                        {video.trainer_name && (
                                            <div className="employee-training-trainer">
                                                <span className="employee-training-detail-label">Eğitmen:</span>
                                                <span className="employee-training-detail-value">{video.trainer_name}</span>
                                            </div>
                                        )}
                                        <div className="employee-training-deadline">
                                            {video.duration && <span>{video.duration}</span>}
                                            {video.due_date && (
                                                <span className={isExpired ? 'is-expired' : undefined}>
                                                    Son: {new Date(video.due_date).toLocaleDateString('tr-TR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>}
                {!pendingQuery.isLoading && !pendingQuery.isError && pending.length === 0 && (
                    <div className="employee-training-empty">
                        <p>Şu an bekleyen veya devam eden bir eğitiminiz bulunmuyor.</p>
                    </div>
                )}
                <PaginationControls
                    pagination={pendingQuery.data?.pagination}
                    onPageChange={setPendingPage}
                />
            </section>

            {/* Tamamlanan Eğitimler Section */}
            <section className="employee-training-section completed">
                <h2 className="employee-training-section-title">
                    <span className="employee-training-section-dot is-completed" aria-hidden="true" />
                    Tamamlanan Eğitimler ve Sertifikalar
                    <span className="employee-training-count">
                        {completedCount}
                    </span>
                </h2>
                {completedQuery.isLoading && (
                    <AsyncState kind="loading" title="Tamamlanan eğitimler yükleniyor" />
                )}
                {completedQuery.isError && (
                    <AsyncState
                        kind="error"
                        title="Tamamlanan eğitimler yüklenemedi"
                        message="Bağlantınızı kontrol edip yeniden deneyin."
                        onRetry={() => void completedQuery.refetch()}
                    />
                )}
                {!completedQuery.isLoading && !completedQuery.isError && <div className="grid-responsive">
                    {completed.map((video) => (
                        <div
                            key={video.assignment_id || video.id}
                            className="premium-card employee-training-card completed"
                        >
                            <div className="employee-training-media">
                                <TrainingCover video={video} />
                            </div>
                            <div className="employee-training-body">
                                <div className="employee-training-meta">
                                    <span className="badge badge-completed">Tamamlandı</span>
                                    <span className="employee-training-category is-completed">{video.video_category || video.category || 'GENEL'}</span>
                                </div>

                                <h3 className="employee-training-title">{video.title}</h3>

                                {video.quiz_score !== null && (
                                    <div className="employee-training-score">
                                        <span>Başarı Skoru</span>
                                        <strong>%{video.quiz_score}</strong>
                                    </div>
                                )}

                                {certificateEnabled(video) && video.reference_id ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCertificate(video);
                                        }}
                                        className="btn-primary employee-training-certificate-button"
                                    >
                                        <Award size={18} /> Sertifikayı Görüntüle
                                    </button>
                                ) : certificateEnabled(video) ? (
                                    <div className="employee-training-certificate-state">
                                        Onay Bekleniyor
                                    </div>
                                ) : (
                                    <div className="employee-training-certificate-state">
                                        Sertifika tanımlı değil
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>}
                <PaginationControls
                    pagination={completedQuery.data?.pagination}
                    onPageChange={setCompletedPage}
                />
            </section>
            {certificate && <TrainingCertificateModal key={certificate.assignment_id || certificate.id} certificate={certificate} onClose={() => setCertificate(null)} />}
        </div>
    );

};
