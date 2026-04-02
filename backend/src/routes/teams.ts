import express from 'express'
import { eq, and } from 'drizzle-orm'
import { db, teams, teamUsers, users, organizations } from '../db'
import { verifyToken } from '../middleware/auth'
import { TeamRole } from '../types/enums'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get user's teams
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId

    const userTeams = await db.select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
      role: teamUsers.role,
      organizationId: teams.organizationId,
      organizationName: organizations.name
    })
      .from(teamUsers)
      .innerJoin(teams, eq(teamUsers.teamId, teams.id))
      .leftJoin(organizations, eq(teams.organizationId, organizations.id))
      .where(eq(teamUsers.userId, userId))

    res.json({ teams: userTeams })
  } catch (error) {
    console.error('Get teams error:', error)
    res.status(500).json({ message: 'Failed to get teams' })
  }
})

// Get team details
router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

    // Check if user is member of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this team' })
    }

    // Get team details
    const team = await db.select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
      organizationId: teams.organizationId,
      organizationName: organizations.name
    })
      .from(teams)
      .leftJoin(organizations, eq(teams.organizationId, organizations.id))
      .where(eq(teams.id, teamId))
      .limit(1)

    if (team.length === 0) {
      return res.status(404).json({ message: 'Team not found' })
    }

    // Get team members
    const members = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: teamUsers.role
    })
      .from(teamUsers)
      .innerJoin(users, eq(teamUsers.userId, users.id))
      .where(eq(teamUsers.teamId, teamId))

    res.json({
      team: team[0],
      members,
      userRole: teamMembership[0].role
    })
  } catch (error) {
    console.error('Get team details error:', error)
    res.status(500).json({ message: 'Failed to get team details' })
  }
})

// Create team
router.post('/', async (req, res) => {
  try {
    const { name, organizationId } = req.body
    const userId = req.user!.userId

    if (!name) {
      return res.status(400).json({ message: 'Team name is required' })
    }

    // Create team
    const newTeam = await db.insert(teams)
      .values({
        name,
        organizationId: organizationId || null
      })
      .returning()

    // Add creator as team lead
    await db.insert(teamUsers)
      .values({
        userId,
        teamId: newTeam[0].id,
        role: TeamRole.LEAD // Team lead role
      })

    res.status(201).json({
      message: 'Team created successfully',
      team: newTeam[0]
    })
  } catch (error) {
    console.error('Create team error:', error)
    res.status(500).json({ message: 'Failed to create team' })
  }
})

// Update team
router.put('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const { name } = req.body
    const userId = req.user!.userId

    // Check if user is lead of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, userId),
        eq(teamUsers.role, TeamRole.LEAD) // Team lead role
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Only team leads can update team details' })
    }

    const updatedTeam = await db.update(teams)
      .set({ name })
      .where(eq(teams.id, teamId))
      .returning()

    res.json({
      message: 'Team updated successfully',
      team: updatedTeam[0]
    })
  } catch (error) {
    console.error('Update team error:', error)
    res.status(500).json({ message: 'Failed to update team' })
  }
})

// Add team member
router.post('/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params
    const { userId: newUserId, email, role = TeamRole.MEMBER } = req.body
    const currentUserId = req.user!.userId


    if (!newUserId && !email) {
      return res.status(400).json({ message: 'Either userId or email is required' })
    }

    // Check if current user is lead or contributor of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, currentUserId)
      ))
      .limit(1)


    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this team' })
    }

    // Only team leads and contributors can add members
    if (teamMembership[0].role !== TeamRole.LEAD && teamMembership[0].role !== TeamRole.CONTRIBUTOR) {
      return res.status(403).json({ message: 'Only team leads and contributors can add members' })
    }

    // Get target user ID (either from provided userId or by looking up email)
    let targetUserId = newUserId
    if (!targetUserId && email) {
      const user = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (user.length === 0) {
        return res.status(404).json({ message: 'User with this email not found' })
      }
      targetUserId = user[0].id
    }

    // Check if user is already a member
    const existingMember = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, targetUserId)
      ))
      .limit(1)

    if (existingMember.length > 0) {
      return res.status(400).json({ message: 'User is already a team member' })
    }

    // Add user to team
    const newMember = await db.insert(teamUsers)
      .values({
        userId: targetUserId,
        teamId,
        role,
        createdBy: currentUserId
      })
      .returning()

    // Get user details for response
    const userDetails = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl
    })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)

    res.status(201).json({
      message: 'Member added successfully',
      member: {
        ...newMember[0],
        user: userDetails[0]
      }
    })
  } catch (error) {
    console.error('Add team member error:', error)
    res.status(500).json({ message: 'Failed to add team member' })
  }
})

// Update member role
router.put('/:teamId/members/:memberId', async (req, res) => {
  try {
    const { teamId, memberId } = req.params
    const { role } = req.body
    const currentUserId = req.user!.userId

    // Check if current user is lead of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, currentUserId),
        eq(teamUsers.role, TeamRole.LEAD) // Team lead role
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Only team leads can update member roles' })
    }

    const updatedMember = await db.update(teamUsers)
      .set({ role })
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, memberId)
      ))
      .returning()

    if (updatedMember.length === 0) {
      return res.status(404).json({ message: 'Team member not found' })
    }

    res.json({
      message: 'Member role updated successfully',
      member: updatedMember[0]
    })
  } catch (error) {
    console.error('Update member role error:', error)
    res.status(500).json({ message: 'Failed to update member role' })
  }
})

// Get team members - matches frontend GET /api/teams/{teamId}/members
router.get('/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

    // Check if user is member of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this team' })
    }

    // Get team members
    const members = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: teamUsers.role
    })
      .from(teamUsers)
      .innerJoin(users, eq(teamUsers.userId, users.id))
      .where(eq(teamUsers.teamId, teamId))

    res.json(members)
  } catch (error) {
    console.error('Get team members error:', error)
    res.status(500).json({ message: 'Failed to get team members' })
  }
})

// Remove team member
router.delete('/:teamId/members/:memberId', async (req, res) => {
  try {
    const { teamId, memberId } = req.params
    const currentUserId = req.user!.userId

    // Check if current user is lead of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, currentUserId),
        eq(teamUsers.role, TeamRole.LEAD) // Team lead role
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Only team leads can remove members' })
    }

    await db.delete(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, memberId)
      ))

    res.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Remove team member error:', error)
    res.status(500).json({ message: 'Failed to remove team member' })
  }
})

export default router