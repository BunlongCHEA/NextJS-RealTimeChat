// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration - Replace with your config
// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
// };

const firebaseConfig = {
  apiKey: 'AIzaSyC3SZrnER1MKBzppAU0rGPP6_Q0kMTELbs',
  authDomain: 'bunlong-22f66.firebaseapp.com',
  projectId: 'bunlong-22f66',
  storageBucket: 'bunlong-22f66.firebasestorage.app',
  messagingSenderId: '326843919188',
  appId: '1:326843919188:web:4286be6ee49c536f1076c1',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    tag: `chat-${payload.data?.chatRoomId || 'default'}`,
    renotify: true,
    requireInteraction: false,
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'Open Chat',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  // Add image if available
  if (payload.notification?.image) {
    notificationOptions.image = payload.notification.image;
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);

  event.notification.close();

  const chatRoomId = event.notification.data?.chatRoomId;
  const action = event.action;

  if (action === 'dismiss') {
    return;
  }

  // Default action or 'open' action
  const urlToOpen = chatRoomId ? `/chat/${chatRoomId}` : '/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.navigate(urlToOpen).then(() => client.focus());
        }
      }
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event);
});