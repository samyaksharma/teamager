import express from 'express'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'
import { db, tasks, taskTeams, taskChecklistItems, teamUsers, users } from '../db'
import { verifyToken } from '../middleware/auth'
import { notify } from '../utils/inAppNotifications'

// Checklists and sub-items for a task. Mounted on /api/tasks next to the main task routes.
const router = express.Router()

router.use(verifyToken)

// Same access rule as the task routes: creator, assignee, or a member of one of the task's teams
async function loadAccessibleTask(taskId: string, userId: string) {
  const found = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
  if (found.length === 0) return { status: 404, message: 'Task not found' } as const
  const task = found[0]

  let hasAccess = task.createdBy === userId || task.assignedTo === userId
  if (!hasAccess) {
    const myTeams = (await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId)))
      .map(t => t.teamId)
    if (myTeams.length > 0) {
      const link = await db.select().from(taskTeams)
        .where(and(eq(taskTeams.taskId, taskId), inArray(taskTeams.teamId, myTeams))).limit(1)
      hasAccess = link.length > 0
    }
  }
  if (!hasAccess) return { status: 403, message: 'Access denied to this task' } as const
  return { task } as const
}

// ---- Checklist ----

router.get('/:taskId/checklist', async (req, res) => {
  try {
    const access = await loadAccessibleTask(req.params.taskId, req.user!.userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const items = await db.select().from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, req.params.taskId))
      .orderBy(asc(taskChecklistItems.position), asc(taskChecklistItems.createdAt))
    res.json(items)
  } catch (error) {
    console.error('Get checklist error:', error)
    res.status(500).json({ message: 'Failed to get checklist' })
  }
})

router.post('/:taskId/checklist', async (req, res) => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : ''
    if (!content || content.length > 500) {
      return res.status(400).json({ message: 'Checklist item text is required (max 500 characters)' })
    }
    const access = await loadAccessibleTask(req.params.taskId, req.user!.userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const last = await db.select({ max: sql<number>`coalesce(max(${taskChecklistItems.position}), -1)::int` })
      .from(taskChecklistItems).where(eq(taskChecklistItems.taskId, req.params.taskId))

    const [item] = await db.insert(taskChecklistItems)
      .values({ taskId: req.params.taskId, content, position: last[0].max + 1 })
      .returning()
    res.status(201).json(item)
  } catch (error) {
    console.error('Add checklist item error:', error)
    res.status(500).json({ message: 'Failed to add checklist item' })
  }
})

router.put('/:taskId/checklist/:itemId', async (req, res) => {
  try {
    const access = await loadAccessibleTask(req.params.taskId, req.user!.userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const update: { content?: string; done?: boolean } = {}
    if (typeof req.body.done === 'boolean') update.done = req.body.done
    if (typeof req.body.content === 'string') {
      const content = req.body.content.trim()
      if (!content || content.length > 500) {
        return res.status(400).json({ message: 'Checklist item text is required (max 500 characters)' })
      }
      update.content = content
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No update data provided' })
    }

    const updated = await db.update(taskChecklistItems).set(update)
      .where(and(eq(taskChecklistItems.id, req.params.itemId), eq(taskChecklistItems.taskId, req.params.taskId)))
      .returning()
    if (updated.length === 0) return res.status(404).json({ message: 'Checklist item not found' })
    res.json(updated[0])
  } catch (error) {
    console.error('Update checklist item error:', error)
    res.status(500).json({ message: 'Failed to update checklist item' })
  }
})

router.delete('/:taskId/checklist/:itemId', async (req, res) => {
  try {
    const access = await loadAccessibleTask(req.params.taskId, req.user!.userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const removed = await db.delete(taskChecklistItems)
      .where(and(eq(taskChecklistItems.id, req.params.itemId), eq(taskChecklistItems.taskId, req.params.taskId)))
      .returning({ id: taskChecklistItems.id })
    if (removed.length === 0) return res.status(404).json({ message: 'Checklist item not found' })
    res.json({ message: 'Checklist item deleted' })
  } catch (error) {
    console.error('Delete checklist item error:', error)
    res.status(500).json({ message: 'Failed to delete checklist item' })
  }
})

// ---- Sub-items (child tasks, one level deep) ----

router.get('/:taskId/subtasks', async (req, res) => {
  try {
    const access = await loadAccessibleTask(req.params.taskId, req.user!.userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const children = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      assignedTo: tasks.assignedTo,
      assigneeName: users.name
    })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(eq(tasks.parentId, req.params.taskId))
      .orderBy(asc(tasks.createdAt))
    res.json(children)
  } catch (error) {
    console.error('Get subtasks error:', error)
    res.status(500).json({ message: 'Failed to get sub-items' })
  }
})

router.post('/:taskId/subtasks', async (req, res) => {
  try {
    const userId = req.user!.userId
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    if (!title || title.length > 255) {
      return res.status(400).json({ message: 'Sub-item title is required (max 255 characters)' })
    }
    const assignedTo: string | null = req.body.assignedTo || null

    const access = await loadAccessibleTask(req.params.taskId, userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })
    const parent = access.task
    if (parent.parentId) {
      return res.status(400).json({ message: 'Sub-items cannot have their own sub-items' })
    }

    const [child] = await db.insert(tasks).values({
      title,
      priority: parent.priority,
      organizationId: parent.organizationId,
      assignedTo,
      createdBy: userId,
      parentId: parent.id
    }).returning()

    // Inherit the parent's teams so the same people can see it
    const parentTeams = await db.select({ teamId: taskTeams.teamId }).from(taskTeams).where(eq(taskTeams.taskId, parent.id))
    if (parentTeams.length > 0) {
      await db.insert(taskTeams).values(parentTeams.map(t => ({ taskId: child.id, teamId: t.teamId })))
    }

    if (assignedTo) {
      await notify({ userId: assignedTo, actorId: userId, module: 'tasks', type: 'task_assigned', title: 'assigned you a task', body: title, link: '/dashboard/tasks' })
    }

    const assignee = assignedTo
      ? (await db.select({ name: users.name }).from(users).where(eq(users.id, assignedTo)).limit(1))[0]
      : undefined
    res.status(201).json({
      id: child.id, title: child.title, status: child.status, assignedTo: child.assignedTo, assigneeName: assignee?.name ?? null
    })
  } catch (error) {
    console.error('Create subtask error:', error)
    res.status(500).json({ message: 'Failed to create sub-item' })
  }
})

export default router
