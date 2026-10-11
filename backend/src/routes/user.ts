import express from 'express'
import bcrypt from 'bcrypt'
import { eq, and, desc, ne, or, ilike, sql } from 'drizzle-orm'
import { db, users, refreshTokens, verificationTokens } from '../db'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { verifyToken } from '../middleware/auth'
import { cookieOptions, clearCookieOptions } from '../utils/cookies'
import { getSessionInfo, enforceTokenLimit } from '../utils/session'
import { sendSessionNotification } from '../utils/notifications'

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (user.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, user[0].password)
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const tokenPayload = { userId: user[0].id, email: user[0].email }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)
    
    const sessionInfo = getSessionInfo(req)
    
    // Enforce token limits (max 5 devices per user)
    await enforceTokenLimit(user[0].id, 5)
    
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await db.insert(refreshTokens)
      .values({
        userId: user[0].id,
        token: refreshToken,
        deviceName: sessionInfo.deviceInfo.deviceName,
        deviceType: sessionInfo.deviceInfo.deviceType,
        browser: sessionInfo.deviceInfo.browser,
        os: sessionInfo.deviceInfo.os,
        ipAddress: sessionInfo.ipAddress,
        userAgent: sessionInfo.userAgent,
        expiresAt,
        lastUsedAt: new Date(),
        isActive: true,
        isPrimaryDevice: false
      })

    const accessCookieSettings = cookieOptions(7 * 24 * 60 * 60 * 1000) // 7 days (matches refresh token expiry)
    
    // Set refresh token in separate HTTP-only cookie for middleware access
    const refreshCookieSettings = cookieOptions(7 * 24 * 60 * 60 * 1000)
    
    res.cookie('accessToken', accessToken, accessCookieSettings)
    res.cookie('refreshToken', refreshToken, refreshCookieSettings)

    // NOTE: Both tokens stored in secure HTTP-only cookies + refresh token in database for validation

    // Send email notification for new login (async, don't wait)
    sendSessionNotification({
      userName: user[0].name,
      email: user[0].email,
      deviceName: sessionInfo.deviceInfo.deviceName,
      ipAddress: sessionInfo.ipAddress,
      action: 'LOGIN',
      timestamp: new Date()
    }).catch(err => console.error('Failed to send login notification:', err))

    res.json({
      message: 'Login successful',
      user: {
        id: user[0].id,
        name: user[0].name,
        username: user[0].username,
        email: user[0].email,
        emailVerified: user[0].emailVerified,
        avatarUrl: user[0].avatarUrl
      }
      // NOTE: No tokens in response - access token is in HTTP-only cookie
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Failed to login' })
  }
})

router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Revoke ALL refresh tokens for this user (logout from all devices)
    await db.update(refreshTokens)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokeReason: 'user_logout'
      })
      .where(eq(refreshTokens.userId, req.user!.userId))

    res.clearCookie('accessToken', clearCookieOptions)
    res.clearCookie('refreshToken', clearCookieOptions)

    res.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Failed to logout' })
  }
})

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt
    })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(user[0]) // Frontend expects user object directly, not wrapped
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Failed to get user information' })
  }
})

router.put('/me', verifyToken, async (req, res) => {
  try {
    const { name, username, email, avatarUrl } = req.body
    const userId = req.user!.userId

    const updateData: any = {}
    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed || trimmed.length > 120) {
        return res.status(400).json({ message: 'Name is required (max 120 characters)' })
      }
      updateData.name = trimmed
    }
    if (username !== undefined) {
      const trimmed = typeof username === 'string' ? username.trim() : ''
      if (!/^[A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*$/.test(trimmed) || trimmed.length > 64) {
        return res.status(400).json({ message: 'Username may contain letters, numbers, underscores, dots and dashes (max 64)' })
      }
      updateData.username = trimmed
    }
    if (email !== undefined) {
      const trimmed = typeof email === 'string' ? email.trim() : ''
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) || trimmed.length > 255) {
        return res.status(400).json({ message: 'Enter a valid email address' })
      }
      updateData.email = trimmed
    }
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided' })
    }

    if (updateData.username) {
      const taken = await db.select({ id: users.id }).from(users)
        .where(and(sql`lower(${users.username}) = ${updateData.username.toLowerCase()}`, ne(users.id, userId))).limit(1)
      if (taken.length > 0) {
        return res.status(400).json({ message: 'Username already taken' })
      }
    }

    if (updateData.email) {
      const taken = await db.select({ id: users.id }).from(users)
        .where(and(sql`lower(${users.email}) = ${updateData.email.toLowerCase()}`, ne(users.id, userId))).limit(1)
      if (taken.length > 0) {
        return res.status(400).json({ message: 'Email already in use' })
      }
    }

    const updatedUser = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        avatarUrl: users.avatarUrl,
          createdAt: users.createdAt
      })

    res.json(updatedUser[0])
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ message: 'Failed to update user' })
  }
})

router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' })
    }

    const decoded = verifyRefreshToken(refreshToken)

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
    
    if (tokenRecord[0].expiresAt && tokenRecord[0].expiresAt < new Date()) {
      await db.update(refreshTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokeReason: 'expired'
        })
        .where(eq(refreshTokens.token, refreshToken))
      
      return res.status(401).json({ message: 'Refresh token expired' })
    }

    await db.update(refreshTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(refreshTokens.token, refreshToken))

    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email
    })

    res.cookie('accessToken', newAccessToken, cookieOptions(15 * 60 * 1000))

    res.json({
      message: 'Token refreshed successfully',
      accessToken: newAccessToken
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(401).json({ message: 'Failed to refresh token' })
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (user.length === 0) {
      // Don't reveal if email exists or not
      return res.json({ message: 'If the email exists, a reset link has been sent' })
    }

    // Generate reset token (reusing verification tokens table)
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await db.insert(verificationTokens)
      .values({
        userId: user[0].id,
        token,
        expiresAt
      })

    res.json({ message: 'If the email exists, a reset link has been sent' })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Failed to process request' })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' })
    }

    const verificationToken = await db.select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1)

    if (verificationToken.length === 0) {
      return res.status(400).json({ message: 'Invalid reset token' })
    }

    if (new Date() > verificationToken[0].expiresAt) {
      return res.status(400).json({ message: 'Reset token has expired' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, verificationToken[0].userId))

    await db.delete(verificationTokens)
      .where(eq(verificationTokens.id, verificationToken[0].id))

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Failed to reset password' })
  }
})

router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const currentRefreshToken = req.cookies.refreshToken

    const sessions = await db.select({
      id: refreshTokens.id,
      deviceName: refreshTokens.deviceName,
      deviceType: refreshTokens.deviceType,
      browser: refreshTokens.browser,
      os: refreshTokens.os,
      ipAddress: refreshTokens.ipAddress,
      isPrimaryDevice: refreshTokens.isPrimaryDevice,
      lastUsedAt: refreshTokens.lastUsedAt,
      createdAt: refreshTokens.createdAt,
      expiresAt: refreshTokens.expiresAt,
      isCurrent: refreshTokens.token
    })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))
      .orderBy(desc(refreshTokens.lastUsedAt))

    const sessionsWithCurrentFlag = sessions.map(session => ({
      ...session,
      isCurrent: session.isCurrent === currentRefreshToken,
      token: undefined // Don't expose tokens
    }))

    res.json(sessionsWithCurrentFlag)
  } catch (error) {
    console.error('Get sessions error:', error)
    res.status(500).json({ message: 'Failed to get sessions' })
  }
})

router.delete('/sessions/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user!.userId
    const currentRefreshToken = req.cookies.refreshToken

    const sessionToRevoke = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.id, parseInt(sessionId)),
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))
      .limit(1)

    if (sessionToRevoke.length === 0) {
      return res.status(404).json({ message: 'Session not found' })
    }

    // Prevent revoking current session via this endpoint
    if (sessionToRevoke[0].token === currentRefreshToken) {
      return res.status(400).json({ 
        message: 'Cannot revoke current session. Use logout instead.' 
      })
    }

    // Check session age for security (new sessions can't revoke others immediately)
    const currentSession = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, currentRefreshToken))
      .limit(1)

    if (currentSession.length > 0) {
      const sessionAge = Date.now() - currentSession[0].createdAt.getTime()
      const twentyFourHours = 24 * 60 * 60 * 1000

      if (sessionAge < twentyFourHours) {
        return res.status(403).json({
          message: 'New sessions cannot revoke other sessions for 24 hours'
        })
      }
    }

    await db.update(refreshTokens)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy: currentRefreshToken,
        revokeReason: 'user_revoked'
      })
      .where(eq(refreshTokens.id, parseInt(sessionId)))

    // Send email notification (async, don't wait)
    const user = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    if (user.length > 0) {
      sendSessionNotification({
        userName: user[0].name,
        email: user[0].email,
        deviceName: sessionToRevoke[0].deviceName || 'Unknown device',
        ipAddress: sessionToRevoke[0].ipAddress || 'Unknown IP',
        action: 'SESSION_REVOKED',
        timestamp: new Date()
      }).catch(err => console.error('Failed to send revocation notification:', err))
    }

    res.json({ message: 'Session revoked successfully' })
  } catch (error) {
    console.error('Revoke session error:', error)
    res.status(500).json({ message: 'Failed to revoke session' })
  }
})

router.post('/sessions/revoke-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const currentRefreshToken = req.cookies.refreshToken

    const currentSession = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, currentRefreshToken))
      .limit(1)

    if (currentSession.length > 0) {
      const sessionAge = Date.now() - currentSession[0].createdAt.getTime()
      const twentyFourHours = 24 * 60 * 60 * 1000

      if (sessionAge < twentyFourHours) {
        return res.status(403).json({
          message: 'New sessions cannot revoke all sessions for 24 hours. Please verify via email.',
          requiresEmailVerification: true
        })
      }
    }

    const otherSessions = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true),
        ne(refreshTokens.token, currentRefreshToken)
      ))

    if (otherSessions.length === 0) {
      return res.json({ 
        message: 'No other sessions to revoke',
        revokedCount: 0 
      })
    }

    await db.update(refreshTokens)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy: currentRefreshToken,
        revokeReason: 'user_revoked_all'
      })
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true),
        ne(refreshTokens.token, currentRefreshToken)
      ))

    // Send email notification (async, don't wait)
    const user = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    if (user.length > 0) {
      const sessionInfo = getSessionInfo(req)
      sendSessionNotification({
        userName: user[0].name,
        email: user[0].email,
        deviceName: sessionInfo.deviceInfo.deviceName,
        ipAddress: sessionInfo.ipAddress,
        action: 'SESSION_REVOKED_ALL',
        timestamp: new Date()
      }).catch(err => console.error('Failed to send revoke-all notification:', err))
    }

    res.json({ 
      message: `Successfully revoked ${otherSessions.length} other sessions`,
      revokedCount: otherSessions.length
    })
  } catch (error) {
    console.error('Revoke all sessions error:', error)
    res.status(500).json({ message: 'Failed to revoke sessions' })
  }
})

router.get('/sessions/audit', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const limit = parseInt(req.query.limit as string) || 50

    res.json({ 
      message: 'Session audit log not yet implemented',
      userId,
      limit
    })
  } catch (error) {
    console.error('Get audit log error:', error)
    res.status(500).json({ message: 'Failed to get audit log' })
  }
})

router.put('/sessions/:sessionId/primary', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user!.userId

    const session = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.id, parseInt(sessionId)),
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))
      .limit(1)

    if (session.length === 0) {
      return res.status(404).json({ message: 'Session not found' })
    }

    await db.update(refreshTokens)
      .set({ isPrimaryDevice: false })
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))

    await db.update(refreshTokens)
      .set({ isPrimaryDevice: true })
      .where(eq(refreshTokens.id, parseInt(sessionId)))

    res.json({ message: 'Primary device updated successfully' })
  } catch (error) {
    console.error('Update primary device error:', error)
    res.status(500).json({ message: 'Failed to update primary device' })
  }
})

router.get('/search', verifyToken, async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'Search query is required' })
    }
    
    if (query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' })
    }
    
    const searchPattern = `%${query}%`
    const searchUsers = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl
    })
      .from(users)
      .where(or(
        ilike(users.name, searchPattern),
        ilike(users.username, searchPattern),
        ilike(users.email, searchPattern)
      ))
      .limit(parseInt(limit as string))
    
    res.json(searchUsers)
  } catch (error) {
    console.error('Search users error:', error)
    res.status(500).json({ message: 'Failed to search users' })
  }
})

export default router