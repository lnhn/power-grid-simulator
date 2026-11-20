/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ]

    return [
      // 全站基础安全响应头（不启用严格 CSP，以免影响 Next 内联脚本）
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // API 响应不缓存，避免会话/租户数据被中间层缓存
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
