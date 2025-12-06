'use client';

import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { isNotificationPermissionDenied } from '@/lib/firebaseClient';

export default function NotificationPermissionBlocked() {
  const [show, setShow] = useState(false);
  const [instructions, setInstructions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isDenied = isNotificationPermissionDenied();
    setShow(isDenied);

    if (isDenied) {
      // Detect browser and set instructions
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('chrome') || userAgent.includes('edge')) {
        setInstructions([
          'Click the lock icon 🔒 in the address bar',
          'Find "Notifications" in the permissions list',
          'Change from "Block" to "Allow"',
          'Refresh this page',
        ]);
      } else if (userAgent.includes('firefox')) {
        setInstructions([
          'Click the lock icon 🔒 in the address bar',
          'Click "Connection secure" or "More information"',
          'Go to Permissions tab',
          'Find "Receive Notifications" and select "Allow"',
          'Refresh this page',
        ]);
      } else if (userAgent.includes('safari')) {
        setInstructions([
          'Open Safari menu → Preferences',
          'Go to Websites → Notifications',
          'Find this website and set to "Allow"',
          'Refresh this page',
        ]);
      } else {
        setInstructions([
          'Go to your browser settings',
          'Find Site Settings or Permissions',
          'Enable notifications for this site',
          'Refresh this page',
        ]);
      }
    }
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Notifications Are Blocked
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p className="mb-2">You have blocked notifications. To enable them:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                {instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="ml-3 flex-shrink-0 text-yellow-600 hover:text-yellow-800"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}