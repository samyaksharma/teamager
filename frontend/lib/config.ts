
// NEXT_PUBLIC_* values are inlined when the app is built, so changing the variable on the host has no effect
// until the frontend is rebuilt. Without it the browser would call localhost, which can only fail in production.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error(
    'NEXT_PUBLIC_API_URL was not set when this app was built, so API requests go to http://localhost:3001. ' +
    'Set it to the backend URL and rebuild.'
  )
}

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
