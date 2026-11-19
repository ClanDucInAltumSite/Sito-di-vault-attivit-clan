// public/sw-notifications.js
// Handler per notifiche PWA (Web Push & Notification Click)
// Vault Scout - Duc In Altum

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra aperta, portala in primo piano e naviga all'URL desiderato
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.navigate && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra PWA
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {
      title: 'Vault Scout',
      body: event.data ? event.data.text() : 'Nuovo aggiornamento disponibile',
    };
  }

  const title = data.title || 'Vault Scout - Clan Duc In Altum';
  const options = {
    body: data.body || 'Nuovo aggiornamento in arrivo',
    icon: data.icon || './icons/icon-192x192.png',
    badge: data.badge || './icons/icon-192x192.png',
    tag: data.tag || 'vault-scout-notification',
    data: {
      url: data.url || './',
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
