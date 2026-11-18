export type NotificationStats = {
  total: number;
  active: number;
  departments: { department: string; count: number }[];
};

export type NotificationSettings = {
  vapid_public_key: string;
  vapid_private_key_configured: boolean;
  vapid_subject: string;
  push_mood_reminder_time: string;
  push_mood_reminder_enabled: string;
  push_mood_reminder_title: string;
  push_mood_reminder_body: string;
};

export type NotificationRoutine = {
  id: number;
  title: string;
  body: string;
  url: string;
  target: 'all' | 'department';
  department: string | null;
  schedule_type: 'daily' | 'once';
  scheduled_date: string | null;
  scheduled_time: string;
  is_active: boolean;
  last_sent_key?: string | null;
};

export type EventTemplate = {
  key: string;
  group: string;
  label: string;
  description: string;
  enabled: boolean;
  scheduled_time?: string;
  title: string;
  body: string;
  url: string;
  variables: string[];
  delivery?: {
    last_processed_date: string | null;
    last_attempt: { status: 'accepted' | 'failed' | 'error' | 'skipped' | 'no_devices'; attempted_at: string; sent: number; failed: number; retry_at: string | null } | null;
  };
};

export type NotificationSubscription = {
  id: number; user_id: number; name: string | null; employee_id: string | null;
  department: string | null; user_status: string | null; device_label: string | null;
  is_active: boolean; created_at: string; updated_at: string;
};

export type RoutineDraft = Omit<NotificationRoutine, 'id' | 'last_sent_key'> & {
  id?: number;
};

export type SendResult = {
  sent: number;
  failed: number;
  skipped?: boolean;
  reason?: string;
};
