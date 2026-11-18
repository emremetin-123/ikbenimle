import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_WARNING_TIME_MS = 30 * 1000;
const TICK_MS = 1000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const SESSION_LAST_ACTIVITY_KEY = 'sessionLastActivityAt';
const ACTIVITY_WRITE_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
    'click',
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'touchmove',
    'pointerdown',
    'wheel'
];

export const SessionTimeout = () => {
    const { user, logout, touchSession } = useAuth();
    const userId = user?.id;
    const sessionTimeoutMs = Math.max(60_000, Number(user?.session_policy?.idle_timeout_ms) || DEFAULT_SESSION_TIMEOUT_MS);
    const warningTimeMs = Math.min(
        sessionTimeoutMs - 1_000,
        Math.max(10_000, Number(user?.session_policy?.warning_duration_ms) || DEFAULT_WARNING_TIME_MS)
    );
    const warningAtMs = sessionTimeoutMs - warningTimeMs;
    const absoluteExpiresAt = Date.parse(user?.session_policy?.absolute_expires_at || '');
    const [showPopup, setShowPopup] = useState(false);
    const [remainingTime, setRemainingTime] = useState(warningTimeMs / 1000);
    const lastActivityRef = useRef(0);
    const showPopupRef = useRef(false);
    const loggedOutRef = useRef(false);
    const lastActivityWriteRef = useRef(0);
    const lastSessionTouchRef = useRef(0);

    useEffect(() => {
        showPopupRef.current = showPopup;
    }, [showPopup]);

    useEffect(() => {
        if (!userId) {
            setShowPopup(false);
            setRemainingTime(warningTimeMs / 1000);
            lastActivityRef.current = Date.now();
            return;
        }

        const readLastActivity = () => {
            const stored = Number(localStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0);
            return stored || lastActivityRef.current || Date.now();
        };

        const writeLastActivity = (timestamp = Date.now(), force = false) => {
            if (!force && timestamp - lastActivityWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
            lastActivityWriteRef.current = timestamp;
            lastActivityRef.current = timestamp;
            localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
        };

        const existingActivity = readLastActivity();
        if (existingActivity) {
            lastActivityRef.current = existingActivity;
        } else {
            writeLastActivity(Date.now(), true);
        }
        loggedOutRef.current = false;
        setShowPopup(false);
        setRemainingTime(warningTimeMs / 1000);

        const forceLogout = () => {
            if (loggedOutRef.current) return;
            loggedOutRef.current = true;
            setShowPopup(false);
            logout();
        };

        const getIdleFor = () => Date.now() - readLastActivity();

        const checkTimeout = () => {
            if (Number.isFinite(absoluteExpiresAt) && Date.now() >= absoluteExpiresAt) {
                forceLogout();
                return true;
            }
            const idleFor = getIdleFor();

            if (idleFor >= sessionTimeoutMs) {
                forceLogout();
                return true;
            }

            if (idleFor >= warningAtMs) {
                const secondsLeft = Math.max(0, Math.ceil((sessionTimeoutMs - idleFor) / 1000));
                setRemainingTime(secondsLeft);
                setShowPopup(true);
            } else if (showPopupRef.current) {
                setShowPopup(false);
                setRemainingTime(warningTimeMs / 1000);
            }

            return false;
        };

        const markActivity = () => {
            if (checkTimeout()) return;
            writeLastActivity();
            const now = Date.now();
            if (now - lastSessionTouchRef.current >= SESSION_TOUCH_INTERVAL_MS) {
                lastSessionTouchRef.current = now;
                void touchSession();
            }
            if (showPopupRef.current) {
                showPopupRef.current = false;
                setShowPopup(false);
                setRemainingTime(warningTimeMs / 1000);
            }
        };

        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, markActivity, { passive: true, capture: true });
        });

        const handleVisibilityCheck = () => {
            if (document.visibilityState === 'visible') {
                checkTimeout();
            }
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === SESSION_LAST_ACTIVITY_KEY) {
                lastActivityRef.current = Number(event.newValue || Date.now());
                checkTimeout();
            }
        };

        const interval = window.setInterval(checkTimeout, TICK_MS);
        window.addEventListener('focus', checkTimeout);
        window.addEventListener('pageshow', checkTimeout);
        window.addEventListener('storage', handleStorageChange);
        document.addEventListener('visibilitychange', handleVisibilityCheck);

        return () => {
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, markActivity, { capture: true });
            });
            window.removeEventListener('focus', checkTimeout);
            window.removeEventListener('pageshow', checkTimeout);
            window.removeEventListener('storage', handleStorageChange);
            document.removeEventListener('visibilitychange', handleVisibilityCheck);
            window.clearInterval(interval);
        };
    }, [
        absoluteExpiresAt,
        logout,
        sessionTimeoutMs,
        touchSession,
        userId,
        warningAtMs,
        warningTimeMs
    ]);

    const handleStayLoggedIn = () => {
        const now = Date.now();
        lastActivityRef.current = now;
        lastActivityWriteRef.current = now;
        localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
        showPopupRef.current = false;
        setShowPopup(false);
        setRemainingTime(warningTimeMs / 1000);
        lastSessionTouchRef.current = now;
        void touchSession();
    };

    if (!showPopup || !user) return null;

    return (
        <div className="session-timeout-overlay" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
            <div className="premium-card session-timeout-card">
                <div className="session-timeout-icon" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                </div>
                <h2 id="session-timeout-title" className="session-timeout-title">Oturum Kapatiliyor</h2>
                <p className="session-timeout-message">
                    Uzun suredir islem yapmadiniz. Guvenliginiz icin oturumunuz <strong className="session-timeout-countdown">{remainingTime} saniye</strong> icinde kapatilacaktir.
                </p>
                <div className="session-timeout-actions">
                    <button type="button" className="btn-primary session-timeout-stay" onClick={handleStayLoggedIn}>
                        Oturumda Kal
                    </button>
                    <button type="button" className="btn-icon session-timeout-logout" onClick={() => logout()}>
                        Cikis Yap
                    </button>
                </div>
            </div>
        </div>
    );
};
