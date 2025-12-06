'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { pushNotificationService } from '@/lib/pushNotificationService';
import { 
  PushNotificationPayload, 
  PushNotificationState,
  NotificationCallback 
} from '@/types/firebase';
import { useAuth } from './useAuth';

interface UsePushNotificationsOptions {
  autoInitialize?: boolean;
  onNotificationReceived?: NotificationCallback;
  currentChatRoomId?: number; // Track current chat room
}

interface UsePushNotificationsReturn extends PushNotificationState {
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<boolean>;
  refreshToken: () => Promise<string | null>;
}

export const usePushNotifications = (
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn => {
  const { autoInitialize = true, onNotificationReceived, currentChatRoomId } = options;
  const { user, token: authToken } = useAuth();
  
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    isLoading: false,
    error: null,
    token: null,
  });

  const initializationAttempted = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isPageVisible = useRef(true); // Track page visibilit

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = ! document.hidden;
      console.log(`📱 Page visibility: ${isPageVisible.current ? 'visible' : 'hidden'}`);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Check if notifications are supported
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isSupported: pushNotificationService.isSupported(),
    }));
  }, []);

  // Check current permission status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setState((prev) => ({
        ...prev,
        isEnabled: Notification.permission === 'granted',
      }));
    }
  }, []);

  // Set up notification listener
  useEffect(() => {
    if (!onNotificationReceived) return;

    // Wrap callback to filter notifications
    const wrappedCallback: NotificationCallback = (payload: PushNotificationPayload) => {
      // Don't show notification if page is visible and user is in the same chat room
      if (isPageVisible.current && 
          payload.data?.chatRoomId && 
          currentChatRoomId && 
          parseInt(payload.data.chatRoomId) === currentChatRoomId) {
        console.log(`Suppressed notification - user active in room ${currentChatRoomId}`);
        return;
      }

      // Don't show notification if page is visible (user is actively using the app)
      if (isPageVisible.current) {
        console.log('Suppressed notification - user is actively using the app');
        // Still call the callback for updating unread counts, but don't show visual notification
        onNotificationReceived(payload);
        return;
      }

      // Show notification (user is not active)
      console.log('Showing notification - user is not active');
      onNotificationReceived(payload);
    };

    unsubscribeRef.current = pushNotificationService.onMessage(wrappedCallback);
    // unsubscribeRef.current = pushNotificationService.onMessage(onNotificationReceived);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [onNotificationReceived, currentChatRoomId]);

  // Auto-initialize when user logs in
  useEffect(() => {
    if (
      autoInitialize &&
      user &&
      authToken &&
      state.isSupported &&
      !initializationAttempted.current
    ) {
      initializationAttempted.current = true;
      
      // Check if already enabled
      if (Notification.permission === 'granted') {
        initializeNotifications();
      }
    }
  }, [user, authToken, state.isSupported, autoInitialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const initializeNotifications = async (): Promise<boolean> => {
    try {
      const initialized = await pushNotificationService.initialize();
      
      if (initialized) {
        await pushNotificationService.registerToken();
        
        setState((prev) => ({
          ...prev,
          isEnabled: true,
          token: pushNotificationService.getToken(),
          error: null,
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize notifications';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
      return false;
    }
  };

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: 'Push notifications are not supported in this browser',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await initializeNotifications();
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isEnabled: success,
      }));

      if (success) {
        console.log('Push notifications enabled');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable notifications';
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      console.error('Failed to enable notifications:', error);
      return false;
    }
  }, [state.isSupported]);

  const disableNotifications = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await pushNotificationService.unregisterToken();
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isEnabled: false,
        token: null,
      }));

      console.log('Push notifications disabled');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable notifications';
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      console.error('Failed to disable notifications:', error);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      // Re-initialize to get new token
      const success = await initializeNotifications();
      
      if (success) {
        return pushNotificationService.getToken();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }, []);

  return {
    ...state,
    enableNotifications,
    disableNotifications,
    refreshToken,
  };
};