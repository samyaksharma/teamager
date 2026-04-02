import express from 'express'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { db, organizationInvitations, organizations, teams, users, teamUsers, organizationUsers } from '../db'
import { verifyToken, optionalAuth } from '../middleware/auth'
import { sendInvitationEmail } from '../utils/email'
import { InvitationStatus, OrganizationRole } from '../types/enums'

const router = express.Router()

// Get user's invitations - matches frontend GET /api/invitations/my-invitations
router.get('/my-invitations', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get user email for invitation lookup
    const user = await db.select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get pending organization invitations for user's email
    const invitations = await db.select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      department: organizationInvitations.department,
      jobTitle: organizationInvitations.jobTitle,
      createdAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt,
      status: organizationInvitations.status,
      token: organizationInvitations.token,
      organizationId: organizations.id,
      organizationName: organizations.name,
      inviterName: users.name
    })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
      .leftJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(
        and(
          eq(organizationInvitations.email, user[0].email),
          eq(organizationInvitations.status, InvitationStatus.PENDING),
          gt(organizationInvitations.expiresAt, new Date()), // Not expired
          isNull(organizationInvitations.deletedAt) // Not deleted
        )
      )

    res.json(invitations)
  } catch (error) {
    console.error('Get my invitations error:', error)
    res.status(500).json({ message: 'Failed to get invitations' })
  }
})

// Validate invitation token - matches frontend GET /api/invitations/validate/{token}
router.get('/validate/:token', optionalAuth, async (req, res) => {
  try {
    const { token } = req.params

    // Get invitation with organization and inviter info
    const invitation = await db.select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      department: organizationInvitations.department,
      jobTitle: organizationInvitations.jobTitle,
      createdAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt,
      status: organizationInvitations.status,
      organizationId: organizations.id,
      organizationName: organizations.name,
      inviterName: users.name
    })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
      .leftJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(
        and(
          eq(organizationInvitations.token, token),
          isNull(organizationInvitations.deletedAt)
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return res.status(404).json({ message: 'Invalid invitation token' })
    }

    const inv = invitation[0]

    // Check if expired
    if (new Date() > inv.expiresAt) {
      return res.status(400).json({ message: 'Invitation has expired' })
    }

    // Check if already accepted
    if (inv.status === InvitationStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Invitation has already been accepted' })
    }

    res.json({
      organizationName: inv.organizationName,
      inviterName: inv.inviterName,
      email: inv.email,
      role: inv.role,
      department: inv.department,
      jobTitle: inv.jobTitle,
      expiresAt: inv.expiresAt
    })
  } catch (error) {
    console.error('Validate invitation error:', error)
    res.status(500).json({ message: 'Failed to validate invitation' })
  }
})

// Accept invitation - matches frontend POST /api/invitations/accept/{token}
router.post('/accept/:token', verifyToken, async (req, res) => {
  try {
    const { token } = req.params
    const userId = req.user!.userId

    // Get user details
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get invitation
    const invitation = await db.select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.token, token),
          isNull(organizationInvitations.deletedAt)
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return res.status(404).json({ message: 'Invalid invitation token' })
    }

    const inv = invitation[0]

    // Validate invitation
    if (new Date() > inv.expiresAt) {
      return res.status(400).json({ message: 'Invitation has expired' })
    }

    if (inv.status === InvitationStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Invitation has already been accepted' })
    }

    // Check if invitation email matches user email
    if (inv.email !== user[0].email) {
      return res.status(400).json({ message: 'Invitation email does not match your account' })
    }

    // Check if user is already a member of the organization
    const existingMembership = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.organizationId, inv.organizationId),
        eq(organizationUsers.userId, userId)
      ))
      .limit(1)

    if (existingMembership.length > 0) {
      return res.status(400).json({ message: 'You are already a member of this organization' })
    }

    // Add user to organization
    await db.insert(organizationUsers)
      .values({
        organizationId: inv.organizationId,
        userId,
        role: inv.role,
        department: inv.department,
        jobTitle: inv.jobTitle,
        joinedAt: new Date(),
        invitedBy: inv.invitedBy
      })

    // Mark invitation as accepted
    await db.update(organizationInvitations)
      .set({ status: InvitationStatus.ACCEPTED })
      .where(eq(organizationInvitations.id, inv.id))

    res.json({ message: 'Invitation accepted successfully' })
  } catch (error) {
    console.error('Accept invitation error:', error)
    res.status(500).json({ message: 'Failed to accept invitation' })
  }
})

// Decline invitation - matches frontend POST /api/invitations/decline/{token}
router.post('/decline/:token', optionalAuth, async (req, res) => {
  try {
    const { token } = req.params

    // Get invitation
    const invitation = await db.select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.token, token),
          isNull(organizationInvitations.deletedAt)
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return res.status(404).json({ message: 'Invalid invitation token' })
    }

    const inv = invitation[0]

    // Check if already accepted
    if (inv.status === InvitationStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Cannot decline an accepted invitation' })
    }

    // Soft delete the invitation (declining it)
    await db.update(organizationInvitations)
      .set({
        deletedAt: new Date(),
        deletedBy: null // Could be null since this might be done by the invitee
      })
      .where(eq(organizationInvitations.id, inv.id))

    res.json({ message: 'Invitation declined successfully' })
  } catch (error) {
    console.error('Decline invitation error:', error)
    res.status(500).json({ message: 'Failed to decline invitation' })
  }
})

// Get sent invitations by user - matches frontend GET /api/invitations/sent
router.get('/sent', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get invitations sent by the user
    const sentInvitations = await db.select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      department: organizationInvitations.department,
      jobTitle: organizationInvitations.jobTitle,
      createdAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt,
      status: organizationInvitations.status,
      deletedAt: organizationInvitations.deletedAt,
      token: organizationInvitations.token,
      organizationId: organizations.id,
      organizationName: organizations.name
    })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
      .where(
        and(
          eq(organizationInvitations.invitedBy, userId),
          isNull(organizationInvitations.deletedAt)
        )
      )

    // Format the response with status
    const formattedInvitations = sentInvitations.map(inv => ({
      ...inv,
      status: inv.status === InvitationStatus.ACCEPTED ? 'accepted' : (new Date() > inv.expiresAt ? 'expired' : 'pending')
    }))

    res.json(formattedInvitations)
  } catch (error) {
    console.error('Get sent invitations error:', error)
    res.status(500).json({ message: 'Failed to get sent invitations' })
  }
})

// Create invitation - matches frontend POST /api/invitations
router.post('/', verifyToken, async (req, res) => {
  try {
    const { email, organizationId, role = 'member', department, jobTitle } = req.body
    const userId = req.user!.userId


    if (!email || !organizationId) {
      return res.status(400).json({ message: 'Email and organizationId are required' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    // Check if user is admin or owner of the organization
    const orgMembership = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ))
      .limit(1)


    if (orgMembership.length === 0 || (orgMembership[0].role !== OrganizationRole.ADMIN && orgMembership[0].role !== OrganizationRole.OWNER)) {
      return res.status(403).json({ message: 'Only organization admins or owners can send invitations' })
    }

    // Get organization details
    const organization = await db.select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (organization.length === 0) {
      return res.status(404).json({ message: 'Organization not found' })
    }

    // Check if user with this email already exists and is an organization member
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      const existingMembership = await db.select()
        .from(organizationUsers)
        .where(and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, existingUser[0].id)
        ))
        .limit(1)

      if (existingMembership.length > 0) {
        return res.status(400).json({ message: 'User is already a member of this organization' })
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await db.select()
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.email, email),
        eq(organizationInvitations.organizationId, organizationId),
        eq(organizationInvitations.status, InvitationStatus.PENDING),
        gt(organizationInvitations.expiresAt, new Date()),
        isNull(organizationInvitations.deletedAt)
      ))
      .limit(1)

    if (existingInvitation.length > 0) {
      return res.status(400).json({ message: 'Invitation already sent to this email' })
    }

    // Generate invitation token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation
    const newInvitation = await db.insert(organizationInvitations)
      .values({
        organizationId,
        email,
        invitedBy: userId,
        token,
        role,
        department,
        jobTitle,
        expiresAt
      })
      .returning()

    // Get inviter details for email
    const inviter = await db.select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    // Send invitation email
    try {
      await sendInvitationEmail(
        email,
        organization[0].name,
        inviter[0]?.name || 'Someone',
        token
      )
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the invitation creation if email fails
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: newInvitation[0].id,
        email,
        organizationName: organization[0].name,
        role,
        department,
        jobTitle,
        expiresAt
      }
    })
  } catch (error) {
    console.error('Create invitation error:', error)
    res.status(500).json({ message: 'Failed to create invitation' })
  }
})

// Cancel/Delete invitation - matches frontend DELETE /api/invitations/{invitationId}
router.delete('/:invitationId', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params
    const userId = req.user!.userId

    // Get invitation to verify ownership
    const invitation = await db.select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          isNull(organizationInvitations.deletedAt)
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return res.status(404).json({ message: 'Invitation not found' })
    }

    const inv = invitation[0]

    // Check if user sent this invitation OR is admin of the organization
    let canDelete = inv.invitedBy === userId

    if (!canDelete) {
      // Check if user is admin of the organization
      const orgMembership = await db.select()
        .from(organizationUsers)
        .where(and(
          eq(organizationUsers.organizationId, inv.organizationId),
          eq(organizationUsers.userId, userId)
        ))
        .limit(1)

      canDelete = orgMembership.length > 0 && (orgMembership[0].role === OrganizationRole.ADMIN || orgMembership[0].role === OrganizationRole.OWNER)
    }

    if (!canDelete) {
      return res.status(403).json({ message: 'Only the invitation sender or organization admins can delete it' })
    }

    // Check if already accepted
    if (inv.status === InvitationStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Cannot delete an accepted invitation' })
    }

    // Soft delete the invitation
    await db.update(organizationInvitations)
      .set({
        deletedAt: new Date(),
        deletedBy: userId
      })
      .where(eq(organizationInvitations.id, invitationId))

    res.json({ message: 'Invitation deleted successfully' })
  } catch (error) {
    console.error('Delete invitation error:', error)
    res.status(500).json({ message: 'Failed to delete invitation' })
  }
})

// Resend invitation - matches frontend POST /api/invitations/{invitationId}/resend
router.post('/:invitationId/resend', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params
    const userId = req.user!.userId

    // Get invitation to verify ownership
    const invitation = await db.select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      organizationId: organizationInvitations.organizationId,
      role: organizationInvitations.role,
      department: organizationInvitations.department,
      jobTitle: organizationInvitations.jobTitle,
      invitedBy: organizationInvitations.invitedBy,
      status: organizationInvitations.status,
      organizationName: organizations.name
    })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          isNull(organizationInvitations.deletedAt)
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return res.status(404).json({ message: 'Invitation not found' })
    }

    const inv = invitation[0]

    // Check if user sent this invitation OR is admin of the organization
    let canResend = inv.invitedBy === userId

    if (!canResend) {
      // Check if user is admin of the organization
      const orgMembership = await db.select()
        .from(organizationUsers)
        .where(and(
          eq(organizationUsers.organizationId, inv.organizationId),
          eq(organizationUsers.userId, userId)
        ))
        .limit(1)

      canResend = orgMembership.length > 0 && (orgMembership[0].role === OrganizationRole.ADMIN || orgMembership[0].role === OrganizationRole.OWNER)
    }

    if (!canResend) {
      return res.status(403).json({ message: 'Only the invitation sender or organization admins can resend it' })
    }

    // Check if already accepted
    if (inv.status === InvitationStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Cannot resend an accepted invitation' })
    }

    // Generate new token and extend expiration
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Update invitation
    await db.update(organizationInvitations)
      .set({ 
        token,
        expiresAt,
        createdAt: new Date() // Update sent date
      })
      .where(eq(organizationInvitations.id, invitationId))

    // Get inviter details for email
    const inviter = await db.select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    // Send invitation email
    try {
      await sendInvitationEmail(
        inv.email,
        inv.organizationName,
        inviter[0]?.name || 'Someone',
        token
      )
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the invitation resend if email fails
    }

    res.json({ message: 'Invitation resent successfully' })
  } catch (error) {
    console.error('Resend invitation error:', error)
    res.status(500).json({ message: 'Failed to resend invitation' })
  }
})

export default router