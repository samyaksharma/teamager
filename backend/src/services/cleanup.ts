import { cleanupExpiredTokens } from '../utils/session'
import { logger } from '../utils/logger'

class CleanupService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000

  start() {
    if (this.isRunning) {
      return
    }

    console.log('Starting cleanup service...')
    this.isRunning = true

    this.runCleanup()

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
      
      const expiredCount = await cleanupExpiredTokens()
      
      logger.cleanup(7)
      
    } catch (error) {
      console.error('Error during cleanup:', error)
      logger.error('Cleanup failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }

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