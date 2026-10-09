import express from 'express'
import { and, or, eq, desc, isNull, inArray, ilike, gte, lte, sql, SQL } from 'drizzle-orm'
import {
  db, documents, documentRoles, tasks, taskTeams, messages, channels, directMessages, teamUsers, users, teams
} from '../db'
import { verifyToken } from '../middleware/auth'

const router = express.Router()

router.use(verifyToken)

const TYPES = ['documents', 'tasks', 'messages'] as const
type SearchType = typeof TYPES[number]

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&')

// Document content is stored as editor JSON/HTML, so reduce it to plain text before building a snippet
const toPlainText = (raw: string) =>
  raw.replace(/<[^>]+>/g, ' ').replace(/[{}\[\]"\\]+/g, ' ').replace(/\s+/g, ' ').trim()

function snippet(raw: string | null, query: string, length = 140) {
  if (!raw) return null
  const text = toPlainText(raw)
  if (!text) return null
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : 0
  if (query && at === -1) return null
  const start = Math.max(0, at - 40)
  const piece = text.slice(start, start + length)
  return `${start > 0 ? '...' : ''}${piece}${start + length < text.length ? '...' : ''}`
}

const parseDate = (value: unknown, endOfDay = false) => {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999)
  return date
}

// Global search across documents, tasks and messages the user can access.
// With no query it returns suggestions: recent activity and tasks assigned to the user.
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.min(parseInt(req.query.limit as string) || (query ? 10 : 5), 25)
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to, true)
    const participant = typeof req.query.participant === 'string' && req.query.participant ? req.query.participant : null

    const requested = typeof req.query.types === 'string' && req.query.types
      ? (req.query.types as string).split(',').filter((t): t is SearchType => (TYPES as readonly string[]).includes(t))
      : [...TYPES]
    const wants = (type: SearchType) => requested.includes(type)

    const myTeams = (await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId)))
      .map(t => t.teamId)
    const like = query ? `%${escapeLike(query)}%` : null

    // ---- Documents ----
    const searchDocuments = async () => {
      const access: SQL[] = [eq(documents.createdBy, userId), eq(documents.ownerId, userId)]
      if (myTeams.length > 0) access.push(inArray(documents.teamId, myTeams))
      access.push(sql`exists (select 1 from ${documentRoles} where ${documentRoles.documentId} = ${documents.id} and ${documentRoles.userId} = ${userId})`)
      if (myTeams.length > 0) {
        access.push(sql`exists (select 1 from ${documentRoles} where ${documentRoles.documentId} = ${documents.id} and ${inArray(documentRoles.teamId, myTeams)})`)
      }

      const conditions: (SQL | undefined)[] = [isNull(documents.deletedAt), or(...access)]
      if (like) conditions.push(or(ilike(documents.title, like), ilike(documents.content, like)))
      if (from) conditions.push(gte(documents.updatedAt, from))
      if (to) conditions.push(lte(documents.updatedAt, to))
      if (participant) conditions.push(or(eq(documents.createdBy, participant), eq(documents.updatedBy, participant)))

      const rows = await db.select({
        id: documents.id,
        title: documents.title,
        content: documents.content,
        updatedAt: documents.updatedAt,
        authorName: users.name,
        teamName: teams.name
      })
        .from(documents)
        .leftJoin(users, eq(documents.createdBy, users.id))
        .leftJoin(teams, eq(documents.teamId, teams.id))
        .where(and(...conditions))
        .orderBy(desc(documents.updatedAt))
        .limit(limit)

      return rows.map(({ content, ...doc }) => ({ ...doc, snippet: snippet(content, query) }))
    }

    // ---- Tasks ----
    const searchTasks = async () => {
      const teamTaskIds = myTeams.length > 0
        ? (await db.select({ taskId: taskTeams.taskId }).from(taskTeams).where(inArray(taskTeams.teamId, myTeams))).map(t => t.taskId)
        : []

      const access: SQL[] = [
        eq(tasks.assignedTo, userId),
        and(eq(tasks.createdBy, userId), isNull(tasks.organizationId))!
      ]
      if (teamTaskIds.length > 0) access.push(inArray(tasks.id, teamTaskIds))

      const conditions: (SQL | undefined)[] = [isNull(tasks.deletedAt), or(...access)]
      if (like) conditions.push(or(ilike(tasks.title, like), ilike(tasks.description, like)))
      if (from) conditions.push(gte(tasks.createdAt, from))
      if (to) conditions.push(lte(tasks.createdAt, to))
      if (participant) conditions.push(or(eq(tasks.createdBy, participant), eq(tasks.assignedTo, participant)))

      const rows = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        assignedTo: tasks.assignedTo,
        assigneeName: users.name
      })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .where(and(...conditions))
        // Suggestions: tasks assigned to the user come first
        .orderBy(...(query ? [] : [sql`(${tasks.assignedTo} = ${userId}) desc`]), desc(tasks.createdAt))
        .limit(limit)

      return rows.map(({ description, ...task }) => ({ ...task, snippet: snippet(description, query) }))
    }

    // ---- Messages (channels in the user's teams + the user's direct messages) ----
    const searchMessages = async () => {
      const channelConditions: (SQL | undefined)[] = [
        myTeams.length > 0 ? inArray(channels.teamId, myTeams) : sql`1=0`
      ]
      if (like) channelConditions.push(ilike(messages.content, like))
      if (from) channelConditions.push(gte(messages.createdAt, from))
      if (to) channelConditions.push(lte(messages.createdAt, to))
      if (participant) channelConditions.push(eq(messages.userId, participant))

      const channelRows = await db.select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        channelId: channels.id,
        channelName: channels.name,
        authorName: users.name
      })
        .from(messages)
        .innerJoin(channels, eq(messages.channelId, channels.id))
        .leftJoin(users, eq(messages.userId, users.id))
        .where(and(...channelConditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit)

      const dmConditions: (SQL | undefined)[] = [
        or(eq(directMessages.senderId, userId), eq(directMessages.receiverId, userId)),
        isNull(directMessages.deletedAt)
      ]
      if (like) dmConditions.push(ilike(directMessages.content, like))
      if (from) dmConditions.push(gte(directMessages.createdAt, from))
      if (to) dmConditions.push(lte(directMessages.createdAt, to))
      if (participant) dmConditions.push(or(eq(directMessages.senderId, participant), eq(directMessages.receiverId, participant)))

      const dmRows = await db.select({
        id: directMessages.id,
        content: directMessages.content,
        createdAt: directMessages.createdAt,
        senderId: directMessages.senderId,
        receiverId: directMessages.receiverId,
        authorName: users.name
      })
        .from(directMessages)
        .leftJoin(users, eq(directMessages.senderId, users.id))
        .where(and(...dmConditions))
        .orderBy(desc(directMessages.createdAt))
        .limit(limit)

      const merged = [
        ...channelRows.map(m => ({
          id: m.id,
          kind: 'channel' as const,
          content: m.content,
          createdAt: m.createdAt,
          authorName: m.authorName,
          channelId: m.channelId,
          channelName: m.channelName,
          contactId: null as string | null
        })),
        ...dmRows.map(m => ({
          id: m.id,
          kind: 'direct' as const,
          content: m.content,
          createdAt: m.createdAt,
          authorName: m.authorName,
          channelId: null as string | null,
          channelName: null as string | null,
          contactId: m.senderId === userId ? m.receiverId : m.senderId
        }))
      ]
      return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)
    }

    const [documentResults, taskResults, messageResults] = await Promise.all([
      wants('documents') ? searchDocuments() : [],
      wants('tasks') ? searchTasks() : [],
      wants('messages') ? searchMessages() : []
    ])

    res.json({
      query,
      suggestions: !query,
      documents: documentResults,
      tasks: taskResults,
      messages: messageResults
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ message: 'Search failed' })
  }
})

export default router
