import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if environment variables are loaded
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
    if (!apiUrl || !wsUrl) {
      // Return HTML for browser display
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Health Check - Unhealthy</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status { padding: 10px 20px; border-radius: 5px; margin-bottom: 20px; }
            .unhealthy { background: #fee; border: 1px solid #f66; color: #d33; }
            .healthy { background: #efe; border: 1px solid #6f6; color: #3d3; }
            .info { background: #f9f9f9; padding: 15px; border-radius: 5px; }
            .timestamp { color: #666; font-size: 0.9em; }
            h1 { color: #333; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🏥 Next.js Chat App Health Check</h1>
            <div class="status unhealthy">
              ❌ <strong>UNHEALTHY</strong> - Environment variables not loaded
            </div>
            <div class="info">
              <p><strong>Timestamp:</strong> <span class="timestamp">${new Date().toISOString()}</span></p>
              <p><strong>Updated by:</strong> BunlongCHEA</p>
              <p><strong>Updated:</strong> 2025-11-07 09:46:44 UTC</p>
            </div>
          </div>
        </body>
        </html>
        `,
        { 
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      );
    }

    // Return HTML for healthy status
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Health Check - Healthy</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .status { padding: 15px 25px; border-radius: 8px; margin-bottom: 25px; font-size: 1.1em; }
          .healthy { background: #e8f5e8; border: 2px solid #4caf50; color: #2e7d32; }
          .info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .config { background: #e3f2fd; padding: 20px; border-radius: 8px; }
          .timestamp { color: #666; font-size: 0.9em; }
          h1 { color: #333; margin-bottom: 25px; text-align: center; }
          h2 { color: #555; margin-top: 25px; margin-bottom: 15px; }
          .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; word-break: break-all; }
          .url { color: #1976d2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏥 Next.js Chat App Health Check</h1>
          
          <div class="status healthy">
            ✅ <strong>HEALTHY</strong> - Next.js Chat App is running perfectly!
          </div>
          
          <div class="info">
            <h2>📊 System Information</h2>
            <div class="grid">
              <div class="label">Status:</div>
              <div class="value">Healthy</div>
              
              <div class="label">Environment:</div>
              <div class="value">${process.env.NODE_ENV || 'development'}</div>
              
              <div class="label">Version:</div>
              <div class="value">${process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}</div>
              
              <div class="label">Timestamp:</div>
              <div class="value timestamp">${new Date().toISOString()}</div>
              
              <div class="label">Updated by:</div>
              <div class="value">BunlongCHEA</div>
              
              <div class="label">Last Updated:</div>
              <div class="value">2025-11-07 09:46:44 UTC</div>
            </div>
          </div>
          
          <div class="config">
            <h2>🔗 Configuration</h2>
            <div class="grid">
              <div class="label">API Base URL:</div>
              <div class="value url">${apiUrl}</div>
              
              <div class="label">WebSocket URL:</div>
              <div class="value url">${wsUrl}</div>
              
              <div class="label">Build Date:</div>
              <div class="value">${process.env.NEXT_PUBLIC_BUILD_DATE || '2025-11-07T09:46:44.000Z'}</div>
              
              <div class="label">Built by:</div>
              <div class="value">${process.env.NEXT_PUBLIC_BUILD_BY || 'BunlongCHEA'}</div>
            </div>
          </div>
          
          <div style="margin-top: 30px; text-align: center; color: #888; font-size: 0.9em;">
            <p>🚀 Real-time Chat Application by BunlongCHEA</p>
            <p>Powered by Next.js + Nginx + Node.js</p>
          </div>
        </div>
      </body>
      </html>
      `,
      { 
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    // Return HTML for error status
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Health Check - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .status { padding: 10px 20px; border-radius: 5px; margin-bottom: 20px; }
          .error { background: #ffeaea; border: 1px solid #ff6b6b; color: #c92a2a; }
          .info { background: #f9f9f9; padding: 15px; border-radius: 5px; }
          .timestamp { color: #666; font-size: 0.9em; }
          h1 { color: #333; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏥 Next.js Chat App Health Check</h1>
          <div class="status error">
            ❌ <strong>ERROR</strong> - Health check failed
          </div>
          <div class="info">
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <p><strong>Timestamp:</strong> <span class="timestamp">${new Date().toISOString()}</span></p>
            <p><strong>Updated by:</strong> BunlongCHEA</p>
            <p><strong>Updated:</strong> 2025-11-07 09:46:44 UTC</p>
          </div>
        </div>
      </body>
      </html>
      `,
      { 
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
}