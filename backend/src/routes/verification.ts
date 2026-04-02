import express from 'express'
import bcrypt from 'bcrypt'
import { eq, and } from 'drizzle-orm'
import { db, users, verificationTokens, organizations, teams, teamUsers, organizationUsers } from '../db'
import { sendVerificationEmail } from '../utils/email'
import { OrganizationRole, TeamRole } from '../types/enums'

const router = express.Router()

// Register new user - matches frontend /api/verification/register
router.post('/register', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      department, 
      receiveNotifications,
      organization,
      organizationSize,
      organizationIndustry 
    } = req.body

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    // Generate username from email if not provided
    const username = email.split('@')[0].toLowerCase()

    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Handle organization creation if provided
    let organizationId = null
    let teamId = null

    if (organization) {
      // Create organization
      const newOrg = await db.insert(organizations)
        .values({
          name: organization,
          size: organizationSize,
          industry: organizationIndustry
        })
        .returning()

      organizationId = newOrg[0].id

      // Create default team for organization
      const newTeam = await db.insert(teams)
        .values({
          name: `${organization} Team`,
          organizationId
        })
        .returning()

      teamId = newTeam[0].id
    }

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

    // Add user to organization and team if created
    if (organizationId && teamId) {
      // Add user as organization owner
      await db.insert(organizationUsers)
        .values({
          userId: newUser[0].id,
          organizationId,
          role: role || OrganizationRole.OWNER,
          department,
          invitedBy: newUser[0].id
        })

      // Add user to team as lead
      await db.insert(teamUsers)
        .values({
          userId: newUser[0].id,
          teamId,
          role: TeamRole.LEAD
        })
    }

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

// Verify email - matches frontend GET /api/verification/verify-email?token={token}
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query

    if (!token) {
      return res.status(400).json({ message: 'Verification token required' })
    }

    // Find verification token
    const verificationToken = await db.select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token as string))
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

export default router