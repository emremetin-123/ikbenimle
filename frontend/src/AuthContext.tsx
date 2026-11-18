import { useState, createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AuthUser } from './types';
import { API_BASE } from './config';
import { normalizePermissions } from './utils/permissions';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './queryClient';
/* eslint-disable react-refresh/only-export-components */

interface AuthContextType {
    user: AuthUser | null;
    login: (employee_id: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    touchSession: () => Promise<boolean>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_LAST_ACTIVITY_KEY = 'sessionLastActivityAt';
const SESSION_LOGOUT_PENDING_KEY = 'sessionLogoutPending';

const normalizeUser = (value: AuthUser) => ({
    ...value,
    permissions: normalizePermissions(value.permissions)
});

function clearStoredSession() {
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

const userScope = (user: AuthUser | null) => user ? JSON.stringify([
    user.id, user.role, user.department, user.manager_id,
    [...user.permissions].sort()
]) : null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState(() => ({
        user: null as AuthUser | null,
        client: createQueryClient(),
        version: 0
    }));
    const sessionRef = useRef(session);
    const authRequestRef = useRef(0);
    const { user } = session;
    const [loading, setLoading] = useState(true);
    const logoutRequestRef = useRef<Promise<boolean> | null>(null);

    const replaceSessionUser = useCallback((nextUser: AuthUser | null, reset = false) => {
        const previous = sessionRef.current;
        const scopeChanged = reset || userScope(previous.user) !== userScope(nextUser);
        if (scopeChanged) {
            // Retire the client so late query/mutation callbacks cannot write into the next session.
            authRequestRef.current += 1;
            void previous.client.cancelQueries();
            previous.client.clear();
        }
        const next = {
            user: nextUser,
            client: scopeChanged ? createQueryClient() : previous.client,
            version: previous.version + (scopeChanged ? 1 : 0)
        };
        sessionRef.current = next;
        setSession(next);
    }, []);

    const expireSessionLocally = useCallback(() => {
        clearStoredSession();
        replaceSessionUser(null, true);
    }, [replaceSessionUser]);

    const flushPendingLogout = useCallback(async () => {
        if (localStorage.getItem(SESSION_LOGOUT_PENDING_KEY) !== 'true') return true;
        if (logoutRequestRef.current) return logoutRequestRef.current;

        const request = (async () => {
            try {
                const response = await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
                if (!response.ok && response.status !== 401 && response.status !== 403) return false;
                localStorage.removeItem(SESSION_LOGOUT_PENDING_KEY);
                return true;
            } catch {
                return false;
            }
        })();
        logoutRequestRef.current = request;
        const completed = await request;
        if (logoutRequestRef.current === request) logoutRequestRef.current = null;
        return completed;
    }, []);

    const loadSession = useCallback(async () => {
        const requestId = ++authRequestRef.current;
        if (localStorage.getItem(SESSION_LOGOUT_PENDING_KEY) === 'true') {
            await flushPendingLogout();
            if (requestId === authRequestRef.current) expireSessionLocally();
            return null;
        }
        try {
            const response = await fetch(`${API_BASE}/api/session`);
            if (requestId !== authRequestRef.current) return null;
            if (!response.ok) {
                expireSessionLocally();
                return null;
            }
            const currentUser = normalizeUser(await response.json() as AuthUser);
            if (requestId !== authRequestRef.current) return null;
            localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
            replaceSessionUser(currentUser);
            return currentUser;
        } catch {
            return null;
        }
    }, [expireSessionLocally, flushPendingLogout, replaceSessionUser]);

    useEffect(() => {
        let active = true;
        loadSession().finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [loadSession]);

    const login = async (employee_id: string, password: string) => {
        const requestId = ++authRequestRef.current;
        if (localStorage.getItem(SESSION_LOGOUT_PENDING_KEY) === 'true') {
            if (!await flushPendingLogout()) throw new Error('Önceki oturum kapatılamadı. Yeniden deneyin.');
        }
        if (requestId !== authRequestRef.current) throw new Error('Oturum işlemi değişti. Yeniden deneyin.');
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id, password })
        });
        const data = await response.json();
        if (requestId !== authRequestRef.current) throw new Error('Oturum işlemi değişti. Yeniden deneyin.');
        if (!response.ok) throw new Error(data.error || 'Giriş yapılamadı.');

        const currentUser = normalizeUser(data as AuthUser);
        localStorage.removeItem(SESSION_LOGOUT_PENDING_KEY);
        localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
        replaceSessionUser(currentUser, true);
        return true;
    };

    const logout = useCallback(async () => {
        localStorage.setItem(SESSION_LOGOUT_PENDING_KEY, 'true');
        expireSessionLocally();
        await flushPendingLogout();
    }, [expireSessionLocally, flushPendingLogout]);

    const touchSession = useCallback(async () => {
        if (!sessionRef.current.user || localStorage.getItem(SESSION_LOGOUT_PENDING_KEY) === 'true') return false;
        const requestId = ++authRequestRef.current;
        try {
            const response = await fetch(`${API_BASE}/api/session`);
            if (requestId !== authRequestRef.current) return false;
            if (response.status === 401 || response.status === 403) {
                expireSessionLocally();
                return false;
            }
            if (!response.ok) return false;
            const currentUser = normalizeUser(await response.json() as AuthUser);
            if (requestId !== authRequestRef.current) return false;
            replaceSessionUser(currentUser);
            return true;
        } catch {
            return false;
        }
    }, [expireSessionLocally, replaceSessionUser]);

    useEffect(() => {
        const handleOnline = () => {
            if (localStorage.getItem(SESSION_LOGOUT_PENDING_KEY) === 'true') {
                void flushPendingLogout();
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [flushPendingLogout]);

    useEffect(() => {
        if (!user) return;
        let checking = false;

        const verifySession = async () => {
            if (checking) return;
            checking = true;
            try {
                await touchSession();
            } finally {
                checking = false;
            }
        };

        const handleResume = () => verifySession();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') verifySession();
        };
        window.addEventListener('focus', handleResume);
        window.addEventListener('pageshow', handleResume);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleResume);
            window.removeEventListener('pageshow', handleResume);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [user, touchSession]);

    return (
        <AuthContext.Provider value={{ user, login, logout, touchSession, loading }}>
            <QueryClientProvider key={session.version} client={session.client}>
                {children}
            </QueryClientProvider>
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
