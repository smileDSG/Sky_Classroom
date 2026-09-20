import type { NextConfig } from 'next';

// 每次构建生成唯一指纹: 暴露给客户端(STALE_GUARD), 长驻标签页靠它主动发现「已发新版」并自刷新。
// 不能写死, 否则 Docker 同一镜像重复部署时指纹不变, 自愈就检测不到新版本。
const BUILD_ID = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  generateBuildId: () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  transpilePackages: ['mathml2omml', 'pptxgenjs', '@maic/dsl', '@maic/renderer'],
  serverExternalPackages: ['better-sqlite3', '@napi-rs/canvas', 'mysql2'],

  // Image optimization: prefer AVIF/WebP for smaller payloads
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1-year browser cache
  },

  // Gzip/Brotli compression (Next.js prod default, explicit here)
  compress: true,

  experimental: {
    proxyClientMaxBodySize: '200mb',
  },

  async headers() {
    const extraAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();
    const frameAncestors = extraAncestors ? `'self' ${extraAncestors}` : "'self'";

    return [
      // Original CSP headers
      {
        source: '/(.*)',
        headers: [
          ...(!extraAncestors ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
      // In development, Turbopack chunk URLs can outlive the current module graph.
      // Do not let the browser keep stale chunks across HMR rebuilds.
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              process.env.NODE_ENV === 'development'
                ? 'no-store, no-cache, must-revalidate'
                : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Avatars & logos: long cache with stale-while-revalidate
      {
        source: '/avatars/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/logos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
