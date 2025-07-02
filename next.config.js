/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 14, no need for experimental flag
  webpack: (config, { isServer }) => {
    // 修复ChromaDB的webpack兼容性问题
    if (isServer) {
      // 服务端：排除ChromaDB的浏览器特定模块
      config.externals.push({
        'chromadb': 'commonjs chromadb'
      })
    } else {
      // 客户端：配置fallback
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        buffer: false,
        process: false,
      }
    }

    // 添加对HTTPS模块的支持
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    })

    return config
  },
  
  // 配置环境变量
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // 实验性功能
  experimental: {
    // 启用服务端组件
    serverComponentsExternalPackages: ['chromadb']
  }
}

module.exports = nextConfig 