import express from 'express'
import bcrypt from 'bcrypt'
import { eq, and } from 'drizzle-orm'
import { db, users, refreshTokens, verificationTokens } from '../db'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { sendVerificationEmail } from '../utils/email'
import { verifyToken } from '../middleware/auth'
import e from 'express'

const router = express.Router()

// Check username availability
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: 'Username is required' })
    }

    const existingUser = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    res.json({
      exists: existingUser.length > 0,
    })
  } catch (error) {
    console.error('Check username error:', error)
    res.status(500).json({ message: 'Failed to check username' })
  }
})

// Register new user - matches /api/verification/register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body

    // Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    // Check username availability
    const existingUsername = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (existingUsername.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const newUser = await db.insert(users)
      .values({
        name,
        username,
        email,
        password: hashedPassword
      })
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email
      })

    // Generate verification token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await db.insert(verificationTokens)
      .values({
        userId: newUser[0].id,
        token,
        expiresAt
      })

    // Send verification email
    try {
      await sendVerificationEmail(email, token)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail registration if email fails
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: newUser[0]
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Failed to register user' })
  }
})

// Login user
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

    // Store refresh token in database (NOT in browser)
    await db.insert(refreshTokens)
      .values({
        userId: user[0].id,
        token: refreshToken,
        // Add session tracking info
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })

    // Set ONLY access token in HTTP-only cookie (refresh token stays server-side)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false, // HTTP for localhost development
      sameSite: 'lax',
      maxAge: 3 * 60 * 1000 // 3 minutes
    })

    // Return user info only (NO tokens in response body)
    res.json({
      message: 'Login successful',
      user: {
        id: user[0].id,
        name: user[0].name,
        username: user[0].username,
        email: user[0].email,
        emailVerified: user[0].emailVerified
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Failed to login' })
  }
})

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' })
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)

    // Check if refresh token exists in database
    const tokenRecord = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.userId, decoded.userId)
      ))
      .limit(1)

    if (tokenRecord.length === 0) {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

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
      accessToken: newAccessToken
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(401).json({ message: 'Failed to refresh token' })
  }
})

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Remove ALL refresh tokens for this user from database (logout from all devices)
    await db.update(refreshTokens)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokeReason: 'user_logout'
      })
      .where(eq(refreshTokens.userId, req.user!.userId))

    // Clear access token cookie
    res.clearCookie('accessToken')

    res.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Failed to logout' })
  }
})

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ message: 'Verification token required' })
    }

    // Find verification token
    const verificationToken = await db.select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1)

    if (verificationToken.length === 0) {
      return res.status(400).json({ message: 'Invalid verification token' })
    }

    // Check if token is expired
    if (new Date() > verificationToken[0].expiresAt) {
      return res.status(400).json({ message: 'Verification token has expired' })
    }

    // Update user as verified
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, verificationToken[0].userId))

    // Delete verification token
    await db.delete(verificationTokens)
      .where(eq(verificationTokens.id, verificationToken[0].id))

    res.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Email verification error:', error)
    res.status(500).json({ message: 'Failed to verify email' })
  }
})

// Get current user
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

    res.json({ user: user[0] })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Failed to get user information' })
  }
})

export default router