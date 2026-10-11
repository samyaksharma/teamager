import express from 'express'
import { eq, and } from 'drizzle-orm'
import { db, teams, teamUsers, users, organizations } from '../db'
import { verifyToken } from '../middleware/auth'
import { TeamRole } from '../types/enums'

const TEAM_ROLE_BY_NAME: Record<string, TeamRole> = {
  viewer: TeamRole.VIEWER,
  member: TeamRole.MEMBER,
  contributor: TeamRole.CONTRIBUTOR,
  lead: TeamRole.LEAD
}

// Accepts the stored number or the role name ('viewer', 'member', 'contributor', 'lead'); null when invalid
const parseTeamRole = (value: unknown): TeamRole | null => {
  if (typeof value === 'string' && value in TEAM_ROLE_BY_NAME) return TEAM_ROLE_BY_NAME[value]
  if (typeof value === 'number' && Object.values(TEAM_ROLE_BY_NAME).includes(value)) return value as TeamRole
  return null
}

const router = express.Router()

router.use(verifyToken)

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

router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

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

router.post('/', async (req, res) => {
  try {
    const { name, organizationId } = req.body
    const userId = req.user!.userId

    if (!name) {
      return res.status(400).json({ message: 'Team name is required' })
    }

    const newTeam = await db.insert(teams)
      .values({
        name,
        organizationId: organizationId || null
      })
      .returning()

    await db.insert(teamUsers)
      .values({
        userId,
        teamId: newTeam[0].id,
        role: TeamRole.LEAD
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

router.put('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const userId = req.user!.userId

    if (!name || name.length > 255) {
      return res.status(400).json({ message: 'Team name is required (max 255 characters)' })
    }

    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, userId),
        eq(teamUsers.role, TeamRole.LEAD)
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

router.post('/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params
    const { userId: newUserId, email, role: requestedRole = TeamRole.MEMBER } = req.body
    const role = parseTeamRole(requestedRole)
    const currentUserId = req.user!.userId

    if (!newUserId && !email) {
      return res.status(400).json({ message: 'Either userId or email is required' })
    }

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

    if (teamMembership[0].role !== TeamRole.LEAD && teamMembership[0].role !== TeamRole.CONTRIBUTOR) {
      return res.status(403).json({ message: 'Only team leads and contributors can add members' })
    }

    // Anyone can be added as a member or viewer; higher roles are granted by leads only
    if (role === null) {
      return res.status(400).json({ message: 'Invalid role' })
    }
    if (role > TeamRole.MEMBER && teamMembership[0].role !== TeamRole.LEAD) {
      return res.status(403).json({ message: 'Only team leads can grant the contributor or lead role' })
    }

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

    const newMember = await db.insert(teamUsers)
      .values({
        userId: targetUserId,
        teamId,
        role,
        createdBy: currentUserId
      })
      .returning()

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

router.put('/:teamId/members/:memberId', async (req, res) => {
  try {
    const { teamId, memberId } = req.params
    const role = parseTeamRole(req.body.role)
    const currentUserId = req.user!.userId

    if (role === null) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, currentUserId),
        eq(teamUsers.role, TeamRole.LEAD)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Only team leads can update member roles' })
    }

    // A team must always keep at least one lead
    if (role !== TeamRole.LEAD) {
      const target = await db.select().from(teamUsers)
        .where(and(eq(teamUsers.teamId, teamId), eq(teamUsers.userId, memberId))).limit(1)
      if (target.length > 0 && target[0].role === TeamRole.LEAD) {
        const leads = await db.select({ id: teamUsers.id }).from(teamUsers)
          .where(and(eq(teamUsers.teamId, teamId), eq(teamUsers.role, TeamRole.LEAD)))
        if (leads.length <= 1) {
          return res.status(400).json({ message: 'A team must have at least one lead' })
        }
      }
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

router.get('/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

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

router.delete('/:teamId/members/:memberId', async (req, res) => {
  try {
    const { teamId, memberId } = req.params
    const currentUserId = req.user!.userId

    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, currentUserId),
        eq(teamUsers.role, TeamRole.LEAD)
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