import { ModulePageHeader } from '../components/ModulePageHeader';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../config';
import type { DocumentItem, DocumentRequest, DocumentRequestType } from '../types';
import { ClipboardList, Download, FileText, Plus, Send } from 'lucide-react';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { PaginationControls } from '../components/PaginationControls';
import { useAppFeedback } from '../components/AppFeedback';

type TabKey = 'payrolls' | 'new-request' | 'requests';

const statusClass = (status: string) => {
    if (status === 'Tamamlandı') return 'is-completed';
    if (status === 'Reddedildi') return 'is-rejected';
    if (status === 'Hazırlanıyor') return 'is-preparing';
    return 'is-pending';
};

export const Documents = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [activeTab, setActiveTab] = useState<TabKey>('payrolls');
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [documentPage, setDocumentPage] = useState(1);
    const [requestPage, setRequestPage] = useState(1);

    const documentsQuery = useQuery({
        queryKey: [...queryKeys.employeeDocuments, documentPage],
        queryFn: () => api.list<DocumentItem>(
            `/api/documents?page=${documentPage}&pageSize=12&sort=upload_date&order=desc`
        ),
        placeholderData: previous => previous
    });
    const typesQuery = useQuery({
        queryKey: queryKeys.employeeDocumentTypes,
        queryFn: () => api.get<DocumentRequestType[]>('/api/document-request-types')
    });
    const requestsQuery = useQuery({
        queryKey: [...queryKeys.employeeDocumentRequests, requestPage],
        queryFn: () => api.list<DocumentRequest>(
            `/api/document-requests?page=${requestPage}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const documents = documentsQuery.data?.items || [];
    const types = typesQuery.data || [];
    const requests = requestsQuery.data?.items || [];
    const loading = documentsQuery.isLoading || typesQuery.isLoading || requestsQuery.isLoading;

    const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('tr-TR') : '-');
    const fileHref = (path?: string | null) => path?.startsWith('http') ? path : `${API_BASE}${path || ''}`;
    const selectedType = types.find(type => String(type.id) === selectedTypeId);

    const submitMutation = useMutation({
        mutationFn: (body: { type_id: number; answers: Record<string, string> }) =>
            api.post<{ success: true; id: number }>('/api/document-requests', body),
        onSuccess: async () => {
            setSelectedTypeId('');
            setAnswers({});
            setRequestPage(1);
            setActiveTab('requests');
            await queryClient.invalidateQueries({ queryKey: queryKeys.employeeDocumentRequests });
        }
    });

    const handleDownload = (title: string, path?: string | null) => {
        if (!path) return;
        const link = document.createElement('a');
        link.href = fileHref(path);
        link.download = title;
        link.click();
    };

    const handleTypeChange = (id: string) => {
        setSelectedTypeId(id);
        setAnswers({});
    };

    const submitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedType) {
            feedback.notifyInfo('Belge türü seçiniz.');
            return;
        }
        try {
            await submitMutation.mutateAsync({ type_id: selectedType.id, answers });
            feedback.notifySuccess('Belge talebiniz iletildi.');
        } catch (error) {
            feedback.notifyError(error instanceof Error ? error.message : 'Talep oluşturulamadı.');
        }
    };

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'payrolls', label: 'Bordrolarım', icon: <FileText size={18} /> },
        { key: 'requests', label: 'Taleplerim', icon: <ClipboardList size={18} /> }
    ];

    return (
        <div className="documents-page">
            <ModulePageHeader title="Belgelerim" description="Bordrolarınızı görüntüleyin, ihtiyaç duyduğunuz şirket belgelerini talep edin." icon={<FileText />} actions={<button type="button" className="btn-secondary" onClick={() => setActiveTab('new-request')} aria-pressed={activeTab === 'new-request'}><Plus size={18} /> Belge Talep Et</button>} />

            <div className="document-tab-bar documents-page-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`document-tab-button ${activeTab === tab.key ? 'active' : ''}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="documents-loading">
                    <p className="document-muted-text">Belgeler yükleniyor...</p>
                </div>
            ) : activeTab === 'payrolls' ? (
                <>
                {documents.length === 0 ? (
                    <div className="premium-card documents-empty-state">
                        <FileText size={64} color="var(--text-muted)" className="documents-empty-icon" />
                        <p className="documents-empty-text">Sisteme yüklenmiş herhangi bir bordronuz bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="grid-responsive">
                        {documents.map(doc => (
                            <div key={doc.id} className="premium-card document-payroll-card">
                                <div className="document-payroll-header">
                                    <div className="document-payroll-icon">
                                        <FileText size={24} color="var(--primary)" />
                                    </div>
                                    <div className="document-payroll-content">
                                        <h3 className="document-payroll-title">{doc.title}</h3>
                                        <p className="document-payroll-date">{formatDate(doc.upload_date)}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDownload(doc.title, doc.file_path)} className="document-secondary-button document-payroll-download">
                                    <Download size={16} /> Dosyayı İndir
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <PaginationControls
                    pagination={documentsQuery.data?.pagination}
                    onPageChange={setDocumentPage}
                />
                </>
            ) : activeTab === 'new-request' ? (
                <form onSubmit={submitRequest} className="premium-card document-request-form">
                    <div>
                        <h3 className="document-section-title">Yeni Belge Talebi</h3>
                        <p className="document-muted-text document-reset-margin">Belge türünü seçin ve gerekli bilgileri doldurun.</p>
                    </div>
                    <div className="input-group document-form-field">
                        <label className="input-label">Belge Türü</label>
                        <select className="form-control" value={selectedTypeId} onChange={e => handleTypeChange(e.target.value)} required>
                            <option value="">Belge seçiniz...</option>
                            {types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                        </select>
                    </div>
                    {selectedType?.fields.map(field => (
                        <div className="input-group document-form-field" key={field.id || field.field_key}>
                            <label className="input-label">{field.label}{field.is_required ? ' *' : ''}</label>
                            {field.field_type === 'textarea' ? (
                                <textarea className="form-control" rows={4} value={answers[field.field_key] || ''} onChange={e => setAnswers({ ...answers, [field.field_key]: e.target.value })} required={Boolean(field.is_required)} placeholder={field.placeholder || ''} />
                            ) : (
                                <input className="form-control" type={field.field_type || 'text'} value={answers[field.field_key] || ''} onChange={e => setAnswers({ ...answers, [field.field_key]: e.target.value })} required={Boolean(field.is_required)} placeholder={field.placeholder || ''} />
                            )}
                        </div>
                    ))}
                    <button type="submit" disabled={submitMutation.isPending} className="document-action-button document-request-submit">
                        <Send size={18} /> {submitMutation.isPending ? 'Gönderiliyor...' : 'Talebi Gönder'}
                    </button>
                </form>
            ) : (
                <div className="document-requests-list">
                    {requests.length === 0 ? (
                        <div className="premium-card document-requests-empty">Henüz belge talebiniz bulunmuyor.</div>
                    ) : requests.map(request => (
                        <div key={request.id} className="premium-card document-request-card">
                            <div className="document-request-card-header">
                                <div>
                                    <h3 className="document-request-title">{request.type_name}</h3>
                                    <p className="document-request-date">Talep tarihi: {formatDate(request.created_at)}</p>
                                </div>
                                <span className={`document-status-badge ${statusClass(request.status)}`}>{request.status}</span>
                            </div>
                            {request.hr_note && <div className="document-request-note">İK Notu: {request.hr_note}</div>}
                            {request.response_file_path && (
                                <button type="button" onClick={() => handleDownload(request.response_file_name || request.type_name || 'Belge', request.response_file_path)} className="document-action-button document-response-download">
                                    <Download size={16} /> Hazırlanan Evrakı İndir
                                </button>
                            )}
                        </div>
                    ))}
                    {requestsQuery.data && (
                        <PaginationControls
                            pagination={requestsQuery.data.pagination}
                            onPageChange={setRequestPage}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
