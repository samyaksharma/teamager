import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { config } from 'dotenv'
import { createServer } from 'http'
import { cleanupService } from './services/cleanup'
import { setupYjsServer } from './services/yjs-server'

// Load environment variables
config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001

// Middleware - Allow localhost origins for local development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  process.env.FRONTEND_URL
].filter((origin): origin is string => Boolean(origin))

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

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

// API Routes - matching frontend expectations
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/organizations', organizationRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/channels', channelRoutes)
app.use('/api/direct-messages', directMessageRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/logs', logRoutes)

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