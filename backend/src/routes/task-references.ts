import express from 'express'
import { eq, and, asc, inArray, isNull } from 'drizzle-orm'
import { db, documents, messages, channels, users, tasks, taskReferences, teamUsers } from '../db'
import { verifyToken } from '../middleware/auth'
import { checkDocumentAccess } from '../utils/permissions'
import { loadTaskForUser, visibleTaskIds } from '../utils/taskAccess'
import { DocumentRole } from '../types/enums'

// Links between tasks and documents / channel messages. Mounted on /api, so each route carries its own auth.
const router = express.Router()

const KINDS = ['document', 'message'] as const
type Kind = typeof KINDS[number]

// Can the user see this document or message?
async function canSeeTarget(kind: Kind, targetId: string, userId: string): Promise<boolean> {
  if (kind === 'document') {
    return checkDocumentAccess(targetId, userId, DocumentRole.VIEWER)
  }
  const found = await db.select({ teamId: channels.teamId })
    .from(messages).innerJoin(channels, eq(messages.channelId, channels.id))
    .where(eq(messages.id, targetId)).limit(1)
  if (found.length === 0) return false
  const member = await db.select({ id: teamUsers.id }).from(teamUsers)
    .where(and(eq(teamUsers.teamId, found[0].teamId), eq(teamUsers.userId, userId))).limit(1)
  return member.length > 0
}

// Items a task links to, resolved to something displayable. Targets the user can't see are left out.
router.get('/tasks/:taskId/references', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const access = await loadTaskForUser(req.params.taskId, userId)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const refs = await db.select().from(taskReferences)
      .where(eq(taskReferences.taskId, req.params.taskId)).orderBy(asc(taskReferences.createdAt))

    const docIds = refs.filter(r => r.kind === 'document').map(r => r.targetId)
    const msgIds = refs.filter(r => r.kind === 'message').map(r => r.targetId)

    const docs = docIds.length > 0
      ? await db.select({ id: documents.id, title: documents.title }).from(documents).where(inArray(documents.id, docIds))
      : []
    const msgs = msgIds.length > 0
      ? await db.select({
          id: messages.id, content: messages.content, createdAt: messages.createdAt,
          channelId: channels.id, channelName: channels.name, teamId: channels.teamId, authorName: users.name
        })
          .from(messages)
          .innerJoin(channels, eq(messages.channelId, channels.id))
          .leftJoin(users, eq(messages.userId, users.id))
          .where(inArray(messages.id, msgIds))
      : []
    const myTeams = new Set((await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId))).map(t => t.teamId))

    const out = []
    for (const ref of refs) {
      if (ref.kind === 'document') {
        const doc = docs.find(d => d.id === ref.targetId)
        if (doc && await checkDocumentAccess(doc.id, userId, DocumentRole.VIEWER)) {
          out.push({ id: ref.id, kind: 'document', targetId: doc.id, title: doc.title })
        }
      } else {
        const msg = msgs.find(m => m.id === ref.targetId)
        if (msg && myTeams.has(msg.teamId)) {
          out.push({
            id: ref.id, kind: 'message', targetId: msg.id, content: msg.content.slice(0, 160),
            channelId: msg.channelId, channelName: msg.channelName, authorName: msg.authorName, createdAt: msg.createdAt
          })
        }
      }
    }
    res.json(out)
  } catch (error) {
    console.error('Get task references error:', error)
    res.status(500).json({ message: 'Failed to get linked items' })
  }
})

router.post('/tasks/:taskId/references', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const { kind, targetId } = req.body
    if (!KINDS.includes(kind) || typeof targetId !== 'string' || !/^[0-9a-f-]{36}$/i.test(targetId)) {
      return res.status(400).json({ message: 'kind must be "document" or "message" and targetId a valid id' })
    }

    const access = await loadTaskForUser(req.params.taskId, userId, true)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    if (!(await canSeeTarget(kind, targetId, userId))) {
      return res.status(404).json({ message: `${kind === 'document' ? 'Document' : 'Message'} not found` })
    }

    const [ref] = await db.insert(taskReferences)
      .values({ taskId: req.params.taskId, kind, targetId, createdBy: userId })
      .onConflictDoNothing()
      .returning()
    if (!ref) return res.status(409).json({ message: 'Already linked' })
    res.status(201).json(ref)
  } catch (error) {
    console.error('Add task reference error:', error)
    res.status(500).json({ message: 'Failed to link item' })
  }
})

router.delete('/tasks/:taskId/references/:refId', verifyToken, async (req, res) => {
  try {
    const access = await loadTaskForUser(req.params.taskId, req.user!.userId, true)
    if (access.status !== undefined) return res.status(access.status).json({ message: access.message })

    const removed = await db.delete(taskReferences)
      .where(and(eq(taskReferences.id, req.params.refId), eq(taskReferences.taskId, req.params.taskId)))
      .returning({ id: taskReferences.id })
    if (removed.length === 0) return res.status(404).json({ message: 'Link not found' })
    res.json({ message: 'Link removed' })
  } catch (error) {
    console.error('Remove task reference error:', error)
    res.status(500).json({ message: 'Failed to remove link' })
  }
})

// Tasks linked to a document (the ones the user can see)
router.get('/documents/:docId/tasks', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const { docId } = req.params
    if (!(await checkDocumentAccess(docId, userId, DocumentRole.VIEWER))) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const rows = await db.select({ refId: taskReferences.id, id: tasks.id, title: tasks.title, status: tasks.status })
      .from(taskReferences)
      .innerJoin(tasks, eq(tasks.id, taskReferences.taskId))
      .where(and(eq(taskReferences.kind, 'document'), eq(taskReferences.targetId, docId), isNull(tasks.deletedAt)))
      .orderBy(asc(taskReferences.createdAt))
    const visible = await visibleTaskIds(userId, rows.map(r => r.id))
    res.json(rows.filter(r => visible.has(r.id)))
  } catch (error) {
    console.error('Get document tasks error:', error)
    res.status(500).json({ message: 'Failed to get linked tasks' })
  }
})

export default router
