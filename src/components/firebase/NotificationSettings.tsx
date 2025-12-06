'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { isNotificationPermissionDenied } from '@/lib/firebaseClient';
import { PushNotificationPayload } from '@/types/firebase';
import { BellIcon, BellSlashIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface NotificationSettingsProps {
  onNotificationReceived?: (payload: PushNotificationPayload) => void;
  className?: string;
}

export default function NotificationSettings({
  onNotificationReceived,
  className = '',
}: NotificationSettingsProps) {
  const {
    isSupported,
    isEnabled,
    isLoading,
    error,
    enableNotifications,
    disableNotifications,
  } = usePushNotifications({
    onNotificationReceived,
  });

  const isBlocked = isNotificationPermissionDenied();

  if (!isSupported) {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2">
          <BellSlashIcon className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-yellow-800 text-sm font-medium">
              Notifications not supported
            </p>
            <p className="text-yellow-700 text-xs mt-1">
              Your browser doesn not support push notifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-start space-x-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 text-sm font-medium">
              Notifications are blocked
            </p>
            <p className="text-red-700 text-xs mt-1">
              You have previously blocked notifications.  To enable them, click the lock icon 🔒 in your browser address bar and change the notification permission to Allow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isEnabled) {
      await disableNotifications();
    } else {
      await enableNotifications();
    }
  };

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isEnabled ? (
            <div className="p-2 bg-green-100 rounded-full">
              <BellIcon className="w-5 h-5 text-green-600" />
            </div>
          ) : (
            <div className="p-2 bg-gray-100 rounded-full">
              <BellSlashIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div>
            <h3 className="font-medium text-gray-900">Push Notifications</h3>
            <p className="text-sm text-gray-500">
              {isEnabled
                ? 'You will receive notifications for new messages'
                : 'Enable to receive notifications for new messages'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isEnabled ?  'bg-blue-500' : 'bg-gray-200'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
          {isLoading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}