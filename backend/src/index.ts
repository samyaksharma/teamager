import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { config } from 'dotenv'
import { createServer } from 'http'
import { cleanupService } from './services/cleanup'
import { setupYjsServer } from './services/yjs-server'
import { allowedOrigins, isAllowedOrigin } from './utils/origins'

// Load environment variables
config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001

// Behind a TLS-terminating proxy (nginx, a platform router, a load balancer) the app only sees the proxy.
// Trusting its X-Forwarded-* headers gives the real client IP and the real protocol (https).
// TRUST_PROXY: a hop count (default 1 in production), "true", or "false".
const trustProxy = process.env.TRUST_PROXY
if (trustProxy === 'true') app.set('trust proxy', true)
else if (trustProxy === 'false') app.set('trust proxy', false)
else if (trustProxy && !isNaN(Number(trustProxy))) app.set('trust proxy', Number(trustProxy))
else if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('FRONTEND_URL (or ALLOWED_ORIGINS) is not set: browsers will not be able to call this API')
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// The auth cookies are sent with cross-site requests when SameSite=None, so reject state-changing requests that
// come from a browser page on an origin we don't know (CSRF). Same-origin and non-browser clients send no Origin.
app.use((req, res, next) => {
  const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
  const origin = req.headers.origin
  if (!safe && origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ message: 'Origin not allowed' })
  }
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Y.js WebSocket server for collaborative editing
setupYjsServer(server)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Teamager API Server', version: '1.0.0' })
})

// Import routes
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import verificationRoutes from './routes/verification'
import organizationRoutes from './routes/organizations'
import teamRoutes from './routes/teams'
import taskRoutes from './routes/tasks'
import documentRoutes from './routes/documents'
import channelRoutes from './routes/channels'
import directMessageRoutes from './routes/direct-messages'
import invitationRoutes from './routes/invitations'
import dashboardRoutes from './routes/dashboard'
import logRoutes from './routes/logs'
import notificationRoutes from './routes/notifications'
import searchRoutes from './routes/search'
import taskItemRoutes from './routes/task-items'
import documentVersionRoutes from './routes/document-versions'
import documentCommentRoutes from './routes/document-comments'
import calendarRoutes from './routes/calendar'
import taskViewRoutes from './routes/task-views'
import taskReferenceRoutes from './routes/task-references'

// API Routes - matching frontend expectations
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/organizations', organizationRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/tasks', taskItemRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/documents', documentVersionRoutes)
app.use('/api/documents', documentCommentRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/task-views', taskViewRoutes)
app.use('/api', taskReferenceRoutes)
app.use('/api/channels', channelRoutes)
app.use('/api/direct-messages', directMessageRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/search', searchRoutes)

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  
  // Start cleanup service
  cleanupService.start()
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...')
  cleanupService.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Shutting down server...')
  cleanupService.stop()
  process.exit(0)
})