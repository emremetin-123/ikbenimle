export type Permission =
  | 'manage_education'
  | 'manage_users'
  | 'manage_announcements'
  | 'manage_news'
  | 'manage_documents'
  | 'manage_feedback'
  | 'manage_careers'
  | 'manage_knowledge_portal'
  | 'manage_surveys'
  | 'manage_meal_menu'
  | 'manage_ai_settings'
  | 'manage_integrations'
  | 'manage_mood_analytics'
  | 'manage_notifications'
  | 'manage_service_routes'
  | 'manage_polyvalence'
  | 'view_polyvalence_reports'
  | 'view_education'
  | 'view_announcements'
  | 'view_documents'
  | 'view_feedback'
  | 'view_careers'
  | 'view_knowledge_portal'
  | 'view_news'
  | 'view_surveys'
  | 'view_service_routes';

export type PolyvalencePeriodStatus = 'draft' | 'open' | 'closed' | 'cancelled';
export type PolyvalenceTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PolyvalenceDepartment {
  id: number;
  name: string;
  source_department_name?: string | null;
  is_archived?: number | boolean;
}

export interface PolyvalenceRole {
  id: number;
  department_id: number;
  name: string;
  is_archived?: number | boolean;
}

export interface PolyvalenceCategory {
  id: number;
  department_id: number;
  name: string;
  sort_order?: number;
  is_archived?: number | boolean;
}

export interface PolyvalenceSkill {
  id: number;
  department_id: number;
  category_id?: number | null;
  department_name?: string;
  category_name?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_archived?: number | boolean;
  archive_reason?: string | null;
}

export interface PolyvalenceLevelDefinition {
  level_value: number;
  label: string;
  description?: string | null;
  color?: string | null;
}

export interface PolyvalencePeriod {
  id: number;
  department_id: number;
  department_name?: string;
  previous_period_id?: number | null;
  name: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: PolyvalencePeriodStatus;
  task_total?: number;
  task_completed?: number;
}

export interface PolyvalenceTaskSummary {
  id: number;
  period_id: number;
  period_name: string;
  department_name: string;
  due_date: string;
  status: PolyvalenceTaskStatus;
  total: number;
  completed: number;
  member_count: number;
  progress_percent: number;
}

export interface PolyvalenceAssessment {
  id: number;
  skill_id: number;
  skill_code?: string | null;
  skill_name: string;
  category: string;
  target_level?: number | null;
  level?: number | null;
  can_train: boolean;
  note: string;
  version_no: number;
  updated_at?: string | null;
}

export interface PolyvalenceTaskMember {
  id: number;
  user_id: number;
  employee_id?: string | null;
  name: string;
  position?: string | null;
  assessments: PolyvalenceAssessment[];
}

export interface PolyvalenceTaskDetail extends PolyvalenceTaskSummary {
  levels?: PolyvalenceLevelDefinition[];
  period_status: PolyvalencePeriodStatus;
  progress: { completed: number; total: number; percent: number };
  members: PolyvalenceTaskMember[];
}

export type UserRole = 'admin' | 'employee';
export type UserStatus = 'active' | 'passive';

export interface SessionPolicy {
  idle_timeout_ms: number;
  absolute_timeout_ms: number;
  warning_duration_ms: number;
  idle_expires_at?: string | null;
  absolute_expires_at?: string | null;
}

export interface AuthUser {
  id: number;
  employee_id: string;
  name: string;
  department?: string | null;
  position?: string | null;
  manager_id?: number | string | null;
  status?: UserStatus | string | null;
  role: UserRole;
  permissions: Permission[];
  photo_url?: string | null;
  session_policy?: SessionPolicy;
}

export interface AdminUser extends AuthUser {
  manager_name?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  blood_type?: string | null;
  birth_date?: string | null;
  email?: string | null;
  clothing_top?: string | null;
  clothing_bottom?: string | null;
  shoe_size?: string | null;
  photo_path?: string | null;
  password?: string;
}

export interface Video {
  id: number;
  title: string;
  url?: string | null;
  description?: string | null;
  category?: string | null;
  pass_score?: number | string | null;
  trainer_name?: string | null;
  trainer_title?: string | null;
  duration?: string | null;
  validity_period?: string | number | null;
  awards_badge?: number | boolean | null;
  badge_image_url?: string | null;
  certificate_enabled?: number | boolean | null;
  auto_reassign_enabled?: number | boolean | null;
  validity_amount?: number | string | null;
  validity_unit?: string | null;
  pause_on_blur?: number | boolean | null;
  disable_forward_seek?: number | boolean | null;
  track_watch_seconds?: number | boolean | null;
  quiz_attempt_limit?: number | string | null;
  training_profile?: string | null;
  delivery_method?: string | null;
  is_mandatory?: number | boolean | null;
  compliance_lock?: number | boolean | null;
  version_no?: number | string | null;
  parent_video_id?: number | string | null;
  is_latest?: number | boolean | null;
  is_active?: number | boolean | null;
  minimum_watch_percent?: number | string | null;
  requires_full_watch?: number | boolean | null;
  requires_quiz?: number | boolean | null;
  official_documents_enabled?: number | boolean | null;
  detailed_audit_enabled?: number | boolean | null;
  cover_image_url?: string | null;
  status?: string | null;
  quiz_score?: number | null;
  due_date?: string | null;
  reference_id?: string | null;
  confirmed_at?: string | null;
  assignment_id?: number | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  video_category?: string | null;
}

export interface EmployeeTrainingSummary {
  total: number;
  completed: number;
  pending: number;
  expired: number;
  badges: number;
}

export interface AdminStatsRow {
  assignment_id: number;
  name: string;
  employee_id: string;
  department?: string | null;
  position?: string | null;
  title: string;
  category?: string | null;
  pass_score: number | null;
  trainer_name?: string | null;
  trainer_title?: string | null;
  duration?: string | null;
  validity_period?: string | number | null;
  training_profile?: string | null;
  delivery_method?: string | null;
  is_mandatory?: number | boolean | null;
  version_no?: number | string | null;
  minimum_watch_percent?: number | string | null;
  requires_full_watch?: number | boolean | null;
  requires_quiz?: number | boolean | null;
  status: string;
  quiz_score: number | null;
  due_date?: string | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  reference_id?: string | null;
  confirmed_at?: string | null;
  watched_seconds?: number | null;
  quiz_attempts?: number | null;
  requires_rewatch?: number | boolean | null;
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correct: number;
}

export interface LessonDraft {
    clientKey?: string;
  title: string;
  url: string;
  description: string;
  content_type: 'video' | 'pdf';
  content_metadata?: Record<string, string | number | boolean | null>;
  required_seconds?: string;
  required_percent?: string;
  file: File | null;
  quizQuestions: QuizQuestion[];
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_public_id?: string | null;
  target_department?: string | null;
  visible_until?: string | null;
  created_at?: string | null;
  author_name?: string | null;
}

export interface ServiceRouteStop {
  id?: number;
  route_id?: number;
  name: string;
  arrival_time?: string | null;
  latitude: number;
  longitude: number;
  order_index?: number;
}

export interface ServiceRoute {
  id: number;
  name: string;
  direction?: string | null;
  plate?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  notes?: string | null;
  color?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  stops: ServiceRouteStop[];
}

export type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'rating';

export interface SurveyQuestion {
  id?: number;
  survey_id?: number;
  question_text: string;
  question_type: SurveyQuestionType;
  options: string[];
  is_required?: boolean;
  order_index?: number;
}

export interface Survey {
  id: number;
  title: string;
  description?: string | null;
  status: 'draft' | 'active' | 'closed';
  created_at?: string | null;
  updated_at?: string | null;
  question_count?: number;
  response_count?: number;
  has_responded?: number | boolean;
  questions?: SurveyQuestion[];
}

export interface SurveyAnswerPayload {
  question_id: number;
  value: string | string[];
}

export interface SurveyResultAnswer {
  response_id?: number;
  question_id: number;
  answer_value: string | string[];
  submitted_at?: string | null;
  name?: string | null;
  department?: string | null;
  position?: string | null;
}

export interface SurveyAnswerSummary {
  total: number;
  counts: Record<string, number>;
}

export interface SurveyResults {
  survey: Survey;
  questions: SurveyQuestion[];
  answers: SurveyResultAnswer[];
  answer_summary?: Record<string, SurveyAnswerSummary>;
  response_count?: { count: number } | number;
  pagination?: PaginationMeta;
}

export interface MealMenu {
  id?: number;
  meal_date: string;
  items: string[];
  source_file?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type LeaveStatus = 'İletildi' | 'Beklemede' | 'Onaylandı' | 'Reddedildi';
export type LeaveDurationType = 'Gün' | 'Saat';

export interface MealMenuRating {
  id?: number;
  meal_date: string;
  user_id?: number;
  food_score: number;
  staff_score: number;
  cleanliness_score: number;
  comment?: string | null;
  department?: string | null;
  position?: string | null;
  name?: string | null;
  employee_id?: string | null;
  avg_total_score?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MealMenuRatingSummary {
  meal_date: string;
  response_count: number;
  avg_food_score: number;
  avg_staff_score: number;
  avg_cleanliness_score: number;
  avg_total_score: number;
}

export interface MealMenuRatingReport {
  month: string;
  summary: MealMenuRatingSummary[];
  overall: {
    response_count: number;
    avg_food_score: number;
    avg_staff_score: number;
    avg_cleanliness_score: number;
    avg_total_score: number;
  };
}

export interface LeaveRequest {
  id: number;
  user_id?: number;
  leave_type: string;
  requester_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_datetime: string;
  end_datetime: string;
  return_datetime?: string | null;
  duration_type: LeaveDurationType;
  duration_value: number;
  description?: string | null;
  status: LeaveStatus | string;
  created_at?: string | null;
}

export interface CompanyNews {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at?: string | null;
  author_name?: string | null;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at?: string | null;
  author_name?: string | null;
}

export interface DocumentItem {
  id: number;
  title: string;
  file_path: string;
  upload_date?: string | null;
}

export type DocumentRequestStatus = 'Beklemede' | 'Hazırlanıyor' | 'Tamamlandı' | 'Reddedildi';
export type DocumentRequestFieldType = 'text' | 'textarea' | 'date' | 'number';

export interface DocumentRequestField {
  id?: number;
  type_id?: number;
  label: string;
  field_key: string;
  field_type: DocumentRequestFieldType | string;
  is_required?: number | boolean;
  order_index?: number;
  placeholder?: string | null;
}

export interface DocumentRequestType {
  id: number;
  name: string;
  description?: string | null;
  is_active?: number | boolean;
  order_index?: number;
  fields: DocumentRequestField[];
}

export interface DocumentRequest {
  id: number;
  user_id: number;
  type_id: number;
  type_name?: string | null;
  status: DocumentRequestStatus | string;
  answers?: Record<string, string>;
  answers_json?: string | null;
  hr_note?: string | null;
  response_file_path?: string | null;
  response_file_name?: string | null;
  response_uploaded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user_name?: string | null;
  employee_id?: string | null;
  department?: string | null;
  position?: string | null;
  handled_by_name?: string | null;
}

export interface FeedbackItem {
  id: number;
    user_id?: number | null;
    employee_id?: string | null;
    updated_at?: string | null;
    viewer_role?: 'owner' | 'assignee' | 'participant';
    can_comment?: boolean;
    can_internal_comment?: boolean;
    can_complete_review?: boolean;
    can_add_participants?: boolean;
  type?: string;
  title: string;
  content: string;
  details?: string | null;
  status?: string | null;
  display_status?: string | null;
  created_at?: string | null;
  user_name?: string | null;
  department?: string | null;
  position?: string | null;
  file_path?: string | null;
  assigned_to_user_id?: number | string | null;
  assigned_to_name?: string | null;
  assigned_to_department?: string | null;
  assigned_department?: string | null;
  due_date?: string | null;
  decision?: string | null;
  decision_note?: string | null;
  public_response?: string | null;
}

export interface JobPosting {
  id: number;
  title: string;
  image_url?: string | null;
  publish_date?: string | null;
  deadline_date?: string | null;
  position_type?: string | null;
  location?: string | null;
  manager_name?: string | null;
  work_model?: string | null;
  job_description?: string | null;
  qualifications?: string | null;
  prerequisites?: string | null;
  additional_notes?: string | null;
  status?: string | null;
  application_count?: number;
  user_applied?: boolean;
}

export interface JobApplication {
  id: number;
  job_id: number;
  user_id: number;
  status: string;
  applied_at?: string | null;
  name?: string | null;
  employee_id?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DirectoryBadge {
  id: number;
  title?: string | null;
  category?: string | null;
  badge_image_url?: string | null;
}

export interface ProfileEducationEntry {
  id?: number;
  school: string;
  department?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  is_current: boolean;
}

export interface DirectoryEntry {
  id: number;
  name: string;
  department?: string | null;
  position?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  education?: string | null;
  skills?: string | null;
  hobbies?: string | null;
  education_entries?: ProfileEducationEntry[];
  skill_tags?: string[];
  hobby_tags?: string[];
  photo_path?: string | null;
  photo_url?: string | null;
  badges?: DirectoryBadge[] | null;
}

export interface Profile {
  id?: number;
  employee_id?: string;
  name?: string;
  department?: string | null;
  position?: string | null;
  role?: UserRole;
  phone?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  blood_type?: string | null;
  birth_date?: string | null;
  email?: string | null;
  clothing_top?: string | null;
  clothing_bottom?: string | null;
  shoe_size?: string | null;
  education?: string | null;
  hobbies?: string | null;
  skills?: string | null;
  education_entries?: ProfileEducationEntry[];
  skill_tags?: string[];
  hobby_tags?: string[];
  photo_path?: string | null;
}

export interface KnowledgeCategory {
  id: number;
  name: string;
  order_index: number;
  item_count?: number;
  matched_item_count?: number;
}

export interface KnowledgeItem {
  id: number;
  category_id: number;
  sub_category: string | null;
  question: string;
  answer: string;
  is_featured: boolean;
  order_index: number;
}

export interface VideoLessonQuestion {
  text: string;
  options: string[];
  correct?: number;
}

export interface VideoLesson {
  id: number;
  module_id?: number | null;
  module_title?: string | null;
  module_index?: number | null;
  title: string;
  url: string;
  description?: string | null;
  content_type?: 'video' | 'pdf' | 'slides' | 'document' | 'live' | 'classroom' | string | null;
  content_metadata?: string | null;
  required_seconds?: number | null;
  required_percent?: number | null;
  status?: string | null;
  score?: number | null;
  watched_seconds?: number | null;
  active_seconds?: number | null;
  content_progress_percent?: number | null;
  page_number?: number | null;
  page_count?: number | null;
  max_position?: number | null;
  last_position?: number | null;
  quiz_attempts?: number | null;
  requires_rewatch?: number | boolean | null;
  quiz?: { questions: VideoLessonQuestion[] } | null;
}

export interface VideoPlayerData {
  video: Video;
  lessons: VideoLesson[];
  assignment: {
    id: number;
    status?: string | null;
    quiz_score?: number | null;
    confirmed_at?: string | null;
    reference_id?: string | null;
  };
}

export interface TodayWeather {
  city: string;
  temperature: number;
  weather_code: number;
  temperature_max: number;
  temperature_min: number;
  observed_at: string;
}

export interface PersonalReminder {
  id: number;
  text: string;
  completed: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
