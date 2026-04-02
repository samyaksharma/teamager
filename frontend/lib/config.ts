/**
 * Configuration for API URLs and environment-specific settings
 */

export const config = {
  // Main API server (also serves Y.js WebSocket on /yjs/*)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  // Document service (same as API server — kept for backward compatibility with api.ts)
  documentServiceUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Timeouts
  requestTimeout: 120000, // 2 minutes
  longOperationTimeout: 600000, // 10 minutes for large operations
} as const

export default config
