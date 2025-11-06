'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
  status: string;
  message: string;
  timestamp: string;
  environment?: string;
  version?: string;
  config?: {
    apiUrl?: string;
    wsUrl?: string;
  };
}

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);

  useEffect(() => {
    // Client-side health check
    const checkHealth = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
      
      if (!apiUrl || !wsUrl) {
        setHealthData({
          status: 'unhealthy',
          message: 'Environment variables not loaded',
          timestamp: new Date().toISOString()
        });
        return;
      }

      setHealthData({
        status: 'healthy',
        message: 'Next.js Chat App is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        config: {
          apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
          wsUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
        }
      });
    };

    checkHealth();
  }, []);

  if (!healthData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            healthData.status === 'healthy' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              healthData.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            {healthData.status.toUpperCase()}
          </div>
          
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Health Check
          </h1>
          
          <p className="mt-2 text-gray-600">
            {healthData.message}
          </p>
          
          <div className="mt-6 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Timestamp:</span>
              <span className="text-gray-900">{healthData.timestamp}</span>
            </div>
            
            {healthData.environment && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Environment:</span>
                <span className="text-gray-900">{healthData.environment}</span>
              </div>
            )}
            
            {healthData.version && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Version:</span>
                <span className="text-gray-900">{healthData.version}</span>
              </div>
            )}
            
            {healthData.config?.apiUrl && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">API URL:</span>
                <span className="text-gray-900 truncate ml-2">{healthData.config.apiUrl}</span>
              </div>
            )}
            
            {healthData.config?.wsUrl && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">WebSocket URL:</span>
                <span className="text-gray-900 truncate ml-2">{healthData.config.wsUrl}</span>
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}