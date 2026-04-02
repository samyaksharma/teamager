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
      updatedAt: organizations.updatedAt
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
    const { name, industry, size, role = 'owner', department, jobTitle } = req.body
    const userId = req.user!.userId

    if (!name) {
      return res.status(400).json({ message: 'Organization name is required' })
    }

    // Verify user exists
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Create organization
    const newOrg = await db.insert(organizations)
      .values({
        name,
        industry,
        size
      })
      .returning()

    // Add user as owner of the organization
    
    const orgMembership = await db.insert(organizationUsers)
      .values({
        userId,
        organizationId: newOrg[0].id,
        role, // 'owner', 'admin', or 'member'
        department,
        jobTitle,
        invitedBy: userId // Self-invited when creating org
      })
      .returning()
    

    // Create default team for the organization
    const newTeam = await db.insert(teams)
      .values({
        name: `${name} Team`,
        organizationId: newOrg[0].id
      })
      .returning()

    // Add user as lead of the default team
    await db.insert(teamUsers)
      .values({
        userId,
        teamId: newTeam[0].id,
        role: TeamRole.LEAD // Team lead role
      })

    res.status(201).json(newOrg[0])
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
    if (name !== undefined) updateData.name = name
    if (industry !== undefined) updateData.industry = industry
    if (size !== undefined) updateData.size = size
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