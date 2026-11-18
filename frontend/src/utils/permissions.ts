import type { AuthUser, Permission } from '../types';

export const normalizePermissions = (permissions: unknown): Permission[] => {
  if (Array.isArray(permissions)) return permissions as Permission[];
  if (typeof permissions !== 'string') return [];

  try {
    const parsed = JSON.parse(permissions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const hasPermission = (user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined, permission: Permission) => {
  return user?.role === 'admin' || Boolean(user?.permissions?.includes(permission));
};

export const hasAdminPanelAccess = (user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined) => {
  return user?.role === 'admin' || Boolean(user?.permissions?.some((permission) => permission.startsWith('manage_')));
};
