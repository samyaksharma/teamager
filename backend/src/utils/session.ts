import { Request } from 'express'
import { db, refreshTokens } from '../db'
import { eq, and, lt, desc, count } from 'drizzle-orm'

interface DeviceInfo {
  deviceName: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
  browser: string
  os: string
}

interface SessionInfo {
  ipAddress: string
  userAgent: string
  deviceInfo: DeviceInfo
}

export const parseUserAgent = (userAgent: string = ''): DeviceInfo => {
  const ua = userAgent.toLowerCase()
  
  // Device type detection
  let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop'
  if (ua.includes('mobile') && !ua.includes('tablet')) {
    deviceType = 'mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet'
  }
  
  // Browser detection
  let browser = 'Unknown'
  if (ua.includes('chrome') && !ua.includes('edge')) {
    browser = 'Chrome'
  } else if (ua.includes('firefox')) {
    browser = 'Firefox'
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari'
  } else if (ua.includes('edge')) {
    browser = 'Edge'
  } else if (ua.includes('opera')) {
    browser = 'Opera'
  }
  
  // OS detection
  let os = 'Unknown'
  if (ua.includes('windows')) {
    os = 'Windows'
  } else if (ua.includes('mac') && !ua.includes('iphone')) {
    os = 'macOS'
  } else if (ua.includes('linux')) {
    os = 'Linux'
  } else if (ua.includes('android')) {
    os = 'Android'
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS'
  }
  
  // Generate device name
  const deviceName = `${browser} on ${os}`
  
  return {
    deviceName,
    deviceType,
    browser,
    os
  }
}

export const getSessionInfo = (req: Request): SessionInfo => {
  const userAgent = req.headers['user-agent'] || ''
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
  const deviceInfo = parseUserAgent(userAgent)
  
  return {
    ipAddress,
    userAgent,
    deviceInfo
  }
}

export const cleanupExpiredTokens = async () => {
  try {
    const result = await db.delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
    
    return (result as any).rowCount || 0
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error)
    return 0
  }
}

export const enforceTokenLimit = async (userId: string, maxTokens: number = 5) => {
  try {
    // Get count of active tokens for user
    const tokenCount = await db.select({ count: count() })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))
    
    const currentCount = tokenCount[0]?.count || 0
    
    if (currentCount >= maxTokens) {
      // Remove oldest tokens to make room
      const tokensToRemove = currentCount - maxTokens + 1
      
      const oldTokens = await db.select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isActive, true)
        ))
        .orderBy(refreshTokens.lastUsedAt)
        .limit(tokensToRemove)
      
      const tokenIds = oldTokens.map(t => t.id)
      
      await db.update(refreshTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokeReason: 'token_limit_exceeded'
        })
        .where(eq(refreshTokens.id, tokenIds[0]))
      
    }
  } catch (error) {
    console.error('Error enforcing token limit:', error)
  }
}

