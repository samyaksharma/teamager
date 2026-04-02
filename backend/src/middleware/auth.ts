import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db, refreshTokens } from '../db'
import { eq, and, gt } from 'drizzle-orm'
import { generateAccessToken, verifyRefreshToken } from '../utils/jwt'
import { logger } from '../utils/logger'

interface JwtPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// Helper function to attempt token refresh using refresh token from cookies
const attemptTokenRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
  refreshToken: string,
  startTime: number,
  expiredAccessToken?: JwtPayload
) => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)
    
    // Check if refresh token exists in database and is active
    const tokenRecord = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.userId, decoded.userId),
        eq(refreshTokens.isActive, true)
      ))
      .limit(1)

    if (tokenRecord.length === 0) {
      return res.status(401).json({ message: 'Invalid or revoked refresh token' })
    }
    
    // Check if token is expired
    if (tokenRecord[0] && tokenRecord[0].expiresAt && tokenRecord[0].expiresAt < new Date()) {
      // Mark as expired
      await db.update(refreshTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokeReason: 'expired'
        })
        .where(eq(refreshTokens.token, refreshToken))
      
      return res.status(401).json({ message: 'Refresh token expired - please login again' })
    }

    // Update last used timestamp
    await db.update(refreshTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(refreshTokens.token, refreshToken))

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email
    })

    // Set new access token in cookie with same settings as login
    const accessCookieSettings = {
      httpOnly: true,
      secure: false, // HTTP for localhost development
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (matches refresh token expiry)
    }
    
    res.cookie('accessToken', newAccessToken, accessCookieSettings)
    
    // Set user on request for next middleware
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    }
    
    const duration = Date.now() - startTime
    
    // Skip logging token refresh success to reduce log noise
    
    return next()
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.authError('Token refresh failed', {
      error: error.message,
      duration: `${duration}ms`
    })
    return res.status(401).json({ message: 'Failed to refresh token - please login again' })
  }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    const token = req.cookies.accessToken

    const tokenCheckData = {
      timestamp,
      route: req.route?.path || 'unknown',
      url: req.originalUrl,
      method: req.method,
      hasCookieToken: !!req.cookies.accessToken,
      hasHeaderToken: !!req.headers.authorization,
      cookieKeys: Object.keys(req.cookies),
      userAgent: req.get('User-Agent')?.substring(0, 50)
    }

    // Skip logging routine token checks to reduce log noise

    if (!token) {
      // If no access token, check if we have a refresh token to attempt refresh
      const refreshToken = req.cookies.refreshToken
      
      if (refreshToken) {
        return await attemptTokenRefresh(req, res, next, refreshToken, startTime)
      }
      
      const duration = Date.now() - startTime
      const noTokenData = {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        allCookies: Object.keys(req.cookies),
        cookieCount: Object.keys(req.cookies).length,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        host: req.get('host'),
        origin: req.get('origin')
      }
      logger.authWarn('No tokens found', noTokenData)
      return res.status(401).json({ message: 'Access token required' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable not set')
    }

    // First decode token to check expiry without verification
    const decodedToken = jwt.decode(token) as JwtPayload
    if (!decodedToken?.userId || !decodedToken?.exp) {
      return res.status(401).json({ message: 'Invalid token format' })
    }

    const currentTime = Math.floor(Date.now() / 1000)
    const expiryTime = decodedToken.exp
    const timeToExpiry = expiryTime - currentTime
    const isExpired = timeToExpiry <= 0


    if (isExpired) {
      // Token is expired, attempt refresh using refresh token from cookie
      const refreshToken = req.cookies.refreshToken
      
      if (refreshToken) {
        return await attemptTokenRefresh(req, res, next, refreshToken, startTime, decodedToken)
      } else {
        return res.status(401).json({ message: 'Session expired - please login again' })
      }
    }

    // Token is not expired, verify it normally
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload

      // Calculate token details for logging
      const issuedTime = decoded.iat || 0
      const tokenAge = currentTime - issuedTime

      req.user = decoded
      const duration = Date.now() - startTime
      const successData = {
        userId: decoded.userId,
        url: req.originalUrl,
        duration: `${duration}ms`,
        tokenExpiresAt: new Date(expiryTime * 1000).toISOString(),
        timeToExpiry: `${timeToExpiry}s`,
        tokenAge: `${tokenAge}s`,
        isExpiringSoon: timeToExpiry < 30
      }
      // Skip logging successful token verifications to reduce log noise
      return next()
    } catch (verificationError: any) {
      const duration = Date.now() - startTime
      const errorData = {
        url: req.originalUrl,
        error: verificationError?.message || 'Unknown error',
        duration: `${duration}ms`
      }
      logger.authWarn('Token verification failed', errorData)
      return res.status(401).json({ message: 'Invalid token' })
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('Auth middleware error:', error, `(${duration}ms)`)
    logger.authError('Auth middleware error', { error: error?.message || 'Unknown error', duration: `${duration}ms`, url: req.originalUrl })
    return res.status(500).json({ message: 'Authentication error' })
  }
}

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return next()
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return next()
    }

    const decoded = jwt.verify(token, secret) as JwtPayload
    req.user = decoded
    next()
  } catch (error) {
    // For optional auth, we just continue without setting req.user
    next()
  }
}