import type { PaginatedResponse } from '../types';
export type AuditSource = 'activity' | 'security';
export type AuditOutcome = 'success' | 'denied' | 'error' | 'pending' | 'aborted';
export interface AuditEntry {
  source: AuditSource; id: string; created_at: string; actor_id: number | null;
  actor_name: string | null; actor_employee_id: string | null;
  module: string; module_label: string; action: string; action_label: string;
  resource_id: string | null; description: string; outcome: AuditOutcome;
  http_status: number | null; retention_days: number; held_at: string | null;
  hold_reason?: string | null; held_by_name?: string | null; method?: string;
  ip_address?: string | null; request_id?: string | null;
  details?: { changed_fields?: string[]; before?: { level_value?: number; can_train?: number }; level?: number; level_value?: number; can_train?: boolean; error_code?: string };
}
export interface AuditList extends PaginatedResponse<AuditEntry> { summary: { total: number; failed: number; held: number } }
export interface AuditPolicy {
  general_days: number; critical_days: number; purge_summary_years: number; unfinished_count: number; cleanup_overdue: boolean;
  modules: { value: string; label: string }[]; actions: { value: string; label: string }[];
  last_purge: { created_at: string; general_count: number; critical_count: number; security_count: number } | null;
}
export interface AuditFilters { user: string; module: string; action: string; outcome: string; from: string; to: string; held: string }
