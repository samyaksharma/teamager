import express from 'express'
import { eq, and, inArray } from 'drizzle-orm'
import { db, users, organizations, organizationUsers, teams, teamUsers, tasks, documents, channels } from '../db'
import { verifyToken } from '../middleware/auth'

const router = express.Router()

// Combined dashboard data endpoint
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    
    // Fetch all dashboard data in parallel for better performance
    const [
      userOrganizations,
      userTeams,
      userTasks,
      userDocuments
    ] = await Promise.all([
      // Get organizations
      db.select({
        id: organizations.id,
        name: organizations.name,
        size: organizations.size,
        industry: organizations.industry,
        role: organizationUsers.role,
        department: organizationUsers.department,
        jobTitle: organizationUsers.jobTitle,
        createdAt: organizations.createdAt
      })
      .from(organizations)
      .innerJoin(organizationUsers, eq(organizations.id, organizationUsers.organizationId))
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.isActive, true)
      )),

      // Get teams
      db.select({
        id: teams.id,
        name: teams.name,
        organizationId: teams.organizationId,
        organizationName: organizations.name,
        role: teamUsers.role,
        createdAt: teams.createdAt
      })
      .from(teams)
      .innerJoin(teamUsers, eq(teams.id, teamUsers.teamId))
      .innerJoin(organizations, eq(teams.organizationId, organizations.id))
      .where(eq(teamUsers.userId, userId)),

      // Get tasks
      db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        assigneeName: users.name,
        organizationName: organizations.name
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(organizations, eq(tasks.organizationId, organizations.id))
      .where(eq(tasks.assignedTo, userId)),

      // Get documents
      db.select({
        id: documents.id,
        title: documents.title,
        teamId: documents.teamId,
        teamName: teams.name,
        authorName: users.name,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt
      })
      .from(documents)
      .leftJoin(teams, eq(documents.teamId, teams.id))
      .leftJoin(users, eq(documents.createdBy, users.id))
      .leftJoin(teamUsers, and(
        eq(teams.id, teamUsers.teamId),
        eq(teamUsers.userId, userId)
      ))
      .where(eq(teamUsers.userId, userId))
    ])

    // Get channels for all user teams
    const teamIds = userTeams.map(team => team.id)
    const teamChannels = teamIds.length > 0 ? await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt
    })
    .from(channels)
    .where(inArray(channels.teamId, teamIds)) : []

    // Group channels by team for easier frontend consumption
    const channelsByTeam = teamChannels.reduce((acc, channel) => {
      if (!acc[channel.teamId]) {
        acc[channel.teamId] = []
      }
      acc[channel.teamId].push(channel)
      return acc
    }, {} as Record<string, typeof teamChannels>)

    res.json({
      organizations: userOrganizations,
      teams: userTeams,
      tasks: userTasks,
      documents: userDocuments,
      channels: channelsByTeam
    })

  } catch (error) {
    console.error('Dashboard data fetch error:', error)
    res.status(500).json({ message: 'Failed to fetch dashboard data' })
  }
})

export default router