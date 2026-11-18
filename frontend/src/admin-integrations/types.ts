export type IntegrationScope =
  | 'employees:write'
  | 'leave-balances:write'
  | 'leave-requests:read'
  | 'leave-requests:ack'
  | 'payrolls:write';

export interface IntegrationConnection {
  id: number;
  name: string;
  provider: 'logo_bridge' | 'generic_bridge';
  is_enabled: boolean;
  employee_sync_enabled: boolean;
  leave_balance_sync_enabled: boolean;
  leave_request_export_enabled: boolean;
  leave_export_trigger: 'created' | 'approved';
  active_key_count: number;
  pending_job_count: number;
  last_seen_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_code?: string | null;
}

export interface IntegrationApiKey {
  id: number;
  connection_id: number;
  name: string;
  key_prefix: string;
  scopes: IntegrationScope[];
  ip_allowlist: string[];
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
  token?: string;
}

export interface IntegrationJob {
  id: number;
  connection_id: number;
  connection_name: string;
  event_type: string;
  aggregate_id: string;
  status: 'pending' | 'leased' | 'retry' | 'completed' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  external_reference?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface IntegrationAuditEvent {
  id: number;
  connection_name?: string | null;
  direction: string;
  action: string;
  status: string;
  request_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface ConnectionDraft {
  name: string;
  provider: 'logo_bridge' | 'generic_bridge';
  is_enabled: boolean;
  employee_sync_enabled: boolean;
  leave_balance_sync_enabled: boolean;
  leave_request_export_enabled: boolean;
  leave_export_trigger: 'created' | 'approved';
}
