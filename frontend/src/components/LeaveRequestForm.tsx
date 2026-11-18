import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import type { LeaveDurationType } from '../types';

const LEAVE_TYPES = [
    'MESAI',
    'MAZERET',
    'YILLIK İZİN',
    'DOĞUM İZNİ',
    'ÖLÜM İZNİ',
    'EVLENME İZNİ',
    'SENDİKAL İZNİ',
    'TOPLU İZİN',
    'PLANLI İZİN',
    'GÖREV FORMU',
    'VİZİTE',
    'DEVAMSIZLIK',
    'DİĞER'
];

const toInputDateTime = (date: Date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
};

const calculateSummary = (startValue: string, endValue: string, durationType: LeaveDurationType) => {
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (!startValue || !endValue || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return null;
    }

    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationType === 'Saat') return { type: 'Saat' as const, value: Math.round(diffHours * 10) / 10 };

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const days = Math.floor((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { type: 'Gün' as const, value: Math.max(days, 1) };
};

export const LeaveRequestForm = () => {
    const queryClient = useQueryClient();
    const now = new Date();
    const [leaveType, setLeaveType] = useState('YILLIK İZİN');
    const [durationType, setDurationType] = useState<LeaveDurationType>('Gün');
    const [startDateTime, setStartDateTime] = useState(toInputDateTime(now));
    const [endDateTime, setEndDateTime] = useState(toInputDateTime(new Date(now.getTime() + 8 * 60 * 60 * 1000)));
    const [returnDateTime, setReturnDateTime] = useState(toInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
    const [description, setDescription] = useState('');
    const [message, setMessage] = useState('');

    const summary = useMemo(() => calculateSummary(startDateTime, endDateTime, durationType), [startDateTime, endDateTime, durationType]);

    const createRequest = useMutation({
        mutationFn: () => api.post('/api/leave-requests', {
            leave_type: leaveType,
            start_datetime: startDateTime,
            end_datetime: endDateTime,
            return_datetime: returnDateTime,
            duration_type: durationType,
            description
        }),
        onSuccess: async () => {
            setDescription('');
            setMessage('Talebiniz iletildi');
            await queryClient.invalidateQueries({ queryKey: queryKeys.employeeLeaveRequests });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : 'Talep gönderilemedi');
        }
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        createRequest.mutate();
    };

    return (
        <form onSubmit={submit} className="premium-card leave-request-form">
            <h3 className="leave-request-title">Yeni İzin Talebi</h3>

            <div className="leave-type-grid">
                {LEAVE_TYPES.map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setLeaveType(type)}
                        className="leave-type-option"
                        aria-pressed={leaveType === type}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <div className="responsive-grid-2 leave-request-fields">
                <div className="input-group leave-request-field">
                    <label className="input-label">Başlangıç Tarihi / Saati</label>
                    <input className="form-control" type="datetime-local" value={startDateTime} onChange={e => setStartDateTime(e.target.value)} required />
                </div>
                <div className="input-group leave-request-field">
                    <label className="input-label">Bitiş Tarihi / Saati</label>
                    <input className="form-control" type="datetime-local" value={endDateTime} onChange={e => setEndDateTime(e.target.value)} required />
                </div>
                <div className="input-group leave-request-field">
                    <label className="input-label">İş Başı Tarihi / Saati</label>
                    <input className="form-control" type="datetime-local" value={returnDateTime} onChange={e => setReturnDateTime(e.target.value)} required />
                </div>
                <div className="input-group leave-request-field">
                    <label className="input-label">Süre Tipi</label>
                    <select className="form-control" value={durationType} onChange={e => setDurationType(e.target.value as LeaveDurationType)}>
                        <option value="Gün">Gün</option>
                        <option value="Saat">Saat</option>
                    </select>
                </div>
            </div>

            <div className="input-group leave-request-description">
                <label className="input-label">Açıklama</label>
                <textarea className="form-control" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Opsiyonel not" />
            </div>

            <div className="leave-request-summary">
                {summary ? `${leaveType} - ${summary.value} ${summary.type}` : 'Tarihleri seçtiğinizde talep özeti burada görünür'}
            </div>

            {message && <div className="leave-request-message" role="status">{message}</div>}

            <button type="submit" className="btn-primary leave-request-submit" disabled={createRequest.isPending || !summary}>
                <Send size={18} /> {createRequest.isPending ? 'Gönderiliyor...' : 'Talebi Gönder'}
            </button>
        </form>
    );
};
