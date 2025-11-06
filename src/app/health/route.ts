import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if environment variables are loaded
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
    if (!apiUrl || !wsUrl) {
      return NextResponse.json(
        { 
          status: 'unhealthy', 
          message: 'Environment variables not loaded',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    // Basic health check
    return NextResponse.json({
      status: 'healthy',
      message: 'Next.js Chat App is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      config: {
        apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
        wsUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}