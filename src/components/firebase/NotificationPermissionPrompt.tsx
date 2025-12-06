'use client';

import { useState, useEffect } from 'react';
import { BellIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { 
  isNotificationPermissionGranted, 
  isNotificationPermissionDenied,
  requestNotificationPermission 
} from '@/lib/firebaseClient';

interface NotificationPermissionPromptProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  autoShow?: boolean;
}

export default function NotificationPermissionPrompt({
  onPermissionGranted,
  onPermissionDenied,
  autoShow = true,
}: NotificationPermissionPromptProps) {
  const [show, setShow] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<string>('');

  useEffect(() => {
    // Check if we should show the prompt
    const shouldShow = 
      typeof window !== 'undefined' &&
      'Notification' in window &&
      ! isNotificationPermissionGranted() &&
      !isNotificationPermissionDenied() &&
      autoShow;

    setShow(shouldShow);

    // Detect browser
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('chrome')) {
        setBrowserInfo('Chrome');
      } else if (userAgent.includes('firefox')) {
        setBrowserInfo('Firefox');
      } else if (userAgent.includes('safari')) {
        setBrowserInfo('Safari');
      } else if (userAgent.includes('edge')) {
        setBrowserInfo('Edge');
      } else {
        setBrowserInfo('your browser');
      }
    }
  }, [autoShow]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);

    try {
      const permission = await requestNotificationPermission();

      if (permission === 'granted') {
        console.log('Permission granted');
        setShow(false);
        onPermissionGranted?.();
      } else if (permission === 'denied') {
        console.log('Permission denied');
        setShow(false);
        onPermissionDenied?.();
      } else {
        console.log('⏸️ Permission dismissed');
        // Don't hide, user might click again
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  if (! show) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <BellIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Enable Notifications
              </h3>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-600 mb-4">
          Get notified instantly when you receive new messages, even when you are not actively using the app.
        </p>

        {/* Info Box */}
        <div className="flex items-start space-x-2 bg-blue-50 rounded-lg p-3 mb-4">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            {browserInfo} will ask for your permission to show notifications.  Click Allow when prompted.
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequesting ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Requesting...</span>
              </span>
            ) : (
              'Enable Notifications'
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            Not Now
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}