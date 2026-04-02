import express from 'express'
import { verifyToken } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = express.Router()

// Get auth logs (protected route - only for debugging)
router.get('/auth', verifyToken, async (req, res) => {
  try {
    // Only allow in development or for specific users
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Logs not available in production' })
    }

    const lines = parseInt(req.query.lines as string) || 100
    const logs = logger.getAuthLogs(lines)
    
    res.json({
      logs,
      totalLines: logs.length,
      requestedLines: lines
    })
  } catch (error) {
    console.error('Error fetching auth logs:', error)
    res.status(500).json({ message: 'Failed to fetch logs' })
  }
})

// Get general logs
router.get('/general', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Logs not available in production' })
    }

    res.json({
      message: 'General logs endpoint - not implemented yet',
      tip: 'Use /api/logs/auth for authentication logs'
    })
  } catch (error) {
    console.error('Error fetching general logs:', error)
    res.status(500).json({ message: 'Failed to fetch logs' })
  }
})

export default router