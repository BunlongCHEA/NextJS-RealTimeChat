import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for nginx
  // output: 'export',

  // Enable standalone output for Docker (SSR)
  output: 'standalone',

  // Disable React Strict Mode for WebSocket connections
  reactStrictMode: false,
  
  // External packages for server components
  serverExternalPackages: ['@stomp/stompjs', 'sockjs-client'],

  // // Enable experimental features
  // experimental: {
  //   serverComponentsExternalPackages: ['@stomp/stompjs', 'sockjs-client'],
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

  // Webpack configuration
  // webpack: (config, { isServer }) => {
  //   if (!isServer) {
  //     config.resolve.fallback = {
  //       ...config.resolve.fallback,
  //       net: false,
  //       tls: false,
  //       fs: false,
  //     };
  //   }
  //   return config;
  // },

  // images: {
  //   // Enable image optimization
  //   domains: ['chatnextjs.bunlong.site', 'chatspringboot.bunlong.site', 'raw.githubusercontent.com', 'example.com'],
  //   formats: ['image/webp', 'image/avif'],
  //   deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  //   imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  // },

  images: {
    unoptimized: true, // Disable image optimization for static export, and to avoid GET 400 errors -- https://chatnextjs.bunlong.site/_next/image?url=***
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        port: '',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/api/v1/images/**',
      },
      // {
      //   protocol: 'https',
      //   hostname: 'chatnextjs.bunlong.site',
      //   port: '',
      //   pathname: '/api/v1/images/**',
      // },
      {
        protocol: 'https',
        hostname: 'chatspringboot.bunlong.site',
        port: '',
        pathname: '/api/v1/images/**',
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
