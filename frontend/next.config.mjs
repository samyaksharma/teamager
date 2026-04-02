/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Ensure single Yjs instance
    config.resolve.alias = {
      ...config.resolve.alias,
      'yjs': 'yjs'
    }
    return config
  },
}

export default nextConfig
