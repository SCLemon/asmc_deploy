self.addEventListener("install", (event) => {
  console.log("[SW] installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] activated");
  event.waitUntil(self.clients.claim());
});

// 收到推播時
self.addEventListener("push", (event) => {
  console.log("[SW] push received");

  const data = event.data.json();

  const title = data.title;
  const options = {
    body: data.body,
    icon: "./logo.png",
    badge: "./logo.png",
    data: {
      url: data.url || "./",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 點通知後
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 如果已經有開著的頁面，就 focus
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // 沒有就開新視窗
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
