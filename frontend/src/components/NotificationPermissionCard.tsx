import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { enablePushNotifications, getNotificationPermission, isPushSupported } from '../services/pushNotifications';

type PermissionState = NotificationPermission | 'unsupported';

export const NotificationPermissionCard = () => {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [subscribed, setSubscribed] = useState(() => localStorage.getItem('pushNotificationsEnabled') === 'true');
  const supported = isPushSupported();

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    if (!supported || permission !== 'granted' || subscribed || loading || autoAttempted) return;

    setAutoAttempted(true);
    setLoading(true);
    setMessage('Bildirim izni acik, cihaz kaydediliyor...');
    enablePushNotifications()
      .then(() => {
        setSubscribed(true);
        setMessage('Bildirimler aktif. Telefonunuza test bildirimi gonderildi.');
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : 'Cihaz kaydedilemedi');
        localStorage.removeItem('pushNotificationsEnabled');
      })
      .finally(() => setLoading(false));
  }, [supported, permission, subscribed, loading, autoAttempted]);

  if (permission === 'granted' && subscribed) {
    return null;
  }

  const enable = async () => {
    setLoading(true);
    setMessage('');
    try {
      await enablePushNotifications();
      setPermission('granted');
      setSubscribed(true);
      setMessage('Bildirimler acildi. Test bildirimi gondererek deneyebilirsiniz.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Bildirimler acilamadi');
      setPermission(getNotificationPermission());
    } finally {
      setLoading(false);
    }
  };

  const denied = permission === 'denied';
  const text = !supported
    ? 'Bu tarayici telefon bildirimi desteklemiyor olabilir. iPhone kullaniyorsaniz siteyi ana ekrana ekleyip oradan acmaniz gerekir.'
    : denied
      ? 'Bu site icin bildirim izni engellenmis. Chrome adres cubugundaki kilit/ayar ikonundan Site ayarlari > Bildirimler > Izin ver secin, sonra sayfayi yenileyin.'
      : permission === 'granted'
        ? 'Bildirim izni acik. Bu cihazi portala kaydetmek icin devam edin.'
        : 'Duyuru, egitim atamasi ve onemli hatirlatmalari telefonda gormek icin bildirimleri acabilirsiniz.';

  return (
    <div className="home-surface notification-permission-card">
      <div className="notification-permission-icon">
        {denied || !supported ? <BellOff size={22} /> : <Bell size={22} />}
      </div>
      <div className="notification-permission-content">
        <h3>Telefon bildirimleri</h3>
        <p>{text}</p>
        {message && (
          <span className={message.includes('acildi') ? 'notification-success' : 'notification-warning'}>
            {message.includes('acildi') && <CheckCircle2 size={15} />} {message}
          </span>
        )}
      </div>
      {supported && !denied ? (
        <button type="button" className="btn-primary" onClick={enable} disabled={loading}>
          {loading ? 'Kaydediliyor...' : permission === 'granted' ? 'Cihazi Kaydet' : 'Bildirimleri Ac'}
        </button>
      ) : (
        <button type="button" className="btn-secondary notification-permission-unavailable" disabled>
          {denied ? 'Izin engelli' : 'Desteklenmiyor'}
        </button>
      )}
    </div>
  );
};
