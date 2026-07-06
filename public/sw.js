self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'EcoTani';
    const options = {
      body: data.body || 'Terdeteksi cuaca ekstrem.',
      icon: '/assets/logo.svg',
      badge: '/assets/logo.svg',
      data: {
        url: data.url || '/dashboard'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Error in push event handler:', err);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Peringatan EcoTani', {
        body: text,
        icon: '/assets/logo.svg',
        data: { url: '/dashboard' }
      })
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Find if there is an existing tab open with the same origin
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(urlToOpen).then(c => c.focus());
        }
      }
      // If no tab is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
