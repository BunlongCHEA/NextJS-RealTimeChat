import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for nginx
  output: 'export',

  // Disable React Strict Mode for WebSocket connections
  reactStrictMode: false,
  
  // External packages for server components
  serverExternalPackages: ['@stomp/stompjs', 'sockjs-client'],
  
  // // Turbopack configuration for better performance
  // turbo: {
  //   rules: {
  //     '*.sockjs': {
  //       loaders: ['file-loader'],
  //     },
  //   },
  // },

  // Allow WebSocket connections with enhanced headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  images: {
    unoptimized: true, // Disable image optimization for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'chatnextjs.bunlong.site',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'chatspringboot.bunlong.site',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

// export default nextConfig;
module.exports = nextConfig;
