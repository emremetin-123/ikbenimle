import type {
  PolyvalenceCategory,
  PolyvalenceDepartment,
  PolyvalenceLevelDefinition,
  PolyvalenceRole,
  PolyvalenceSkill,
} from '../types';

export type AdminView = 'periods' | 'definitions' | 'members' | 'standards' | 'levels';

export type ModalKind =
  | 'period'
  | 'department'
  | 'role'
  | 'category'
  | 'skill'
  | 'membership'
  | 'target'
  | 'schedule'
  | 'level';

export type SetupUser = {
  id: number;
  employee_id: string;
  name: string;
  department?: string | null;
  position?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
};

export type Membership = {
  id: number;
  user_id: number;
  department_id: number;
  role_id?: number | null;
  evaluator_user_id?: number | null;
  is_active?: number | boolean;
  is_manual_override?: number | boolean;
  user_name: string;
  employee_id: string;
  position?: string | null;
  evaluator_name?: string | null;
  role_name?: string | null;
  department_name?: string | null;
  source_department?: string | null;
  is_department_auto?: number | boolean;
  is_evaluator_auto?: number | boolean;
};

export type SkillTarget = {
  id: number;
  skill_id: number;
  role_id: number;
  target_level?: number | null;
  criticality: 'normal' | 'critical';
  min_qualified_count: number;
};

export type Schedule = {
  id: number;
  department_id: number;
  frequency_months: number;
  next_start_date?: string | null;
  duration_days: number;
  reminder_days: string;
  is_active?: number | boolean;
};

export type OpenPeriodGap = {
  period_id: number;
  period_name: string;
  department_name: string;
  missing_members: number;
  missing_skills: number;
  missing_assessments: number;
  skipped_members: number;
};

export type AuditLog = {
  id: number;
  action: string;
  actor_name?: string | null;
  reason?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

export type SetupResponse = {
  departments: PolyvalenceDepartment[];
  roles: PolyvalenceRole[];
  categories: PolyvalenceCategory[];
  skills: PolyvalenceSkill[];
  targets: SkillTarget[];
  memberships: Membership[];
  schedules: Schedule[];
  levels: PolyvalenceLevelDefinition[];
  users: SetupUser[];
  videos: Array<{ id: number; title: string; category?: string | null }>;
  training_links: Array<{ skill_id: number; video_id: number }>;
  active_membership_count: number;
};

export type ReportPeriodGroup = {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
  due_date?: string | null;
  period_count: number;
  task_total: number;
  task_completed: number;
  departments: Array<{ id: number; name: string; period_id: number; status: string }>;
};

export type PolyvalenceDashboard = {
  group: { key: string; label: string; start_date: string; end_date: string } | null;
  selected_department_id: 'all' | number;
  selected_position: string;
  period_ids: number[];
  departments: Array<{ id: number; name: string }>;
  positions: Array<{ key: string; name: string }>;
  summary: {
    polyvalence_rate: number;
    polyvalence_delta?: number | null;
    average_skill_per_employee: number;
    average_skill_delta?: number | null;
    critical_risk_count: number;
    completion_percent: number;
    completed_employees: number;
    total_employees: number;
  };
  operation_risks: Array<{
    skill_name: string;
    owner_name?: string | null;
    department_name?: string | null;
    qualified_count: number;
    min_qualified_count: number;
  }>;
  heatmap: {
    departments: Array<{ id: number | string; name: string }>;
    categories: string[];
    cells: Array<{
      department_id: number | string;
      department_name: string;
      category: string;
      score: number;
    }>;
  };
  department_comparison: Array<{ department_id: number | string; name: string; score: number }>;
  top_employees: Array<{
    employee_id: string;
    name: string;
    position?: string | null;
    department_name?: string | null;
    completed: number;
    target_total: number;
    score: number;
  }>;
  development_skills: Array<{
    skill_name: string;
    category?: string | null;
    department_name?: string | null;
    coverage: number;
  }>;
};

export const EMPTY_SETUP: SetupResponse = {
  departments: [],
  roles: [],
  categories: [],
  skills: [],
  targets: [],
  memberships: [],
  schedules: [],
  levels: [],
  users: [],
  videos: [],
  training_links: [],
  active_membership_count: 0,
};
