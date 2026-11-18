import { ModulePageHeader } from './components/ModulePageHeader';
import { useDeferredValue, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from './config';
import type { AdminUser, DocumentRequest, DocumentRequestStatus, DocumentRequestType } from './types';
import { ExportExcelButton } from './components/ExportExcelButton';
import { PaginationControls } from './components/PaginationControls';
import { Edit3, FileText, Plus, Settings, Upload } from 'lucide-react';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { useAppFeedback } from './components/AppFeedback';
import { DocumentRequestModal } from './admin-documents/DocumentRequestModal';
import { DocumentTypeModal } from './admin-documents/DocumentTypeModal';
import { LoadingIndicator } from './components/LoadingIndicator';
import { emptyDocumentTypeDraft, makeDocumentFieldKey } from './admin-documents/documentTypeSupport';

type AdminDocTab = 'payroll' | 'requests' | 'types';

const requestStatuses: DocumentRequestStatus[] = ['Beklemede', 'Hazırlanıyor', 'Tamamlandı', 'Reddedildi'];

export const AdminDocuments = () => {
    const feedback = useAppFeedback();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [title, setTitle] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedUserOption, setSelectedUserOption] = useState<AdminUser | null>(null);
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState('');
    const [activeTab, setActiveTab] = useState<AdminDocTab>('requests');
    const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
    const [requestStatus, setRequestStatus] = useState<DocumentRequestStatus>('Beklemede');
    const [hrNote, setHrNote] = useState('');
    const [responseFile, setResponseFile] = useState<File | null>(null);
    const [typeModalOpen, setTypeModalOpen] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
    const [typeForm, setTypeForm] = useState(emptyDocumentTypeDraft);
    const [filters, setFilters] = useState({ status: '', type: '', search: '', start: '', end: '' });
    const deferredSearch = useDeferredValue(filters.search.trim());
    const deferredUserSearch = useDeferredValue(userSearch.trim());
    const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('tr-TR') : '-');
    const fileHref = (path?: string | null) => path?.startsWith('http') ? path : `${API_BASE}${path || ''}`;
    const getAnswerLabel = (request: DocumentRequest, key: string) => {
        const type = types.find(item => Number(item.id) === Number(request.type_id));
        return type?.fields.find(field => field.field_key === key)?.label || key;
    };

    const buildRequestParams = () => {
        const params = new URLSearchParams({ sort: 'created_at', order: 'desc' });
        if (deferredSearch) params.set('search', deferredSearch);
        if (filters.status) params.set('status', filters.status);
        if (filters.type) params.set('type', filters.type);
        if (filters.start) params.set('start', filters.start);
        if (filters.end) params.set('end', filters.end);
        return params;
    };
    const requestsQuery = useQuery({
        queryKey: [...queryKeys.adminDocumentRequests, { page, search: deferredSearch, status: filters.status, type: filters.type, start: filters.start, end: filters.end }],
        queryFn: () => {
            const params = buildRequestParams();
            params.set('page', String(page));
            params.set('pageSize', '25');
            return api.list<DocumentRequest>(`/api/admin/document-requests?${params.toString()}`);
        },
        placeholderData: previous => previous,
    });
    const usersQuery = useQuery({
        queryKey: [...queryKeys.adminDocumentUserOptions, { page: userPage, search: deferredUserSearch }],
        queryFn: () => {
            const params = new URLSearchParams({ page: String(userPage), pageSize: '25' });
            if (deferredUserSearch) params.set('search', deferredUserSearch);
            return api.list<AdminUser>(`/api/admin/document-user-options?${params.toString()}`);
        },
        staleTime: 5 * 60_000,
        placeholderData: previous => previous,
        enabled: activeTab === 'payroll',
    });
    const typesQuery = useQuery({
        queryKey: queryKeys.adminDocumentTypes,
        queryFn: () => api.get<DocumentRequestType[]>('/api/admin/document-request-types'),
        staleTime: 5 * 60_000,
    });
    const requests = requestsQuery.data?.items || [];
    const users = usersQuery.data?.items || [];
    const types = typesQuery.data || [];
    const refreshData = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.adminDocumentRequests }),
            queryClient.invalidateQueries({ queryKey: queryKeys.adminDocumentTypes }),
            queryClient.invalidateQueries({ queryKey: queryKeys.adminDocumentUserOptions }),
        ]);
    };

    const handlePayrollSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !selectedUser) return feedback.notifyInfo('Kullanıcı ve dosya zorunludur.');
        setStatus('Yükleniyor...');

        const formData = new FormData();
        formData.append('user_id', selectedUser);
        formData.append('title', title);
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/admin/documents`, {
            method: 'POST',

            body: formData
        });

        if (res.ok) {
            feedback.notifySuccess('Bordro başarıyla yüklendi ve kişiye atandı.');
            setTitle('');
            setSelectedUser('');
            setSelectedUserOption(null);
            setFile(null);
            setStatus('');
        } else {
            feedback.notifyError('Bordro yüklenemedi.');
            setStatus('');
        }
    };

    const openRequest = (request: DocumentRequest) => {
        setSelectedRequest(request);
        setRequestStatus(request.status as DocumentRequestStatus);
        setHrNote(request.hr_note || '');
        setResponseFile(null);
    };

    const updateRequest = async () => {
        if (!selectedRequest) return;
        const res = await fetch(`${API_BASE}/api/admin/document-requests/${selectedRequest.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: requestStatus, hr_note: hrNote })
        });
        if (!res.ok) return feedback.notifyError('Talep güncellenemedi.');

        if (responseFile) {
            const body = new FormData();
            body.append('file', responseFile);
            const uploadRes = await fetch(`${API_BASE}/api/admin/document-requests/${selectedRequest.id}/file`, {
                method: 'POST',

                body
            });
            if (!uploadRes.ok) return feedback.notifyError('Talep güncellendi ancak dosya yüklenemedi.');
        }
        setSelectedRequest(null);
        await refreshData();
    };

    const openTypeModal = (type?: DocumentRequestType) => {
        if (type) {
            setEditingTypeId(type.id);
            setTypeForm({
                name: type.name,
                description: type.description || '',
                is_active: type.is_active !== 0 && type.is_active !== false,
                order_index: Number(type.order_index || 0),
                fields: type.fields.length ? type.fields.map(field => ({
                    label: field.label,
                    field_key: field.field_key,
                    field_type: field.field_type || 'text',
                    is_required: field.is_required === 1 || field.is_required === true,
                    placeholder: field.placeholder || ''
                })) : []
            });
        } else {
            setEditingTypeId(null);
            setTypeForm(emptyDocumentTypeDraft());
        }
        setTypeModalOpen(true);
    };

    const saveType = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...typeForm,
            fields: typeForm.fields.map((field, index) => ({
                ...field,
                field_key: field.field_key || makeDocumentFieldKey(field.label),
                order_index: index + 1
            }))
        };
        const res = await fetch(`${API_BASE}/api/admin/document-request-types${editingTypeId ? `/${editingTypeId}` : ''}`, {
            method: editingTypeId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            setTypeModalOpen(false);
            await refreshData();
        } else {
            const data = await res.json().catch(() => ({}));
            feedback.notifyError(data.error || 'Belge türü kaydedilemedi.');
        }
    };

    const downloadRequestsExcel = async () => {
        const params = buildRequestParams();
        const allRequests = await api.listAll<DocumentRequest>(
            `/api/admin/document-requests?${params.toString()}`
        );
        if (!allRequests.length) return;
        const headers = ['Talep No', 'Tarih', 'Calisan', 'Sicil', 'Bolum', 'Belge Turu', 'Durum', 'IK Notu', 'Cevap Dosyasi', 'Form Cevaplari'];
        const rows = allRequests.map(request => [
            request.id,
            formatDate(request.created_at),
            request.user_name || '-',
            request.employee_id || '-',
            request.department || '-',
            request.type_name || '-',
            request.status,
            request.hr_note || '-',
            request.response_file_path ? 'Yuklendi' : 'Yok',
            Object.entries(request.answers || {}).map(([key, value]) => `${key}: ${value}`).join(' | ') || '-'
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'));
        const blob = new Blob(['\uFEFF' + [headers.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `belge_talepleri_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const tabs: { key: AdminDocTab; label: string; icon: React.ReactNode }[] = [
        { key: 'requests', label: 'Belge Talepleri', icon: <FileText size={18} /> },
        { key: 'payroll', label: 'Bordro Yükleme', icon: <Upload size={18} /> },
        { key: 'types', label: 'Belge Türleri', icon: <Settings size={18} /> }
    ];

    return (
        <div className="admin-documents-page">
            <ModulePageHeader title="Belge İşlemleri" description="Bordro yükleyin, çalışan belge taleplerini karşılayın ve talep formlarını yönetin." icon={<FileText />} />

            <div className="document-tab-bar">
                {tabs.map(tab => (
                    <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`document-tab-button ${activeTab === tab.key ? 'active' : ''}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'requests' && (
                <div className="premium-card admin-document-panel">
                    <div className="admin-document-panel-header">
                        <h3 className="document-reset-margin">Gelen Belge Talepleri</h3>
                        <ExportExcelButton onClick={() => void downloadRequestsExcel()} disabled={!requestsQuery.data?.pagination.total} />
                    </div>
                    <div className="responsive-grid-3">
                        <input className="form-control" placeholder="Çalışan, sicil, bölüm veya belge ara..." value={filters.search} onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
                        <select className="form-control" value={filters.status} onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
                            <option value="">Tüm durumlar</option>
                            {requestStatuses.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select className="form-control" value={filters.type} onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}>
                            <option value="">Tüm belge türleri</option>
                            {types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                        </select>
                        <input className="form-control" type="date" value={filters.start} onChange={e => { setFilters({ ...filters, start: e.target.value }); setPage(1); }} />
                        <input className="form-control" type="date" value={filters.end} onChange={e => { setFilters({ ...filters, end: e.target.value }); setPage(1); }} />
                    </div>
                    <div className="admin-document-request-list">
                        {requests.map(request => (
                            <button key={request.id} type="button" onClick={() => openRequest(request)} className="document-request-row">
                                <div className="admin-document-request-header">
                                    <div>
                                        <strong>{request.type_name}</strong>
                                        <div className="admin-document-request-meta has-top-margin">{request.user_name} ({request.employee_id}) - {request.department || '-'}</div>
                                    </div>
                                    <div className="admin-document-request-meta">{formatDate(request.created_at)}</div>
                                </div>
                                <div className="admin-document-request-badges">
                                    <span className="badge badge-pending">{request.status}</span>
                                    {request.response_file_path && <span className="badge badge-completed">Evrak yüklendi</span>}
                                </div>
                            </button>
                        ))}
                        {requestsQuery.isLoading && <LoadingIndicator compact label="Belge talepleri yükleniyor" />}
                        {!requestsQuery.isLoading && !requests.length && <div className="admin-document-empty-state">Filtrelere uygun talep bulunmuyor.</div>}
                    </div>
                    <PaginationControls pagination={requestsQuery.data?.pagination} onPageChange={setPage} />
                </div>
            )}

            {activeTab === 'payroll' && (
                <div className="premium-card admin-document-payroll-panel">
                    <div className="admin-document-payroll-header">
                        <h3 className="admin-document-payroll-title">Kişiye Özel Bordro Yükle</h3>
                        <p className="admin-document-payroll-description">Yüklenen dosyalar sadece ilgili çalışan tarafından kendi panelinde görüntülenebilir.</p>
                    </div>
                    <form onSubmit={handlePayrollSubmit} className="admin-document-payroll-form">
                        <div className="responsive-grid-2">
                            <div className="input-group document-form-field">
                                <label className="input-label">Bordro Dönemi</label>
                                <input className="form-control" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Ocak 2026" />
                            </div>
                            <div className="input-group document-form-field">
                                <label className="input-label">Çalışan Ara</label>
                                <input className="form-control" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} placeholder="Ad, sicil, bölüm veya pozisyon" />
                            </div>
                            <div className="input-group document-form-field">
                                <label className="input-label">Çalışan Seç</label>
                                <select className="form-control" required value={selectedUser} onChange={(e) => {
                                    setSelectedUser(e.target.value);
                                    setSelectedUserOption(users.find(user => String(user.id) === e.target.value) || null);
                                }}>
                                    <option value="">Çalışan seçiniz...</option>
                                    {selectedUserOption && !users.some(user => user.id === selectedUserOption.id) && (
                                        <option value={selectedUserOption.id}>{selectedUserOption.name} ({selectedUserOption.employee_id}) - {selectedUserOption.department}</option>
                                    )}
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employee_id}) - {u.department}</option>)}
                                </select>
                            </div>
                        </div>
                        <PaginationControls pagination={usersQuery.data?.pagination} onPageChange={setUserPage} />
                        <div className="input-group document-form-field">
                            <label className="input-label">Bordro Dosyası</label>
                            <input className="form-control admin-document-file-input" required type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="admin-document-payroll-actions">
                            <button type="submit" className="document-action-button"><Upload size={17} /> Yükle ve Çalışana Ata</button>
                            {status && <span className="admin-document-upload-status">{status}</span>}
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'types' && (
                <div className="premium-card admin-document-panel">
                    <div className="admin-document-panel-header">
                        <h3 className="document-reset-margin">Belge Türleri</h3>
                        <button type="button" className="document-action-button" onClick={() => openTypeModal()}><Plus size={18} /> Yeni Tür</button>
                    </div>
                    <div className="admin-document-request-list">
                        {types.map(type => (
                            <div key={type.id} className="admin-document-type-row">
                                <div>
                                    <strong>{type.name}</strong>
                                    <div className="admin-document-request-meta has-top-margin">{type.fields.length} alan - {type.is_active === 0 || type.is_active === false ? 'Pasif' : 'Aktif'}</div>
                                </div>
                                <button type="button" className="document-secondary-button" onClick={() => openTypeModal(type)}><Edit3 size={16} /> Düzenle</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedRequest && (
                <DocumentRequestModal
                    request={selectedRequest}
                    status={requestStatus}
                    statuses={requestStatuses}
                    hrNote={hrNote}
                    answerLabel={getAnswerLabel}
                    fileHref={fileHref}
                    onStatusChange={setRequestStatus}
                    onHrNoteChange={setHrNote}
                    onFileChange={setResponseFile}
                    onClose={() => setSelectedRequest(null)}
                    onSave={() => void updateRequest()}
                />
            )}

            {typeModalOpen && (
                <DocumentTypeModal
                    editingTypeId={editingTypeId}
                    draft={typeForm}
                    setDraft={setTypeForm}
                    onClose={() => setTypeModalOpen(false)}
                    onSubmit={saveType}
                />
            )}
        </div>
    );
};
