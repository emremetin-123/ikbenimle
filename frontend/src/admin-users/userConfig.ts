import type { AdminUser, Permission, UserRole, UserStatus } from '../types';

export const MODULE_PERMISSIONS: { id: Permission; label: string }[] = [
  { id: 'manage_education', label: 'Eğitim İşlemleri' },
  { id: 'manage_users', label: 'Kullanıcı İşlemleri' },
  { id: 'manage_announcements', label: 'Duyuru İşlemleri' },
  { id: 'manage_news', label: 'Haber İşlemleri' },
  { id: 'manage_documents', label: 'Belge İşlemleri' },
  { id: 'manage_feedback', label: 'Öneri ve Şikayet İşlemleri' },
  { id: 'manage_careers', label: 'Kariyer İşlemleri' },
  { id: 'manage_knowledge_portal', label: 'Bilgi Portalı İşlemleri' },
  { id: 'manage_surveys', label: 'Anket İşlemleri' },
  { id: 'manage_meal_menu', label: 'Yemek Menüsü İşlemleri' },
  { id: 'manage_ai_settings', label: 'AI Ayarları' },
  { id: 'manage_integrations', label: 'Entegrasyonları Yönet' },
  { id: 'manage_mood_analytics', label: 'Duygu Durumu Analizi' },
  { id: 'manage_notifications', label: 'Bildirim İşlemleri' },
  { id: 'manage_service_routes', label: 'Servis Güzergahları İşlemleri' },
  { id: 'manage_polyvalence', label: 'Polivalans İşlemleri' },
  { id: 'view_polyvalence_reports', label: 'Polivalans Raporlarını Gör' },
  { id: 'view_education', label: 'Eğitimleri Gör' },
  { id: 'view_announcements', label: 'Duyuruları Gör' },
  { id: 'view_documents', label: 'Belgeleri Gör' },
  { id: 'view_feedback', label: 'Öneri ve Şikayetleri Gör' },
  { id: 'view_careers', label: 'Kariyer Merkezini Gör' },
  { id: 'view_knowledge_portal', label: 'Bilgi Portalını Gör' },
  { id: 'view_news', label: 'Şirket Haberlerini Gör' },
  { id: 'view_surveys', label: 'Anketleri Gör' },
  { id: 'view_service_routes', label: 'Servis Güzergahlarını Gör' },
];

export const ALL_MODULE_PERMISSION_IDS = MODULE_PERMISSIONS.map(({ id }) => id);

export const DEFAULT_VIEW_PERMISSIONS: Permission[] = [
  'view_education',
  'view_announcements',
  'view_documents',
  'view_feedback',
  'view_careers',
  'view_knowledge_portal',
  'view_news',
  'view_surveys',
  'view_service_routes',
];

export interface UserFormValues {
  employee_id: string;
  name: string;
  department: string;
  position: string;
  manager_id: string;
  status: UserStatus;
  password: string;
  role: UserRole;
  permissions: Permission[];
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  blood_type: string;
  birth_date: string;
  email: string;
  clothing_top: string;
  clothing_bottom: string;
  shoe_size: string;
}

export const createEmptyUserForm = (): UserFormValues => ({
  employee_id: '',
  name: '',
  department: '',
  position: '',
  manager_id: '',
  status: 'active',
  password: '',
  role: 'employee',
  permissions: [...DEFAULT_VIEW_PERMISSIONS],
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  blood_type: '',
  birth_date: '',
  email: '',
  clothing_top: '',
  clothing_bottom: '',
  shoe_size: '',
});

export const parsePermissions = (permissions: AdminUser['permissions']): Permission[] => {
  try {
    const parsed = typeof permissions === 'string' ? JSON.parse(permissions) : (permissions || []);
    return Array.isArray(parsed) ? parsed.filter((value): value is Permission => (
      ALL_MODULE_PERMISSION_IDS.includes(value as Permission)
    )) : [];
  } catch {
    return [];
  }
};

export const userToFormValues = (user: AdminUser): UserFormValues => ({
  employee_id: user.employee_id,
  name: user.name,
  department: user.department || '',
  position: user.position || '',
  manager_id: String(user.manager_id || ''),
  status: user.status === 'passive' ? 'passive' : 'active',
  password: '',
  role: user.role,
  permissions: user.role === 'admin' ? [...ALL_MODULE_PERMISSION_IDS] : parsePermissions(user.permissions),
  phone: user.phone || '',
  address: user.address || '',
  emergency_contact_name: user.emergency_contact_name || '',
  emergency_contact_phone: user.emergency_contact_phone || '',
  blood_type: user.blood_type || '',
  birth_date: user.birth_date?.slice(0, 10) || '',
  email: user.email || '',
  clothing_top: user.clothing_top || '',
  clothing_bottom: user.clothing_bottom || '',
  shoe_size: user.shoe_size || '',
});

export const isUserActive = (user: AdminUser) => (user.status || 'active') === 'active';
