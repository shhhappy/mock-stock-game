// 모의주식게임 — 로또/룰렛 1분 전 알림용 서비스워커
// 앱이 백그라운드거나 화면이 꺼져 있어도 push 이벤트를 받아 알림(소리+진동)을 띄운다.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: '모의주식게임', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '모의주식게임';
  const options = {
    body: data.body || '',
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || 'mock-stock-game',
    renotify: true,
    requireInteraction: false,
    data: { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
