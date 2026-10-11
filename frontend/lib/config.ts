
export const config = {
  // Main API server (also serves Y.js WebSocket on /yjs/*)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  // Document service (same as API server — kept for backward compatibility with api.ts)
  documentServiceUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  requestTimeout: 120000,
  longOperationTimeout: 600000,
} as const

export default config
