import express from 'express'
import bcrypt from 'bcrypt'
import { eq, and, desc, ne, or, ilike } from 'drizzle-orm'
import { db, users, refreshTokens, verificationTokens } from '../db'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { verifyToken } from '../middleware/auth'
import { getSessionInfo, enforceTokenLimit } from '../utils/session'
import { sendSessionNotification } from '../utils/notifications'

const router = express.Router()

// Login user - matches frontend /api/user/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // Find user
    const user = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (user.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user[0].password)
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate tokens
    const tokenPayload = { userId: user[0].id, email: user[0].email }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)
    
    // Get session information
    const sessionInfo = getSessionInfo(req)
    
    // Enforce token limits (max 5 devices per user)
    await enforceTokenLimit(user[0].id, 5)
    
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Store refresh token with session tracking
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
        isPrimaryDevice: false // Can be updated later by user
      })

    // Set access token in HTTP-only cookie
    const accessCookieSettings = {
      httpOnly: true,
      secure: false, // HTTP for localhost development
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (matches refresh token expiry)
    }
    
    // Set refresh token in separate HTTP-only cookie for middleware access
    const refreshCookieSettings = {
      httpOnly: true,
      secure: false, // HTTP for localhost development
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    
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

// Logout user - matches frontend /api/user/logout
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
      

    // Clear both access token and refresh token cookies
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    res.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Failed to logout' })
  }
})

// Get current user - matches frontend /api/user/me
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

// Update current user - matches frontend PUT /api/user/me
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { name, username, email, avatarUrl } = req.body
    const userId = req.user!.userId

    // Build update object with only provided fields
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (username !== undefined) updateData.username = username
    if (email !== undefined) updateData.email = email
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided' })
    }

    // Check for duplicate username/email if being updated
    if (username) {
      const existingUsername = await db.select()
        .from(users)
        .where(and(eq(users.username, username), eq(users.id, userId)))
        .limit(1)
      
      if (existingUsername.length > 0 && existingUsername[0].id !== userId) {
        return res.status(400).json({ message: 'Username already taken' })
      }
    }

    if (email) {
      const existingEmail = await db.select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.id, userId)))
        .limit(1)
      
      if (existingEmail.length > 0 && existingEmail[0].id !== userId) {
        return res.status(400).json({ message: 'Email already in use' })
      }
    }

    // Update user
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

// Refresh token - matches frontend /api/user/refresh-token
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' })
    }

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
    if (tokenRecord[0].expiresAt < new Date()) {
      // Mark as expired
      await db.update(refreshTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokeReason: 'expired'
        })
        .where(eq(refreshTokens.token, refreshToken))
      
      return res.status(401).json({ message: 'Refresh token expired' })
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

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    })
    

    res.json({
      message: 'Token refreshed successfully',
      accessToken: newAccessToken // Frontend expects this
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(401).json({ message: 'Failed to refresh token' })
  }
})

// Forgot password - matches frontend /api/user/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    // Check if user exists
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

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

// Reset password - matches frontend /api/user/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' })
    }

    // Find and verify token
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, verificationToken[0].userId))

    // Delete the token
    await db.delete(verificationTokens)
      .where(eq(verificationTokens.id, verificationToken[0].id))

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Failed to reset password' })
  }
})

// Session Management Endpoints

// Get all active sessions for current user
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

    // Mark current session and hide token
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

// Revoke a specific session
router.delete('/sessions/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user!.userId
    const currentRefreshToken = req.cookies.refreshToken

    // Get the session to revoke
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

    // Revoke the session
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

// Revoke all other sessions (logout everywhere else)
router.post('/sessions/revoke-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const currentRefreshToken = req.cookies.refreshToken

    // Check current session age for security
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

    // Get all other active sessions
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

    // Revoke all other sessions
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

// Get session audit log
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

// Update session as primary device
router.put('/sessions/:sessionId/primary', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user!.userId

    // Verify session belongs to user
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

    // Remove primary flag from all other sessions
    await db.update(refreshTokens)
      .set({ isPrimaryDevice: false })
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isActive, true)
      ))

    // Set this session as primary
    await db.update(refreshTokens)
      .set({ isPrimaryDevice: true })
      .where(eq(refreshTokens.id, parseInt(sessionId)))

    res.json({ message: 'Primary device updated successfully' })
  } catch (error) {
    console.error('Update primary device error:', error)
    res.status(500).json({ message: 'Failed to update primary device' })
  }
})

// Search users - for adding to teams
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'Search query is required' })
    }
    
    if (query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' })
    }
    
    // Search users by name, username, or email
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