importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyApz5hnCLN4ZgG87cjkvztj_qlTHt5dizU",
  authDomain: "attendance-app-f3968.firebaseapp.com",
  projectId: "attendance-app-f3968",
  storageBucket: "attendance-app-f3968.firebasestorage.app",
  messagingSenderId: "1054968600634",
  appId: "1:1054968600634:web:ad9a66e50e26b98ccf7d03"
});

const messaging = firebase.messaging();

// Intercept background notifications and fire native OS banners
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || payload.notification?.title || "Scholarlytix Alert";
  
  // Extract the target tab from the payload
  const targetTab = payload.data?.targetTab || "Notice Board";

  const options = {
    body: payload.data?.message || payload.notification?.body || "You have a new academic update.",
    icon: '/favicon.ico',
    data: { tab: targetTab } // Store the tab inside the notification data payload
  };
  return self.registration.showNotification(title, options);
});

// Handle Banner Clicks and Route to the correct Dashboard Tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetTab = event.notification.data.tab;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if there is already an app window open on a dashboard
      for (let client of windowClients) {
        const clientUrl = new URL(client.url);
        // If the user is currently on the student or faculty dashboard, navigate them instantly
        if (clientUrl.pathname.includes('/dashboard')) {
          // Seamlessly swap the tab without opening a duplicate browser tab
          const newUrl = `${clientUrl.origin}${clientUrl.pathname}?tab=${encodeURIComponent(targetTab)}`;
          return client.navigate(newUrl).then((c) => c.focus());
        }
      }
      
      // 2. If the app is completely closed, open the root domain with the tab param.
      // The Next.js layout auth guards will carry the param over to the respective dashboard.
      if (clients.openWindow) {
        return clients.openWindow(`/?tab=${encodeURIComponent(targetTab)}`);
      }
    })
  );
});