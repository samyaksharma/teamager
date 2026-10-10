// Browser origins allowed to call the API (CORS) and to open the collaboration WebSocket.
// Local development origins are only allowed outside production.
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']

const configured = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',')
]
  .map(o => o?.trim().replace(/\/+$/, ''))
  .filter((o): o is string => Boolean(o))

export const allowedOrigins = [
  ...(process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
  ...configured
]

export const isAllowedOrigin = (origin: string | undefined) => !!origin && allowedOrigins.includes(origin.replace(/\/+$/, ''))
