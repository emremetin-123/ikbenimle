const viteApiBase = import.meta.env.VITE_API_BASE;
export const API_BASE = typeof viteApiBase === 'string' ? viteApiBase : 'http://localhost:5000';

export const getPhotoUrl = (path: string | undefined | null) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${API_BASE}${path}`;
};
