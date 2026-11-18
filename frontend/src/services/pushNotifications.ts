import { api } from './api';

type VapidResponse = {
  publicKey: string;
  configured: boolean;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export const isPushSupported = () => (
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window
);

export const getNotificationPermission = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const enablePushNotifications = async () => {
  if (!isPushSupported()) {
    throw new Error('Bu tarayıcı bildirimleri desteklemiyor');
  }

  const vapid = await api.get<VapidResponse>('/api/notifications/vapid-public-key');
  if (!vapid.configured || !vapid.publicKey) {
    throw new Error('Bildirim anahtarları sunucuda tanımlı değil');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Bildirim izni verilmedi');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
  });

  await api.post('/api/notifications/subscribe', {
    subscription,
    deviceLabel: navigator.userAgent.slice(0, 180)
  });
  await api.post('/api/notifications/test-me');
  localStorage.setItem('pushNotificationsEnabled', 'true');

  return subscription;
};
