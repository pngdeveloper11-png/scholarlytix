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
  
  // Dynamically determine the route based on the targetTab data
  let targetUrl = '/';
  if (payload.data?.targetTab) {
      targetUrl = `/?tab=${encodeURIComponent(payload.data.targetTab)}`;
  }

  const options = {
    body: payload.data?.message || payload.notification?.body || "You have a new academic update.",
    icon: '/favicon.ico',
    data: { url: targetUrl }
  };
  return self.registration.showNotification(title, options);
});

// Handle Banner Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});