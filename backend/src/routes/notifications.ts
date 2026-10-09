import express from 'express'
import { eq, and, desc, isNull, sql } from 'drizzle-orm'
import { db, notifications, notificationSettings, users } from '../db'
import { verifyToken } from '../middleware/auth'

const router = express.Router()

router.use(verifyToken)

const MODULES = ['documents', 'tasks', 'messages'] as const

// List the current user's notifications (activity feed), newest first
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100)

    const [items, unread] = await Promise.all([
      db.select({
        id: notifications.id,
        module: notifications.module,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorName: users.name,
        actorAvatar: users.avatarUrl
      })
        .from(notifications)
        .leftJoin(users, eq(notifications.actorId, users.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit),
      db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    ])

    res.json({ notifications: items, unreadCount: unread[0].count })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Failed to get notifications' })
  }
})

// Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, req.user!.userId), isNull(notifications.readAt)))
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ message: 'Failed to update notifications' })
  }
})

// Get per-module settings
router.get('/settings', async (req, res) => {
  try {
    const row = await db.select().from(notificationSettings)
      .where(eq(notificationSettings.userId, req.user!.userId)).limit(1)
    res.json({
      documents: row[0]?.documents ?? true,
      tasks: row[0]?.tasks ?? true,
      messages: row[0]?.messages ?? true
    })
  } catch (error) {
    console.error('Get notification settings error:', error)
    res.status(500).json({ message: 'Failed to get notification settings' })
  }
})

// Update per-module settings
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user!.userId
    const update: Partial<Record<typeof MODULES[number], boolean>> = {}
    for (const m of MODULES) {
      if (typeof req.body[m] === 'boolean') update[m] = req.body[m]
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No settings provided' })
    }

    const [row] = await db.insert(notificationSettings)
      .values({ userId, ...update })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: update })
      .returning()
    res.json({ documents: row.documents, tasks: row.tasks, messages: row.messages })
  } catch (error) {
    console.error('Update notification settings error:', error)
    res.status(500).json({ message: 'Failed to update notification settings' })
  }
})

// Mark one as read
router.put('/:id/read', async (req, res) => {
  try {
    const updated = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.userId)))
      .returning({ id: notifications.id })
    if (updated.length === 0) {
      return res.status(404).json({ message: 'Notification not found' })
    }
    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Failed to update notification' })
  }
})

export default router
