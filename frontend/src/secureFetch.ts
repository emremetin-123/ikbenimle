import { API_BASE } from './config';

const CSRF_COOKIE_NAME = 'ikbenimle_csrf';

const getCookie = (name: string) => {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
};

const isMutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

export const installSecureFetch = () => {
  const originalFetch = window.fetch.bind(window);
  const apiOrigin = new URL(API_BASE || window.location.origin, window.location.origin).origin;

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || String(input), window.location.origin);
    if (url.origin !== apiOrigin || (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/'))) {
      return originalFetch(input, init);
    }

    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.delete('Authorization');

    if (isMutation(method)) {
      const csrfToken = getCookie(CSRF_COOKIE_NAME);
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    }

    return originalFetch(input, {
      ...init,
      headers,
      credentials: 'include'
    });
  };
};
