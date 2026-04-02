import { cleanupExpiredTokens } from '../utils/session'
import { logger } from '../utils/logger'

class CleanupService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  // Run cleanup every 1 hour
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour in milliseconds

  start() {
    if (this.isRunning) {
      return
    }

    console.log('Starting cleanup service...')
    this.isRunning = true

    // Run initial cleanup
    this.runCleanup()

    // Schedule regular cleanups
    this.intervalId = setInterval(() => {
      this.runCleanup()
    }, this.CLEANUP_INTERVAL)

    console.log(`Cleanup service started (runs every ${this.CLEANUP_INTERVAL / 1000 / 60} minutes)`)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('Cleanup service stopped')
  }

  private async runCleanup() {
    try {
      
      // Clean expired tokens
      const expiredCount = await cleanupExpiredTokens()
      
      // Clean old log files (keep 7 days)
      logger.cleanup(7)
      
      // Skip logging routine cleanup to reduce log noise
    } catch (error) {
      console.error('Error during cleanup:', error)
      logger.error('Cleanup failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  // Manual cleanup trigger
  async manualCleanup() {
    return this.runCleanup()
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.CLEANUP_INTERVAL / 1000 / 60,
      nextCleanup: this.intervalId ? new Date(Date.now() + this.CLEANUP_INTERVAL) : null
    }
  }
}

export const cleanupService = new CleanupService()
export default cleanupService