import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';
/* eslint-disable react-refresh/only-export-components */

type NavigateOptions = { replace?: boolean };
type Navigate = (target: string | number, options?: NavigateOptions) => void;

type RouterLocation = {
  pathname: string;
  search: string;
  hash: string;
};

type RouterContextValue = {
  location: RouterLocation;
  navigate: Navigate;
};

const readLocation = (): RouterLocation => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
});

const RouterContext = createContext<RouterContextValue | null>(null);

export const BrowserRouter = ({ children }: { children: ReactNode }) => {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onLocationChange = () => setLocation(readLocation());
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('app:navigation', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('app:navigation', onLocationChange);
    };
  }, []);

  const navigate = useCallback<Navigate>((target, options = {}) => {
    if (typeof target === 'number') {
      window.history.go(target);
      return;
    }

    const next = new URL(target, window.location.origin);
    if (next.origin !== window.location.origin) {
      window.location.assign(next.href);
      return;
    }

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const destination = `${next.pathname}${next.search}${next.hash}`;
    if (current === destination) return;
    window.history[options.replace ? 'replaceState' : 'pushState']({}, '', destination);
    window.dispatchEvent(new Event('app:navigation'));
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('Router hooks must be used inside BrowserRouter');
  return context;
};

export const useLocation = () => useRouter().location;
export const useNavigate = () => useRouter().navigate;

export const useParams = () => {
  const { pathname } = useLocation();
  const patterns = [
    /^\/employee\/egitimler\/(?<id>[^/]+)\/?$/,
    /^\/employee\/kariyer\/(?<id>[^/]+)\/?$/,
    /^\/employee\/moduller\/(?<module>[^/]+)\/?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.groups) return match.groups as Record<string, string>;
  }
  return {} as Record<string, string>;
};

export const useSearchParams = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = useCallback((next: URLSearchParams | Record<string, string>) => {
    const value = next instanceof URLSearchParams ? next : new URLSearchParams(next);
    navigate(`${location.pathname}${value.size ? `?${value.toString()}` : ''}`, { replace: true });
  }, [location.pathname, navigate]);
  return [params, setParams] as const;
};

export const Navigate = ({ to, replace = false }: { to: string; replace?: boolean }) => {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace }), [navigate, replace, to]);
  return null;
};

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
};

export const NavLink = ({ to, end = false, className, onClick, ...props }: NavLinkProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const target = new URL(to, window.location.origin);
  const isActive = end
    ? location.pathname === target.pathname && location.search === target.search
    : location.pathname === target.pathname || location.pathname.startsWith(`${target.pathname}/`);
  const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className;

  return (
    <a
      {...props}
      href={`${target.pathname}${target.search}${target.hash}`}
      className={resolvedClassName}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
        ) return;
        event.preventDefault();
        navigate(`${target.pathname}${target.search}${target.hash}`);
      }}
    />
  );
};
