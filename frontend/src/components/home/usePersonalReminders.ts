import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../queryClient';
import { api } from '../../services/api';
import type { PersonalReminder } from '../../types';

export function usePersonalReminders() {
    return useQuery({
        queryKey: queryKeys.personalReminders,
        queryFn: () => api.get<{ items: PersonalReminder[] }>('/api/reminders'),
    });
}
