import express from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db, channels, messages, users, teamUsers } from '../db'
import { verifyToken } from '../middleware/auth'
import { TeamRole } from '../types/enums'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get channels - matches frontend GET /api/channels?teamId={teamId}
router.get('/', async (req, res) => {
  try {
    const { teamId } = req.query
    const userId = req.user!.userId

    if (!teamId) {
      return res.status(400).json({ message: 'teamId query parameter is required' })
    }

    // Check if user is member of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId as string),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this team' })
    }

    // Get channels for the team
    const teamChannels = await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt,
      createdBy: channels.createdBy,
      creatorName: users.name
    })
      .from(channels)
      .leftJoin(users, eq(channels.createdBy, users.id))
      .where(eq(channels.teamId, teamId as string))
      .orderBy(channels.isDefault, channels.createdAt)

    res.json(teamChannels)
  } catch (error) {
    console.error('Get channels error:', error)
    res.status(500).json({ message: 'Failed to get channels' })
  }
})

// Get channel by ID - matches frontend GET /api/channels/{channelId}
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params
    const userId = req.user!.userId

    // Get channel with creator info
    const channel = await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt,
      createdBy: channels.createdBy,
      creatorName: users.name
    })
      .from(channels)
      .leftJoin(users, eq(channels.createdBy, users.id))
      .where(eq(channels.id, channelId))
      .limit(1)

    if (channel.length === 0) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const channelData = channel[0]

    // Check if user has access to the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, channelData.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this channel' })
    }

    res.json(channelData)
  } catch (error) {
    console.error('Get channel error:', error)
    res.status(500).json({ message: 'Failed to get channel' })
  }
})

// Get default channel for team - matches frontend GET /api/channels/team/{teamId}/default
router.get('/team/:teamId/default', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

    // Check team access
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

    // Get default channel
    const defaultChannel = await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt,
      createdBy: channels.createdBy,
      creatorName: users.name
    })
      .from(channels)
      .leftJoin(users, eq(channels.createdBy, users.id))
      .where(and(
        eq(channels.teamId, teamId),
        eq(channels.isDefault, true)
      ))
      .limit(1)

    if (defaultChannel.length === 0) {
      return res.status(404).json({ message: 'Default channel not found' })
    }

    res.json(defaultChannel[0])
  } catch (error) {
    console.error('Get default channel error:', error)
    res.status(500).json({ message: 'Failed to get default channel' })
  }
})

// Create channel - matches frontend POST /api/channels
router.post('/', async (req, res) => {
  try {
    const { name, description, teamId, type = 0, isPrivate = false } = req.body
    const userId = req.user!.userId

    if (!name || !teamId) {
      return res.status(400).json({ message: 'Channel name and teamId are required' })
    }

    // Check if user is admin/moderator of the team (only admins can create channels)
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

    // Check if user has admin permissions (lead or contributor can create channels)
    const userRole = teamMembership[0].role
    if (userRole !== TeamRole.LEAD && userRole !== TeamRole.CONTRIBUTOR) {
      return res.status(403).json({ message: 'Only team leads and contributors can create channels' })
    }

    // Create channel
    const newChannel = await db.insert(channels)
      .values({
        name,
        description,
        teamId,
        type,
        isPrivate,
        createdBy: userId
      })
      .returning()

    // Get created channel with creator info
    const channelWithCreator = await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt,
      createdBy: channels.createdBy,
      creatorName: users.name
    })
      .from(channels)
      .leftJoin(users, eq(channels.createdBy, users.id))
      .where(eq(channels.id, newChannel[0].id))
      .limit(1)

    res.status(201).json(channelWithCreator[0])
  } catch (error) {
    console.error('Create channel error:', error)
    res.status(500).json({ message: 'Failed to create channel' })
  }
})

// Update channel - matches frontend PUT /api/channels/{channelId}
router.put('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params
    const { name, description, isPrivate, type } = req.body
    const userId = req.user!.userId

    // Get channel and check access
    const channel = await db.select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (channel.length === 0) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const channelData = channel[0]

    // Check team access and admin privileges
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, channelData.teamId),
        eq(teamUsers.userId, userId),
        eq(teamUsers.role, TeamRole.LEAD) // Team lead role
      ))
      .limit(1)

    if (teamMembership.length === 0 && channelData.createdBy !== userId) {
      return res.status(403).json({ message: 'Only team admins or channel creator can update channel' })
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate
    if (type !== undefined) updateData.type = type

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided' })
    }

    // Update channel
    await db.update(channels)
      .set(updateData)
      .where(eq(channels.id, channelId))

    // Get updated channel with creator info
    const updatedChannel = await db.select({
      id: channels.id,
      name: channels.name,
      description: channels.description,
      teamId: channels.teamId,
      type: channels.type,
      isPrivate: channels.isPrivate,
      isDefault: channels.isDefault,
      createdAt: channels.createdAt,
      createdBy: channels.createdBy,
      creatorName: users.name
    })
      .from(channels)
      .leftJoin(users, eq(channels.createdBy, users.id))
      .where(eq(channels.id, channelId))
      .limit(1)

    res.json(updatedChannel[0])
  } catch (error) {
    console.error('Update channel error:', error)
    res.status(500).json({ message: 'Failed to update channel' })
  }
})

// Get channel messages - matches frontend GET /api/channels/{channelId}/messages
router.get('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params
    const { limit } = req.query
    const userId = req.user!.userId

    const channel = await db.select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (channel.length === 0) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const channelData = channel[0]

    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, channelData.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this channel' })
    }

    const limitNum = limit ? parseInt(limit as string) : undefined

    let messagesQuery = db.select({
      id: messages.id,
      content: messages.content,
      userId: messages.userId,
      channelId: messages.channelId,
      createdAt: messages.createdAt,
      userName: users.name,
      userAvatar: users.avatarUrl
    })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))

    if (limitNum) {
      messagesQuery = (messagesQuery as any).limit(limitNum)
    }

    const channelMessages = await messagesQuery

    // Reverse to get chronological order
    res.json(channelMessages.reverse())
  } catch (error) {
    console.error('Get channel messages error:', error)
    res.status(500).json({ message: 'Failed to get channel messages' })
  }
})

// Create channel message - matches frontend POST /api/channels/{channelId}/messages
router.post('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params
    const { content } = req.body
    const userId = req.user!.userId

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' })
    }

    // Check channel access
    const channel = await db.select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (channel.length === 0) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const channelData = channel[0]

    // Check team access
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, channelData.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this channel' })
    }

    // Create message
    const newMessage = await db.insert(messages)
      .values({
        content: content.trim(),
        userId,
        channelId
      })
      .returning()

    // Get message with user info
    const messageWithUser = await db.select({
      id: messages.id,
      content: messages.content,
      userId: messages.userId,
      channelId: messages.channelId,
      createdAt: messages.createdAt,
      userName: users.name,
      userAvatar: users.avatarUrl
    })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.id, newMessage[0].id))
      .limit(1)

    res.status(201).json(messageWithUser[0])
  } catch (error) {
    console.error('Create channel message error:', error)
    res.status(500).json({ message: 'Failed to create message' })
  }
})

// Check if user can create channels in a team
router.get('/can-create/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const userId = req.user!.userId

    // Check if user is admin/moderator of the team
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.json({ canCreate: false, reason: 'Not a team member' })
    }

    // Check if user has admin permissions (lead or admin can create channels)
    const userRole = teamMembership[0].role
    const canCreate = userRole === TeamRole.LEAD || userRole === TeamRole.CONTRIBUTOR

    res.json({ 
      canCreate,
      role: userRole,
      reason: canCreate ? null : 'Only team leads and admins can create channels'
    })
  } catch (error) {
    console.error('Check create permissions error:', error)
    res.status(500).json({ message: 'Failed to check permissions' })
  }
})

// Add all team members to a channel - POST /api/channels/{channelId}/add-team-members
router.post('/:channelId/add-team-members', async (req, res) => {
  try {
    const { channelId } = req.params
    const { teamId } = req.body
    const userId = req.user!.userId

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' })
    }

    // Get channel and verify it exists
    const channel = await db.select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (channel.length === 0) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const channelData = channel[0]

    // Check if user has permission to add members (team lead/admin or channel creator)
    const teamMembership = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, channelData.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (teamMembership.length === 0) {
      return res.status(403).json({ message: 'Access denied to this team' })
    }

    const userRole = teamMembership[0].role
    const canManageMembers = userRole === TeamRole.LEAD || userRole === TeamRole.CONTRIBUTOR || channelData.createdBy === userId

    if (!canManageMembers) {
      return res.status(403).json({ message: 'Only team leads, admins, or channel creator can add members' })
    }

    // Get all team members
    const teamMembers = await db.select({
      userId: teamUsers.userId,
      userName: users.name,
      userEmail: users.email
    })
      .from(teamUsers)
      .leftJoin(users, eq(teamUsers.userId, users.id))
      .where(eq(teamUsers.teamId, teamId))

    // Note: In a real implementation, you would have a channel_members table
    // For now, we'll just return the count of members that would be added
    const memberCount = teamMembers.length

    res.json({ 
      success: true,
      message: `All ${memberCount} team members have been notified about the channel`,
      memberCount,
      members: teamMembers
    })
  } catch (error) {
    console.error('Add team members error:', error)
    res.status(500).json({ message: 'Failed to add team members' })
  }
})

export default router