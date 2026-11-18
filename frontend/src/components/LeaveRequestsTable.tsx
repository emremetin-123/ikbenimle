import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { PaginationControls } from './PaginationControls';
import type { LeaveRequest } from '../types';

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '-';
    return date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
};

const statusClassName = (status: string) => {
    if (status === 'Onaylandı') return 'is-approved';
    if (status === 'Reddedildi') return 'is-rejected';
    return 'is-pending';
};

export const LeaveRequestsTable = () => {
    const [page, setPage] = useState(1);
    const requestsQuery = useQuery({
        queryKey: [...queryKeys.employeeLeaveRequests, page],
        queryFn: () => api.list<LeaveRequest>(
            `/api/leave-requests?page=${page}&pageSize=10&sort=created_at&order=desc`
        )
    });
    const rows = requestsQuery.data?.items || [];

    return (
        <div className="premium-card leave-requests-card">
            <div className="leave-requests-header">
                <h3 className="leave-request-title">Taleplerim</h3>
            </div>

            <div className="table-container">
                <table className="leave-requests-table">
                    <thead>
                        <tr>
                            {['Talep No', 'Talep Nedeni', 'Başlangıç', 'Bitiş', 'İş Başı', 'Süre Tipi', 'Süre', 'Durumu'].map(header => (
                                <th key={header}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {requestsQuery.isLoading ? (
                            <tr>
                                <td colSpan={8} className="leave-requests-state">
                                    Yükleniyor...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="leave-requests-state">
                                    Henüz izin talebiniz bulunmuyor.
                                </td>
                            </tr>
                        ) : rows.map(row => (
                            <tr key={row.id}>
                                <td className="leave-request-number">#{row.id}</td>
                                <td>{row.leave_type}</td>
                                <td>{formatDateTime(row.start_datetime)}</td>
                                <td>{formatDateTime(row.end_datetime)}</td>
                                <td>{formatDateTime(row.return_datetime)}</td>
                                <td>{row.duration_type}</td>
                                <td>{row.duration_value}</td>
                                <td>
                                    <span className={`leave-request-status ${statusClassName(row.status)}`}>
                                        {row.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="leave-requests-pagination">
                <PaginationControls
                    pagination={requestsQuery.data?.pagination}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
};
