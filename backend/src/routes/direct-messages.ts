import express from 'express'
import { eq, and, or, desc, sql, isNull } from 'drizzle-orm'
import { db, directMessages, users } from '../db'
import { verifyToken } from '../middleware/auth'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get direct messages - matches frontend GET /api/direct-messages
router.get('/', async (req, res) => {
  try {
    const { limit } = req.query
    const userId = req.user!.userId

    // Get all direct messages for the user
    const limitNum = limit ? parseInt(limit as string) : undefined
    
    let messagesQuery = db.select({
      id: directMessages.id,
      content: directMessages.content,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      deletedAt: directMessages.deletedAt,
      senderName: users.name,
      senderAvatar: users.avatarUrl
    })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(
        and(
          or(
            eq(directMessages.senderId, userId),
            eq(directMessages.receiverId, userId)
          ),
          isNull(directMessages.deletedAt)
        )
      )
      .orderBy(desc(directMessages.createdAt))

    if (limitNum) {
      messagesQuery = (messagesQuery as any).limit(limitNum)
    }

    const messages = await messagesQuery

    res.json(messages)
  } catch (error) {
    console.error('Get direct messages error:', error)
    res.status(500).json({ message: 'Failed to get direct messages' })
  }
})

// Get unread direct messages - matches frontend GET /api/direct-messages/unread
router.get('/unread', async (req, res) => {
  try {
    const userId = req.user!.userId

    const unreadMessages = await db.select({
      id: directMessages.id,
      content: directMessages.content,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      deletedAt: directMessages.deletedAt,
      senderName: users.name,
      senderAvatar: users.avatarUrl
    })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(
        and(
          eq(directMessages.receiverId, userId),
          isNull(directMessages.readAt),
          isNull(directMessages.deletedAt)
        )
      )
      .orderBy(desc(directMessages.createdAt))

    res.json(unreadMessages)
  } catch (error) {
    console.error('Get unread messages error:', error)
    res.status(500).json({ message: 'Failed to get unread messages' })
  }
})

// Get messages with specific user - matches frontend GET /api/direct-messages/user/{userId}
router.get('/user/:otherUserId', async (req, res) => {
  try {
    const { otherUserId } = req.params
    const { limit } = req.query
    const userId = req.user!.userId

    // Verify the other user exists
    const otherUser = await db.select()
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1)

    if (otherUser.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get conversation between the two users
    const limitNum = limit ? parseInt(limit as string) : undefined
    
    let messagesQuery = db.select({
      id: directMessages.id,
      content: directMessages.content,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      deletedAt: directMessages.deletedAt,
      senderName: users.name,
      senderAvatar: users.avatarUrl
    })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(
        and(
          or(
            and(
              eq(directMessages.senderId, userId),
              eq(directMessages.receiverId, otherUserId)
            ),
            and(
              eq(directMessages.senderId, otherUserId),
              eq(directMessages.receiverId, userId)
            )
          ),
          isNull(directMessages.deletedAt)
        )
      )
      .orderBy(desc(directMessages.createdAt))

    if (limitNum) {
      messagesQuery = (messagesQuery as any).limit(limitNum)
    }

    const conversation = await messagesQuery

    // Reverse to get chronological order
    res.json(conversation.reverse())
  } catch (error) {
    console.error('Get user conversation error:', error)
    res.status(500).json({ message: 'Failed to get conversation' })
  }
})

// Send message to user - matches frontend POST /api/direct-messages/user/{userId}
router.post('/user/:receiverId', async (req, res) => {
  try {
    const { receiverId } = req.params
    const { content } = req.body
    const userId = req.user!.userId

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' })
    }

    if (receiverId === userId) {
      return res.status(400).json({ message: 'Cannot send message to yourself' })
    }

    // Verify receiver exists
    const receiver = await db.select()
      .from(users)
      .where(eq(users.id, receiverId))
      .limit(1)

    if (receiver.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' })
    }

    // Create message
    const newMessage = await db.insert(directMessages)
      .values({
        content: content.trim(),
        senderId: userId,
        receiverId
      })
      .returning()

    // Get message with sender info
    const messageWithSender = await db.select({
      id: directMessages.id,
      content: directMessages.content,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      deletedAt: directMessages.deletedAt,
      senderName: users.name,
      senderAvatar: users.avatarUrl
    })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(eq(directMessages.id, newMessage[0].id))
      .limit(1)

    res.status(201).json(messageWithSender[0])
  } catch (error) {
    console.error('Send direct message error:', error)
    res.status(500).json({ message: 'Failed to send message' })
  }
})

// Mark message as read - matches frontend PUT /api/direct-messages/{messageId}/read
router.put('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params
    const userId = req.user!.userId

    // Get message and verify user is the receiver
    const message = await db.select()
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1)

    if (message.length === 0) {
      return res.status(404).json({ message: 'Message not found' })
    }

    if (message[0].receiverId !== userId) {
      return res.status(403).json({ message: 'You can only mark messages addressed to you as read' })
    }

    // Mark as read
    const updatedMessage = await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(eq(directMessages.id, messageId))
      .returning()

    res.json({ message: 'Message marked as read', data: updatedMessage[0] })
  } catch (error) {
    console.error('Mark message as read error:', error)
    res.status(500).json({ message: 'Failed to mark message as read' })
  }
})

// Mark all messages from user as read - matches frontend PUT /api/direct-messages/user/{userId}/read-all
router.put('/user/:senderId/read-all', async (req, res) => {
  try {
    const { senderId } = req.params
    const userId = req.user!.userId

    // Verify sender exists
    const sender = await db.select()
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1)

    if (sender.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Mark all unread messages from this sender as read
    await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessages.receiverId, userId),
          eq(directMessages.senderId, senderId),
          isNull(directMessages.readAt)
        )
      )

    res.json({ message: 'All messages marked as read' })
  } catch (error) {
    console.error('Mark all messages as read error:', error)
    res.status(500).json({ message: 'Failed to mark messages as read' })
  }
})

// Delete message - matches frontend DELETE /api/direct-messages/{messageId}
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params
    const userId = req.user!.userId

    // Get message and verify user is the sender
    const message = await db.select()
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1)

    if (message.length === 0) {
      return res.status(404).json({ message: 'Message not found' })
    }

    if (message[0].senderId !== userId) {
      return res.status(403).json({ message: 'You can only delete messages you sent' })
    }

    // Soft delete the message
    const deletedMessage = await db.update(directMessages)
      .set({ deletedAt: new Date(), deletedBy: userId })
      .where(eq(directMessages.id, messageId))
      .returning()

    res.json({ message: 'Message deleted successfully', data: deletedMessage[0] })
  } catch (error) {
    console.error('Delete message error:', error)
    res.status(500).json({ message: 'Failed to delete message' })
  }
})

export default router