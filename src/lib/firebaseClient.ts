import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';
import { 
  FirebaseConfig, 
  FirebaseMessagePayload, 
  NotificationPermissionStatus 
} from '@/types/firebase';

// Firebase configuration from environment variables
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Firebase instances
let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

// Validate Firebase configuration
const isFirebaseConfigValid = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
};

// Initialize Firebase App
export const initializeFirebaseApp = (): FirebaseApp | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isFirebaseConfigValid()) {
    console.warn('Firebase configuration is incomplete');
    return null;
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
      console.log('Firebase app initialized');
    } else {
      firebaseApp = getApps()[0];
    }
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase app:', error);
    return null;
  }
};

// Get Firebase Messaging instance
export const getFirebaseMessagingInstance = (): Messaging | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (messagingInstance) {
    return messagingInstance;
  }

  try {
    const app = initializeFirebaseApp();
    if (!app) {
      return null;
    }

    messagingInstance = getMessaging(app);
    console.log('Firebase Messaging initialized');
    return messagingInstance;
  } catch (error) {
    console.error('Failed to initialize Firebase Messaging:', error);
    return null;
  }
};


// Check if notification permission is granted
export const isNotificationPermissionGranted = (): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
};

// Check if notification permission is denied
export const isNotificationPermissionDenied = (): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'denied';
};

// Request notification permission with fallback for older browsers
export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  if (typeof window === 'undefined') {
    return 'default';
  }

  if (! ('Notification' in window)) {
    console.error('This browser does not support notifications');
    return 'default';
  }

  try {
    // Modern browsers (Chrome, Firefox, Edge, Safari 12. 1+)
    if (typeof Notification. requestPermission === 'function') {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionStatus;
    }

    // Fallback for older browsers (callback-based)
    return new Promise((resolve) => {
      Notification.requestPermission((permission) => {
        resolve(permission as NotificationPermissionStatus);
      });
    });
  } catch (error) {
    console. error('Error requesting notification permission:', error);
    return 'default';
  }
};

// Request notification permission and get FCM token
export const requestFcmToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const permission: NotificationPermissionStatus = await requestNotificationPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }
    
    console.log('✅ Notification permission granted');

    const messaging = getFirebaseMessagingInstance();
    if (!messaging) {
      console.error('Firebase Messaging not initialized');
      return null;
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('VAPID key not configured');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });

    if (token) {
      console.log('FCM token obtained');
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Subscribe to foreground messages
 */
export const subscribeToForegroundMessages = (
  callback: (payload: FirebaseMessagePayload) => void
): (() => void) => {
  const messaging = getFirebaseMessagingInstance();
  
  if (!messaging) {
    console.warn('Cannot subscribe to messages - Messaging not initialized');
    return () => {};
  }

  const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
    console.log('📬 Foreground message received:', payload);
    
    const typedPayload: FirebaseMessagePayload = {
      notification: payload.notification ?  {
        title: payload.notification.title,
        body: payload.notification.body,
        image: payload.notification.image,
        icon: payload.notification.icon,
      } : undefined,
      data: payload.data as FirebaseMessagePayload['data'],
      from: payload.from,
      collapseKey: payload.collapseKey,
      messageId: payload.messageId,
    };

    callback(typedPayload);
  });

  return unsubscribe;
};

/**
 * Check if Firebase is supported in current browser
 */
export const isFirebaseSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
};

/**
 * Get current notification permission status
 */
export const getNotificationPermissionStatus = (): NotificationPermissionStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission as NotificationPermissionStatus;
};