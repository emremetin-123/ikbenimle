import { ModulePageHeader } from '../components/ModulePageHeader';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../router';
import { getPhotoUrl } from '../config';
import { Briefcase, MapPin, Calendar, ChevronRight } from 'lucide-react';
import type { JobPosting } from '../types';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { AsyncState } from '../components/AsyncState';
import { PaginationControls } from '../components/PaginationControls';
import '../index.css';

export const Careers = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const jobsQuery = useQuery({
        queryKey: [...queryKeys.employeeCareerJobs, page],
        queryFn: () => api.list<JobPosting>(
            `/api/careers/jobs?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const jobs = jobsQuery.data?.items || [];

    return (
        <div className="career-page">
            <ModulePageHeader title="Kariyer Merkezi" description="Şirket içi açık pozisyonları inceleyin ve kariyerinize yön verin." icon={<Briefcase />} />

            {/* Job List */}
            {jobsQuery.isLoading ? (
                <AsyncState
                    kind="loading"
                    title="İlanlar yükleniyor"
                    className="career-state"
                />
            ) : jobsQuery.isError ? (
                <AsyncState
                    kind="error"
                    title="İlanlar yüklenemedi"
                    message="Bağlantınızı kontrol edip yeniden deneyin."
                    onRetry={() => void jobsQuery.refetch()}
                    className="career-state"
                />
            ) : jobs.length === 0 ? (
                <AsyncState
                    kind="empty"
                    title="Açık ilan bulunmuyor"
                    message="Şu anda yayınlanmış bir kariyer ilanı bulunmamaktadır."
                    className="career-state career-state-empty"
                />
            ) : (
                <div className="career-job-list">
                    {jobs.map(job => (
                        <button
                            type="button"
                            key={job.id}
                            onClick={() => navigate(`/employee/kariyer/${job.id}`)}
                            className="career-job-card"
                        >
                            <div className="career-job-card-main">
                                <div className="career-job-media">
                                    {job.image_url ? (
                                        <img src={getPhotoUrl(job.image_url)} alt="" />
                                    ) : (
                                        <Briefcase size={28} color="var(--primary)" />
                                    )}
                                </div>
                                <div className="career-job-content">
                                    <h3>{job.title}</h3>
                                    <div className="career-job-meta">
                                        <span>
                                            <MapPin size={14} /> {job.location || 'Belirtilmedi'}
                                        </span>
                                        <span>
                                            <Briefcase size={14} /> {job.position_type || 'Belirtilmedi'}
                                        </span>
                                        <span>
                                            <Calendar size={14} /> Son Başvuru: {job.deadline_date ? new Date(job.deadline_date).toLocaleDateString('tr-TR') : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="career-job-chevron" />
                        </button>
                    ))}
                </div>
            )}
            <PaginationControls
                pagination={jobsQuery.data?.pagination}
                onPageChange={setPage}
            />
        </div>
    );
};
