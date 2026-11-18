import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Trash2, Plus, Edit2, Users, Save, X } from 'lucide-react';
import { ModulePageHeader } from './components/ModulePageHeader';
import './index.css';
import type { JobApplication, JobPosting } from './types';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { PaginationControls } from './components/PaginationControls';
import { StatusBadge, type StatusBadgeTone } from './components/StatusBadge';
import { useAppFeedback } from './components/AppFeedback';
import { ModalShell } from './components/ModalShell';
import { LoadingIndicator } from './components/LoadingIndicator';

export const AdminCareers = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [page, setPage] = useState(1);
    const [applicationsPage, setApplicationsPage] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
    const [viewingAppsFor, setViewingAppsFor] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        image_url: '',
        publish_date: '',
        deadline_date: '',
        position_type: '',
        location: '',
        manager_name: '',
        work_model: '',
        job_description: '',
        qualifications: '',
        prerequisites: '',
        additional_notes: '',
        status: 'active'
    });

    const jobsQuery = useQuery({
        queryKey: [...queryKeys.adminCareerJobs, page],
        queryFn: () => api.list<JobPosting>(
            `/api/careers/admin/jobs?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const applicationsQuery = useQuery({
        queryKey: [...queryKeys.adminCareerApplications, viewingAppsFor, applicationsPage],
        queryFn: () => api.list<JobApplication>(
            `/api/careers/admin/jobs/${viewingAppsFor}/applications?page=${applicationsPage}&pageSize=10&sort=applied_at&order=desc`
        ),
        enabled: viewingAppsFor !== null
    });
    const saveMutation = useMutation({
        mutationFn: ({ id, body }: { id?: number; body: typeof formData }) =>
            id
                ? api.put(`/api/careers/admin/jobs/${id}`, body)
                : api.post('/api/careers/admin/jobs', body),
        onSuccess: async () => {
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminCareerJobs });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/api/careers/admin/jobs/${id}`),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminCareerJobs });
        }
    });
    const applicationStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) =>
            api.put(`/api/careers/admin/applications/${id}/status`, { status }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.adminCareerApplications }),
                queryClient.invalidateQueries({ queryKey: queryKeys.adminCareerJobs })
            ]);
        }
    });
    const jobs = jobsQuery.data?.items || [];
    const applications = applicationsQuery.data?.items || [];
    const applicationStatusTone = (status: string): StatusBadgeTone => {
        if (status === 'approved') return 'success';
        if (status === 'reviewing') return 'info';
        if (status === 'rejected') return 'danger';
        return 'warning';
    };

    const fetchApplications = (jobId: number) => {
        setApplicationsPage(1);
        setViewingAppsFor(jobId);
    };

    const updateApplicationStatus = async (appId: number, status: string) => {
        try {
            await applicationStatusMutation.mutateAsync({ id: appId, status });
        } catch (err) {
            feedback.notifyError(err instanceof Error ? err.message : 'Başvuru durumu güncellenemedi.');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveMutation.mutateAsync({ id: editingJob?.id, body: formData });
            feedback.notifySuccess('İlan başarıyla kaydedildi.');
            setIsEditing(false);
            setEditingJob(null);
            setFormData({
                title: '', image_url: '', publish_date: '', deadline_date: '', position_type: '', location: '', manager_name: '', work_model: '', job_description: '', qualifications: '', prerequisites: '', additional_notes: '', status: 'active'
            });
        } catch (err) {
            feedback.notifyError(err instanceof Error ? err.message : 'İlan kaydedilemedi.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!await feedback.confirm({ title: 'İlanı sil', message: 'İlan ve ilana ait tüm başvurular kalıcı olarak silinecek.', confirmLabel: 'İlanı Sil', danger: true })) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (err) {
            feedback.notifyError(err instanceof Error ? err.message : 'İlan silinemedi.');
        }
    };

    const openEdit = (job?: JobPosting) => {
        if (job) {
            setEditingJob(job);
            setFormData({
                title: job.title || '',
                image_url: job.image_url || '',
                publish_date: job.publish_date || '',
                deadline_date: job.deadline_date || '',
                position_type: job.position_type || '',
                location: job.location || '',
                manager_name: job.manager_name || '',
                work_model: job.work_model || '',
                job_description: job.job_description || '',
                qualifications: job.qualifications || '',
                prerequisites: job.prerequisites || '',
                additional_notes: job.additional_notes || '',
                status: job.status || 'active'
            });
        } else {
            setEditingJob(null);
            setFormData({
                title: '', image_url: '', publish_date: '', deadline_date: '', position_type: '', location: '', manager_name: '', work_model: '', job_description: '', qualifications: '', prerequisites: '', additional_notes: '', status: 'active'
            });
        }
        setIsEditing(true);
    };

    if (jobsQuery.isLoading) return <LoadingIndicator label="Kariyer kayıtları yükleniyor" />;

    if (viewingAppsFor) {
        return (
            <div>
                <button onClick={() => setViewingAppsFor(null)} className="career-admin-back">
                    &larr; İlanlara Dön
                </button>
                <h2>Başvurular</h2>
                {applicationsQuery.isLoading ? <p>Başvurular yükleniyor...</p> : applications.length === 0 ? <p>Henüz başvuru yok.</p> : (
                    <div className="career-admin-table-wrap">
                    <table className="career-admin-table">
                        <thead>
                            <tr>
                                <th>Aday</th>
                                <th>Departman</th>
                                <th>İletişim</th>
                                <th>Tarih</th>
                                <th>Durum</th>
                                <th className="career-admin-cell-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map(app => (
                                <tr key={app.id}>
                                    <td>
                                        <div><strong>{app.name}</strong></div>
                                        <div className="career-admin-secondary">#{app.employee_id}</div>
                                    </td>
                                    <td>{app.department || '-'} {app.position ? `(${app.position})` : ''}</td>
                                    <td>
                                        <div>{app.phone || '-'}</div>
                                        <div className="career-admin-secondary">{app.email || '-'}</div>
                                    </td>
                                    <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString('tr-TR') : '-'}</td>
                                    <td>
                                        <StatusBadge
                                            tone={applicationStatusTone(app.status)}
                                            className={`career-admin-status is-${app.status}`}
                                        >
                                            {app.status}
                                        </StatusBadge>
                                    </td>
                                    <td className="career-admin-cell-center">
                                        <select
                                            value={app.status}
                                            onChange={(e) => updateApplicationStatus(app.id, e.target.value)}
                                            className="career-admin-status-select"
                                        >
                                            <option value="pending">Bekliyor</option>
                                            <option value="reviewing">Değerlendiriliyor</option>
                                            <option value="approved">Onaylandı</option>
                                            <option value="rejected">Reddedildi</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
                <PaginationControls
                    pagination={applicationsQuery.data?.pagination}
                    onPageChange={setApplicationsPage}
                />
            </div>
        );
    }

    const editorModal = isEditing ? (
        <ModalShell onClose={() => setIsEditing(false)} labelledBy="career-admin-modal-title" className="admin-action-modal">
                <div className="admin-modal-header">
                    <h2 id="career-admin-modal-title" className="career-admin-modal-title">{editingJob ? 'İlanı Düzenle' : 'Yeni İlan Ekle'}</h2>
                    <button type="button" className="admin-modal-close" onClick={() => setIsEditing(false)} title="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSave} className="career-admin-form">


                    <div className="responsive-grid-2">
                        <div>
                            <label className="input-label">İlan Başlığı</label>
                            <input required type="text" className="form-control" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">Kapak Görseli URL</label>
                            <input type="text" className="form-control" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} />
                        </div>
                    </div>

                    <div className="responsive-grid-4">
                        <div>
                            <label className="input-label">İlan Tarihi</label>
                            <input type="date" className="form-control" value={formData.publish_date} onChange={e => setFormData({...formData, publish_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">Son Başvuru Tarihi</label>
                            <input type="date" className="form-control" value={formData.deadline_date} onChange={e => setFormData({...formData, deadline_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">Durum</label>
                            <select className="form-control" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                <option value="active">Aktif</option>
                                <option value="inactive">Pasif</option>
                            </select>
                        </div>
                    </div>

                    <div className="responsive-grid-2">
                        <div>
                            <label className="input-label">Pozisyon Türü</label>
                            <input type="text" className="form-control" value={formData.position_type} onChange={e => setFormData({...formData, position_type: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">Görev Yeri</label>
                            <input type="text" className="form-control" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">1. Yönetici</label>
                            <input type="text" className="form-control" value={formData.manager_name} onChange={e => setFormData({...formData, manager_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="input-label">Çalışma Modeli</label>
                            <input type="text" className="form-control" value={formData.work_model} onChange={e => setFormData({...formData, work_model: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="input-label">İş Tanımı (Her satır madde imi olur)</label>
                        <textarea rows={4} className="form-control" value={formData.job_description} onChange={e => setFormData({...formData, job_description: e.target.value})}></textarea>
                    </div>

                    <div>
                        <label className="input-label">Nitelikler (Her satır madde imi olur)</label>
                        <textarea rows={4} className="form-control" value={formData.qualifications} onChange={e => setFormData({...formData, qualifications: e.target.value})}></textarea>
                    </div>

                    <div>
                        <label className="input-label">Ön Koşullar (Her satır madde imi olur)</label>
                        <textarea rows={4} className="form-control" value={formData.prerequisites} onChange={e => setFormData({...formData, prerequisites: e.target.value})}></textarea>
                    </div>

                    <div>
                        <label className="input-label">Açıklama (Düz metin)</label>
                        <textarea rows={3} className="form-control" value={formData.additional_notes} onChange={e => setFormData({...formData, additional_notes: e.target.value})}></textarea>
                    </div>

                    <div className="admin-modal-actions">
                        <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel career-admin-cancel">İptal</button>
                        <button type="submit" className="btn-primary career-admin-save" disabled={saveMutation.isPending}>
                            <Save size={20} /> {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </form>
        </ModalShell>
    ) : null;

    return (
        <div className="career-admin">
            {editorModal}
            <ModulePageHeader title="Kariyer İşlemleri" description="Şirket içi ilanları yayınlayın, başvuruları inceleyin ve süreçlerini takip edin." icon={<Briefcase />} actions={
                <button
                    type="button"
                    onClick={() => openEdit()}
                    className="btn-primary career-admin-create"
                >
                    <Plus size={20} /> Yeni İlan
                </button>
            } />

            <div className="career-admin-table-wrap">
                <table className="career-admin-table">
                    <thead>
                        <tr>
                            <th>Başlık</th>
                            <th>Bitiş Tarihi</th>
                            <th className="career-admin-cell-center">Başvurular</th>
                            <th className="career-admin-cell-center">Durum</th>
                            <th className="career-admin-cell-center">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map(job => (
                            <tr key={job.id}>
                                <td>
                                    <strong>{job.title}</strong>
                                    <div className="career-admin-secondary">{job.position_type} - {job.location}</div>
                                </td>
                                <td>
                                    {job.deadline_date ? new Date(job.deadline_date).toLocaleDateString('tr-TR') : '-'}
                                </td>
                                <td className="career-admin-cell-center">
                                    <button
                                        onClick={() => fetchApplications(job.id)}
                                        className="career-admin-applications"
                                    >
                                        <Users size={16} /> {job.application_count || 0}
                                    </button>
                                </td>
                                <td className="career-admin-cell-center">
                                    <StatusBadge
                                        tone={job.status === 'active' ? 'success' : 'danger'}
                                        className={`career-admin-status ${job.status === 'active' ? 'is-active' : 'is-inactive'}`}
                                    >
                                        {job.status === 'active' ? 'Aktif' : 'Pasif'}
                                    </StatusBadge>
                                </td>
                                <td className="career-admin-cell-center">
                                    <button onClick={() => openEdit(job)} className="career-admin-icon-button is-edit" title="Düzenle">
                                        <Edit2 size={20} />
                                    </button>
                                    <button onClick={() => handleDelete(job.id)} className="career-admin-icon-button is-delete" title="Sil">
                                        <Trash2 size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {jobs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="career-admin-empty">Kayıtlı ilan bulunamadı.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControls
                pagination={jobsQuery.data?.pagination}
                onPageChange={setPage}
            />
        </div>
    );
};
