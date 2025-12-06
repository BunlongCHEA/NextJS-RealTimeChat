// Firebase Message Payload Types
export interface FirebaseNotificationPayload {
  title?: string;
  body?: string;
  image?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  click_action?: string;
}

export interface FirebaseMessageData {
  type: string;
  chatRoomId: string;
  messageId: string;
  senderId: string;
  senderName?: string;
  messageType: string;
  timestamp: string;
  [key: string]: string | undefined;
}

export interface FirebaseMessagePayload {
  notification?: FirebaseNotificationPayload;
  data?: FirebaseMessageData;
  from?: string;
  collapseKey?: string;
  messageId?: string;
}

// Push Notification Types
export interface PushNotificationData {
  type: string;
  chatRoomId: string;
  messageId: string;
  senderId: string;
  senderName?: string;
  messageType: string;
  timestamp: string;
}

export interface PushNotificationPayload {
  notification?: {
    title: string;
    body: string;
    image?: string;
  };
  data?: PushNotificationData;
}

// FCM Token Types
export interface FcmTokenRequest {
  token: string;
  deviceType: 'WEB' | 'ANDROID' | 'IOS';
}

export interface FcmTokenResponse {
  status: number;
  message: string;
  data: string | null;
}

// Firebase Configuration Types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Notification Permission Status
export type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

// Notification Callback Type
export type NotificationCallback = (payload: PushNotificationPayload) => void;

// Push Notification Service State
export interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
}

// Service Worker Message Types
export interface ServiceWorkerMessage {
  type: 'NOTIFICATION_CLICK' | 'NOTIFICATION_CLOSE' | 'PUSH_RECEIVED';
  payload?: PushNotificationPayload;
  action?: string;
  chatRoomId?: string;
}

// Extend the built-in NotificationOptions to include modern properties
export interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  image?: string;
  vibrate?: number | number[];
  timestamp?: number;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
}

// Add this if NotificationAction is not recognized
export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}