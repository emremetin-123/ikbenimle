import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from '../router';
import { getPhotoUrl } from '../config';
import { ArrowLeft, Heart, CheckCircle } from 'lucide-react';
import type { JobPosting } from '../types';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';
import '../index.css';

export const JobDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const jobQuery = useQuery({
        queryKey: [...queryKeys.employeeCareerJobDetail, id],
        queryFn: () => api.get<JobPosting>(`/api/careers/jobs/${id}`),
        enabled: Boolean(id)
    });
    const applyMutation = useMutation({
        mutationFn: () => api.post(`/api/careers/jobs/${id}/apply`),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: [...queryKeys.employeeCareerJobDetail, id]
                }),
                queryClient.invalidateQueries({ queryKey: queryKeys.employeeCareerJobs }),
                queryClient.invalidateQueries({ queryKey: queryKeys.employeeCareerApplications })
            ]);
        }
    });
    const job = jobQuery.data || null;

    const handleApply = async () => {
        if (!job || job.user_applied) return;
        try {
            await applyMutation.mutateAsync();
            feedback.notifySuccess('Başvurunuz başarıyla alındı.');
        } catch (err) {
            feedback.notifyError(err instanceof Error ? err.message : 'Başvuru sırasında bir hata oluştu.');
        }
    };

    if (jobQuery.isLoading) return <LoadingIndicator label="İlan yükleniyor" />;
    if (!job) return <div className="career-detail-state">İlan bulunamadı.</div>;

    const renderTextToList = (text?: string | null) => {
        if (!text) return null;
        return (
            <ul className="career-detail-list">
                {text.split('\n').filter(l => l.trim()).map((line, idx) => (
                    <li key={idx}>{line.replace(/^[-•*]\s*/, '')}</li>
                ))}
            </ul>
        );
    };

    return (
        <div className="career-detail-page">

            {/* Top Navigation Bar */}
            <div className="career-detail-nav">
                <button onClick={() => navigate(-1)} className="career-detail-back">
                    <ArrowLeft size={24} />
                    <span>İlan Detayı</span>
                </button>
            </div>

            <div className="career-detail-body">
                {/* Cover Image */}
                <div className="career-detail-cover">
                    {job.image_url ? (
                        <img src={getPhotoUrl(job.image_url)} alt="Kapak" />
                    ) : (
                        <div className="career-detail-cover-fallback">
                            <h2>{job.title}</h2>
                        </div>
                    )}
                </div>

                {/* Job Title & Info Box */}
                <h3 className="career-detail-title">{job.title}</h3>

                <div className="career-detail-section career-detail-facts">
                    <div className="career-detail-fact">
                        <span className="career-detail-label">İlan Tarihi :</span>
                        <span className="career-detail-value">{job.publish_date ? new Date(job.publish_date).toLocaleDateString('tr-TR') : '-'}</span>
                    </div>
                    <div className="career-detail-fact">
                        <span className="career-detail-label">Son Başvuru Tarihi :</span>
                        <span className="career-detail-value career-detail-value-danger">{job.deadline_date ? new Date(job.deadline_date).toLocaleDateString('tr-TR') : '-'}</span>
                    </div>
                    <div className="career-detail-fact">
                        <span className="career-detail-label">Pozisyon Türü :</span>
                        <span className="career-detail-value career-detail-value-primary">{job.position_type || '-'}</span>
                    </div>
                    <div className="career-detail-fact">
                        <span className="career-detail-label">Görev Yeri :</span>
                        <span className="career-detail-value career-detail-value-primary">{job.location || '-'}</span>
                    </div>
                    <div className="career-detail-fact">
                        <span className="career-detail-label">Bağlı Olacağı 1. Yönetici :</span>
                        <span className="career-detail-value">{job.manager_name || '-'}</span>
                    </div>
                </div>

                {/* İş Tanımı */}
                <div className="career-detail-section">
                    <h4>İş Tanımı</h4>
                    <div className="career-detail-work">
                        <div><span>Çalışma Yeri:</span> <strong>{job.location || '-'}</strong></div>
                        <div><span>Çalışma Modeli:</span> <strong>{job.work_model || '-'}</strong></div>
                    </div>
                    {renderTextToList(job.job_description)}
                </div>

                {/* Nitelikler */}
                {job.qualifications && (
                    <div className="career-detail-section">
                        <h4>Nitelikler</h4>
                        {renderTextToList(job.qualifications)}
                    </div>
                )}

                {/* Ön Koşullar */}
                {job.prerequisites && (
                    <div className="career-detail-section">
                        <h4>Ön Koşullar</h4>
                        {renderTextToList(job.prerequisites)}
                    </div>
                )}

                {/* Açıklama */}
                {job.additional_notes && (
                    <div className="career-detail-section">
                        <h4>Açıklama</h4>
                        <div className="career-detail-notes">
                            {job.additional_notes}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            <div className="career-detail-actions">
                <button className="career-detail-favorite" aria-label="İlanı favorilere ekle">
                    <Heart size={28} />
                </button>
                <button
                    onClick={handleApply}
                    disabled={job.user_applied || applyMutation.isPending}
                    className={`career-detail-apply${job.user_applied ? ' is-applied' : ''}`}
                >
                    {job.user_applied ? (
                        <>
                            <CheckCircle size={20} /> BAŞVURULDU
                        </>
                    ) : (
                        applyMutation.isPending ? 'İŞLENİYOR...' : 'BAŞVUR'
                    )}
                </button>
            </div>
        </div>
    );
};
