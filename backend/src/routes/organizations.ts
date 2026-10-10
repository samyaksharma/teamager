import express from 'express'
import { eq, and } from 'drizzle-orm'
import { db, organizations, users, teams, teamUsers, organizationUsers } from '../db'
import { verifyToken } from '../middleware/auth'
import { OrganizationRole, TeamRole } from '../types/enums'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get all organizations - matches frontend /api/organizations
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get user's organization or all if admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get organizations through direct membership
    
    const orgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      size: organizations.size,
      industry: organizations.industry,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      // The current user's role in this organization (OrganizationRole)
      role: organizationUsers.role
    })
      .from(organizations)
      .innerJoin(organizationUsers, eq(organizations.id, organizationUsers.organizationId))
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.isActive, true)
      ))
    

    res.json(orgs)
  } catch (error) {
    console.error('Get organizations error:', error)
    res.status(500).json({ message: 'Failed to get organizations' })
  }
})

// Get organization by ID - matches frontend /api/organizations/{orgId}
router.get('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params
    const userId = req.user!.userId

    // Check if user belongs to this organization
    const userOrgAccess = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, orgId),
        eq(organizationUsers.isActive, true)
      ))
      .limit(1)

    if (userOrgAccess.length === 0) {
      return res.status(403).json({ message: 'Access denied to this organization' })
    }

    // Get organization details
    const org = await db.select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (org.length === 0) {
      return res.status(404).json({ message: 'Organization not found' })
    }

    res.json(org[0])
  } catch (error) {
    console.error('Get organization error:', error)
    res.status(500).json({ message: 'Failed to get organization' })
  }
})

// Create organization - matches frontend POST /api/organizations
router.post('/', async (req, res) => {
  try {
    // `role` is the person's job role from the signup form; it doesn't change what they can do:
    // whoever creates a workspace owns it.
    const { name, industry, size, department, jobTitle } = req.body
    const userId = req.user!.userId

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 255) {
      return res.status(400).json({ message: 'Organization name is required (max 255 characters)' })
    }

    // Verify user exists
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Organization, owner membership, default team and team lead are created together or not at all
    const org = await db.transaction(async (tx) => {
      const [newOrg] = await tx.insert(organizations)
        .values({
          name: trimmedName,
          industry: typeof industry === 'string' ? industry.slice(0, 128) : null,
          size: typeof size === 'string' ? size.slice(0, 64) : null
        })
        .returning()

      await tx.insert(organizationUsers)
        .values({
          userId,
          organizationId: newOrg.id,
          role: OrganizationRole.OWNER,
          department: typeof department === 'string' ? department.slice(0, 64) : null,
          jobTitle: typeof jobTitle === 'string' ? jobTitle.slice(0, 100) : null,
          invitedBy: userId // Self-invited when creating org
        })

      const [newTeam] = await tx.insert(teams)
        .values({
          name: `${trimmedName} Team`,
          organizationId: newOrg.id
        })
        .returning()

      await tx.insert(teamUsers)
        .values({
          userId,
          teamId: newTeam.id,
          role: TeamRole.LEAD // Team lead role
        })

      return newOrg
    })

    res.status(201).json(org)
  } catch (error) {
    console.error('Create organization error:', error)
    res.status(500).json({ message: 'Failed to create organization' })
  }
})

// Update organization - matches frontend PUT /api/organizations/{orgId}
router.put('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params
    const { name, industry, size } = req.body
    const userId = req.user!.userId

    // Check if user has admin/owner rights in this organization
    const userOrgAccess = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, orgId),
        eq(organizationUsers.isActive, true)
      ))
      .limit(1)

    if (userOrgAccess.length === 0 || (userOrgAccess[0].role !== OrganizationRole.OWNER && userOrgAccess[0].role !== OrganizationRole.ADMIN)) {
      return res.status(403).json({ message: 'Access denied: admin rights required' })
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed || trimmed.length > 255) {
        return res.status(400).json({ message: 'Organization name is required (max 255 characters)' })
      }
      updateData.name = trimmed
    }
    if (industry !== undefined) {
      if (industry !== null && (typeof industry !== 'string' || industry.length > 128)) {
        return res.status(400).json({ message: 'Industry must be at most 128 characters' })
      }
      updateData.industry = industry ? industry.trim() : null
    }
    if (size !== undefined) {
      if (size !== null && (typeof size !== 'string' || size.length > 64)) {
        return res.status(400).json({ message: 'Size must be at most 64 characters' })
      }
      updateData.size = size ? size.trim() : null
    }
    updateData.updatedAt = new Date()

    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return res.status(400).json({ message: 'No update data provided' })
    }

    // Update organization
    const updatedOrg = await db.update(organizations)
      .set(updateData)
      .where(eq(organizations.id, orgId))
      .returning()

    if (updatedOrg.length === 0) {
      return res.status(404).json({ message: 'Organization not found' })
    }

    res.json(updatedOrg[0])
  } catch (error) {
    console.error('Update organization error:', error)
    res.status(500).json({ message: 'Failed to update organization' })
  }
})

// Delete organization - matches frontend DELETE /api/organizations/{orgId}
router.delete('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params
    const userId = req.user!.userId

    // Check if user has owner rights in this organization (only owners can delete)
    const userOrgAccess = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, orgId),
        eq(organizationUsers.role, OrganizationRole.OWNER),
        eq(organizationUsers.isActive, true)
      ))
      .limit(1)

    if (userOrgAccess.length === 0) {
      return res.status(403).json({ message: 'Access denied: owner rights required to delete organization' })
    }

    // Delete organization (cascade will handle related records)
    await db.delete(organizations)
      .where(eq(organizations.id, orgId))

    res.json({ message: 'Organization deleted successfully' })
  } catch (error) {
    console.error('Delete organization error:', error)
    res.status(500).json({ message: 'Failed to delete organization' })
  }
})

export default router