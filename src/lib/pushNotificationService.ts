import { 
  PushNotificationPayload, 
  PushNotificationState,
  NotificationCallback,
  FirebaseMessagePayload,
  ExtendedNotificationOptions
} from '@/types/firebase';
import { ApiService } from './api';
import {
  initializeFirebaseApp,
  requestFcmToken,
  subscribeToForegroundMessages,
  isFirebaseSupported,
  getNotificationPermissionStatus,
} from './firebaseClient';

class PushNotificationService {
  private static instance: PushNotificationService;
  private token: string | null = null;
  private isInitialized = false;
  private messageListeners: Set<NotificationCallback> = new Set();
  private unsubscribeForeground: (() => void) | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize the push notification service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (typeof window === 'undefined') {
      return false;
    }

    if (!isFirebaseSupported()) {
      console.warn('Push notifications not supported in this browser');
      return false;
    }

    try {
      // Initialize Firebase
      const app = initializeFirebaseApp();
      if (!app) {
        console.error('Failed to initialize Firebase app');
        return false;
      }

      // Register service worker
      await this.registerServiceWorker();

      // Request permission and get token
      this.token = await requestFcmToken();

      if (! this.token) {
        console.warn('Failed to get FCM token');
        return false;
      }

      // Set up foreground message listener
      this.setupForegroundListener();

      this.isInitialized = true;
      console.log('Push notification service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      return false;
    }
  }

  /**
   * Register service worker for background notifications
   */
  private async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (! ('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Set up listener for foreground messages
   */
  private setupForegroundListener(): void {
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }

    this.unsubscribeForeground = subscribeToForegroundMessages((payload: FirebaseMessagePayload) => {
      const pushPayload = this.convertToPushNotificationPayload(payload);
      
      // Notify all listeners
      this.messageListeners.forEach((callback) => {
        callback(pushPayload);
      });

      // Show notification manually in foreground
      this.showForegroundNotification(pushPayload);
    });
  }

  /**
   * Convert Firebase message payload to push notification payload
   */
  private convertToPushNotificationPayload(payload: FirebaseMessagePayload): PushNotificationPayload {
    return {
      notification: payload.notification ? {
        title: payload.notification.title || 'New Message',
        body: payload.notification.body || '',
        image: payload.notification.image,
      } : undefined,
      data: payload.data ?  {
        type: payload.data.type || 'NEW_MESSAGE',
        chatRoomId: payload.data.chatRoomId || '',
        messageId: payload.data.messageId || '',
        senderId: payload.data.senderId || '',
        senderName: payload.data.senderName,
        messageType: payload.data.messageType || 'TEXT',
        timestamp: payload.data.timestamp || new Date().toISOString(),
      } : undefined,
    };
  }

  /**
   * Show notification when app is in foreground
   */
  private showForegroundNotification(payload: PushNotificationPayload): void {
    if (! payload.notification) return;

    // Don't show notification if page is visible (user is actively using the app)
    if (! document.hidden) {
        console.log('🔕 Suppressed foreground notification - page is visible');
        return;
    }

    const { title, body, image } = payload.notification;
    const chatRoomId = payload.data?.chatRoomId;

    const options: ExtendedNotificationOptions = {
      body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `chat-${chatRoomId || 'default'}`,
      renotify: true,
      data: payload.data,
      silent: false,
    };

    if (image) {
      options.image = image;
    }

    if (getNotificationPermissionStatus() === 'granted') {
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        if (chatRoomId) {
          window.location.href = `/chat/${chatRoomId}`;
        }
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  /**
   * Register FCM token with backend server
   */
  async registerToken(): Promise<void> {
    if (!this.token) {
      console.warn('No FCM token available to register');
      return;
    }

    try {
      await ApiService.registerFcmToken(this.token, 'WEB');
      console.log('FCM token registered with server');
    } catch (error) {
      console.error('Failed to register FCM token:', error);
      throw error;
    }
  }

  /**
   * Unregister FCM token from backend server
   */
  async unregisterToken(): Promise<void> {
    if (!this.token) {
      return;
    }

    try {
      await ApiService.unregisterFcmToken(this.token);
      console.log('FCM token unregistered');
    } catch (error) {
      console.error('Failed to unregister FCM token:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notification messages
   */
  onMessage(callback: NotificationCallback): () => void {
    this.messageListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return isFirebaseSupported();
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current state of the service
   */
  getState(): PushNotificationState {
    return {
      isSupported: this.isSupported(),
      isEnabled: getNotificationPermissionStatus() === 'granted',
      isLoading: false,
      error: null,
      token: this.token,
    };
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
      this.unsubscribeForeground = null;
    }
    this.messageListeners.clear();
    this.isInitialized = false;
    this.token = null;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();